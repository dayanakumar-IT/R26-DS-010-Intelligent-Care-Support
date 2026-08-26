# SCRIBE Service — Component 3
# Voice to ADL Documentation
# FastAPI backend — built by teammate

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SCRIBE Service",
    description="Voice to ADL documentation API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO (teammate): import and include routers
# from routes import observations, patients, reports
# app.include_router(observations.router, prefix="/scribe/observations")
# app.include_router(patients.router,     prefix="/scribe/patients")
# app.include_router(reports.router,      prefix="/scribe/reports")

@app.get("/")
def health_check():
    return {"service": "SCRIBE", "status": "running", "component": 3}
