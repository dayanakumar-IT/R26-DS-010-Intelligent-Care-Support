# SENTRY Service — Component 2
# Edge-Enabled Skeletal Movement Analysis System
# FastAPI backend for fall risk detection

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SENTRY Service",
    description="Real-time fall risk detection API using ST-GCN skeletal analysis",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: import and include routers
# from routes import patients, alerts, risk_score
# app.include_router(patients.router, prefix="/sentry/patients", tags=["patients"])
# app.include_router(alerts.router,   prefix="/sentry/alerts",   tags=["alerts"])
# app.include_router(risk_score.router, prefix="/sentry/risk",   tags=["risk"])

@app.get("/")
def health_check():
    return {"service": "SENTRY", "status": "running", "component": 2}
