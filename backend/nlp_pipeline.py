import logging
import re
from datetime import datetime

import pandas as pd
import spacy
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from models import Entity, Relationship

logger = logging.getLogger(__name__)

# Lazy load spacy model on demand
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        for model_name in ["en_core_web_trf", "en_core_web_sm", "en_core_web_md"]:
            try:
                _nlp = spacy.load(model_name)
                break
            except Exception:
                continue
        if _nlp is None:
            _nlp = spacy.blank("en")
        if "sentencizer" not in _nlp.pipe_names and "parser" not in _nlp.pipe_names:
            _nlp.add_pipe("sentencizer")
    return _nlp


PHONE_RE = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\b[6-9]\d{9}\b|\b\+91[-.\s]?[6-9]\d{4}[-.\s]?\d{5}\b")
VEHICLE_RE = re.compile(r"\b[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{1,4}\b", re.IGNORECASE)
ACCOUNT_RE = re.compile(r"\b(ACC\d{3,}|[A-Z]{4}\d{10,})\b", re.IGNORECASE)
IP_RE = re.compile(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
DOMAIN_RE = re.compile(r"\b(?!(?:\d+\.){3}\d+)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|in|example|test|gov|edu|me|xyz|tech|co|site|online|top|cc|onion|info|biz|ai)\b", re.IGNORECASE)
WALLET_RE = re.compile(r"\b(?:WALLET-[A-Za-z0-9]+|0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b")
USER_HANDLE_RE = re.compile(r"\b(?:user|suspect|target|agent|operator)_[a-zA-Z0-9_]+\b", re.IGNORECASE)
ARROW_REL_RE = re.compile(r"([A-Za-z0-9._%+-]+)\s*->\s*([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9._%+-]+)")

SPACY_LABELS = {"PERSON", "ORG", "GPE", "LOC", "FAC", "NORP"}

REL_PATTERNS = [
    (re.compile(r"\b(?:transfer|transferred|wire|payment|paid|sent|received|hawala|transferred_to)\b", re.I), "TRANSFERS_MONEY_TO"),
    (re.compile(r"\b(?:connect|connected|connecting|link|linked|connected_to)\b", re.I), "COMMUNICATES_WITH"),
    (re.compile(r"\b(?:contact|contacted|contacting|call|called|calling)\b", re.I), "CONTACTED"),
    (re.compile(r"\b(?:communicat|communicated|communicating|talked|spoke|communicated_with)\b", re.I), "COMMUNICATES_WITH"),
    (re.compile(r"\b(?:access|accessed|accessing|visit|visited|visiting|seen near|located at)\b", re.I), "LOCATED_AT"),
    (re.compile(r"\b(?:associate|associated|associate of|associated with|partner|accomplice|conspiracy)\b", re.I), "ASSOCIATE_OF"),
    (re.compile(r"\b(?:meet|meeting|met|rendezvous|gathered)\b", re.I), "MEETS_WITH"),
    (re.compile(r"\b(?:operat|operated|operating|operates|used|uses|using)\b", re.I), "OPERATES"),
    (re.compile(r"\b(?:own|owns|owner|registered at|belongs to)\b", re.I), "OWNS"),
    (re.compile(r"\b(?:accountant at|works for|employed by|member of|director of)\b", re.I), "EMPLOYED_BY"),
]


def _regex_entities(text: str, evidence_id: str) -> list[dict]:
    ents = []
    seen = set()

    for m in USER_HANDLE_RE.finditer(text):
        val = m.group()
        if val.lower() not in seen:
            ents.append({"text": val, "label": "PERSON", "confidence": 0.90, "evidence_id": evidence_id})
            seen.add(val.lower())

    for m in IP_RE.finditer(text):
        val = m.group()
        if val not in seen:
            ents.append({"text": val, "label": "SERVER_IP", "confidence": 0.95, "evidence_id": evidence_id})
            seen.add(val)

    for m in WALLET_RE.finditer(text):
        val = m.group()
        if val not in seen:
            ents.append({"text": val, "label": "CRYPTO_WALLET", "confidence": 0.90, "evidence_id": evidence_id})
            seen.add(val)

    for m in EMAIL_RE.finditer(text):
        val = m.group()
        if val.lower() not in seen:
            ents.append({"text": val, "label": "EMAIL", "confidence": 0.95, "evidence_id": evidence_id})
            seen.add(val.lower())

    for m in DOMAIN_RE.finditer(text):
        val = m.group()
        if val.lower() not in seen and not any(val.lower() in e for e in seen if "@" in e):
            ents.append({"text": val, "label": "DOMAIN", "confidence": 0.85, "evidence_id": evidence_id})
            seen.add(val.lower())

    for m in PHONE_RE.finditer(text):
        val = m.group()
        if val not in seen:
            ents.append({"text": val, "label": "PHONE", "confidence": 0.90, "evidence_id": evidence_id})
            seen.add(val)

    for m in VEHICLE_RE.finditer(text):
        val = m.group()
        if val.upper() not in seen:
            ents.append({"text": val, "label": "VEHICLE", "confidence": 0.85, "evidence_id": evidence_id})
            seen.add(val.upper())

    for m in ACCOUNT_RE.finditer(text):
        val = m.group()
        if val not in seen:
            ents.append({"text": val, "label": "BANK_ACCOUNT", "confidence": 0.90, "evidence_id": evidence_id})
            seen.add(val)

    return ents


def extract_from_text(text: str, evidence_id: str) -> dict:
    nlp_model = get_nlp()
    doc = nlp_model(text)

    entities = []
    seen_texts = set()

    for ent in doc.ents:
        if ent.label_ in SPACY_LABELS:
            clean_t = ent.text.strip()
            if clean_t and clean_t.lower() not in seen_texts:
                entities.append({
                    "text": clean_t,
                    "label": ent.label_,
                    "confidence": 0.8,
                    "evidence_id": evidence_id,
                })
                seen_texts.add(clean_t.lower())

    for regex_ent in _regex_entities(text, evidence_id):
        if regex_ent["text"].lower() not in seen_texts:
            entities.append(regex_ent)
            seen_texts.add(regex_ent["text"].lower())

    relations = []
    seen_rels = set()

    # 1. Parse explicit arrow relationships if present (e.g. A -> connected_to -> B)
    for m in ARROW_REL_RE.finditer(text):
        subj, raw_pred, obj = m.groups()
        pred = raw_pred.strip().upper()
        if pred in ("CONNECTED_TO", "CONNECTS_TO"):
            pred = "COMMUNICATES_WITH"
        elif pred in ("ACCESSED", "ACCESS"):
            pred = "LOCATED_AT"
        elif pred in ("TRANSFERRED_TO", "TRANSFERRED"):
            pred = "TRANSFERS_MONEY_TO"
        elif pred in ("COMMUNICATED_WITH", "COMMUNICATES_WITH"):
            pred = "COMMUNICATES_WITH"
        elif pred in ("ASSOCIATED_WITH", "IS_ASSOCIATED_WITH"):
            pred = "ASSOCIATE_OF"

        subj_ent = next((e for e in entities if e["text"].lower() == subj.lower()), None)
        obj_ent = next((e for e in entities if e["text"].lower() == obj.lower()), None)
        subj_label = subj_ent["label"] if subj_ent else "ENTITY"
        obj_label = obj_ent["label"] if obj_ent else "ENTITY"

        key = (subj.lower(), pred, obj.lower())
        if key not in seen_rels and subj.lower() != obj.lower():
            relations.append({
                "subject": subj,
                "subject_label": subj_label,
                "predicate": pred,
                "object": obj,
                "object_label": obj_label,
                "confidence": 0.90,
                "evidence_id": evidence_id,
                "timestamp": None,
            })
            seen_rels.add(key)

    # 2. Sentence-level natural language relation extraction
    try:
        lines_or_sents = [s.text.strip() for s in doc.sents if s.text.strip()]
    except Exception:
        lines_or_sents = [l.strip() for l in text.splitlines() if l.strip()]

    if not lines_or_sents or len(lines_or_sents) <= 1:
        fallback_lines = [l.strip() for l in text.splitlines() if l.strip()]
        if len(fallback_lines) > len(lines_or_sents):
            lines_or_sents = fallback_lines

    for sent_text in lines_or_sents:
        sent_lower = sent_text.lower()
        present_ents = [e for e in entities if e["text"].lower() in sent_lower and len(e["text"]) > 1]
        present_ents.sort(key=lambda e: sent_lower.find(e["text"].lower()))

        if len(present_ents) >= 2:
            pred = None
            for pat, p_type in REL_PATTERNS:
                if pat.search(sent_text):
                    pred = p_type
                    break

            for i in range(len(present_ents) - 1):
                e1 = present_ents[i]
                e2 = present_ents[i + 1]
                if e1["text"].lower() == e2["text"].lower():
                    continue

                rel_pred = pred
                if not rel_pred:
                    # Semantic co-occurrence heuristics
                    if e1["label"] == "PERSON" and e2["label"] == "PHONE":
                        rel_pred = "USES"
                    elif e1["label"] == "PERSON" and e2["label"] in ("ORG", "ORGANIZATION"):
                        rel_pred = "EMPLOYED_BY"
                    elif e1["label"] == "PERSON" and e2["label"] in ("GPE", "LOC", "LOCATION"):
                        rel_pred = "LOCATED_AT"
                    elif e1["label"] == "PERSON" and e2["label"] == "VEHICLE":
                        rel_pred = "OWNS"
                    elif e1["label"] == "CRYPTO_WALLET" and e2["label"] == "CRYPTO_WALLET":
                        rel_pred = "TRANSFERS_MONEY_TO"
                    elif e1["label"] == "BANK_ACCOUNT" and e2["label"] == "BANK_ACCOUNT":
                        rel_pred = "TRANSFERS_MONEY_TO"
                    elif e1["label"] in ("SERVER_IP", "IP") and e2["label"] in ("SERVER_IP", "IP", "DOMAIN"):
                        rel_pred = "CONTACTED"
                    elif e1["label"] == "PERSON" and e2["label"] == "PERSON":
                        rel_pred = "COMMUNICATES_WITH"
                    else:
                        rel_pred = "RELATED_TO"

                key = (e1["text"].lower(), rel_pred, e2["text"].lower())
                if key not in seen_rels:
                    relations.append({
                        "subject": e1["text"],
                        "subject_label": e1["label"],
                        "predicate": rel_pred,
                        "object": e2["text"],
                        "object_label": e2["label"],
                        "confidence": 0.80 if pred else 0.65,
                        "evidence_id": evidence_id,
                        "timestamp": None,
                    })
                    seen_rels.add(key)

    return {"entities": entities, "relations": relations}


def extract_from_cdr(df, evidence_id: str) -> dict:
    entities, relations = [], []
    for _, row in df.iterrows():
        caller, receiver = str(row["caller_number"]), str(row["receiver_number"])
        entities.append({"text": caller, "label": "PHONE", "confidence": 0.9, "evidence_id": evidence_id})
        entities.append({"text": receiver, "label": "PHONE", "confidence": 0.9, "evidence_id": evidence_id})
        relations.append({
            "subject": caller, "subject_label": "PHONE",
            "predicate": "CALLS",
            "object": receiver, "object_label": "PHONE",
            "confidence": 0.95, "evidence_id": evidence_id,
            "timestamp": str(row.get("call_start", "")),
            "attributes": {"duration_seconds": row.get("duration_seconds"), "call_end": str(row.get("call_end", ""))},
        })
    return {"entities": entities, "relations": relations}


def extract_from_transactions(df, evidence_id: str) -> dict:
    entities, relations = [], []
    for _, row in df.iterrows():
        src, dst = str(row["from_account"]), str(row["to_account"])
        amount = float(row["amount"])
        entities.append({"text": src, "label": "BANK_ACCOUNT", "confidence": 0.9, "evidence_id": evidence_id})
        entities.append({"text": dst, "label": "BANK_ACCOUNT", "confidence": 0.9, "evidence_id": evidence_id})
        relations.append({
            "subject": src, "subject_label": "BANK_ACCOUNT",
            "predicate": "TRANSFERRED",
            "object": dst, "object_label": "BANK_ACCOUNT",
            "confidence": 0.95, "evidence_id": evidence_id,
            "timestamp": str(row.get("timestamp", "")),
            "attributes": {
                "amount": amount,
                "currency": row.get("currency", "INR"),
                "high_value": amount > 500000,
            },
        })
    return {"entities": entities, "relations": relations}


def extract_from_vehicles(df, evidence_id: str) -> dict:
    entities, relations = [], []
    for _, row in df.iterrows():
        reg = str(row["registration_number"])
        owner = str(row["owner_name"])
        entities.append({"text": reg, "label": "VEHICLE", "confidence": 0.9, "evidence_id": evidence_id})
        entities.append({"text": owner, "label": "PERSON", "confidence": 0.85, "evidence_id": evidence_id})
        relations.append({
            "subject": owner, "subject_label": "PERSON",
            "predicate": "OWNS",
            "object": reg, "object_label": "VEHICLE",
            "confidence": 0.85, "evidence_id": evidence_id,
            "timestamp": str(row.get("timestamp", "")),
            "attributes": {"make": row.get("make"), "model": row.get("model")},
        })
        location = row.get("location")
        if location and str(location) != "nan":
            entities.append({"text": str(location), "label": "GPE", "confidence": 0.7, "evidence_id": evidence_id})
            relations.append({
                "subject": reg, "subject_label": "VEHICLE",
                "predicate": "DETECTED_AT",
                "object": str(location), "object_label": "GPE",
                "confidence": 0.7, "evidence_id": evidence_id,
                "timestamp": str(row.get("timestamp", "")),
            })
    return {"entities": entities, "relations": relations}


def extract_from_locations(df, evidence_id: str) -> dict:
    entities, relations = [], []
    for _, row in df.iterrows():
        name = str(row["entity_name"])
        etype = str(row["entity_type"]).upper()
        loc = str(row["location_name"])
        entities.append({"text": name, "label": etype, "confidence": 0.8, "evidence_id": evidence_id})
        entities.append({"text": loc, "label": "GPE", "confidence": 0.8, "evidence_id": evidence_id})
        relations.append({
            "subject": name, "subject_label": etype,
            "predicate": "VISITED",
            "object": loc, "object_label": "GPE",
            "confidence": 0.8, "evidence_id": evidence_id,
            "timestamp": str(row.get("timestamp", "")),
            "attributes": {"latitude": row.get("latitude"), "longitude": row.get("longitude")},
        })
    return {"entities": entities, "relations": relations}


EXACT_MATCH_LABELS = {"PHONE", "BANK_ACCOUNT", "VEHICLE", "SERVER_IP", "IP", "EMAIL", "CRYPTO_WALLET", "WALLET", "DOMAIN"}
FUZZY_MATCH_LABELS = {"PERSON", "ORG", "GPE", "LOC", "ORGANIZATION", "LOCATION"}


def resolve_entities(entity_list: list[dict]) -> list[dict]:
    """Deduplicate entities of the same type via exact or fuzzy matching."""
    by_label: dict[str, list[dict]] = {}
    for ent in entity_list:
        by_label.setdefault(ent["label"], []).append(ent)

    resolved = []
    for label, ents in by_label.items():
        clusters: list[list[dict]] = []

        for ent in ents:
            placed = False
            for cluster in clusters:
                head = cluster[0]
                if label in EXACT_MATCH_LABELS:
                    same = ent["text"].strip().lower() == head["text"].strip().lower()
                else:
                    same = fuzz.token_sort_ratio(ent["text"], head["text"]) > 85
                if same:
                    cluster.append(ent)
                    placed = True
                    break
            if not placed:
                clusters.append([ent])

        for cluster in clusters:
            canonical = max(cluster, key=lambda e: e.get("confidence", 0))
            aliases = sorted({e["text"] for e in cluster if e["text"] != canonical["text"]})
            evidence_ids = sorted({e.get("evidence_id") for e in cluster if e.get("evidence_id")})
            resolved.append({
                "text": canonical["text"],
                "label": label,
                "confidence": canonical.get("confidence", 0.5),
                "aliases": aliases,
                "evidence_ids": list(evidence_ids),
            })

    return resolved


import uuid


def _to_uuid(val):
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except Exception:
        return None



def parse_timestamp(ts_val):
    if not ts_val:
        return None
    if isinstance(ts_val, datetime):
        return ts_val
    try:
        dt = pd.to_datetime(ts_val)
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()
    except Exception:
        return None


def _match_entity(ent_text: str, ent_label: str, existing_ent: Entity) -> bool:
    if existing_ent.entity_type != ent_label:
        # Cross-label compatibility for IP / SERVER_IP or USER / PERSON
        if not (
            (ent_label in ("IP", "SERVER_IP") and existing_ent.entity_type in ("IP", "SERVER_IP"))
            or (ent_label in ("USER", "PERSON") and existing_ent.entity_type in ("USER", "PERSON"))
        ):
            return False
    names_to_check = [existing_ent.canonical_name] + (existing_ent.aliases or [])
    if ent_label in EXACT_MATCH_LABELS:
        ent_clean = ent_text.strip().lower()
        return any(ent_clean == name.strip().lower() for name in names_to_check if name)
    else:
        return any(fuzz.token_sort_ratio(ent_text, name) > 85 for name in names_to_check if name)


def resolve_entities_global(case_id: str | uuid.UUID, new_entities: list[dict], db: Session) -> list[Entity]:
    """
    Global entity resolution across a case:
    - Loads existing case entities from DB.
    - Reuses exact/fuzzy matching logic.
    - MATCH -> merges aliases, source_evidence_ids, updates confidence and updates Neo4j.
    - NO MATCH -> creates Entity ORM instance.
    - Returns canonical Entity ORM objects.
    - Avoids duplicate entities, aliases, and evidence IDs.
    """
    case_uuid = _to_uuid(case_id)
    if not new_entities:
        return db.query(Entity).filter(Entity.case_id == case_uuid).all()

    deduped_batch = resolve_entities(new_entities)
    existing_entities = db.query(Entity).filter(Entity.case_id == case_uuid).all()
    canonical_entities: list[Entity] = []

    for ent in deduped_batch:
        ent_text = ent["text"].strip()
        ent_label = ent["label"]
        ent_confidence = ent.get("confidence", 0.5)
        ent_aliases = set(ent.get("aliases", []))
        ent_ev_ids = set(ent.get("evidence_ids", []))

        matched_entity = None
        for existing in existing_entities:
            if _match_entity(ent_text, ent_label, existing):
                matched_entity = existing
                break

        if matched_entity:
            # Merge aliases
            current_aliases = set(matched_entity.aliases or [])
            if ent_text.lower() != matched_entity.canonical_name.lower():
                current_aliases.add(ent_text)
            current_aliases.update(ent_aliases)
            current_aliases.discard(matched_entity.canonical_name)
            matched_entity.aliases = sorted(list(current_aliases))

            # Merge evidence IDs
            current_ev_ids = set(matched_entity.source_evidence_ids or [])
            current_ev_ids.update(ent_ev_ids)
            matched_entity.source_evidence_ids = sorted(list(current_ev_ids))

            # Update confidence
            if ent_confidence > (matched_entity.confidence or 0.0):
                matched_entity.confidence = ent_confidence

            if matched_entity not in canonical_entities:
                canonical_entities.append(matched_entity)
        else:
            aliases_list = sorted(list(ent_aliases - {ent_text}))
            new_entity = Entity(
                case_id=case_uuid,
                entity_type=ent_label,
                canonical_name=ent_text,
                aliases=aliases_list,
                confidence=ent_confidence,
                source_evidence_ids=sorted(list(ent_ev_ids)),
            )
            db.add(new_entity)
            existing_entities.append(new_entity)
            canonical_entities.append(new_entity)

    # Batch Neo4j node update in a single session
    try:
        from database import is_neo4j_online, get_neo4j_session
        if is_neo4j_online():
            from graph_service import _label
            with get_neo4j_session() as session:
                for ent_orm in canonical_entities:
                    label = _label(ent_orm.entity_type)
                    session.run(
                        f"""
                        MERGE (n:{label} {{name: $name, case_id: $case_id}})
                        SET n.confidence = $confidence,
                            n.aliases = $aliases,
                            n.updated_at = datetime()
                        """,
                        name=ent_orm.canonical_name,
                        case_id=str(case_id),
                        confidence=ent_orm.confidence or 0.5,
                        aliases=ent_orm.aliases or [],
                    )
    except Exception as exc:
        logger.warning("Could not update Neo4j nodes during global resolution: %s", exc)

    db.commit()
    for ent_orm in canonical_entities:
        db.refresh(ent_orm)

    return canonical_entities


def persist_relationships(
    case_id: str | uuid.UUID,
    relations: list[dict],
    canonical_entities: list[Entity],
    evidence_id: str | uuid.UUID,
    db: Session,
) -> list[Relationship]:
    """Persist extracted relationships using SQLAlchemy ORM and canonical entity IDs without duplicates."""
    if not relations:
        return []

    case_uuid = _to_uuid(case_id)
    default_ev_uuid = _to_uuid(evidence_id)

    entity_name_lookup: dict[str, Entity] = {}
    entity_lookup: dict[tuple[str, str], Entity] = {}
    for ent in canonical_entities:
        c_name = ent.canonical_name.strip().lower()
        entity_name_lookup[c_name] = ent
        entity_lookup[(c_name, ent.entity_type)] = ent
        for alias in (ent.aliases or []):
            if alias:
                a_name = alias.strip().lower()
                entity_name_lookup[a_name] = ent
                entity_lookup[(a_name, ent.entity_type)] = ent

    # Pre-fetch all existing relationships for this case in a single query for O(1) in-memory lookup
    existing_rels = db.query(Relationship).filter(Relationship.case_id == case_uuid).all()
    rel_map: dict[tuple, Relationship] = {
        (r.source_entity_id, r.target_entity_id, r.relationship_type): r
        for r in existing_rels
    }

    try:
        from graph_service import _sanitize_rel_type
    except Exception:
        def _sanitize_rel_type(val):
            return str(val).upper()

    persisted: list[Relationship] = []
    for rel in relations:
        subj_name = rel.get("subject", "").strip().lower()
        subj_label = rel.get("subject_label", "")
        obj_name = rel.get("object", "").strip().lower()
        obj_label = rel.get("object_label", "")
        raw_pred = rel.get("predicate", "RELATED_TO")
        rel_type = _sanitize_rel_type(raw_pred)

        src_ent = entity_lookup.get((subj_name, subj_label)) or entity_name_lookup.get(subj_name)
        if not src_ent:
            for name, ent in entity_name_lookup.items():
                if name == subj_name or fuzz.token_sort_ratio(name, subj_name) > 85:
                    src_ent = ent
                    break

        tgt_ent = entity_lookup.get((obj_name, obj_label)) or entity_name_lookup.get(obj_name)
        if not tgt_ent:
            for name, ent in entity_name_lookup.items():
                if name == obj_name or fuzz.token_sort_ratio(name, obj_name) > 85:
                    tgt_ent = ent
                    break

        if not src_ent or not tgt_ent:
            continue

        ts = parse_timestamp(rel.get("timestamp"))
        confidence = float(rel.get("confidence", 0.5))
        attributes = rel.get("attributes") or {}
        provenance = rel.get("provenance_type", "OBSERVED")
        ev_uuid = _to_uuid(rel.get("evidence_id")) or default_ev_uuid

        existing = rel_map.get((src_ent.id, tgt_ent.id, rel_type))

        if existing:
            if confidence > (existing.confidence or 0.0):
                existing.confidence = confidence
            if attributes:
                merged_attrs = dict(existing.attributes or {})
                merged_attrs.update(attributes)
                existing.attributes = merged_attrs
            if ts and not existing.timestamp:
                existing.timestamp = ts
            persisted.append(existing)
        else:
            new_rel = Relationship(
                case_id=case_uuid,
                source_entity_id=src_ent.id,
                target_entity_id=tgt_ent.id,
                relationship_type=rel_type,
                timestamp=ts,
                confidence=confidence,
                provenance_type=provenance,
                evidence_id=ev_uuid,
                attributes=attributes,
            )
            db.add(new_rel)
            rel_map[(src_ent.id, tgt_ent.id, rel_type)] = new_rel
            persisted.append(new_rel)

    db.commit()
    for r in persisted:
        db.refresh(r)

    return persisted


