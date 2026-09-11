"""Multi-Source Explainable Risk Fusion Engine for NETRIX.

Combines multimodal intelligence predictions across cyber network flows (TON_IoT / GraphSAGE),
financial transactions (HeteroCrimeGNN AML), telecom call records (CDR),
and formal law enforcement reports (FIR), weighted alongside graph topological
centrality metrics with dynamic re-normalization over available modalities.
"""

from typing import Any, Optional
from ml_models.gnn.schema import (
    Entity,
    Prediction,
    RiskProfile,
    _to_json_serializable,
)

# Standard Threat Tiers
TIER_CRITICAL = "CRITICAL"
TIER_HIGH = "HIGH"
TIER_MEDIUM = "MEDIUM"
TIER_LOW = "LOW"

# Default Modality Risk Weights
DEFAULT_WEIGHTS: dict[str, float] = {
    "cyber": 0.25,
    "financial": 0.25,
    "communication": 0.20,
    "fir": 0.20,
    "graph": 0.10,
}


class RiskFusionEngine:
    """Multi-source explainable risk fusion engine for criminal intelligence entities."""

    def __init__(self, weights: Optional[dict[str, float]] = None) -> None:
        self.weights: dict[str, float] = dict(weights if weights is not None else DEFAULT_WEIGHTS)
        for k, v in self.weights.items():
            self.weights[k] = max(0.0, float(v))

    @staticmethod
    def _extract_score_from_item(item: Any) -> Optional[float]:
        if item is None:
            return None
        if isinstance(item, (int, float)):
            return min(1.0, max(0.0, float(item)))
        if isinstance(item, Prediction):
            return min(1.0, max(0.0, float(item.risk_score)))
        if hasattr(item, "risk_score"):
            val = getattr(item, "risk_score")
            if val is not None:
                return min(1.0, max(0.0, float(val)))
        if isinstance(item, dict):
            for key in ("risk_score", "score", "probability", "gnn_prob", "confidence", "threat_score"):
                if key in item and item[key] is not None:
                    try:
                        return min(1.0, max(0.0, float(item[key])))
                    except (ValueError, TypeError):
                        pass
        return None

    def _extract_cyber_risk(self, entity: Entity) -> Optional[float]:
        scores: list[float] = []
        for key in ("cyber", "ton_iot", "TON_IOT", "TON_IoT_RandomForest", "network", "cyber_risk", "attacks"):
            if key in entity.predictions:
                val = self._extract_score_from_item(entity.predictions[key])
                if val is not None:
                    scores.append(val)

        if entity.entity_type == "IP":
            for k in ("risk_score", "threat_score", "maliciousness"):
                if k in entity.attributes:
                    val = self._extract_score_from_item(entity.attributes[k])
                    if val is not None:
                        scores.append(val)

        connected_ips = entity.attributes.get("connected_ips", []) or entity.attributes.get("ip_predictions", [])
        if isinstance(connected_ips, list):
            for ip_item in connected_ips:
                val = self._extract_score_from_item(ip_item)
                if val is not None:
                    scores.append(val)
        elif isinstance(connected_ips, dict):
            for _, ip_val in connected_ips.items():
                val = self._extract_score_from_item(ip_val)
                if val is not None:
                    scores.append(val)

        for attr_key in ("cyber_risk", "ton_iot_risk"):
            if attr_key in entity.attributes:
                val = self._extract_score_from_item(entity.attributes[attr_key])
                if val is not None:
                    scores.append(val)

        return round(max(scores), 4) if scores else None

    def _extract_financial_risk(self, entity: Entity) -> Optional[float]:
        scores: list[float] = []
        for key in ("financial", "finance", "FINANCE", "aml", "HeteroCrimeGNN", "best_hetero_crime_gnn", "financial_risk"):
            if key in entity.predictions:
                val = self._extract_score_from_item(entity.predictions[key])
                if val is not None:
                    scores.append(val)

        if entity.entity_type in ("ACCOUNT", "TRANSACTION", "BANK_ACCOUNT"):
            for k in ("risk_score", "aml_score", "is_laundering_prob"):
                if k in entity.attributes:
                    val = self._extract_score_from_item(entity.attributes[k])
                    if val is not None:
                        scores.append(val)

        connected_accounts = (
            entity.attributes.get("connected_accounts", [])
            or entity.attributes.get("account_predictions", [])
            or entity.attributes.get("transactions", [])
        )
        if isinstance(connected_accounts, list):
            for acc_item in connected_accounts:
                val = self._extract_score_from_item(acc_item)
                if val is not None:
                    scores.append(val)
        elif isinstance(connected_accounts, dict):
            for _, acc_val in connected_accounts.items():
                val = self._extract_score_from_item(acc_val)
                if val is not None:
                    scores.append(val)

        for attr_key in ("financial_risk", "aml_risk"):
            if attr_key in entity.attributes:
                val = self._extract_score_from_item(entity.attributes[attr_key])
                if val is not None:
                    scores.append(val)

        return round(max(scores), 4) if scores else None

    def _extract_communication_risk(self, entity: Entity) -> Optional[float]:
        scores: list[float] = []
        for key in ("communication", "cdr", "CDR", "telecom", "CDR_Telecom_Anomaly_Engine", "communication_risk"):
            if key in entity.predictions:
                val = self._extract_score_from_item(entity.predictions[key])
                if val is not None:
                    scores.append(val)

        if entity.entity_type == "PHONE":
            for k in ("risk_score", "anomaly_score", "call_risk"):
                if k in entity.attributes:
                    val = self._extract_score_from_item(entity.attributes[k])
                    if val is not None:
                        scores.append(val)

        connected_phones = (
            entity.attributes.get("connected_phones", [])
            or entity.attributes.get("phone_predictions", [])
            or entity.attributes.get("calls", [])
        )
        if isinstance(connected_phones, list):
            for phone_item in connected_phones:
                val = self._extract_score_from_item(phone_item)
                if val is not None:
                    scores.append(val)
        elif isinstance(connected_phones, dict):
            for _, phone_val in connected_phones.items():
                val = self._extract_score_from_item(phone_val)
                if val is not None:
                    scores.append(val)

        for attr_key in ("communication_risk", "cdr_risk"):
            if attr_key in entity.attributes:
                val = self._extract_score_from_item(entity.attributes[attr_key])
                if val is not None:
                    scores.append(val)

        return round(max(scores), 4) if scores else None

    def _extract_fir_risk(self, entity: Entity) -> Optional[float]:
        scores: list[float] = []
        for key in ("fir", "FIR", "legal", "statute", "FIR_Legal_Severity_Engine", "fir_risk", "legal_severity"):
            if key in entity.predictions:
                val = self._extract_score_from_item(entity.predictions[key])
                if val is not None:
                    scores.append(val)

        if entity.entity_type in ("FIR", "CRIME"):
            for k in ("risk_score", "severity_score", "legal_severity"):
                if k in entity.attributes:
                    val = self._extract_score_from_item(entity.attributes[k])
                    if val is not None:
                        scores.append(val)

        connected_firs = (
            entity.attributes.get("firs", [])
            or entity.attributes.get("connected_firs", [])
            or entity.attributes.get("fir_predictions", [])
        )
        if isinstance(connected_firs, list):
            for fir_item in connected_firs:
                val = self._extract_score_from_item(fir_item)
                if val is not None:
                    scores.append(val)
        elif isinstance(connected_firs, dict):
            for _, fir_val in connected_firs.items():
                val = self._extract_score_from_item(fir_val)
                if val is not None:
                    scores.append(val)

        for attr_key in ("fir_risk", "legal_risk"):
            if attr_key in entity.attributes:
                val = self._extract_score_from_item(entity.attributes[attr_key])
                if val is not None:
                    scores.append(val)

        return round(max(scores), 4) if scores else None

    def compute_entity_risk(self, entity: Entity, centrality_score: float = 0.0) -> RiskProfile:
        cyber_risk = self._extract_cyber_risk(entity)
        financial_risk = self._extract_financial_risk(entity)
        communication_risk = self._extract_communication_risk(entity)
        fir_risk = self._extract_fir_risk(entity)
        graph_risk: Optional[float] = round(float(centrality_score), 4) if centrality_score > 0.0 else None

        available_factors: dict[str, float] = {}
        if cyber_risk is not None:
            available_factors["cyber"] = cyber_risk
        if financial_risk is not None:
            available_factors["financial"] = financial_risk
        if communication_risk is not None:
            available_factors["communication"] = communication_risk
        if fir_risk is not None:
            available_factors["fir"] = fir_risk
        if graph_risk is not None:
            available_factors["graph"] = graph_risk

        if not available_factors:
            overall_risk = 0.0
            tier = TIER_LOW
            explanation = f"Entity '{entity.name}' ({entity.entity_id}) has no active risk signals; baseline tier LOW (0.00)."
            normalized_weights: dict[str, float] = {}
        else:
            total_active_weight = sum(self.weights.get(k, 0.0) for k in available_factors.keys())
            if total_active_weight > 0.0:
                normalized_weights = {
                    k: self.weights.get(k, 0.0) / total_active_weight
                    for k in available_factors.keys()
                }
                overall_risk = sum(available_factors[k] * normalized_weights[k] for k in available_factors.keys())
            else:
                uniform_weight = 1.0 / len(available_factors)
                normalized_weights = {k: uniform_weight for k in available_factors.keys()}
                overall_risk = sum(available_factors.values()) * uniform_weight

            overall_risk = min(1.0, max(0.0, round(overall_risk, 4)))

            if overall_risk >= 0.80:
                tier = TIER_CRITICAL
            elif overall_risk >= 0.60:
                tier = TIER_HIGH
            elif overall_risk >= 0.40:
                tier = TIER_MEDIUM
            else:
                tier = TIER_LOW

            breakdown_parts = [
                f"{k}={available_factors[k]:.2f} (wt={normalized_weights[k]:.1%})"
                for k in sorted(available_factors.keys())
            ]
            explanation = (
                f"Entity '{entity.name}' (type={entity.entity_type}) evaluated at "
                f"{tier} risk ({overall_risk:.2f}). Modality breakdown: {', '.join(breakdown_parts)}."
            )

        return RiskProfile(
            cyber_risk=cyber_risk,
            financial_risk=financial_risk,
            communication_risk=communication_risk,
            fir_risk=fir_risk,
            graph_risk=graph_risk,
            overall_risk=overall_risk,
            risk_tier=tier,
            factors={k: round(v, 4) for k, v in available_factors.items()},
            explanation=explanation,
        )

    def extract_centrality_score(
        self, entity_id: str, centrality_metrics: dict[str, dict[str, float]]
    ) -> float:
        if not centrality_metrics or entity_id not in centrality_metrics:
            return 0.0

        metrics = centrality_metrics[entity_id]
        if "centrality_score" in metrics:
            return min(1.0, max(0.0, float(metrics["centrality_score"])))
        if "overall" in metrics:
            return min(1.0, max(0.0, float(metrics["overall"])))

        deg = float(metrics.get("degree_centrality", 0.0))
        bet = float(metrics.get("betweenness_centrality", 0.0))
        cls_c = float(metrics.get("closeness_centrality", 0.0))
        pr = float(metrics.get("pagerank", 0.0))

        composite = (0.40 * deg) + (0.45 * bet) + (0.15 * cls_c)
        if pr > 0.05:
            composite = max(composite, min(1.0, pr * 4.0))

        return min(1.0, max(0.0, round(composite, 4)))

    def fuse_all_risks(
        self,
        entities: list[Entity],
        centrality_metrics: dict[str, dict[str, float]],
    ) -> list[Entity]:
        for entity in entities:
            c_score = self.extract_centrality_score(entity.entity_id, centrality_metrics)
            risk_profile = self.compute_entity_risk(entity, centrality_score=c_score)
            entity.risk = risk_profile

        return entities


def get_risk_summary(entities: list[Entity]) -> dict[str, Any]:
    tier_counts = {TIER_CRITICAL: 0, TIER_HIGH: 0, TIER_MEDIUM: 0, TIER_LOW: 0}
    scores: list[float] = []
    top_entities: list[dict[str, Any]] = []

    for e in entities:
        r = e.risk
        score = float(r.overall_risk if hasattr(r, "overall_risk") else r.get("overall_risk", 0.0))
        tier = str(r.risk_tier if hasattr(r, "risk_tier") else r.get("risk_tier", TIER_LOW))
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        scores.append(score)

    avg_score = round(sum(scores) / len(scores), 4) if scores else 0.0
    sorted_entities = sorted(
        entities,
        key=lambda x: (x.risk.overall_risk if hasattr(x.risk, "overall_risk") else x.risk.get("overall_risk", 0.0)),
        reverse=True,
    )
    for e in sorted_entities[:10]:
        score = float(e.risk.overall_risk if hasattr(e.risk, "overall_risk") else e.risk.get("overall_risk", 0.0))
        tier = str(e.risk.risk_tier if hasattr(e.risk, "risk_tier") else e.risk.get("risk_tier", TIER_LOW))
        top_entities.append({
            "entity_id": e.entity_id,
            "name": e.name,
            "entity_type": e.entity_type,
            "overall_risk": score,
            "risk_tier": tier,
        })

    return {
        "total_entities": len(entities),
        "average_overall_risk": avg_score,
        "tier_distribution": tier_counts,
        "top_risk_entities": top_entities,
    }
