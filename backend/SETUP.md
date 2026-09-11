# Setup

Blockchain has been fully removed from this build — no `blockchain.py`, no
blockchain fields on `Evidence`, no `blockchain_custody` table, no
blockchain router. Everything else (Postgres + Neo4j + FastAPI) is as specified.

## 1. Python environment

```bash
# From the project root (where venv/ lives):
venv\Scripts\activate           # Windows PowerShell

cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_trf
```

## 2. Configure environment

Edit `backend/.env`:

```
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT>.supabase.co:5432/postgres
NEO4J_URI=neo4j+s://<HOST>.databases.neo4j.io
NEO4J_USER=<USER>
NEO4J_PASSWORD=<PASSWORD>
JWT_SECRET=<SECRET>
GEMINI_API_KEY=<OPTIONAL — only needed for natural-language explanations>
```

> Note: If your password contains special characters (e.g. `@`), URL-encode them.
> `@` → `%40`, `#` → `%23`, etc.

## 3. Train the ML models (do this once before starting the server)

```bash
# From backend/ with venv active:
python ml_models/train.py --synthetic
```

This trains:
- **RandomForest** link predictor on 1 000 synthetic node-pairs
- **Isolation Forest** anomaly detector on 480 synthetic nodes

And prints a metrics table:

```
LinkPredictor (Random Forest):
  roc_auc          ~0.95+
  precision        ~0.90+
  recall           ~0.90+
  f1               ~0.90+
  precision_at_10  1.00

AnomalyDetector (Isolation Forest):
  roc_auc          ~0.85+
  n_samples        480
```

Models are saved to `ml_models/saved/`.

To retrain on real Neo4j case data after seeding:

```bash
python ml_models/train.py --all-cases
```

## 4. Run the server

```bash
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive Swagger UI.

## 5. Seed demo data (optional)

```bash
# Set initial admin password via environment variable
export INITIAL_ADMIN_PASSWORD="YourSecureAdminPassword"
python seed.py
```

Creates the initial admin account (`arhamk_17`, `hiarham17@gmail.com`) and demo users, 1 case (`CR/2024/MUM/0045`), ingests a synthetic FIR +
CDR + transactions dataset directly into Postgres/Neo4j, and runs the
analytics pass (link predictions, anomalies, IPS).

## 6. API endpoints

### Evidence & Cases (unchanged)
```bash
# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "arhamk_17", "password": "YourSecureAdminPassword"}'


# (save the access_token from the response as $TOKEN)

# Create a case
curl -X POST http://localhost:8000/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_number": "CR/2024/TEST/001", "title": "Test Case", "priority": "medium"}'

# Upload evidence
curl -X POST http://localhost:8000/evidence/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@fir_sample.txt" \
  -F "case_id=<CASE_ID>" \
  -F "source_type=fir"
```

### ML Analytics (backed by Random Forest + Isolation Forest)
```bash
# Link predictions (RF scores)
curl "http://localhost:8000/analytics/link-predictions?case_id=<CASE_ID>" \
  -H "Authorization: Bearer $TOKEN"

# Anomaly detection (IF scores)
curl "http://localhost:8000/analytics/anomalies?case_id=<CASE_ID>" \
  -H "Authorization: Bearer $TOKEN"

# IPS (composite score using ML outputs)
curl "http://localhost:8000/analytics/ips?case_id=<CASE_ID>" \
  -H "Authorization: Bearer $TOKEN"

# Check model status + metrics
curl "http://localhost:8000/analytics/model-status" \
  -H "Authorization: Bearer $TOKEN"
```

### ML Summary (no LLM — pure ML output)
```bash
curl -X POST http://localhost:8000/ai/ml-summary \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_id": "<CASE_ID>"}'
```

### AI Assistant (Gemini — optional, only if GEMINI_API_KEY is set)
```bash
# Graph Q&A
curl -X POST http://localhost:8000/ai/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_id": "<CASE_ID>", "query": "Who is connected to Rajan Mehta?"}'

# Explain IPS score
curl -X POST http://localhost:8000/ai/explain \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"case_id": "<CASE_ID>", "entity_name": "Rajan Mehta"}'
```

## Architecture

```
Upload → SHA-256 → NLP (spaCy + regex)
       → Entity Resolution (rapidfuzz)
       → Neo4j (graph write)
       → Feature Engineering (degree, Jaccard, Adamic-Adar …)
       → RandomForest (link prediction)  ← ml_models/saved/link_predictor.joblib
       → IsolationForest (anomaly)       ← ml_models/saved/anomaly_detector.joblib
       → IPS (composite score)
       → FastAPI analytics endpoints
       → [OPTIONAL] Gemini explains ML output
```

## What changed vs. the original spec

- **Removed** `anthropic` dependency (was unused).
- **Added** `ml_models/` package:
  - `feature_engineering.py` — graph feature extraction from Neo4j
  - `link_predictor.py`      — RandomForest (or XGBoost) link prediction
  - `anomaly_detector.py`    — Isolation Forest with 6 features + StandardScaler
  - `train.py`               — standalone training script with metrics
- **Modified** `analytics.py`:
  - `compute_link_predictions()` → RF model primary, heuristic fallback
  - `compute_anomaly_scores()` → persisted IF primary, 2-feature live IF fallback
  - Added `get_model_status()` + `/analytics/model-status` endpoint
- **Modified** `ai_assistant.py`:
  - Added `/ai/ml-summary` — structured ML-only summary (no LLM)
  - Gemini remains optional explainer only
- **Modified** `requirements.txt`: added `joblib`, `xgboost`, `google-genai`; removed `anthropic`
- Everything else (NLP, Neo4j, IPS, auth, ingestion, models, schemas) is **unchanged**.
