"""Standalone demo data seeder. Run with: python seed.py

Requires the backend's PostgreSQL and Neo4j to be reachable, and the
FastAPI app to NOT be running on the same DB in a conflicting way
(seeding talks to the DB directly, not through the HTTP API).
"""
import io
import os
import uuid

import pandas as pd

from config import settings
from database import SessionLocal, Base, engine
from models import User, Case, Evidence, Entity
from auth import hash_password
import nlp_pipeline
import graph_service
from analytics import compute_link_predictions, compute_anomaly_scores, compute_ips

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ---------------------------------------------------------------------------
# Initial Admin & Demo Users
# ---------------------------------------------------------------------------
admin_username = os.environ.get("INITIAL_ADMIN_USERNAME") or settings.INITIAL_ADMIN_USERNAME or "arhamk_17"
admin_email = os.environ.get("INITIAL_ADMIN_EMAIL") or settings.INITIAL_ADMIN_EMAIL or "hiarham17@gmail.com"
admin_password = (
    os.environ.get("INITIAL_ADMIN_PASSWORD")
    or os.environ.get("ADMIN_PASSWORD")
    or os.environ.get("NETRIX_ADMIN_PASSWORD")
    or settings.INITIAL_ADMIN_PASSWORD
)

if not admin_password:
    raise ValueError(
        "Initial admin password is required. Please set the INITIAL_ADMIN_PASSWORD environment variable before running the seeder."
    )

DEMO_USERS = [
    {"username": admin_username, "password": admin_password, "role": "admin", "email": admin_email},
    {"username": "investigator1", "password": "Inv@1234", "role": "investigator", "email": "inv1@demo.com"},
    {"username": "supervisor1", "password": "Sup@1234", "role": "supervisor", "email": "sup@demo.com"},
    {"username": "analyst1", "password": "Ana@1234", "role": "analyst", "email": "ana@demo.com"},
]

created_users = {}
for u in DEMO_USERS:
    existing = db.query(User).filter(User.username == u["username"]).first()
    if existing:
        existing.email = u["email"]
        existing.role = u["role"]
        if u.get("password"):
            existing.password_hash = hash_password(u["password"])
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        created_users[u["username"]] = existing
        continue
    user = User(
        username=u["username"],
        email=u["email"],
        password_hash=hash_password(u["password"]),
        role=u["role"],
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    created_users[u["username"]] = user

admin_user = created_users[admin_username]


# ---------------------------------------------------------------------------
# Demo case
# ---------------------------------------------------------------------------
case = db.query(Case).filter(Case.case_number == "CR/2024/MUM/0045").first()
if not case:
    case = Case(
        case_number="CR/2024/MUM/0045",
        title="Phoenix Group Financial Fraud",
        priority="high",
        status="active",
        created_by=admin_user.id,
        assigned_to=admin_user.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

case_id = str(case.id)

# ---------------------------------------------------------------------------
# Synthetic FIR text
# ---------------------------------------------------------------------------
FIR_TEXT = """First Information Report — Case 0045/2024
Mumbai Police — Economic Offences Wing

On 14th January 2024, complainant filed report of financial fraud.
Suspect Rajan Mehta, resident of Dadar, Mumbai, operated an illegal hawala network.
Rajan Mehta was contacted on phone number 9876543210 and 9988001122.
His associate Suresh Patil used vehicle MH-01-AB-1234.
Third suspect Priya Shah served as accountant at Phoenix Traders Pvt Ltd.
Phoenix Traders is registered at Kurla Industrial Estate.
Funds worth Rs 45,00,000 were transferred from account ACC001 to offshore account ACC007.
A meeting between Rajan Mehta and Suresh Patil was observed at Dadar Railway Station.
Suresh Patil was also seen near Kurla Depot on 13th January 2024.
Bank records show account ACC003 operated by Priya Shah received Rs 8,00,000.
Organization Shell Co Mumbai Ltd was used for layering transactions.
Vikram Joshi, associate of Suresh Patil, operates phone 9111222333.
"""

CDR_CSV = """caller_number,receiver_number,call_start,call_end,duration_seconds
9876543210,9123456789,2024-01-14 23:30:00,2024-01-14 23:35:42,342
9876543210,9988776655,2024-01-14 23:45:00,2024-01-14 23:47:00,120
9123456789,9876543210,2024-01-15 00:15:00,2024-01-15 00:16:29,89
9988776655,9111222333,2024-01-15 01:00:00,2024-01-15 01:07:36,456
9876543210,9111222333,2024-01-13 22:00:00,2024-01-13 22:03:30,210
9988001122,9123456789,2024-01-13 21:00:00,2024-01-13 21:02:10,130
9111222333,9988001122,2024-01-12 23:15:00,2024-01-12 23:16:00,60
9123456789,9988001122,2024-01-12 20:00:00,2024-01-12 20:05:00,300
"""

TRANSACTIONS_CSV = """from_account,to_account,amount,currency,timestamp
ACC001,ACC007,1500000,INR,2024-01-14 09:00:00
ACC003,ACC007,800000,INR,2024-01-14 10:30:00
ACC007,ACC009,2100000,INR,2024-01-15 09:00:00
ACC001,ACC005,450000,INR,2024-01-13 14:00:00
ACC005,ACC007,430000,INR,2024-01-13 15:30:00
ACC003,ACC005,220000,INR,2024-01-12 11:00:00
ACC009,ACC011,1800000,INR,2024-01-16 10:00:00
"""


def _ingest(source_type: str, filename: str, extracted: dict):
    evidence_id = uuid.uuid4()
    evidence = Evidence(
        id=evidence_id,
        case_id=case.id,
        filename=filename,
        original_filename=filename,
        file_type="text/plain" if source_type in ("fir", "report") else "text/csv",
        file_size_bytes=0,
        sha256_hash="seed_" + str(evidence_id),
        storage_path=f"./data/{case_id}/{filename}",
        source_type=source_type,
        uploaded_by=admin_user.id,
        processing_status="completed",
        extracted_data=extracted,
    )
    db.add(evidence)
    db.commit()

    resolved = nlp_pipeline.resolve_entities(extracted.get("entities", []))
    for ent in resolved:
        db.add(Entity(
            case_id=case.id,
            entity_type=ent["label"],
            canonical_name=ent["text"],
            aliases=ent.get("aliases", []),
            confidence=ent.get("confidence", 0.5),
            source_evidence_ids=ent.get("evidence_ids", [str(evidence_id)]),
        ))
    db.commit()

    graph_service.write_to_graph(
        case_id=case_id,
        entities=resolved,
        relations=extracted.get("relations", []),
        evidence_id=str(evidence_id),
    )


from leads import generate_leads_for_case
from model_metrics import seed_gnn_benchmark_metrics

# FIR
fir_extracted = nlp_pipeline.extract_from_text(FIR_TEXT, "ev_fir_0045")
_ingest("fir", "fir_0045.txt", fir_extracted)

# CDR
cdr_df = pd.read_csv(io.StringIO(CDR_CSV))
cdr_extracted = nlp_pipeline.extract_from_cdr(cdr_df, "ev_cdr_jan2024")
_ingest("cdr", "cdr_jan2024.csv", cdr_extracted)

# Transactions
txn_df = pd.read_csv(io.StringIO(TRANSACTIONS_CSV))
txn_extracted = nlp_pipeline.extract_from_transactions(txn_df, "ev_txn_jan2024")
_ingest("transaction", "transactions_jan2024.csv", txn_extracted)

# Cyber / IP infrastructure
ip_evidence_id = uuid.uuid4()
ip_entities = [
    {"label": "IP", "text": "192.168.1.105", "aliases": [], "confidence": 0.95, "evidence_ids": [str(ip_evidence_id)]},
    {"label": "IP", "text": "10.0.0.42", "aliases": [], "confidence": 0.92, "evidence_ids": [str(ip_evidence_id)]},
    {"label": "IP", "text": "172.16.0.88", "aliases": [], "confidence": 0.88, "evidence_ids": [str(ip_evidence_id)]},
]
ip_relations = [
    {"source": "Rajan Mehta", "target": "192.168.1.105", "type": "USES_IP", "confidence": 0.90},
    {"source": "Suresh Patil", "target": "10.0.0.42", "type": "USES_IP", "confidence": 0.85},
    {"source": "Priya Shah", "target": "172.16.0.88", "type": "USES_IP", "confidence": 0.88},
]
_ingest("cyber", "network_logs_jan2024.csv", {"entities": ip_entities, "relations": ip_relations})

# ---------------------------------------------------------------------------
# Analytics pass (GNN-Powered)
# ---------------------------------------------------------------------------
link_preds = compute_link_predictions(case_id, db)
print(f"GNN Link predictions computed: {len(link_preds)}")

anomalies = compute_anomaly_scores(case_id, db)
print(f"Anomalies / Kingpins flagged: {len(anomalies)}")
for a in anomalies:
    print(f"  - {a['name']} ({a['entity_type']}): {a['anomaly_score']} [{a['flag']}] via {a.get('model', 'Model')}")

ips_results = compute_ips(case_id, db)
print(f"Multimodal IPS results computed: {len(ips_results)}")

leads = generate_leads_for_case(case_id, db)
print(f"Investigative leads generated: {len(leads)}")

seed_gnn_benchmark_metrics(db)
print("Seeded genuine GNN benchmark evaluation metrics.")

db.close()

print(f"\nDemo seeded successfully. Case ID: {case_id}")
