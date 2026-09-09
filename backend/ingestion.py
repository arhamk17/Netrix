import hashlib
import logging
import os
import uuid
from datetime import datetime
from io import BytesIO

import pandas as pd
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Evidence, Case, Entity, User
from auth import get_current_user, require_roles, log_action
import schemas
import nlp_pipeline
import graph_service
import blockchain_service
from celery_app import process_evidence_task

logger = logging.getLogger(__name__)

ingestion_router = APIRouter()


def compute_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


import preprocessing
import model_adapter


def _extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        text_parts = []
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    return file_bytes.decode("utf-8", errors="ignore")


def route_and_extract(source_type: str, filename: str, file_bytes: bytes, evidence_id: str) -> dict:
    """
    Route evidence through preprocessing and model adapter cascade
    (Local Python Model -> Local HTTP Model -> NLP Pipeline Fallback).
    """
    model_input = preprocessing.preprocess(file_bytes, filename=filename, source_type=source_type)
    model_input.metadata["evidence_id"] = evidence_id
    extracted = model_adapter.extract_intelligence(model_input, filename=filename, source_type=source_type)

    # Ensure relations key is mapped for existing graph_service and nlp_pipeline compatibility
    if "relationships" in extracted and "relations" not in extracted:
        extracted["relations"] = extracted["relationships"]
    elif "relations" in extracted and "relationships" not in extracted:
        extracted["relationships"] = extracted["relations"]

    return extracted


@ingestion_router.post("/evidence/upload", response_model=schemas.EvidenceResponse)
def upload_evidence(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    source_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_bytes = file.file.read()
    sha256_hash = compute_sha256(file_bytes)

    evidence_id = uuid.uuid4()
    case_dir = os.path.join(settings.DATA_DIR, str(case_id))
    os.makedirs(case_dir, exist_ok=True)
    storage_path = os.path.join(case_dir, f"{evidence_id}_{file.filename}")

    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    evidence = Evidence(
        id=evidence_id,
        case_id=c_uuid or case_id,
        filename=os.path.basename(storage_path),
        original_filename=file.filename,
        file_type=file.content_type,
        file_size_bytes=len(file_bytes),
        sha256_hash=sha256_hash,
        storage_path=storage_path,
        source_type=source_type,
        uploaded_by=current_user.id,
        processing_status="pending",
        blockchain_status="pending",
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Register SHA-256 and IDs on blockchain for integrity & provenance
    try:
        reg_result = blockchain_service.register_evidence(
            evidence_id=str(evidence.id),
            evidence_hash=sha256_hash,
            case_id=str(case_id),
        )
        if reg_result and reg_result.get("status") == 1:
            evidence.blockchain_status = "registered"
            evidence.blockchain_tx_hash = reg_result.get("tx_hash")
            evidence.blockchain_block_number = reg_result.get("block_number")
            db.commit()
            db.refresh(evidence)
            logger.info("Evidence %s registered on blockchain: %s", evidence.id, reg_result.get("tx_hash"))
        else:
            evidence.blockchain_status = "failed"
            db.commit()
            db.refresh(evidence)
            logger.warning("Blockchain registration status not 1 for evidence %s: %s", evidence.id, reg_result)
    except Exception as exc:
        logger.error("Blockchain registration failed for evidence %s: %s", evidence.id, exc)
        try:
            evidence.blockchain_status = "failed"
            db.commit()
            db.refresh(evidence)
        except Exception as db_exc:
            logger.error("Failed updating blockchain_status to failed for evidence %s: %s", evidence.id, db_exc)

    try:
        process_evidence_task.delay(str(evidence.id))
    except Exception as exc:
        logger.exception("Failed to dispatch Celery task for evidence %s: %s", evidence.id, exc)

    log_action(db, current_user.id, "upload_evidence", "evidence", evidence.id,
               {"case_id": str(case_id), "source_type": source_type})

    return evidence


def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


@ingestion_router.get("/evidence/{evidence_id}/status", response_model=schemas.EvidenceStatusResponse)
def get_evidence_status(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev_uuid = _to_uuid(evidence_id)
    evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


@ingestion_router.get("/evidence/{evidence_id}/verify", response_model=schemas.EvidenceVerifyResponse)
def verify_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev_uuid = _to_uuid(evidence_id)
    evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if not os.path.exists(evidence.storage_path):
        raise HTTPException(status_code=404, detail="Evidence file missing on disk")

    try:
        with open(evidence.storage_path, "rb") as f:
            file_bytes = f.read()
        computed_hash = compute_sha256(file_bytes)
        stored_hash = evidence.sha256_hash
        match = computed_hash.lower() == stored_hash.lower()
        verified_at = datetime.utcnow()

        # Blockchain verification check
        blockchain_verified = None
        bc_record = None
        custody_hist = []
        try:
            bc_record = blockchain_service.get_evidence_record(str(evidence.id))
            if bc_record:
                blockchain_verified = blockchain_service.verify_evidence(str(evidence.id), computed_hash)
                # If verified successfully, record immutable VERIFIED custody event on blockchain
                if blockchain_verified:
                    try:
                        blockchain_service.record_custody_event(str(evidence.id), "VERIFIED")
                    except Exception as rec_exc:
                        logger.warning("Failed to record VERIFIED custody event for evidence %s: %s", evidence_id, rec_exc)
            else:
                blockchain_verified = False

            custody_hist = blockchain_service.get_custody_history(str(evidence.id))
        except Exception as bc_exc:
            logger.warning("Blockchain verification check failed for evidence %s: %s", evidence_id, bc_exc)
            blockchain_verified = False

        return {
            "match": match,
            "stored_hash": stored_hash,
            "computed_hash": computed_hash,
            "verified_at": verified_at,
            "blockchain_verified": blockchain_verified,
            "blockchain_status": evidence.blockchain_status,
            "blockchain_tx_hash": evidence.blockchain_tx_hash,
            "blockchain_record": bc_record,
            "custody_history": custody_hist,
        }
    except Exception as exc:
        logger.exception("Failed to verify evidence %s: %s", evidence_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to verify evidence: {exc}")


@ingestion_router.get("/evidence/{evidence_id}/blockchain", response_model=schemas.EvidenceBlockchainRecordResponse)
def get_evidence_blockchain(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev_uuid = _to_uuid(evidence_id)
    evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    try:
        record = blockchain_service.get_evidence_record(str(evidence.id))
        custody_hist = blockchain_service.get_custody_history(str(evidence.id))
    except Exception as exc:
        logger.warning("Failed to retrieve blockchain record for evidence %s: %s", evidence_id, exc)
        record = None
        custody_hist = []

    if record:
        return {
            "registered": True,
            "evidence_id": str(evidence.id),
            "evidence_hash": record.get("evidence_hash"),
            "case_id": record.get("case_id"),
            "timestamp": record.get("timestamp"),
            "registered_by": record.get("registered_by"),
            "blockchain_status": evidence.blockchain_status or "registered",
            "blockchain_tx_hash": evidence.blockchain_tx_hash,
            "blockchain_block_number": evidence.blockchain_block_number,
            "custody_history": custody_hist,
        }

    return {
        "registered": False,
        "evidence_id": str(evidence.id),
        "evidence_hash": None,
        "case_id": str(evidence.case_id),
        "timestamp": None,
        "registered_by": None,
        "blockchain_status": evidence.blockchain_status or "pending",
        "blockchain_tx_hash": evidence.blockchain_tx_hash,
        "blockchain_block_number": evidence.blockchain_block_number,
        "custody_history": custody_hist,
    }


@ingestion_router.get("/evidence/{evidence_id}/blockchain/history", response_model=schemas.EvidenceCustodyHistoryResponse)
def get_evidence_custody_history(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve immutable on-chain chain-of-custody history for an evidence item."""
    ev_uuid = _to_uuid(evidence_id)
    evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    try:
        events = blockchain_service.get_custody_history(str(evidence.id))
    except Exception as exc:
        logger.warning("Failed to retrieve custody history for evidence %s: %s", evidence_id, exc)
        events = []

    return {
        "evidence_id": str(evidence.id),
        "events": events,
    }


@ingestion_router.get("/evidence/{evidence_id}", response_model=schemas.EvidenceResponse)
def get_evidence(evidence_id: str, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    ev_uuid = _to_uuid(evidence_id)
    evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


@ingestion_router.get("/cases/{case_id}/evidence", response_model=list[schemas.EvidenceResponse])
def list_case_evidence(case_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    return db.query(Evidence).filter(Evidence.case_id == c_uuid).all() if c_uuid else []


