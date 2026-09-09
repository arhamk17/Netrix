import logging
import re
from datetime import datetime

import pandas as pd
import spacy
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from models import Entity, Relationship

logger = logging.getLogger(__name__)

# Load spacy model once
nlp = spacy.load("en_core_web_trf")


PHONE_RE = re.compile(r"\b[6-9]\d{9}\b")
VEHICLE_RE = re.compile(r"\b[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b")
ACCOUNT_RE = re.compile(r"\b(ACC\d{3,}|[A-Z]{4}\d{10,})\b")

SPACY_LABELS = {"PERSON", "ORG", "GPE", "LOC", "DATE", "MONEY"}


def _regex_entities(text: str, evidence_id: str) -> list[dict]:
    ents = []
    for m in PHONE_RE.finditer(text):
        ents.append({"text": m.group(), "label": "PHONE", "confidence": 0.9, "evidence_id": evidence_id})
    for m in VEHICLE_RE.finditer(text):
        ents.append({"text": m.group(), "label": "VEHICLE", "confidence": 0.85, "evidence_id": evidence_id})
    for m in ACCOUNT_RE.finditer(text):
        ents.append({"text": m.group(), "label": "BANK_ACCOUNT", "confidence": 0.85, "evidence_id": evidence_id})
    return ents


def extract_from_text(text: str, evidence_id: str) -> dict:
    doc = nlp(text)

    entities = []
    for ent in doc.ents:
        if ent.label_ in SPACY_LABELS:
            entities.append({
                "text": ent.text.strip(),
                "label": ent.label_,
                "confidence": 0.8,
                "evidence_id": evidence_id,
            })
    entities.extend(_regex_entities(text, evidence_id))

    relations = []
    for sent in doc.sents:
        sent_text = sent.text
        persons = [e.text.strip() for e in sent.ents if e.label_ == "PERSON"]
        orgs = [e.text.strip() for e in sent.ents if e.label_ == "ORG"]
        gpes = [e.text.strip() for e in sent.ents if e.label_ in ("GPE", "LOC")]
        phones = PHONE_RE.findall(sent_text)

        for p in persons:
            for ph in phones:
                relations.append({
                    "subject": p, "subject_label": "PERSON",
                    "predicate": "USES",
                    "object": ph, "object_label": "PHONE",
                    "confidence": 0.75, "evidence_id": evidence_id, "timestamp": None,
                })
            for o in orgs:
                relations.append({
                    "subject": p, "subject_label": "PERSON",
                    "predicate": "WORKS_FOR",
                    "object": o, "object_label": "ORG",
                    "confidence": 0.65, "evidence_id": evidence_id, "timestamp": None,
                })
            for g in gpes:
                relations.append({
                    "subject": p, "subject_label": "PERSON",
                    "predicate": "VISITED",
                    "object": g, "object_label": "GPE",
                    "confidence": 0.60, "evidence_id": evidence_id, "timestamp": None,
                })

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


EXACT_MATCH_LABELS = {"PHONE", "BANK_ACCOUNT", "VEHICLE"}
FUZZY_MATCH_LABELS = {"PERSON", "ORG", "GPE"}


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
        from database import get_neo4j_session
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
        logger.exception("Failed to update Neo4j nodes during global resolution: %s", exc)

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

    entity_lookup: dict[tuple[str, str], Entity] = {}
    for ent in canonical_entities:
        entity_lookup[(ent.canonical_name.strip().lower(), ent.entity_type)] = ent
        for alias in (ent.aliases or []):
            if alias:
                entity_lookup[(alias.strip().lower(), ent.entity_type)] = ent

    # Pre-fetch all existing relationships for this case in a single query for O(1) in-memory lookup
    existing_rels = db.query(Relationship).filter(Relationship.case_id == case_uuid).all()
    rel_map: dict[tuple, Relationship] = {
        (r.source_entity_id, r.target_entity_id, r.relationship_type): r
        for r in existing_rels
    }

    persisted: list[Relationship] = []
    for rel in relations:
        subj_name = rel.get("subject", "").strip().lower()
        subj_label = rel.get("subject_label", "")
        obj_name = rel.get("object", "").strip().lower()
        obj_label = rel.get("object_label", "")
        rel_type = rel.get("predicate", "RELATED_TO")

        src_ent = entity_lookup.get((subj_name, subj_label))
        if not src_ent:
            for (name, _), ent in entity_lookup.items():
                if name == subj_name or fuzz.token_sort_ratio(name, subj_name) > 85:
                    src_ent = ent
                    break

        tgt_ent = entity_lookup.get((obj_name, obj_label))
        if not tgt_ent:
            for (name, _), ent in entity_lookup.items():
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


