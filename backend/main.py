import os
import sys
import uuid

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
try:
    torch_lib = os.path.join(sys.prefix, "Lib", "site-packages", "torch", "lib")
    if os.path.exists(torch_lib) and hasattr(os, "add_dll_directory"):
        os.add_dll_directory(torch_lib)
        os.environ["PATH"] = torch_lib + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from config import settings
from database import engine, Base, neo4j_driver, get_db
import auth
import ingestion
import graph_service
import analytics
import ai_assistant
import leads
import explainability
import model_metrics
from models import (
    Case, Evidence, Entity, IPSResult, User, Relationship, AnalyticsResult, AuditLog, Event, LeadResult, ModelMetrics
)
from auth import get_current_user, require_roles, log_action, assert_case_access, get_client_ip
import schemas


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        neo4j_driver.close()
    except Exception:
        pass


app = FastAPI(
    title="Netrix Intelligence API",
    version="1.0.0",
    description="NETRIX — AI-Powered Digital Forensics, Temporal Graph Intelligence & Blockchain Integrity System",
    lifespan=lifespan,
)

cors_origins = [orig.strip() for orig in settings.ALLOWED_ORIGINS.split(",") if orig.strip()]
if not cors_origins:
    cors_origins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.exception("Unhandled error on %s %s: %s", request.method, request.url, exc)
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "netrix-intelligence-api"}


app.include_router(auth.auth_router, prefix="/auth", tags=["auth"])
app.include_router(ingestion.ingestion_router, tags=["evidence"])
app.include_router(graph_service.graph_router, tags=["graph"])
app.include_router(analytics.analytics_router, tags=["analytics"])
app.include_router(ai_assistant.ai_router, prefix="/ai", tags=["ai"])
app.include_router(leads.leads_router)
app.include_router(explainability.explain_router)
app.include_router(model_metrics.model_metrics_router)


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------
@app.post("/cases", response_model=schemas.CaseResponse, tags=["cases"])
def create_case(payload: schemas.CaseCreate, request: Request, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles("investigator", "supervisor", "admin"))):
    if db.query(Case).filter(Case.case_number == payload.case_number).first():
        raise HTTPException(status_code=400, detail="Case number already exists")

    case = Case(
        case_number=payload.case_number,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        tags=payload.tags,
        created_by=current_user.id,
        assigned_to=current_user.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    client_ip = get_client_ip(request)
    log_action(db, current_user.id, "create_case", "case", case.id, ip_address=client_ip)
    return case


@app.get("/cases", tags=["cases"])
def list_cases(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Case)
    if current_user.role not in ("admin", "supervisor"):
        query = query.filter(
            (Case.created_by == current_user.id) | (Case.assigned_to == current_user.id)
        )
    cases = query.all()

    results = []
    for case in cases:
        evidence_count = db.query(Evidence).filter(Evidence.case_id == case.id).count()
        results.append({
            "id": str(case.id),
            "case_number": case.case_number,
            "title": case.title,
            "status": case.status,
            "priority": case.priority,
            "tags": case.tags,
            "created_at": case.created_at,
            "evidence_count": evidence_count,
        })
    return results


def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return None


@app.get("/cases/{case_id}", tags=["cases"])
def get_case(case_id: str, db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)

    evidence = db.query(Evidence).filter(Evidence.case_id == c_uuid).all()
    entity_count = db.query(Entity).filter(Entity.case_id == c_uuid).count()
    top_ips = (
        db.query(IPSResult)
        .filter(IPSResult.case_id == c_uuid)
        .order_by(IPSResult.ips_score.desc())
        .limit(5)
        .all()
    )

    return {
        "case": schemas.CaseResponse.model_validate(case),
        "evidence": [schemas.EvidenceResponse.model_validate(e) for e in evidence],
        "entity_count": entity_count,
        "top_ips_results": [
            {
                "entity_name": r.entity_name,
                "entity_type": r.entity_type,
                "ips_score": r.ips_score,
                "explanation": r.explanation,
            }
            for r in top_ips
        ],
    }


@app.get("/cases/{case_id}/entities", response_model=list[schemas.EntityResponse], tags=["cases"])
def get_case_entities(case_id: str, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return db.query(Entity).filter(Entity.case_id == c_uuid).all()


@app.get("/cases/{case_id}/relationships", response_model=list[schemas.RelationshipResponse], tags=["cases"])
def get_case_relationships(case_id: str, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)
    return db.query(Relationship).filter(Relationship.case_id == c_uuid).all()


@app.patch("/cases/{case_id}", response_model=schemas.CaseResponse, tags=["cases"])
def update_case(case_id: str, payload: schemas.CaseUpdate, request: Request, db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles("investigator", "supervisor", "admin"))):
    c_uuid = _to_uuid(case_id)
    case = db.query(Case).filter(Case.id == c_uuid).first() if c_uuid else None
    assert_case_access(case, current_user)

    for field in ("status", "priority", "title", "description"):
        value = getattr(payload, field)
        if value is not None:
            setattr(case, field, value)

    db.commit()
    db.refresh(case)
    client_ip = get_client_ip(request)
    log_action(db, current_user.id, "update_case", "case", case.id, ip_address=client_ip)
    return case

# Auto-reloaded with fast connection pooler settings

