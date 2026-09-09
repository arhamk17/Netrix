import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models import ModelMetrics, User
import schemas

logger = logging.getLogger(__name__)

model_metrics_router = APIRouter(prefix="/model-metrics", tags=["model-metrics"])

VALID_TASK_TYPES = {"ner", "relation", "event", "anomaly", "link_prediction"}


@model_metrics_router.post("", response_model=schemas.ModelMetricsResponse, status_code=status.HTTP_201_CREATED)
def record_model_metrics(
    payload: schemas.ModelMetricsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """
    Record evaluation metrics for a trained model.
    Admin / Supervisor RBAC protected. Teammate provides metrics (precision, recall, f1, accuracy, auc).
    """
    task_type = payload.task_type.strip().lower()
    if task_type not in VALID_TASK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task_type '{payload.task_type}'. Supported: {', '.join(sorted(VALID_TASK_TYPES))}",
        )

    metric_record = ModelMetrics(
        model_name=payload.model_name.strip(),
        model_version=payload.model_version.strip(),
        task_type=task_type,
        metrics=payload.metrics or {},
        evaluated_at=datetime.utcnow(),
        notes=payload.notes,
    )
    db.add(metric_record)
    db.commit()
    db.refresh(metric_record)

    logger.info("Recorded metrics for model '%s' (task: %s, version: %s)",
                metric_record.model_name, metric_record.task_type, metric_record.model_version)
    return metric_record


@model_metrics_router.get("", response_model=List[schemas.ModelMetricsResponse])
def list_model_metrics(
    task_type: Optional[str] = Query(None, description="Filter by task_type (ner, relation, event, anomaly, link_prediction)"),
    model_name: Optional[str] = Query(None, description="Filter by model_name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List historical evaluation metrics for all models."""
    query = db.query(ModelMetrics)
    if task_type:
        query = query.filter(ModelMetrics.task_type == task_type.strip().lower())
    if model_name:
        query = query.filter(ModelMetrics.model_name == model_name.strip())

    return query.order_by(ModelMetrics.evaluated_at.desc()).all()


@model_metrics_router.get("/latest", response_model=List[schemas.ModelMetricsResponse])
def get_latest_model_metrics(
    task_type: Optional[str] = Query(None, description="Filter latest by task_type"),
    model_name: Optional[str] = Query(None, description="Filter latest by model_name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the latest evaluation metrics per task type / model."""
    query = db.query(ModelMetrics)
    if task_type:
        query = query.filter(ModelMetrics.task_type == task_type.strip().lower())
    if model_name:
        query = query.filter(ModelMetrics.model_name == model_name.strip())

    all_records = query.order_by(ModelMetrics.evaluated_at.desc()).all()
    # Group by (model_name, task_type) and pick the most recent one
    latest_map: Dict[tuple, ModelMetrics] = {}
    for r in all_records:
        key = (r.model_name, r.task_type)
        if key not in latest_map:
            latest_map[key] = r

    return list(latest_map.values())
