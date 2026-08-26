# CareSense Mobile

Flutter mobile app + backend services for SENTRY (Component 2) and SCRIBE (Component 3).

## Structure

```
caresense_mobile/
├── backend/
│   ├── sentry_service/    ← Component 2: Fall Risk Detection (Harishalinee)
│   └── scribe_service/    ← Component 3: Voice to ADL (Teammate)
└── frontend/              ← Flutter mobile app (both modules)
```

## Running the app

```bash
cd frontend
flutter pub get
flutter run
```

## Running backend services

```bash
# SENTRY (port 8001)
cd backend/sentry_service
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload --port 8001

# SCRIBE (port 8002)
cd backend/scribe_service
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8002
```

## Git Branch
`caresense_mobile_flutter_v1`
