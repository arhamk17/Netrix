import uuid

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="investigator")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


class Case(Base):
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_number = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="open")
    priority = Column(String, default="medium")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    tags = Column(ARRAY(String), default=list)


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    sha256_hash = Column(String, nullable=False, index=True)
    storage_path = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processing_status = Column(String, default="pending")
    processing_error = Column(Text, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    blockchain_status = Column(String, default="pending")
    blockchain_tx_hash = Column(String, nullable=True)
    blockchain_block_number = Column(Integer, nullable=True)


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    entity_type = Column(String, nullable=False)
    canonical_name = Column(String, nullable=False)
    aliases = Column(JSON, default=list)
    attributes = Column(JSON, default=dict)
    confidence = Column(Float, default=0.5)
    source_evidence_ids = Column(JSON, default=list)
    neo4j_node_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class IPSResult(Base):
    __tablename__ = "ips_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    entity_name = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    ips_score = Column(Float, nullable=False)
    contributing_factors = Column(JSON, default=dict)
    explanation = Column(Text, nullable=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    source_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    target_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    relationship_type = Column(String, nullable=False)
    # Relationship activity timestamp (e.g. phone call, transaction, meeting)
    timestamp = Column(DateTime(timezone=True), nullable=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    confidence = Column(Float, default=0.5)
    provenance_type = Column(String, default="OBSERVED")
    source = Column(String, nullable=True)
    evidence_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=True)
    attributes = Column(JSON, default=dict)
    neo4j_rel_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    # Real-world incident/event timestamp (e.g. robbery, crime occurrence, data breach)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    location = Column(String, nullable=True)
    evidence_id = Column(UUID(as_uuid=True), ForeignKey("evidence.id"), nullable=True)
    attributes = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AnalyticsResult(Base):
    __tablename__ = "analytics_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    metric_type = Column(String, nullable=False, index=True)
    metric_value = Column(Float, nullable=True)
    meta_data = Column("metadata", JSON, default=dict)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())


class LeadResult(Base):
    __tablename__ = "lead_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    lead_type = Column(String, nullable=False, index=True)
    entities_involved = Column(JSON, default=list)
    severity = Column(String, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, default=0.5)
    explanation = Column(Text, nullable=False)
    evidence_ids = Column(JSON, default=list)
    contributing_signals = Column(JSON, default=dict)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def lead_id(self):
        return self.id


class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String, nullable=False, index=True)
    model_version = Column(String, nullable=False)
    task_type = Column(String, nullable=False, index=True)  # ner, relation, event, anomaly, link_prediction
    metrics = Column(JSON, default=dict)                    # precision, recall, f1, accuracy, auc
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)





