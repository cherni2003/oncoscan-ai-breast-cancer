"""
main.py — FastAPI avec MongoDB
Corrections :
  - Appel à init_db() au démarrage (lifespan)
  - Routes /patients et /scans ajoutées (nécessaires pour le dashboard)
  - CORS activé pour le frontend React (localhost:5173)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from chatbot import get_chatbot_response
from db import (
    init_db,
    get_patient,
    get_latest_scan,
    get_analytics,
    get_all_patients,
    get_all_scans,
    get_histopathology,
)

# ── Lifespan (remplace @app.on_event deprecated) ─────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()          # initialise MongoDB au démarrage
    yield                    # l'app tourne ici
    # nettoyage éventuel à l'arrêt

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="MammoScan AI Assistant API", lifespan=lifespan)

# CORS — autorise le frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schémas ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    patient_id: Optional[str] = None

class ChatResponse(BaseModel):
    response:   str
    confidence: float
    data:       Optional[dict] = None
    risk_score: Optional[float] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "MammoScan AI API", "status": "running"}

# Chat
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        result = await get_chatbot_response(request.message, request.patient_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Patient unique
@app.get("/patient/{patient_id}")
async def get_patient_data(patient_id: str):
    patient = await get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

# Liste de tous les patients
@app.get("/patients")
async def list_patients():
    return await get_all_patients()

# Dernier scan d'un patient
@app.get("/scan/{patient_id}")
async def get_scan_data(patient_id: str):
    scan = await get_latest_scan(patient_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan

# Tous les scans
@app.get("/scans")
async def list_scans():
    return await get_all_scans()

# Histopathologie d'un patient
@app.get("/histo/{patient_id}")
async def get_histo(patient_id: str):
    return await get_histopathology(patient_id)

# Dashboard / analytics
@app.get("/dashboard")
async def get_dashboard_stats():
    stats = await get_analytics()
    if not stats:
        raise HTTPException(status_code=404, detail="Analytics not found")
    return stats

# ── Dev ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)