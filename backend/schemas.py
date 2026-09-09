import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

import json
from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "investigator"


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------
class CaseCreate(BaseModel):
    case_number: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    tags: List[str] = []


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_number: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    tags: Optional[List[str]] = []
    created_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [v] if v else []
        return v or []


# ---------------------------------------------------------------------------
# Events (Real-world incidents/events)
# ---------------------------------------------------------------------------
class EventCreate(BaseModel):
    case_id: uuid.UUID
    event_type: str
    title: str
    description: Optional[str] = None
    timestamp: datetime  # Real-world incident/event time
    location: Optional[str] = None
    evidence_id: Optional[uuid.UUID] = None
    attributes: Optional[Dict[str, Any]] = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    event_type: str
    title: str
    description: Optional[str] = None
    timestamp: datetime  # Real-world incident/event time
    location: Optional[str] = None
    evidence_id: Optional[uuid.UUID] = None
    attributes: Optional[Dict[str, Any]] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    original_filename: str
    source_type: str
    sha256_hash: str
    processing_status: str
    processing_error: Optional[str] = None
    uploaded_at: datetime
    extracted_data: Optional[Dict[str, Any]] = None
    blockchain_status: Optional[str] = "pending"
    blockchain_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None


class EvidenceStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    processing_status: str
    processing_error: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    extracted_data: Optional[Dict[str, Any]] = None
    blockchain_status: Optional[str] = "pending"
    blockchain_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None


class EvidenceVerifyResponse(BaseModel):
    match: bool
    stored_hash: str
    computed_hash: str
    verified_at: datetime
    blockchain_verified: Optional[bool] = None
    blockchain_status: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None
    blockchain_record: Optional[Dict[str, Any]] = None
    custody_history: Optional[List[Dict[str, Any]]] = None


class EvidenceBlockchainRecordResponse(BaseModel):
    registered: bool
    evidence_id: str
    evidence_hash: Optional[str] = None
    case_id: Optional[str] = None
    timestamp: Optional[int] = None
    registered_by: Optional[str] = None
    blockchain_status: str
    blockchain_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    custody_history: Optional[List[Dict[str, Any]]] = None


class CustodyEventSchema(BaseModel):
    action: str
    timestamp: Any
    performed_by: str
    evidence_id: Optional[str] = None


class EvidenceCustodyHistoryResponse(BaseModel):
    evidence_id: str
    events: List[CustodyEventSchema]


# ---------------------------------------------------------------------------
# Entities & Relationships
# ---------------------------------------------------------------------------
class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    entity_type: str
    canonical_name: str
    aliases: Optional[List[str]] = []
    confidence: float


class RelationshipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    source_entity_id: uuid.UUID
    target_entity_id: uuid.UUID
    relationship_type: str
    timestamp: Optional[datetime] = None
    confidence: Optional[float] = 0.5
    provenance_type: Optional[str] = "OBSERVED"
    source: Optional[str] = None
    evidence_id: Optional[uuid.UUID] = None
    attributes: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class CentralityResult(BaseModel):
    name: str
    type: str
    degree: float
    betweenness: float
    pagerank: float


class LinkPrediction(BaseModel):
    entity_a: Dict[str, Any]
    entity_b: Dict[str, Any]
    score: float
    algorithm: str
    explanation: Dict[str, Any]


class AnomalyResult(BaseModel):
    name: str
    entity_type: str
    anomaly_score: float
    degree: int
    flag: str
    description: str


class IPSResultSchema(BaseModel):
    entity_name: str
    entity_type: str
    ips_score: float
    contributing_factors: Dict[str, Any]
    explanation: str


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------
class GraphNode(BaseModel):
    id: str
    label: str
    name: str
    confidence: Optional[float] = None
    ips_score: Optional[float] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    confidence: Optional[float] = None
    provenance_type: Optional[str] = None
    evidence_id: Optional[str] = None
    timestamp: Optional[str] = None


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
class AskRequest(BaseModel):
    case_id: str
    query: str
    conversation_history: List[Dict[str, Any]] = []


class AskResponse(BaseModel):
    answer: str
    context_facts_used: int
    confidence: str


class ExplainRequest(BaseModel):
    entity_name: str = ""
    case_id: str


# ---------------------------------------------------------------------------
# ML Summary
# ---------------------------------------------------------------------------
class MLSummaryResponse(BaseModel):
    case_id: str
    top_ips: List[Dict[str, Any]]
    link_predictions: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    model_status: Dict[str, Any]


# ---------------------------------------------------------------------------
# Investigative Leads
# ---------------------------------------------------------------------------
class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lead_id: uuid.UUID
    case_id: uuid.UUID
    lead_type: str
    entities_involved: List[Any] = []
    severity: str
    confidence: float
    explanation: str
    evidence_ids: List[str] = []
    contributing_signals: Dict[str, Any] = {}
    generated_at: datetime


class LeadGenerateResponse(BaseModel):
    case_id: str
    leads_generated: int
    leads: List[LeadResponse]


# ---------------------------------------------------------------------------
# Explainability & Evidence Traceability
# ---------------------------------------------------------------------------
class ReasoningStep(BaseModel):
    step: int
    signal_type: str
    description: str
    entities: List[Any] = []
    relationships: List[Any] = []
    evidence_ids: List[str] = []
    sha256_hashes: List[str] = []


class IntegrityCheck(BaseModel):
    all_evidence_verified: bool
    unverified_evidence_ids: List[str] = []


class ExplainLeadResponse(BaseModel):
    lead_id: str
    explanation: str
    reasoning_chain: List[ReasoningStep]
    integrity_check: IntegrityCheck


# ---------------------------------------------------------------------------
# Model Metrics
# ---------------------------------------------------------------------------
class ModelMetricsCreate(BaseModel):
    model_name: str
    model_version: str
    task_type: str  # ner, relation, event, anomaly, link_prediction
    metrics: Dict[str, Any]  # precision, recall, f1, accuracy, auc
    notes: Optional[str] = None


class ModelMetricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    model_name: str
    model_version: str
    task_type: str
    metrics: Dict[str, Any]
    evaluated_at: datetime
    notes: Optional[str] = None

