import xgboost as xgb
import pandas as pd
import re
import joblib

# ── 1. Charger le modèle ──────────────────────────────────────────────────────
model = joblib.load('predection_de_risk\seer_xgb_model.pkl')

# ── 2. Récupérer les features directement depuis le modèle ───────────────────
feature_cols = model.get_booster().feature_names
print("Features du modèle :", feature_cols)

# ── 3. Patient exemple (valeurs déjà encodées) ────────────────────────────────
def clean_col_names(df):
    df = df.copy()
    df.columns = [re.sub(r'[^\w]', '_', col).strip('_') for col in df.columns]
    return df

patients = pd.DataFrame([
    # Age  Race  Marital  Unk  TStage  NStage  6thStage  Grade  AStage  TumSize  ER  PR  NodeExam  NodePos
    [69,   1,    1,       0,   2,      2,      4,        3,     1,      40,      1,  0,  47,       23],  # haut risque
    [45,   1,    1,       0,   1,      0,      1,        1,     1,      15,      1,  1,  20,       0 ],  # faible risque
    [58,   1,    0,       0,   2,      1,      2,        2,     1,      25,      0,  0,  12,       5 ],  # risque moyen
], columns=[
    'Age', 'Race ', 'Marital Status', 'Unnamed: 3',
    'T Stage ', 'N Stage', '6th Stage', 'Grade', 'A Stage',
    'Tumor Size', 'Estrogen Status', 'Progesterone Status',
    'Regional Node Examined', 'Reginol Node Positive'
])

patients = clean_col_names(patients)
patients = patients.reindex(columns=feature_cols, fill_value=0)

probas = model.predict_proba(patients)[:, 1]
for i, p in enumerate(probas):
    risk = "Risque élevé" if p > 0.5 else "Risque faible"
    print(f"Patient {i+1} → {p:.3f} — {risk}")