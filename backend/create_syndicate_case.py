"""
create_syndicate_case.py
Provisions and ingests the dedicated multi-jurisdictional criminal syndicate case featuring:
1. Akshat Malhotra (Syndicate Kingpin & Operations Head)
2. Abinaya Sundaram (Cyber Exploitation & Technical Lead)
3. Rishika Sen (Financial Controller & Hawala Escrow Lead)
4. Arham Mehta (Darknet Infrastructure & Command Node Operator)
5. Likith Reddy (Tactical Drop & Logistics Courier)
6. Shrushti Joshi (Crypto Layering & Custodial Auditor)
"""
import io
import os
import uuid
from datetime import datetime, timedelta
import pandas as pd

from config import settings
from database import SessionLocal, Base, engine, is_neo4j_online, get_neo4j_session
from models import User, Case, Evidence, Entity, Relationship, Event, IPSResult, AnalyticsResult, LeadResult
from auth import hash_password
import nlp_pipeline
import graph_service
from analytics import compute_link_predictions, compute_anomaly_scores, compute_ips
from leads import generate_leads_for_case
from model_metrics import seed_gnn_benchmark_metrics

# Initialize DB tables
Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("[*] Initializing Team User Accounts...")
TEAM_MEMBERS = [
    {"username": "akshat", "email": "akshat@netrix.org", "role": "investigator", "password": "Netrix@2026"},
    {"username": "abinaya", "email": "abinaya@netrix.org", "role": "analyst", "password": "Netrix@2026"},
    {"username": "rishika", "email": "rishika@netrix.org", "role": "supervisor", "password": "Netrix@2026"},
    {"username": "arham", "email": "arham@netrix.org", "role": "admin", "password": "Netrix@2026"},
    {"username": "likith", "email": "likith@netrix.org", "role": "investigator", "password": "Netrix@2026"},
    {"username": "shrushti", "email": "shrushti@netrix.org", "role": "auditor", "password": "Netrix@2026"},
    {"username": "arhamk_17", "email": "hiarham17@gmail.com", "role": "admin", "password": "Rishika@24"},
    {"username": "investigator1", "email": "inv1@demo.com", "role": "investigator", "password": "Inv@1234"},
]

user_records = {}
for member in TEAM_MEMBERS:
    user = db.query(User).filter(User.username == member["username"]).first()
    if not user:
        user = User(
            username=member["username"],
            email=member["email"],
            password_hash=hash_password(member["password"]),
            role=member["role"],
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.email = member["email"]
        user.role = member["role"]
        user.password_hash = hash_password(member["password"])
        db.commit()
        db.refresh(user)
    user_records[member["username"]] = user

admin_user = db.query(User).filter(User.role == "admin").first() or list(user_records.values())[0]

# ---------------------------------------------------------------------------
# Register Syndicate Case
# ---------------------------------------------------------------------------
CASE_NUMBER = "CR/2026/NETRIX/0096"
CASE_TITLE = "Operation ShadowNet: Apex Financial & Cyber Syndicate"
CASE_DESC = (
    "Comprehensive criminal network intelligence, cross-border hawala tracing, and cyber forensics "
    "investigation targeting the 6 syndicate kingpins: Akshat Malhotra (Syndicate Kingpin), "
    "Abinaya Sundaram (Cyber Infiltration), Rishika Sen (Hawala Escrow & Financial Controller), "
    "Arham Mehta (Darknet Command Node), Likith Reddy (Tactical Logistics & Cash Drop), "
    "and Shrushti Joshi (Crypto Layering & Tumbling Auditor)."
)

case = db.query(Case).filter(Case.case_number == CASE_NUMBER).first()
if case:
    print(f"[*] Re-seeding existing case: {CASE_NUMBER}")
    db.query(Entity).filter(Entity.case_id == case.id).delete()
    db.query(Relationship).filter(Relationship.case_id == case.id).delete()
    db.query(Event).filter(Event.case_id == case.id).delete()
    db.query(Evidence).filter(Evidence.case_id == case.id).delete()
    db.query(IPSResult).filter(IPSResult.case_id == case.id).delete()
    db.query(LeadResult).filter(LeadResult.case_id == case.id).delete()
    db.query(AnalyticsResult).filter(AnalyticsResult.case_id == case.id).delete()
    db.commit()
    case.title = CASE_TITLE
    case.description = CASE_DESC
    case.priority = "critical"
    case.status = "active"
    case.tags = ["SYNDICATE", "CYBER_CRIME", "HAWALA", "DARKNET", "CRYPTOCURRENCY", "KINGPINS"]
    db.commit()
    db.refresh(case)
else:
    case = Case(
        case_number=CASE_NUMBER,
        title=CASE_TITLE,
        description=CASE_DESC,
        priority="critical",
        status="active",
        tags=["SYNDICATE", "CYBER_CRIME", "HAWALA", "DARKNET", "CRYPTOCURRENCY", "KINGPINS"],
        created_by=admin_user.id,
        assigned_to=admin_user.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

case_id = str(case.id)
print(f"[*] Case Active: {case.case_number} (UUID: {case_id})")

# ---------------------------------------------------------------------------
# Evidence 1: Forensic FIR Narrative
# ---------------------------------------------------------------------------
FIR_TEXT = f"""First Information Report — Case {CASE_NUMBER}
Special Cyber Crime & Financial Intelligence Bureau — Metropolitan Forensic Enclave

On 10th February 2026, intercepted intelligence initiated Operation ShadowNet.
Primary syndicate target Akshat Malhotra was identified as the operational mastermind orchestrating illicit financial flow and logistics across Mumbai and Bengaluru.
Akshat Malhotra communicates via primary encrypted terminal 9820011223 and secondary satellite burner 9820044556.
Technical operative Abinaya Sundaram manages the clandestine cyber infrastructure and unauthorized intrusion payload delivery from Bandra-Kurla Complex.
Abinaya Sundaram operates phone line 9833112233 and designated offshore account ACC_SUNDARAM_901.

Senior Financial Controller Rishika Sen oversees cross-jurisdictional money routing, escrow holding, and darknet liquidation.
Rishika Sen operates terminal 9844223344 and centralized escrow account ACC_SEN_505.
Platform Lead Arham Mehta manages the central command node, encrypted reverse-proxies, and bulletproof hosting servers using terminal 9855334455.
Arham Mehta operates getaway vehicle MH-02-NX-2026 and authorized fund disbursements through account ACC_MEHTA_101.

Tactical courier Likith Reddy performed physical asset transit, cash drops, and SIM card dispersal near Dadar Enclave and Kurla Tech Park.
Likith Reddy operates contact line 9866445566 and armored logistics vehicle MH-04-LK-8899.
Custodial Auditor Shrushti Joshi conducted cryptographic Merkle tree tumbling, cryptocurrency mixing, and chain-of-custody obfuscation.
Shrushti Joshi operates line 9877556677 and custodial audit account ACC_JOSHI_707.

Inter-entity transfer of Rs 75,00,000 was routed from ACC_MEHTA_101 to ACC_SEN_505 for operational forensics.
Subsequent allocation of Rs 25,00,000 was transferred to ACC_SUNDARAM_901 and Rs 15,00,000 to ACC_JOSHI_707.
Surveillance confirmed direct operational coordination between Akshat Malhotra, Abinaya Sundaram, Rishika Sen, Arham Mehta, Likith Reddy, and Shrushti Joshi at the ShadowNet Safehouse Command Center.
"""

# ---------------------------------------------------------------------------
# Evidence 2: CDR Telecommunication Trace
# ---------------------------------------------------------------------------
CDR_CSV = """caller_number,receiver_number,call_start,call_end,duration_seconds
9820011223,9833112233,2026-02-10 10:15:00,2026-02-10 10:22:45,465
9820011223,9844223344,2026-02-10 11:00:00,2026-02-10 11:08:12,492
9855334455,9820011223,2026-02-10 12:30:00,2026-02-10 12:39:20,560
9855334455,9866445566,2026-02-10 14:00:00,2026-02-10 14:15:30,930
9866445566,9877556677,2026-02-10 15:45:00,2026-02-10 15:52:10,430
9833112233,9877556677,2026-02-10 16:20:00,2026-02-10 16:31:00,660
9844223344,9855334455,2026-02-10 17:00:00,2026-02-10 17:12:40,760
9820044556,9866445566,2026-02-10 18:30:00,2026-02-10 18:36:15,375
9820011223,9855334455,2026-02-10 20:00:00,2026-02-10 20:14:00,840
"""

# ---------------------------------------------------------------------------
# Evidence 3: High-Value Financial Ledger
# ---------------------------------------------------------------------------
TRANSACTIONS_CSV = """from_account,to_account,amount,currency,timestamp
ACC_MEHTA_101,ACC_SEN_505,7500000,INR,2026-02-10 09:30:00
ACC_SEN_505,ACC_SUNDARAM_901,2500000,INR,2026-02-10 11:15:00
ACC_SEN_505,ACC_JOSHI_707,1500000,INR,2026-02-10 13:45:00
ACC_SUNDARAM_901,ACC_MALHOTRA_303,1200000,INR,2026-02-10 15:00:00
ACC_MEHTA_101,ACC_REDDY_404,800000,INR,2026-02-10 16:30:00
ACC_MALHOTRA_303,ACC_JOSHI_707,450000,INR,2026-02-10 17:50:00
ACC_JOSHI_707,ACC_MALHOTRA_303,1850000,INR,2026-02-10 21:00:00
"""

# ---------------------------------------------------------------------------
# Evidence Storage & Ingestion Helpers
# ---------------------------------------------------------------------------
os.makedirs(f"./data/{case_id}", exist_ok=True)

def ingest_evidence_doc(source_type: str, filename: str, content_str: str, extracted: dict):
    evidence_id = uuid.uuid4()
    storage_path = f"./data/{case_id}/{filename}"
    with open(storage_path, "w", encoding="utf-8") as f:
        f.write(content_str)

    evidence = Evidence(
        id=evidence_id,
        case_id=case.id,
        filename=filename,
        original_filename=filename,
        file_type="text/plain" if source_type in ("fir", "report") else "text/csv",
        file_size_bytes=len(content_str.encode("utf-8")),
        sha256_hash="seed_" + str(evidence_id),
        storage_path=storage_path,
        source_type=source_type,
        uploaded_by=admin_user.id,
        processing_status="completed",
        extracted_data=extracted,
        blockchain_status="verified",
        blockchain_tx_hash=f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}",
        blockchain_block_number=19420800,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence

# 1. Ingest FIR
print("[*] Ingesting FIR Narrative...")
fir_extracted = nlp_pipeline.extract_from_text(FIR_TEXT, f"ev_fir_{case_id[:8]}")
ev_fir = ingest_evidence_doc("fir", f"fir_shadownet_{case_id[:8]}.txt", FIR_TEXT, fir_extracted)

# 2. Ingest CDR
print("[*] Ingesting CDR Evidence...")
cdr_df = pd.read_csv(io.StringIO(CDR_CSV))
cdr_extracted = nlp_pipeline.extract_from_cdr(cdr_df, f"ev_cdr_{case_id[:8]}")
ev_cdr = ingest_evidence_doc("cdr", f"cdr_shadownet_{case_id[:8]}.csv", CDR_CSV, cdr_extracted)

# 3. Ingest Financial Ledger
print("[*] Ingesting Financial Ledger...")
txn_df = pd.read_csv(io.StringIO(TRANSACTIONS_CSV))
txn_extracted = nlp_pipeline.extract_from_transactions(txn_df, f"ev_txn_{case_id[:8]}")
ev_txn = ingest_evidence_doc("transaction", f"transactions_shadownet_{case_id[:8]}.csv", TRANSACTIONS_CSV, txn_extracted)

# 4. Ingest Cyber & Darknet Node Network
print("[*] Ingesting Cyber & Crypto Forensics...")
CYBER_CSV = """source_node,target_node,relation_type,confidence,timestamp
Akshat Malhotra,Abinaya Sundaram,COORDINATES_WITH,0.98,2026-02-10 10:30:00
Abinaya Sundaram,Rishika Sen,REPORTS_TO,0.95,2026-02-10 11:30:00
Rishika Sen,Arham Mehta,COLLABORATES_WITH,0.97,2026-02-10 12:45:00
Arham Mehta,Likith Reddy,DEPLOYS_COURIER,0.94,2026-02-10 14:15:00
Likith Reddy,Shrushti Joshi,TRANSMITS_ASSETS,0.96,2026-02-10 16:00:00
Shrushti Joshi,Akshat Malhotra,RETURNS_LAUNDERED_CAPITAL,0.99,2026-02-10 18:00:00
Akshat Malhotra,0x7F9a4B2C81e6D540192Aa88B12F,CONTROLS_WALLET,0.96,2026-02-10 18:30:00
Arham Mehta,10.240.1.50,ADMINISTERS_SERVER,0.97,2026-02-10 19:00:00
Abinaya Sundaram,192.168.10.45,OPERATES_COMMAND_NODE,0.95,2026-02-10 19:30:00
Shrushti Joshi,0x942B4E1C387A119280dEA94B,TUMBLES_CRYPTO,0.98,2026-02-10 20:15:00
"""
ev_cyber = ingest_evidence_doc("cyber", f"cyber_infrastructure_{case_id[:8]}.csv", CYBER_CSV, {})

# ---------------------------------------------------------------------------
# Entities Definition (6 Criminals + Supporting Forensic Nodes)
# ---------------------------------------------------------------------------
print("[*] Building Forensic Entity Registry for 6 Criminal Kingpins...")
CRIMINAL_ENTITIES = [
    {
        "name": "Akshat Malhotra",
        "type": "PERSON",
        "aliases": ["Akshat", "Apex Mastermind", "Target Alpha"],
        "confidence": 0.99,
        "attributes": {
            "role": "Syndicate Kingpin & Operations Mastermind",
            "threat_level": "CRITICAL",
            "phone": "9820011223",
            "location": "Mumbai / Bangalore",
            "account": "ACC_MALHOTRA_303"
        }
    },
    {
        "name": "Abinaya Sundaram",
        "type": "PERSON",
        "aliases": ["Abinaya", "Cyber Architect", "Specter"],
        "confidence": 0.98,
        "attributes": {
            "role": "Cyber Infiltration & Technical Lead",
            "threat_level": "HIGH",
            "phone": "9833112233",
            "location": "BKC Enclave",
            "account": "ACC_SUNDARAM_901"
        }
    },
    {
        "name": "Rishika Sen",
        "type": "PERSON",
        "aliases": ["Rishika", "Escrow Controller", "Hawala Manager"],
        "confidence": 0.98,
        "attributes": {
            "role": "Hawala Escrow & Financial Controller",
            "threat_level": "CRITICAL",
            "phone": "9844223344",
            "location": "Metropolitan Hub",
            "account": "ACC_SEN_505"
        }
    },
    {
        "name": "Arham Mehta",
        "type": "PERSON",
        "aliases": ["Arham", "Infrastructure Architect", "Root Node"],
        "confidence": 0.97,
        "attributes": {
            "role": "Darknet Infrastructure & Command Node Operator",
            "threat_level": "HIGH",
            "phone": "9855334455",
            "vehicle": "MH-02-NX-2026",
            "account": "ACC_MEHTA_101"
        }
    },
    {
        "name": "Likith Reddy",
        "type": "PERSON",
        "aliases": ["Likith", "Field Courier", "Drop Operator"],
        "confidence": 0.96,
        "attributes": {
            "role": "Tactical Logistics, Drop & Physical Courier",
            "threat_level": "HIGH",
            "phone": "9866445566",
            "vehicle": "MH-04-LK-8899",
            "location": "Dadar / Kurla",
            "account": "ACC_REDDY_404"
        }
    },
    {
        "name": "Shrushti Joshi",
        "type": "PERSON",
        "aliases": ["Shrushti", "Crypto Tumbler", "Audit Obfuscator"],
        "confidence": 0.98,
        "attributes": {
            "role": "Crypto Layering & Tumbling Auditor",
            "threat_level": "CRITICAL",
            "phone": "9877556677",
            "account": "ACC_JOSHI_707"
        }
    },
    # Infrastructure Nodes
    {"name": "0x7F9a4B2C81e6D540192Aa88B12F", "type": "CRYPTO_WALLET", "aliases": [], "confidence": 0.96, "attributes": {"chain": "Ethereum", "balance": "142.5 ETH"}},
    {"name": "0x942B4E1C387A119280dEA94B", "type": "CRYPTO_WALLET", "aliases": [], "confidence": 0.95, "attributes": {"chain": "Monero/BTC", "tumbler_pool": "TORNADO_CLONE"}},
    {"name": "10.240.1.50", "type": "SERVER_IP", "aliases": [], "confidence": 0.97, "attributes": {"protocol": "Darknet Reverse Proxy"}},
    {"name": "192.168.10.45", "type": "SERVER_IP", "aliases": [], "confidence": 0.94, "attributes": {"protocol": "Command & Control Node"}},
    {"name": "MH-02-NX-2026", "type": "VEHICLE", "aliases": [], "confidence": 0.93, "attributes": {"model": "Black Armored SUV"}},
    {"name": "ShadowNet Command Center", "type": "LOCATION", "aliases": [], "confidence": 0.95, "attributes": {"city": "Mumbai", "zone": "BKC Forensics Cluster"}},
]

entity_db_map = {}
for ent_dict in CRIMINAL_ENTITIES:
    ent_obj = Entity(
        case_id=case.id,
        entity_type=ent_dict["type"],
        canonical_name=ent_dict["name"],
        aliases=ent_dict["aliases"],
        attributes=ent_dict["attributes"],
        confidence=ent_dict["confidence"],
        source_evidence_ids=[str(ev_fir.id), str(ev_cdr.id), str(ev_txn.id), str(ev_cyber.id)],
    )
    db.add(ent_obj)
    db.commit()
    db.refresh(ent_obj)
    entity_db_map[ent_dict["name"]] = ent_obj

# ---------------------------------------------------------------------------
# Relationships & Links Definition
# ---------------------------------------------------------------------------
print("[*] Wiring Syndicate Graph Link Topology...")
SYNDICATE_RELATIONSHIPS = [
    # Criminal coordination ring
    ("Akshat Malhotra", "Abinaya Sundaram", "COORDINATES_WITH", 0.98, "2026-02-10 10:15:00", ev_cdr.id),
    ("Abinaya Sundaram", "Rishika Sen", "REPORTS_TO", 0.95, "2026-02-10 11:00:00", ev_cdr.id),
    ("Rishika Sen", "Arham Mehta", "COLLABORATES_WITH", 0.97, "2026-02-10 12:30:00", ev_cdr.id),
    ("Arham Mehta", "Likith Reddy", "DEPLOYS", 0.94, "2026-02-10 14:00:00", ev_cdr.id),
    ("Likith Reddy", "Shrushti Joshi", "TRANSMITS_EVIDENCE", 0.96, "2026-02-10 15:45:00", ev_cdr.id),
    ("Shrushti Joshi", "Akshat Malhotra", "RETURNS_CLEAN_CAPITAL", 0.99, "2026-02-10 17:50:00", ev_txn.id),
    
    # Financial transfers
    ("Arham Mehta", "Rishika Sen", "TRANSFERS_MONEY_TO", 0.99, "2026-02-10 09:30:00", ev_txn.id),
    ("Rishika Sen", "Abinaya Sundaram", "TRANSFERS_MONEY_TO", 0.99, "2026-02-10 11:15:00", ev_txn.id),
    ("Rishika Sen", "Shrushti Joshi", "TRANSFERS_MONEY_TO", 0.99, "2026-02-10 13:45:00", ev_txn.id),
    ("Abinaya Sundaram", "Akshat Malhotra", "TRANSFERS_MONEY_TO", 0.98, "2026-02-10 15:00:00", ev_txn.id),
    ("Arham Mehta", "Likith Reddy", "TRANSFERS_MONEY_TO", 0.97, "2026-02-10 16:30:00", ev_txn.id),
    
    # Infrastructure controls
    ("Akshat Malhotra", "0x7F9a4B2C81e6D540192Aa88B12F", "CONTROLS_WALLET", 0.96, "2026-02-10 18:30:00", ev_cyber.id),
    ("Shrushti Joshi", "0x942B4E1C387A119280dEA94B", "TUMBLES_CRYPTO", 0.98, "2026-02-10 20:15:00", ev_cyber.id),
    ("Arham Mehta", "10.240.1.50", "ADMINISTERS_SERVER", 0.97, "2026-02-10 19:00:00", ev_cyber.id),
    ("Abinaya Sundaram", "192.168.10.45", "OPERATES_COMMAND_NODE", 0.95, "2026-02-10 19:30:00", ev_cyber.id),
    ("Arham Mehta", "MH-02-NX-2026", "OPERATES_VEHICLE", 0.93, "2026-02-10 14:00:00", ev_fir.id),
    ("Akshat Malhotra", "ShadowNet Command Center", "LOCATED_AT", 0.96, "2026-02-10 20:00:00", ev_fir.id),
]

for src_name, tgt_name, rel_type, conf, ts_str, ev_id in SYNDICATE_RELATIONSHIPS:
    src_ent = entity_db_map.get(src_name)
    tgt_ent = entity_db_map.get(tgt_name)
    if src_ent and tgt_ent:
        ts_val = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
        rel_obj = Relationship(
            case_id=case.id,
            source_entity_id=src_ent.id,
            target_entity_id=tgt_ent.id,
            relationship_type=rel_type,
            timestamp=ts_val,
            confidence=conf,
            provenance_type="OBSERVED",
            evidence_id=ev_id,
            attributes={"source_name": src_name, "target_name": tgt_name}
        )
        db.add(rel_obj)

        # Also register timeline Event
        event_obj = Event(
            case_id=case.id,
            event_type=rel_type,
            title=f"{src_name} {rel_type.replace('_', ' ').title()} {tgt_name}",
            description=f"Surveillance captured {src_name} engaging in {rel_type.replace('_', ' ')} with {tgt_name}.",
            timestamp=ts_val,
            location="BKC / Mumbai Enclave",
            evidence_id=ev_id,
            attributes={"confidence": conf, "source": src_name, "target": tgt_name}
        )
        db.add(event_obj)

db.commit()

# Write into Neo4j if available
try:
    if is_neo4j_online():
        resolved_entities = [
            {"label": ent["type"], "text": ent["name"], "confidence": ent["confidence"]}
            for ent in CRIMINAL_ENTITIES
        ]
        relations_payload = [
            {"subject": s, "object": t, "predicate": r, "confidence": c, "timestamp": ts}
            for s, t, r, c, ts, _ in SYNDICATE_RELATIONSHIPS
        ]
        graph_service.write_to_graph(case_id, resolved_entities, relations_payload, str(ev_fir.id))
        print("[+] Synced graph topology with Neo4j cluster.")
except Exception as ne:
    print(f"[!] Neo4j sync bypassed: {ne}")

# ---------------------------------------------------------------------------
# Machine Learning Intelligence & GNN Execution
# ---------------------------------------------------------------------------
print("[*] Executing GNN & Forensic Analytics Pipeline...")

# 1. Multimodal IPS Results
ips_scores_data = [
    ("Akshat Malhotra", "PERSON", 0.96, "Primary syndicate mastermind coordinating logistics, high-value transfers, and operational command."),
    ("Rishika Sen", "PERSON", 0.94, "Central financial escrow hub routing over Rs 75,00,000 in layered hawala transactions."),
    ("Shrushti Joshi", "PERSON", 0.91, "Key cryptographic laundering operative managing Merkle tumblers and Monero pools."),
    ("Abinaya Sundaram", "PERSON", 0.88, "Technical exploit lead maintaining illegal command nodes and malware C2 infrastructure."),
    ("Arham Mehta", "PERSON", 0.86, "Network infrastructure architect providing darknet reverse proxies and getaway logistics."),
    ("Likith Reddy", "PERSON", 0.82, "Tactical courier executing on-ground cash drops and burner SIM card dispersal."),
]

for name, ent_type, score, explanation in ips_scores_data:
    ent_obj = entity_db_map.get(name)
    ips_record = IPSResult(
        case_id=case.id,
        entity_id=ent_obj.id if ent_obj else None,
        entity_name=name,
        entity_type=ent_type,
        ips_score=score,
        contributing_factors={
            "centrality_weight": 0.35,
            "financial_flow_weight": 0.40,
            "telecom_frequency_weight": 0.25,
            "kingpin_flag": True
        },
        explanation=explanation,
        computed_at=datetime.utcnow()
    )
    db.add(ips_record)
db.commit()

# 2. Link Predictions & GNN Analytics
try:
    link_preds = compute_link_predictions(case_id, db)
    print(f"  [+] GNN Link predictions calculated: {len(link_preds)}")
except Exception as e:
    print(f"  [!] Link prediction warning: {e}")

try:
    anomalies = compute_anomaly_scores(case_id, db)
    print(f"  [+] Kingpins / Anomaly nodes detected: {len(anomalies)}")
except Exception as e:
    print(f"  [!] Anomaly warning: {e}")

try:
    leads = generate_leads_for_case(case_id, db)
    print(f"  [+] Generated investigative leads: {len(leads)}")
except Exception as e:
    print(f"  [!] Leads warning: {e}")

try:
    seed_gnn_benchmark_metrics(db)
    print("  [+] Seeded GNN Benchmark metrics.")
except Exception as e:
    print(f"  [!] Benchmark warning: {e}")

db.close()

print(f"\n" + "=" * 65)
print(f"  SUCCESSFULLY PROVISIONED CRIMINAL SYNDICATE CASE")
print(f"  Case Number : {CASE_NUMBER}")
print(f"  Case Title  : {CASE_TITLE}")
print(f"  Case ID     : {case_id}")
print(f"  6 Criminals : Akshat Malhotra, Abinaya Sundaram, Rishika Sen,")
print(f"                Arham Mehta, Likith Reddy, Shrushti Joshi")
print(f"  Status      : Active on Netrix Frontend")
print(f"=" * 65 + "\n")
