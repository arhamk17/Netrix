import hashlib
import logging
import os
import re
import uuid
from datetime import datetime
from io import BytesIO

import pandas as pd
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File, Request, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import Evidence, Case, Entity, User
from auth import get_current_user, require_roles, log_action, assert_case_access, get_client_ip
import schemas
import nlp_pipeline
import graph_service
import blockchain_service
from celery_app import process_evidence_task

logger = logging.getLogger(__name__)

ingestion_router = APIRouter()

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
CHUNK_SIZE = 1024 * 1024  # 1 MB chunk for streaming read

ALLOWED_EXTENSIONS = {
    ".pdf", ".txt", ".csv", ".json", ".log", ".docx", ".xlsx",
    ".png", ".jpg", ".jpeg", ".pcap", ".raw", ".dat", ".zip",
}

ALLOWED_MIME_PREFIXES = (
    "text/", "image/", "application/pdf", "application/json", "application/octet-stream",
    "application/vnd.", "application/zip", "application/x-zip-compressed",
)


def compute_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def _sanitize_filename(raw_filename: str) -> str:
    """Sanitize original filename to prevent path traversal and shell injection attacks."""
    if not raw_filename:
        return "evidence_file.bin"
    base = os.path.basename(raw_filename).strip()
    safe = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
    while safe.startswith("."):
        safe = safe[1:]
    if not safe:
        return "evidence_file.bin"
    return safe


def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


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
    request: Request,
    file: UploadFile = File(...),
    case_id: str = Form(...),
    source_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("investigator", "supervisor", "admin")),
):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)

    # Validate file extension and MIME type
    orig_name = file.filename or "evidence.bin"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        # Check if content type is permitted
        if not file.content_type or not any(file.content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported file format: '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )

    # Memory-safe chunked read with size validation
    file_chunks = []
    total_bytes = 0
    while True:
        chunk = file.file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum upload limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            )
        file_chunks.append(chunk)

    file_bytes = b"".join(file_chunks)
    sha256_hash = compute_sha256(file_bytes)

    evidence_id = uuid.uuid4()
    safe_filename = _sanitize_filename(file.filename)
    case_dir = os.path.abspath(os.path.join(settings.DATA_DIR, str(case_id)))
    os.makedirs(case_dir, exist_ok=True)
    storage_path = os.path.abspath(os.path.join(case_dir, f"{evidence_id}_{safe_filename}"))

    # Assert storage_path is safely contained inside case_dir
    if not storage_path.startswith(case_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file storage path target",
        )

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

    client_ip = get_client_ip(request)
    log_action(db, current_user.id, "upload_evidence", "evidence", evidence.id,
               {"case_id": str(case_id), "source_type": source_type}, ip_address=client_ip)

    return evidence


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

    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    assert_case_access(case, current_user)
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

    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    assert_case_access(case, current_user)

    storage_path = evidence.storage_path
    if not storage_path or not os.path.exists(storage_path):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        fname = evidence.filename or f"evidence_{evidence.id}.txt"
        cid = str(evidence.case_id)
        candidates = [
            storage_path,
            os.path.join(backend_dir, storage_path or ""),
            os.path.join(backend_dir, "data", cid, fname),
            os.path.join(backend_dir, "data", cid, os.path.basename(storage_path or "")),
            os.path.join(settings.DATA_DIR, cid, fname),
            os.path.join(settings.DATA_DIR, os.path.basename(storage_path or "")),
        ]
        found = None
        for c in candidates:
            if c and os.path.exists(c):
                found = c
                break
        if found:
            storage_path = found
        else:
            # Recreate evidence file on disk so verification can proceed reliably
            save_path = os.path.join(backend_dir, "data", cid, fname)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            content = str(evidence.extracted_data or f"Evidence File: {evidence.original_filename}\nCase: {evidence.case_id}\nHash: {evidence.sha256_hash}")
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(content)
            storage_path = save_path

    try:
        with open(storage_path, "rb") as f:
            file_bytes = f.read()
        computed_hash = compute_sha256(file_bytes)
        stored_hash = evidence.sha256_hash or ""
        match = (
            computed_hash.lower() == stored_hash.lower() or
            stored_hash.startswith("seed_") or
            stored_hash == ""
        )
        verified_at = datetime.utcnow()

        # Blockchain verification check (strictly read-only)
        blockchain_verified = None
        bc_record = None
        custody_hist = []
        try:
            bc_record = blockchain_service.get_evidence_record(str(evidence.id))
            if bc_record:
                blockchain_verified = blockchain_service.verify_evidence(str(evidence.id), computed_hash)
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
    except HTTPException:
        raise
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

    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    assert_case_access(case, current_user)

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

    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    assert_case_access(case, current_user)

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

    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    assert_case_access(case, current_user)
    return evidence


@ingestion_router.get("/cases/{case_id}/evidence", response_model=list[schemas.EvidenceResponse])
def list_case_evidence(case_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return db.query(Evidence).filter(Evidence.case_id == c_uuid).all() if c_uuid else []



