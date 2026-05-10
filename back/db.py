"""
db.py — Adaptateur PathoScan pour le chatbot MammoScan
Compatible avec la base MongoDB "breast_cancer_idc" de la collègue.
Collections utilisées : patients, predictions, risk_predictions, mammo_predictions
"""

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

# ── Config — même URI que le main.py de la collègue ──────────────────────────
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = "breast_cancer_idc"

_client = None
_db     = None

def get_db():
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
        _db     = _client[DB_NAME]
    return _db

# ── Helper ────────────────────────────────────────────────────────────────────
def _clean(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    # Convertir datetime en string
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# ── get_patient ───────────────────────────────────────────────────────────────
# Cherche un patient par son id (champ "id" ou "patient_id")
async def get_patient(patient_id: str):
    db = get_db()
    doc = await db.patients.find_one(
        {"$or": [{"id": patient_id}, {"patient_id": patient_id}]},
        {"_id": 0}
    )
    if not doc:
        return None

    # Normalise les champs pour que le chatbot les comprenne
    return {
        "patient_id":  doc.get("id") or doc.get("patient_id", patient_id),
        "age":         doc.get("age", "N/A"),
        "gender":      doc.get("gender") or doc.get("sex", "N/A"),
        "history":     doc.get("history") or doc.get("antecedents") or ["N/A"],
        "risk_score":  doc.get("risk_score") or doc.get("risk", 0.0),
        # Champs supplémentaires PathoScan
        "name":        doc.get("name", ""),
        "doctor_id":   doc.get("doctor_id", ""),
        "created_at":  doc.get("created_at", ""),
    }

# ── get_latest_scan ───────────────────────────────────────────────────────────
# Cherche dans mammo_predictions (mammographie) puis predictions (histopathologie)
async def get_latest_scan(patient_id: str):
    db = get_db()

    # 1. Chercher le dernier résultat mammographie
    mammo = await db.mammo_predictions.find_one(
        {"$or": [{"patient_id": patient_id}, {"id": patient_id}]},
        sort=[("created_at", -1)]
    )
    if mammo:
        mammo.pop("_id", None)
        return {
            "scan_id":       str(mammo.get("_id", "")),
            "patient_id":    patient_id,
            "date":          mammo.get("created_at", datetime.utcnow()).isoformat()
                             if isinstance(mammo.get("created_at"), datetime)
                             else str(mammo.get("created_at", "N/A")),
            "birads_result": mammo.get("verdict", "N/A"),
            "tumor_detected": mammo.get("verdict", "") == "MASSE",
            "confidence":    mammo.get("confidence", "N/A"),
            "view":          mammo.get("view", "N/A"),
            "type":          "mammographie",
        }

    # 2. Fallback : histopathologie (predictions)
    histo = await db.predictions.find_one(
        {"$or": [{"patient_id": patient_id}, {"id": patient_id}]},
        sort=[("created_at", -1)]
    )
    if histo:
        histo.pop("_id", None)
        return {
            "scan_id":       str(histo.get("_id", "")),
            "patient_id":    patient_id,
            "date":          histo.get("created_at", datetime.utcnow()).isoformat()
                             if isinstance(histo.get("created_at"), datetime)
                             else str(histo.get("created_at", "N/A")),
            "birads_result": histo.get("verdict", "N/A"),
            "tumor_detected": "malin" in str(histo.get("verdict", "")).lower() or
                              "idc"   in str(histo.get("verdict", "")).lower(),
            "confidence":    histo.get("confidence", "N/A"),
            "type":          "histopathologie",
        }

    return None

# ── get_analytics ─────────────────────────────────────────────────────────────
# Calcule les stats depuis les vraies collections PathoScan
async def get_analytics():
    db = get_db()

    total_patients = await db.patients.count_documents({})
    total_mammo    = await db.mammo_predictions.count_documents({})
    total_histo    = await db.predictions.count_documents({})
    total_risk     = await db.risk_predictions.count_documents({})

    masses  = await db.mammo_predictions.count_documents({"verdict": "MASSE"})
    malins  = await db.predictions.count_documents({"verdict": "IDC (Malin)"})
    highrisk = await db.risk_predictions.count_documents({"verdict": "High Risk"})

    cancer_cases = max(masses, malins)

    avg_risk = 0.0
    if total_risk > 0:
        pipeline = [{"$group": {"_id": None, "avg": {"$avg": "$risk_score"}}}]
        async for doc in db.risk_predictions.aggregate(pipeline):
            avg_risk = doc.get("avg", 0.0) or 0.0

    return {
        "total_patients":   total_patients,
        "cancer_cases":     cancer_cases,
        "average_risk":     round(avg_risk, 4),
        "total_analyses":   total_mammo + total_histo + total_risk,
        "masses_detectees": masses,
        "cas_malins":       malins,
        "high_risk":        highrisk,
        "last_updated":     datetime.utcnow().isoformat(),
    }

# ── get_all_patients ──────────────────────────────────────────────────────────
async def get_all_patients():
    db = get_db()
    docs = await db.patients.find({}, {"_id": 0}).to_list(length=1000)
    return docs

# ── get_all_scans ─────────────────────────────────────────────────────────────
# Retourne tous les scans (mammo + histopathologie fusionnés)
async def get_all_scans():
    db = get_db()
    mammo = await db.mammo_predictions.find({}, {"_id": 0}).to_list(length=1000)
    histo = await db.predictions.find({}, {"_id": 0}).to_list(length=1000)

    def _fmt_mammo(d):
        created = d.get("created_at", "")
        return {
            "scan_id":        str(d.get("_id", d.get("id", ""))),
            "patient_id":     d.get("patient_id", d.get("id", "")),
            "date":           created.isoformat() if isinstance(created, datetime) else str(created),
            "birads_result":  d.get("verdict", "N/A"),
            "tumor_detected": d.get("verdict", "") == "MASSE",
            "confidence":     d.get("confidence", "N/A"),
            "type":           "mammographie",
        }

    def _fmt_histo(d):
        created = d.get("created_at", "")
        verdict = str(d.get("verdict", ""))
        return {
            "scan_id":        str(d.get("_id", d.get("id", ""))),
            "patient_id":     d.get("patient_id", d.get("id", "")),
            "date":           created.isoformat() if isinstance(created, datetime) else str(created),
            "birads_result":  verdict,
            "tumor_detected": "malin" in verdict.lower() or "idc" in verdict.lower(),
            "confidence":     d.get("confidence", "N/A"),
            "type":           "histopathologie",
        }

    return [_fmt_mammo(d) for d in mammo] + [_fmt_histo(d) for d in histo]

# ── get_histopathology ────────────────────────────────────────────────────────
async def get_histopathology(patient_id: str):
    db = get_db()
    docs = await db.predictions.find(
        {"$or": [{"patient_id": patient_id}, {"id": patient_id}]},
        {"_id": 0}
    ).to_list(length=100)
    return docs

# ── get_latest_risk ───────────────────────────────────────────────────────────
async def get_latest_risk(patient_id: str):
    db = get_db()
    doc = await db.risk_predictions.find_one(
        {"$or": [{"patient_id": patient_id}, {"id": patient_id}]},
        sort=[("created_at", -1)]
    )
    if doc:
        doc.pop("_id", None)
        return doc
    return None

# ── init_db (optionnel — ne rien écraser) ────────────────────────────────────
async def init_db():
    print("✅ Connecté à PathoScan DB :", DB_NAME)