"""
db.py — MongoDB avec connexion persistante (Motor)
Corrections :
  - Une seule connexion partagée (client global) au lieu d'en ouvrir/fermer une par requête
  - init_db() n'écrase plus les données si elles existent déjà
  - get_all_patients() et get_all_scans() ajoutés pour le dashboard
  - _id MongoDB supprimé proprement partout
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
import asyncio
import os

# ── Config ────────────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME",   "mammoscan")

# Connexion UNIQUE partagée — plus d'ouverture/fermeture à chaque requête
_client = None
_db     = None

def get_db():
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
        _db     = _client[DB_NAME]
    return _db

# ── Modèles Pydantic ──────────────────────────────────────────────────────────

class Patient(BaseModel):
    patient_id: str
    age:        int
    gender:     str
    risk_score: float
    history:    List[str]

class Scan(BaseModel):
    scan_id:        str
    patient_id:     str
    date:           str
    birads_result:  str
    tumor_detected: bool

class Histopathology(BaseModel):
    sample_id:  str
    patient_id: str
    diagnosis:  str
    confidence: float

class Analytics(BaseModel):
    total_patients: int
    cancer_cases:   int
    average_risk:   float
    last_updated:   datetime = Field(default_factory=datetime.now)

# ── Init (insère seulement si vide) ──────────────────────────────────────────

async def init_db():
    db = get_db()

    # Index
    await db.patients.create_index("patient_id", unique=True)
    await db.scans.create_index("scan_id",       unique=True)
    await db.scans.create_index("patient_id")
    await db.scans.create_index([("patient_id", 1), ("date", -1)])
    await db.histopathology.create_index("sample_id",  unique=True)
    await db.histopathology.create_index("patient_id")

    # Insère seulement si la collection est vide
    if await db.patients.count_documents({}) == 0:
        patients = [
            Patient(patient_id="P001", age=45, gender="Female",
                    risk_score=0.15, history=["None"]),
            Patient(patient_id="P002", age=62, gender="Female",
                    risk_score=0.85, history=["Family history", "Smoking"]),
            Patient(patient_id="P003", age=55, gender="Female",
                    risk_score=0.40, history=["Previous biopsy"]),
        ]
        await db.patients.insert_many([p.dict() for p in patients])
        print("  Patients insérés.")

    if await db.scans.count_documents({}) == 0:
        scans = [
            Scan(scan_id="S001", patient_id="P001", date="2024-01-15",
                 birads_result="Category 1", tumor_detected=False),
            Scan(scan_id="S002", patient_id="P002", date="2024-02-10",
                 birads_result="Category 5", tumor_detected=True),
        ]
        await db.scans.insert_many([s.dict() for s in scans])
        print("  Scans insérés.")

    if await db.histopathology.count_documents({}) == 0:
        histo = [
            Histopathology(sample_id="H001", patient_id="P002",
                           diagnosis="Invasive Ductal Carcinoma", confidence=0.98),
        ]
        await db.histopathology.insert_many([h.dict() for h in histo])
        print("  Histopathologie insérée.")

    if await db.analytics.count_documents({}) == 0:
        analytics = Analytics(total_patients=3, cancer_cases=1, average_risk=0.46)
        await db.analytics.insert_one(analytics.dict())
        print("  Analytics insérés.")

    print("✅ MongoDB prêt.")

# ── Helper ────────────────────────────────────────────────────────────────────

def _clean(doc):
    if doc:
        doc.pop("_id", None)
    return doc

# ── Requêtes ──────────────────────────────────────────────────────────────────

async def get_patient(patient_id: str):
    return _clean(await get_db().patients.find_one({"patient_id": patient_id}))

async def get_latest_scan(patient_id: str):
    return _clean(await get_db().scans.find_one(
        {"patient_id": patient_id},
        sort=[("date", -1)]
    ))

async def get_analytics():
    return _clean(await get_db().analytics.find_one())

async def get_all_patients():
    return await get_db().patients.find({}, {"_id": 0}).to_list(length=1000)

async def get_all_scans():
    return await get_db().scans.find({}, {"_id": 0}).to_list(length=1000)

async def get_histopathology(patient_id: str):
    return await get_db().histopathology.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).to_list(length=100)

if __name__ == "__main__":
    asyncio.run(init_db())