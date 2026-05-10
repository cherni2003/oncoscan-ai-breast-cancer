"""
chatbot.py — Moteur NLP du chatbot MammoScan
Corrections :
  - Chemins Windows codés en dur → chemins relatifs automatiques
  - Fallback par mots-clés si model.pth absent
  - Extraction automatique du patient_id depuis le message
  - Toutes les réponses génériques en français
"""

import os
import random
import json
import re
import torch
import numpy as np

from db import get_patient, get_latest_scan, get_analytics
from ml_model import predict_risk

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Chemins relatifs au script ────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BASE_DIR, "data")
INTENTS_FILE = os.path.join(DATA_DIR, "intents.json")
MODEL_FILE   = os.path.join(DATA_DIR, "model.pth")

# ── Chargement du modèle NLP ──────────────────────────────────────────────────
_nlp_ready = False
model = all_words = tags = intents_data = None

try:
    from train_nlp import NeuralNet, tokenize, bag_of_words

    with open(INTENTS_FILE, "r", encoding="utf-8") as f:
        intents_data = json.load(f)

    data        = torch.load(MODEL_FILE, map_location=device)
    input_size  = data["input_size"]
    hidden_size = data["hidden_size"]
    output_size = data["output_size"]
    all_words   = data["all_words"]
    tags        = data["tags"]

    model = NeuralNet(input_size, hidden_size, output_size).to(device)
    model.load_state_dict(data["model_state"])
    model.eval()
    _nlp_ready = True
    print("✅ Modèle NLP chargé depuis", MODEL_FILE)

except Exception as e:
    print(f"⚠️  Modèle NLP non disponible ({e}). Fallback par mots-clés activé.")

# ── Fallback par mots-clés ────────────────────────────────────────────────────
KEYWORD_RULES = [
    (["dashboard", "statistiques", "stats", "analytics",
      "tableau de bord", "kpi", "combien de patients",
      "vue d'ensemble", "données globales", "bilan"],         "dashboard"),
    (["patient info", "infos patient", "fiche patient",
      "profil patient", "dossier patient", "qui est",
      "données patient", "get patient", "show patient"],      "patient_info"),
    (["scan", "mammograph", "birads", "bi-rads",
      "résultat scan", "résultat radio", "imagerie",
      "dernier scan", "compte-rendu"],                        "scan_result"),
    (["risque", "risk", "score de risque", "calcule le risque",
      "évaluation du risque", "à risque", "prédiction"],      "risk"),
    (["bonjour", "salut", "coucou", "bonsoir", "hello",
      "hey", "allô", "bonne journée"],                        "greeting"),
    (["au revoir", "bye", "à bientôt", "ciao",
      "bonne nuit", "à plus", "je termine"],                  "goodbye"),
    (["merci", "thanks", "thank you", "parfait",
      "super", "génial", "nickel", "bien reçu"],              "thanks"),
    (["aide", "help", "que peux-tu", "fonctionnalités",
      "comment utiliser", "que puis-je", "à quoi tu sers"],   "aide"),
    (["bi-rads", "birads", "catégorie", "classification birads",
      "qu'est-ce que bi-rads", "échelle birads"],              "birads"),
    (["cancer du sein", "cancer sein", "dépistage",
      "prévention", "facteurs de risque", "symptômes"],        "cancer_info"),
]

GENERIC_RESPONSES = {
    "greeting": [
        "Bonjour ! Je suis l'assistant IA MammoScan. Comment puis-je vous aider ?",
        "Bonjour ! Je suis là pour vous aider avec les données patients, les scans et l'évaluation des risques.",
        "Bienvenue sur MammoScan IA. Posez-moi vos questions sur les patients, les mammographies ou le tableau de bord.",
    ],
    "goodbye": [
        "Au revoir ! Prenez soin de vous.",
        "À bientôt ! N'hésitez pas à revenir si vous avez des questions.",
        "Bonne journée ! Restez en bonne santé.",
    ],
    "thanks": [
        "Avec plaisir !",
        "Je suis là pour vous aider !",
        "De rien ! Y a-t-il autre chose que je puisse faire pour vous ?",
        "C'est normal, n'hésitez pas.",
    ],
    "aide": [
        (
            "Je peux vous aider avec :\n"
            "• 📊 Tableau de bord — statistiques globales du système\n"
            "• 👤 Dossier patient — ex : 'infos patient P001'\n"
            "• 🔬 Résultat scan — ex : 'résultat scan P002'\n"
            "• ⚠️ Risque IA — ex : 'calcule le risque P001'"
        ),
    ],
    "birads": [
        (
            "Le système BI-RADS classe les résultats mammographiques de 0 à 6 :\n"
            "• Catégorie 1 : Négatif — examen normal\n"
            "• Catégorie 2 : Découverte bénigne — rassurant\n"
            "• Catégorie 3 : Probablement bénin — surveillance\n"
            "• Catégorie 4 : Suspicion — biopsie recommandée\n"
            "• Catégorie 5 : Hautement suspect — intervention urgente\n"
            "• Catégorie 6 : Malignité confirmée par biopsie"
        ),
    ],
    "cancer_info": [
        (
            "Le cancer du sein est le cancer le plus fréquent chez la femme. "
            "Les facteurs de risque incluent l'âge, les antécédents familiaux et certains modes de vie. "
            "Un dépistage régulier par mammographie est recommandé à partir de 50 ans. "
            "Consultez votre médecin pour un suivi personnalisé."
        ),
    ],
}

def _keyword_tag(message: str) -> str:
    lower = message.lower()
    for keywords, tag in KEYWORD_RULES:
        if any(kw in lower for kw in keywords):
            return tag
    return "unknown"

def _extract_patient_id(message: str):
    """Extrait P001, P002… directement depuis le message."""
    match = re.search(r"\bP\d{3,}\b", message, re.IGNORECASE)
    return match.group(0).upper() if match else None

# ── Réponse principale ────────────────────────────────────────────────────────

async def get_chatbot_response(message: str, patient_id: str = None):
    # Priorité à l'ID extrait depuis le message
    extracted_id = _extract_patient_id(message)
    if extracted_id:
        patient_id = extracted_id

    # Détection du tag
    tag  = "unknown"
    prob = 1.0

    if _nlp_ready:
        try:
            sentence = tokenize(message)
            X = bag_of_words(sentence, all_words).reshape(1, -1)
            X = torch.from_numpy(X).to(device)

            output = model(X)
            _, predicted = torch.max(output, dim=1)
            probs = torch.softmax(output, dim=1)
            prob  = probs[0][predicted.item()].item()

            if prob > 0.75:
                tag = tags[predicted.item()]
            else:
                tag = _keyword_tag(message)
        except Exception:
            tag = _keyword_tag(message)
    else:
        tag = _keyword_tag(message)

    # ── Logique par tag ───────────────────────────────────────────────────────

    if tag == "dashboard":
        stats = await get_analytics()
        if stats:
            stats.pop("last_updated", None)
            return {
                "response": (
                    f"📊 Statistiques système — "
                    f"Total patients : {stats['total_patients']}, "
                    f"Cas cancéreux : {stats['cancer_cases']}, "
                    f"Risque moyen : {stats['average_risk']:.0%}"
                ),
                "confidence": prob,
                "data": stats,
                "type": "dashboard",
            }
        return {"response": "Impossible de charger les statistiques.", "confidence": prob}

    if tag == "patient_info":
        if not patient_id:
            return {"response": "Veuillez fournir un identifiant patient (ex : P001).", "confidence": prob}
        patient = await get_patient(patient_id)
        if patient:
            return {
                "response": (
                    f"Dossier patient — ID : {patient['patient_id']}, "
                    f"Âge : {patient['age']} ans, Genre : {patient['gender']}, "
                    f"Antécédents : {', '.join(patient['history'])}"
                ),
                "confidence": prob,
                "data": patient,
                "type": "patient_info",
            }
        return {"response": f"Aucun patient trouvé avec l'ID {patient_id}.", "confidence": prob}

    if tag == "scan_result":
        if not patient_id:
            return {"response": "Veuillez fournir un identifiant patient (ex : P001).", "confidence": prob}
        scan = await get_latest_scan(patient_id)
        if scan:
            return {
                "response": (
                    f"Dernier scan pour {patient_id} — "
                    f"Date : {scan['date']}, "
                    f"BI-RADS : {scan['birads_result']}, "
                    f"Tumeur : {'Détectée' if scan['tumor_detected'] else 'Non détectée'}"
                ),
                "confidence": prob,
                "data": scan,
                "type": "scan_result",
            }
        return {"response": f"Aucun résultat de scan trouvé pour {patient_id}.", "confidence": prob}

    if tag == "risk":
        if not patient_id:
            return {"response": "Veuillez fournir un identifiant patient (ex : P001).", "confidence": prob}
        patient = await get_patient(patient_id)
        if patient:
            risk_score = predict_risk(patient)
            return {
                "response": (
                    f"Prédiction IA pour {patient_id} — "
                    f"Score de risque : {risk_score:.2%}. "
                    f"Consultez un spécialiste pour confirmation clinique."
                ),
                "confidence": prob,
                "risk_score": risk_score,
                "type": "risk",
            }
        return {"response": f"Aucune donnée disponible pour {patient_id}.", "confidence": prob}

    # Réponses génériques (greeting, goodbye, thanks, aide, birads, cancer_info)
    if tag in GENERIC_RESPONSES:
        return {
            "response": random.choice(GENERIC_RESPONSES[tag]),
            "confidence": prob,
            "type": tag,
        }

    # Réponses depuis intents.json (si NLP chargé)
    if _nlp_ready and intents_data:
        for intent in intents_data.get("intents", []):
            if intent["tag"] == tag and intent.get("responses"):
                return {
                    "response": random.choice(intent["responses"]),
                    "confidence": prob,
                    "type": tag,
                }

    return {
        "response": (
            "Je n'ai pas bien compris votre demande. Je peux vous aider avec :\n"
            "• 📊 Tableau de bord — 'Afficher le tableau de bord'\n"
            "• 👤 Dossier patient — 'Infos patient P001'\n"
            "• 🔬 Résultat scan — 'Résultat scan P002'\n"
            "• ⚠️ Évaluation risque — 'Calcule le risque P001'"
        ),
        "confidence": prob,
        "type": "unknown",
    }