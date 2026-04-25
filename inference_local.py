"""
==============================================================
  Mammo-CLIP — Inférence + GradCAM++  [FIXED v4]
==============================================================

PROBLEME FONDAMENTAL IDENTIFIE :
  Le modèle EfficientNet-B5 fine-tuné utilise le profil du bord
  du sein / mamelon comme feature discriminante principale.
  Toute méthode CAM (GradCAM, EigenCAM) va donc activer ce bord.

STRATEGIE v4 :
  1. Erosion TRES agressive du masque sein (15% taille, 4 iter)
     → exclut physiquement mamelon + ~75px de bord tout autour
  2. GradCAM++ sur couche intermédiaire _blocks[-8]
     → meilleure résolution spatiale, moins biaisé vers la sortie
  3. Multi-scale CAM : moyenne sur 3 couches différentes
     → réduit la dépendance à une seule couche biaisée
  4. Suppression des activations corrélées au contour du sein :
     on calcule un "edge map" du contour du sein et on soustrait
     cette contribution de la heatmap finale
==============================================================
"""

import sys
from unittest.mock import MagicMock
sys.modules['albumentations']                           = MagicMock()
sys.modules['albumentations.pytorch']                   = MagicMock()
sys.modules['albumentations.core']                      = MagicMock()
sys.modules['albumentations.core.transforms_interface'] = MagicMock()
sys.modules['imgaug']                                   = MagicMock()
sys.modules['imgaug.augmenters']                        = MagicMock()

import torch
import torch.nn.functional as F
import cv2
import numpy as np
import argparse
import os
import warnings
warnings.filterwarnings("ignore")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches

sys.path.append('Mammo-CLIP/src/codebase')
from Classifiers.models.breast_clip_classifier import BreastClipClassifier


# ══════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════

CKPT_PRETRAINED = 'models_export/Pre-trained-checkpoints/b5-model-best-epoch-7.tar'
CKPT_FINETUNED  = 'models_export/best_model_auc0796_recall0853.pth'
ARCH            = 'upmc_breast_clip_det_b5_period_n_ft'

MAMMO_MEAN = 0.3089279
MAMMO_STD  = 0.25053555

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'[INFO] Device : {DEVICE}')


# ══════════════════════════════════════════════════════════════
#  1. Chargement modèle
# ══════════════════════════════════════════════════════════════

def load_classifier():
    print('[MODELE] Chargement BreastClipClassifier B5...')
    ckpt_pre = torch.load(CKPT_PRETRAINED, map_location='cpu', weights_only=False)
    ckpt_ft  = torch.load(CKPT_FINETUNED,  map_location='cpu', weights_only=False)
    args      = argparse.Namespace()
    args.arch = ARCH
    model     = BreastClipClassifier(args=args, ckpt=ckpt_pre, n_class=1)
    model.load_state_dict(ckpt_ft['model'], strict=False)
    model     = model.to(DEVICE).eval()
    print('[MODELE] Charge (AUC 0.796)')
    return model


# ══════════════════════════════════════════════════════════════
#  2. Masque sein ultra-agressif + carte de bord  [FIX #1+#4]
# ══════════════════════════════════════════════════════════════

def build_breast_mask(img_gray, img_size):
    """
    Masque intérieur du sein UNIQUEMENT :
      - Exclut ~15% du bord tout autour (mamelon, peau, artefacts)
      - Retourne aussi le masque de bord (pour suppression edge-bias)
    """
    blur        = cv2.GaussianBlur(img_gray, (5, 5), 0)
    _, bin_mask = cv2.threshold(blur, 0, 255,
                                cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel   = np.ones((15, 15), np.uint8)
    bin_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_CLOSE, kernel)
    bin_mask = cv2.morphologyEx(bin_mask, cv2.MORPH_OPEN,  kernel)

    # Convex hull
    contours, _ = cv2.findContours(bin_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
    hull_mask = np.zeros_like(img_gray)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        hull    = cv2.convexHull(largest)
        cv2.fillPoly(hull_mask, [hull], 255)

    # Masque de bord = zone entre hull complet et hull érodé (pour suppression)
    erode_edge = max(5, img_size // 20)   # 5% = zone de bord
    k_edge     = np.ones((erode_edge, erode_edge), np.uint8)
    inner_mild = cv2.erode(hull_mask, k_edge, iterations=2)
    edge_zone  = cv2.subtract(hull_mask, inner_mild).astype(np.float32) / 255.0

    # Masque intérieur AGRESSIF : 15% érosion, 4 itérations
    erode_px = max(8, img_size // 7)      # ~73px sur 512
    k_big    = np.ones((erode_px, erode_px), np.uint8)
    inner    = cv2.erode(hull_mask, k_big, iterations=4)

    # Exclusion coins DICOM
    h, w = inner.shape
    inner[:int(h * 0.15), w - int(w * 0.15):] = 0
    inner[h - int(h * 0.15):, w - int(w * 0.15):] = 0

    # Exclusion côté mamelon (gauche ou droite, 12% de large)
    left_mean  = img_gray[:, :w//4].mean()
    right_mean = img_gray[:, 3*w//4:].mean()
    band       = int(w * 0.12)
    if left_mean > right_mean:
        inner[:, :band] = 0
    else:
        inner[:, w - band:] = 0

    return inner, edge_zone


# ══════════════════════════════════════════════════════════════
#  3. GradCAM++ sur une couche donnée  [FIX #2]
# ══════════════════════════════════════════════════════════════

def gradcampp_layer(img_t, model, target_layer, img_size):
    """
    GradCAM++ : pondération par alpha = grad² / (2*grad² + Σ act*grad³)
    Plus précis que GradCAM vanilla pour la localisation.
    """
    activations, gradients = {}, {}

    def fwd_hook(m, inp, out):
        activations['f'] = out

    def bwd_hook(m, gi, go):
        gradients['f'] = go[0]

    h_f = target_layer.register_forward_hook(fwd_hook)
    h_b = target_layer.register_backward_hook(bwd_hook)

    img_v = img_t.clone().requires_grad_(True)
    feat, _ = model.image_encoder({'image': img_v})
    prob    = torch.sigmoid(model.classifier(feat))
    model.zero_grad()
    prob.backward(retain_graph=True)

    h_f.remove()
    h_b.remove()

    act  = activations['f'].detach()   # [1, C, H, W]
    grad = gradients['f'].detach()     # [1, C, H, W]

    # GradCAM++ weights
    grad2 = grad ** 2
    grad3 = grad ** 3
    # sum over spatial dims
    denom  = 2.0 * grad2 + (grad3 * act).sum(dim=[2, 3], keepdim=True)
    denom  = torch.where(denom != 0, denom,
                         torch.ones_like(denom))
    alpha  = grad2 / denom
    # ReLU on grad, then weighted sum
    weights = (alpha * F.relu(grad)).sum(dim=[2, 3], keepdim=True)
    cam     = F.relu((weights * act).sum(dim=1, keepdim=True))

    cam_up = F.interpolate(cam, size=(img_size, img_size),
                           mode='bilinear', align_corners=False)
    cam_np = cam_up.squeeze().detach().cpu().numpy()
    return cam_np, prob.item()


# ══════════════════════════════════════════════════════════════
#  4. Multi-scale CAM  [FIX #3]
# ══════════════════════════════════════════════════════════════

def multiscale_cam(img_t, model, img_size):
    """
    Moyenne GradCAM++ sur 3 couches :
      - _blocks[-2]  : haute sémantique
      - _blocks[-5]  : sémantique intermédiaire
      - _blocks[-10] : haute résolution spatiale
    Réduit le biais d'une seule couche.
    """
    enc    = model.image_encoder
    nblocks = len(enc._blocks)

    # Indices robustes peu importe la taille du réseau
    indices = sorted(set([
        max(0, nblocks - 2),
        max(0, nblocks - 5),
        max(0, nblocks - 10),
    ]))

    cam_sum  = None
    prob_sum = 0.0
    n        = 0

    for idx in indices:
        layer = enc._blocks[idx]
        print(f'[MultiCAM] _blocks[{idx}] ({type(layer).__name__})')
        try:
            cam_i, prob_i = gradcampp_layer(img_t, model, layer, img_size)
            cam_sum  = cam_i if cam_sum is None else cam_sum + cam_i
            prob_sum += prob_i
            n        += 1
        except Exception as e:
            print(f'[MultiCAM] Skip _blocks[{idx}]: {e}')

    if n == 0:
        raise RuntimeError('Aucune couche CAM na fonctionne')

    return cam_sum / n, prob_sum / n


# ══════════════════════════════════════════════════════════════
#  5. Pipeline principal
# ══════════════════════════════════════════════════════════════

def gradcam_heatmap_masked(img_path, model, img_size=512, n_smooth=3):
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f'[ERREUR] Image non trouvee : {img_path}')
        return None

    img_display              = cv2.resize(img, (img_size, img_size))
    breast_mask, edge_zone   = build_breast_mask(img_display, img_size)

    # Tensor
    img_r    = cv2.resize(img, (456, 760))
    img_norm = (img_r.astype(np.float32) / 255.0 - MAMMO_MEAN) / MAMMO_STD
    img_base = (torch.tensor(img_norm)
                .unsqueeze(0).repeat(3, 1, 1)
                .unsqueeze(0).to(DEVICE))

    # Multi-scale CAM avec n_smooth passes bruitées
    cam_accum  = None
    prob_accum = 0.0
    for i in range(n_smooth):
        noise  = torch.randn_like(img_base) * 0.005
        img_t  = (img_base + noise).to(DEVICE)
        cam_i, prob_i = multiscale_cam(img_t, model, img_size)
        cam_accum  = cam_i if cam_accum is None else cam_accum + cam_i
        prob_accum += prob_i
        print(f'[Smooth] Pass {i+1}/{n_smooth} prob={prob_i*100:.1f}%')

    cam  = cam_accum / n_smooth
    prob = prob_accum / n_smooth

    # Appliquer masque intérieur agressif
    cam[breast_mask == 0] = 0.0

    # FIX #4 : suppression edge-bias
    # Soustrait la contribution proportionnelle à la zone de bord
    # (pondérée par 0.7 pour ne pas trop supprimer si la lésion est proche du bord)
    cam = cam * (1.0 - 0.7 * edge_zone)
    cam = np.maximum(cam, 0.0)
    cam[breast_mask == 0] = 0.0

    # Normalisation percentile intra-sein
    inside = cam[breast_mask > 0]
    if inside.size > 0:
        p_low  = np.percentile(inside, 2)
        p_high = np.percentile(inside, 98)
    else:
        p_low, p_high = 0.0, 1.0
    cam = np.clip(cam, p_low, p_high)
    cam = (cam - p_low) / (p_high - p_low + 1e-8)
    cam[breast_mask == 0] = 0.0

    cam_smooth = cv2.GaussianBlur(cam.astype(np.float32), (15, 15), 0)
    cam_smooth[breast_mask == 0] = 0.0

    # Overlay
    heatmap     = cv2.applyColorMap((cam_smooth * 255).astype(np.uint8),
                                    cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    img_rgb     = cv2.cvtColor(img_display, cv2.COLOR_GRAY2RGB)
    mask_3d     = np.stack([breast_mask / 255] * 3, axis=2)
    overlay     = (img_rgb * (1 - mask_3d * 0.5)
                   + heatmap_rgb * mask_3d * 0.5).astype(np.uint8)

    # BBox : score = activation_moyenne × sqrt(surface)
    cam_inside   = cam_smooth[breast_mask > 0]
    adaptive_thr = float(np.percentile(cam_inside, 85)) if cam_inside.size > 0 else 0.3
    adaptive_thr = max(adaptive_thr, 0.25)

    hot_mask = ((cam_smooth > adaptive_thr) & (breast_mask > 0)).astype(np.uint8)
    breast_area = float((breast_mask > 0).sum())
    min_area    = max(200, breast_area * 0.01)

    contours, _ = cv2.findContours(hot_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)

    bbox_cam   = None
    best_score = -1.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        c_mask   = np.zeros_like(cam_smooth)
        cv2.fillPoly(c_mask, [c], 1.0)
        mean_act = float(cam_smooth[c_mask > 0].mean()) if c_mask.sum() > 0 else 0.0
        score    = mean_act * np.sqrt(area)
        if score > best_score:
            best_score = score
            x, y, w, h = cv2.boundingRect(c)
            pad      = 15
            bbox_cam = [max(0, x-pad), max(0, y-pad),
                        min(img_size, x+w+pad), min(img_size, y+h+pad)]

    return img_display, cam_smooth, overlay, prob, breast_mask, bbox_cam


# ══════════════════════════════════════════════════════════════
#  6. Visualisation
# ══════════════════════════════════════════════════════════════

def visualize(img_path, img_display, cam, overlay,
              prob, breast_mask, bbox_cam, img_size, output_path):
    pred  = 'MASSE'  if prob >= 0.5 else 'Normal'
    color = 'red'    if prob >= 0.5 else 'green'

    fig, axes = plt.subplots(1, 3, figsize=(16, 6), facecolor='#111111')
    fig.suptitle(
        f'Mammo-CLIP -- {os.path.basename(img_path)}\n'
        f'Prediction : {pred}   Probabilite : {prob*100:.1f}%',
        fontsize=13, fontweight='bold', color=color
    )
    for ax in axes:
        ax.set_facecolor('#111111')
        ax.axis('off')

    axes[0].imshow(img_display, cmap='gray')
    axes[0].set_title('Image originale', color='white', fontsize=11)

    cam_display = cam.copy().astype(float)
    cam_display[breast_mask == 0] = np.nan
    axes[1].imshow(img_display, cmap='gray')
    im = axes[1].imshow(cam_display, cmap='jet', alpha=0.6, vmin=0, vmax=1)
    axes[1].set_title('GradCAM++ multi-scale\n(bords supprimes)', color='white', fontsize=11)
    if bbox_cam:
        x1c, y1c, x2c, y2c = bbox_cam
        axes[1].add_patch(patches.Rectangle(
            (x1c, y1c), x2c-x1c, y2c-y1c,
            lw=2, edgecolor='white', facecolor='none', linestyle='--'))
    plt.colorbar(im, ax=axes[1], fraction=0.046, pad=0.04, label='Activation')

    axes[2].imshow(overlay)
    axes[2].set_title('Overlay + bbox suspecte', color='white', fontsize=11)
    if bbox_cam:
        x1c, y1c, x2c, y2c = bbox_cam
        axes[2].add_patch(patches.Rectangle(
            (x1c, y1c), x2c-x1c, y2c-y1c,
            lw=2, edgecolor='red', facecolor='none'))

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#111111')
    plt.close()
    print(f'[OK] Resultat -> {output_path}')


# ══════════════════════════════════════════════════════════════
#  7. Resume terminal
# ══════════════════════════════════════════════════════════════

def print_summary(img_path, prob, bbox_cam, output_path):
    pred = 'MASSE' if prob >= 0.5 else 'Normal'
    print(f'\n{"="*50}')
    print(f'  RESUME -- {os.path.basename(img_path)}')
    print(f'{"="*50}')
    print(f'  Classifieur  : {pred}  ({prob*100:.1f}%)')
    print(f'  CAM bbox     : {bbox_cam}')
    high_prob   = prob >= 0.5
    has_bbox    = bbox_cam is not None
    if high_prob and has_bbox:
        conf = 'HAUTE -- Classifieur positif + localisation CAM'
    elif high_prob:
        conf = 'FAIBLE -- Classifieur positif, pas de localisation claire'
    else:
        conf = 'NORMALE -- Classifieur negatif'
    print(f'  {conf}')
    print(f'{"="*50}')
    print(f'  PNG : {output_path}')
    print(f'{"="*50}')


# ══════════════════════════════════════════════════════════════
#  8. predict()
# ══════════════════════════════════════════════════════════════

def predict(img_path, classifier, img_size=512, output_dir='.', n_smooth=3):
    print(f'\n[PREDICT] {img_path}')
    result = gradcam_heatmap_masked(img_path, classifier, img_size, n_smooth)
    if result is None:
        return
    img_display, cam, overlay, prob, breast_mask, bbox_cam = result
    print(f'[CLASSIFIEUR] Probabilite masse : {prob*100:.1f}%')

    stem        = os.path.splitext(os.path.basename(img_path))[0]
    output_path = os.path.join(output_dir, f'gradcam_{stem}.png')
    os.makedirs(output_dir, exist_ok=True)

    visualize(img_path, img_display, cam, overlay,
              prob, breast_mask, bbox_cam, img_size, output_path)
    print_summary(img_path, prob, bbox_cam, output_path)
    return {'prob': prob, 'bbox_gradcam': bbox_cam, 'output': output_path}


# ══════════════════════════════════════════════════════════════
#  9. CLI
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Mammo-CLIP GradCAM++ v4')
    p.add_argument('--image',      type=str, default='mammonor.PNG')
    p.add_argument('--img_size',   type=int, default=512)
    p.add_argument('--output_dir', type=str, default='.')
    p.add_argument('--n_smooth',   type=int, default=3)
    args = p.parse_args()
    classifier = load_classifier()
    predict(
        img_path   = args.image,
        classifier = classifier,
        img_size   = args.img_size,
        output_dir = args.output_dir,
        n_smooth   = args.n_smooth,
    )