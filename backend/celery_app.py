import logging
import os
import sys
import uuid
from pathlib import Path
from celery import Celery

# Ensure backend directory is in sys.path for Celery worker regardless of working directory
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import settings
from database import SessionLocal
from models import Evidence
import nlp_pipeline
import graph_service

logger = logging.getLogger(__name__)

celery_app = Celery(
    "criminal_intelligence",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


def _to_uuid(val):
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except Exception:
        return None


@celery_app.task(name="process_evidence_task", bind=True)
def process_evidence_task(self, evidence_id: str):
    """
    Background worker task to process an uploaded evidence file:
    - Creates its own DB session.
    - Loads Evidence by ID.
    - Reads storage file.
    - Calls route_and_extract().
    - Calls resolve_entities_global().
    - Calls graph_service.write_to_graph().
    - Persists relationships in PostgreSQL using canonical entity IDs.
    - Updates processing_status = completed / failed.
    """
    db = None
    ev_uuid = _to_uuid(evidence_id)
    try:
        from ingestion import route_and_extract

        db = SessionLocal()
        evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
        if not evidence:
            logger.error("Evidence with ID %s not found for processing", evidence_id)
            return {"status": "error", "message": f"Evidence {evidence_id} not found"}

        evidence.processing_status = "processing"
        db.commit()
        db.refresh(evidence)

        storage_path = evidence.storage_path
        if not os.path.isabs(storage_path) and not os.path.exists(storage_path):
            alt_path = os.path.join(str(backend_dir), storage_path)
            if os.path.exists(alt_path):
                storage_path = alt_path

        if not os.path.exists(storage_path):
            raise FileNotFoundError(f"Evidence file not found at {storage_path}")

        with open(storage_path, "rb") as f:
            file_bytes = f.read()

        extracted = route_and_extract(
            evidence.source_type,
            evidence.original_filename,
            file_bytes,
            str(evidence.id),
        )

        resolved_entities = nlp_pipeline.resolve_entities_global(
            case_id=str(evidence.case_id),
            new_entities=extracted.get("entities", []),
            db=db,
        )

        graph_entities = [
            {
                "text": ent.canonical_name,
                "label": ent.entity_type,
                "confidence": ent.confidence,
                "aliases": ent.aliases or [],
                "evidence_ids": ent.source_evidence_ids or [str(evidence.id)],
            }
            for ent in resolved_entities
        ]

        graph_service.write_to_graph(
            case_id=str(evidence.case_id),
            entities=graph_entities,
            relations=extracted.get("relations", []),
            evidence_id=str(evidence.id),
        )

        nlp_pipeline.persist_relationships(
            case_id=str(evidence.case_id),
            relations=extracted.get("relations", []),
            canonical_entities=resolved_entities,
            evidence_id=str(evidence.id),
            db=db,
        )

        evidence.processing_status = "completed"
        evidence.extracted_data = extracted
        evidence.processing_error = None
        db.commit()
        db.refresh(evidence)

        # Record ANALYZED chain-of-custody event on blockchain
        try:
            import blockchain_service
            blockchain_service.record_custody_event(str(evidence.id), "ANALYZED")
            logger.info("Recorded ANALYZED custody event on blockchain for evidence %s", evidence_id)
        except Exception as bc_exc:
            logger.warning("Failed recording ANALYZED custody event for evidence %s: %s", evidence_id, bc_exc)

        logger.info("Successfully processed evidence %s for case %s", evidence_id, evidence.case_id)
        return {"status": "completed", "evidence_id": evidence_id}

    except Exception as exc:
        logger.exception("Failed to process evidence %s: %s", evidence_id, exc)
        if db is not None:
            try:
                db.rollback()
                evidence = db.query(Evidence).filter(Evidence.id == ev_uuid).first() if ev_uuid else None
                if evidence:
                    evidence.processing_status = "failed"
                    evidence.processing_error = f"{type(exc).__name__}: {str(exc)}"
                    db.commit()
            except Exception:
                logger.exception("Failed to update evidence status to failed for %s", evidence_id)
        raise exc
    finally:
        if db is not None:
            db.close()

