# CareSense Mobile — Backend Services

Two independent FastAPI services for the mobile app.

## Services

### sentry_service/ — Component 2 (Fall Risk Detection)
Built by: Harishalinee
- ST-GCN skeletal movement analysis
- Real-time fall risk scoring (HIGH / MODERATE / NORMAL)
- Alert generation and management
- Event replay skeletal data

**Run:**
```bash
cd sentry_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

### scribe_service/ — Component 3 (Voice to ADL)
Built by: Teammate
- Whisper ASR + LoRA adapter
- BART disfluency removal
- T5 ADL field extraction
- ADL record storage + TTS handover

**Run:**
```bash
cd scribe_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

---

## Shared Database
Both services connect to the **same Supabase project** using the credentials in their respective `.env` files (copy from `.env.example`).

Never commit `.env` files to Git.
