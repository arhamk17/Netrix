"""Entity and Relationship Schema for GNN Intelligence Pipeline in NETRIX."""

from dataclasses import asdict, dataclass, field
from typing import Any, Optional


# ============================================================================
# Standard Entity Types
# ============================================================================
ENTITY_TYPE_PERSON = "PERSON"
ENTITY_TYPE_PHONE = "PHONE"
ENTITY_TYPE_ACCOUNT = "ACCOUNT"
ENTITY_TYPE_IP = "IP"
ENTITY_TYPE_FIR = "FIR"
ENTITY_TYPE_LOCATION = "LOCATION"
ENTITY_TYPE_ORGANIZATION = "ORGANIZATION"
ENTITY_TYPE_TRANSACTION = "TRANSACTION"
ENTITY_TYPE_EVENT = "EVENT"
ENTITY_TYPE_CRIME = "CRIME"

VALID_ENTITY_TYPES: frozenset[str] = frozenset({
    ENTITY_TYPE_PERSON,
    ENTITY_TYPE_PHONE,
    ENTITY_TYPE_ACCOUNT,
    ENTITY_TYPE_IP,
    ENTITY_TYPE_FIR,
    ENTITY_TYPE_LOCATION,
    ENTITY_TYPE_ORGANIZATION,
    ENTITY_TYPE_TRANSACTION,
    ENTITY_TYPE_EVENT,
    ENTITY_TYPE_CRIME,
})

# ============================================================================
# Standard Data Sources
# ============================================================================
SOURCE_CDR = "CDR"
SOURCE_FINANCE = "FINANCE"
SOURCE_FIR = "FIR"
SOURCE_NCRB = "NCRB"
SOURCE_TON_IOT = "TON_IOT"

# ============================================================================
# Standard Relationship Types
# ============================================================================
REL_USES = "USES"
REL_OWNS = "OWNS"
REL_CALLS = "CALLS"
REL_TRANSFERS_TO = "TRANSFERS_TO"
REL_MENTIONED_IN = "MENTIONED_IN"
REL_OCCURRED_AT = "OCCURRED_AT"
REL_ASSOCIATED_WITH = "ASSOCIATED_WITH"
REL_COMMUNICATES_WITH = "COMMUNICATES_WITH"
REL_HAS_TRANSACTION = "HAS_TRANSACTION"
REL_HAS_CRIME = "HAS_CRIME"
REL_ATTACKS = "ATTACKS"
REL_CONNECTS_TO = "CONNECTS_TO"
REL_HAS_STATISTIC = "HAS_STATISTIC"


# ============================================================================
# Serialization Helper
# ============================================================================
def _to_json_serializable(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if hasattr(val, "item") and callable(val.item):
        try:
            return val.item()
        except (ValueError, TypeError):
            pass
    if hasattr(val, "tolist") and callable(val.tolist):
        return [_to_json_serializable(x) for x in val.tolist()]
    if isinstance(val, dict):
        return {str(k): _to_json_serializable(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_to_json_serializable(x) for x in val]
    if hasattr(val, "to_dict") and callable(val.to_dict):
        return val.to_dict()
    if hasattr(val, "__dataclass_fields__"):
        return _dataclass_to_dict(val)
    return str(val)


def _dataclass_to_dict(obj: Any) -> dict[str, Any]:
    raw = asdict(obj)
    return {k: _to_json_serializable(v) for k, v in raw.items()}


# ============================================================================
# Dataclasses
# ============================================================================
@dataclass
class Entity:
    entity_id: str
    entity_type: str
    name: str
    original_value: str = ""
    normalized_value: str = ""
    source: str = ""
    sources: list[str] = field(default_factory=list)
    attributes: dict[str, Any] = field(default_factory=dict)
    predictions: dict[str, Any] = field(default_factory=dict)
    risk: dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0

    def __post_init__(self) -> None:
        if not self.original_value:
            self.original_value = self.name
        if not self.normalized_value:
            self.normalized_value = self.original_value
        if self.source and not self.sources:
            self.sources = [self.source]
        elif self.sources and not self.source:
            self.source = self.sources[0]

    def to_dict(self) -> dict[str, Any]:
        return _dataclass_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Entity":
        return cls(
            entity_id=str(data.get("entity_id", "")),
            entity_type=str(data.get("entity_type", "")),
            name=str(data.get("name", "")),
            original_value=str(data.get("original_value", "")),
            normalized_value=str(data.get("normalized_value", "")),
            source=str(data.get("source", "")),
            sources=list(data.get("sources", [])),
            attributes=dict(data.get("attributes", {})),
            predictions=dict(data.get("predictions", {})),
            risk=dict(data.get("risk", {})),
            confidence=float(data.get("confidence", 1.0)),
        )


@dataclass
class Relationship:
    relationship_id: str
    source_entity: str
    target_entity: str
    relationship_type: str
    sources: list[str] = field(default_factory=list)
    confidence: float = 1.0
    risk_score: Optional[float] = None
    timestamp: Optional[str] = None
    attributes: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return _dataclass_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Relationship":
        return cls(
            relationship_id=str(data.get("relationship_id", "")),
            source_entity=str(data.get("source_entity", "")),
            target_entity=str(data.get("target_entity", "")),
            relationship_type=str(data.get("relationship_type", "")),
            sources=list(data.get("sources", [])),
            confidence=float(data.get("confidence", 1.0)),
            risk_score=float(data["risk_score"]) if data.get("risk_score") is not None else None,
            timestamp=str(data["timestamp"]) if data.get("timestamp") is not None else None,
            attributes=dict(data.get("attributes", {})),
        )


@dataclass
class Prediction:
    model_name: str
    source: str
    prediction: str
    confidence: float
    risk_score: float
    raw_input: Optional[dict[str, Any]] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return _dataclass_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Prediction":
        return cls(
            model_name=str(data.get("model_name", "")),
            source=str(data.get("source", "")),
            prediction=str(data.get("prediction", "")),
            confidence=float(data.get("confidence", 0.0)),
            risk_score=float(data.get("risk_score", 0.0)),
            raw_input=dict(data["raw_input"]) if data.get("raw_input") is not None else None,
            timestamp=str(data["timestamp"]) if data.get("timestamp") is not None else None,
        )


@dataclass
class RiskProfile:
    cyber_risk: Optional[float] = None
    financial_risk: Optional[float] = None
    communication_risk: Optional[float] = None
    fir_risk: Optional[float] = None
    graph_risk: Optional[float] = None
    overall_risk: float = 0.0
    risk_tier: str = "LOW"
    factors: dict[str, float] = field(default_factory=dict)
    explanation: str = ""

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def to_dict(self) -> dict[str, Any]:
        return _dataclass_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RiskProfile":
        return cls(
            cyber_risk=float(data["cyber_risk"]) if data.get("cyber_risk") is not None else None,
            financial_risk=float(data["financial_risk"]) if data.get("financial_risk") is not None else None,
            communication_risk=float(data["communication_risk"]) if data.get("communication_risk") is not None else None,
            fir_risk=float(data["fir_risk"]) if data.get("fir_risk") is not None else None,
            graph_risk=float(data["graph_risk"]) if data.get("graph_risk") is not None else None,
            overall_risk=float(data.get("overall_risk", 0.0)),
            risk_tier=str(data.get("risk_tier", "LOW")),
            factors=dict(data.get("factors", {})),
            explanation=str(data.get("explanation", "")),
        )
