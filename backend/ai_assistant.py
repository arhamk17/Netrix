"""
ai_assistant.py
Gemini is OPTIONAL — used only to explain ML/graph results in plain English.
Core predictions come from RandomForest + IsolationForest in analytics.py.

/ai/ask        — graph-context Q&A (Gemini if key present, rule-based fallback)
/ai/explain    — explain IPS score (Gemini if key present, stored text fallback)
/ai/ml-summary — structured ML-only summary, NO LLM call
"""
import logging
import httpx
from google import genai
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import settings
from database import get_neo4j_session, get_db
from models import IPSResult, User
from auth import get_current_user, log_action
import schemas

logger = logging.getLogger(__name__)

ai_router = APIRouter()

SYSTEM_PROMPT = """You are an investigative intelligence assistant.
Your job is to help investigators understand relationships in criminal case data.
Rules:
- Answer ONLY from the graph context and ML results provided. Do not hallucinate.
- Always cite entity names and evidence IDs when available.
- Never assign guilt, criminal probability, or definitive conclusions.
- If the data does not answer the question, say so clearly.
- Use plain language. Be concise. Bullet points where helpful."""


def build_graph_context(case_id: str) -> str:
    with get_neo4j_session() as session:
        result = session.run(
            """
            MATCH (n {case_id: $case_id})-[r]-(m)
            RETURN n.name AS n_name, labels(n)[0] AS n_label, type(r) AS rel_type,
                   m.name AS m_name, labels(m)[0] AS m_label,
                   r.evidence_id AS evidence_id, r.timestamp AS timestamp,
                   r.confidence AS confidence
            LIMIT 120
            """,
            case_id=case_id,
        )
        lines = []
        for rec in result:
            lines.append(
                f"[{rec['n_label']}] {rec['n_name']} --[{rec['rel_type']}]--> "
                f"[{rec['m_label']}] {rec['m_name']} | evidence: {rec['evidence_id']} "
                f"| time: {rec['timestamp']}"
            )
    context = "\n".join(lines)
    return context[:6000]


def _fallback_answer(query: str, context: str) -> dict:
    query_terms = [t.lower() for t in query.split() if len(t) > 2]
    matches = [
        line for line in context.split("\n")
        if any(t in line.lower() for t in query_terms)
    ]
    if matches:
        answer = (
            "Rule-based lookup (no LLM key configured). "
            "Matching facts:\n" + "\n".join(matches[:15])
        )
    else:
        answer = (
            "Rule-based lookup (no LLM key configured). "
            "No matching facts found in the graph context."
        )
    return {
        "answer": answer,
        "context_facts_used": context.count("\n"),
        "confidence": "LOW",
    }


def _get_gemini_client():
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def call_inference_model(prompt: str, history: list = None) -> str:
    """
    Call local AI inference model via HTTP POST to LOCAL_MODEL_URL/generate.
    Payload: {"prompt": prompt, "history": history or []}
    Expects response: {"text": ...}
    """
    if not settings.LOCAL_MODEL_URL:
        raise ValueError("LOCAL_MODEL_URL is not configured")

    url = f"{settings.LOCAL_MODEL_URL.rstrip('/')}/generate"
    payload = {
        "prompt": prompt,
        "history": history or [],
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("text", "")
    except Exception as exc:
        logger.exception("Local inference model call failed: %s", exc)
        raise exc


def ask_network(query: str, case_id: str, history: list) -> dict:
    context = build_graph_context(case_id)
    full_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Graph context:\n{context}\n\n"
        f"Question: {query}"
    )

    # 1. Try LOCAL MODEL FIRST
    if settings.LOCAL_MODEL_URL:
        try:
            local_ans = call_inference_model(full_prompt, history)
            if local_ans:
                return {
                    "answer": local_ans,
                    "context_facts_used": context.count("\n"),
                    "confidence": "HIGH" if len(context) > 500 else "LOW",
                }
        except Exception as exc:
            logger.warning("Local inference model failed, falling back: %s", exc)

    # 2. Fallback to Gemini if configured
    if settings.GEMINI_API_KEY:
        try:
            client = _get_gemini_client()

            contents = []
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

            contents.append({
                "role": "user",
                "parts": [{"text": f"Graph context:\n{context}\n\nQuestion: {query}"}],
            })

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "max_output_tokens": 800,
                },
            )

            return {
                "answer": response.text,
                "context_facts_used": context.count("\n"),
                "confidence": "HIGH" if len(context) > 500 else "LOW",
            }
        except Exception as exc:
            logger.exception("Gemini API call failed: %s", exc)

    # 3. Heuristic fallback
    return _fallback_answer(query, context)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@ai_router.post("/ask", response_model=schemas.AskResponse)
def route_ask(
    payload: schemas.AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = ask_network(payload.query, payload.case_id, payload.conversation_history)
    log_action(db, current_user.id, "ai_ask", "case", payload.case_id,
               {"query": payload.query})
    return result


@ai_router.post("/explain")
def route_explain(
    payload: schemas.ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ips = (
        db.query(IPSResult)
        .filter(
            IPSResult.case_id == payload.case_id,
            IPSResult.entity_name == payload.entity_name,
        )
        .first()
    )
    if not ips:
        return {"explanation": f"No IPS result found for {payload.entity_name} in this case."}

    prompt = (
        f"Explain in plain English why {payload.entity_name} has IPS score {ips.ips_score}. "
        f"Contributing factors: {ips.contributing_factors}. "
        "The IPS was computed by Random Forest link prediction + Isolation Forest anomaly "
        "detection + network centrality. Never use guilt-implying language."
    )

    if settings.LOCAL_MODEL_URL:
        try:
            local_exp = call_inference_model(prompt, [])
            if local_exp:
                return {"explanation": local_exp}
        except Exception as exc:
            logger.warning("Local inference model explain failed, falling back: %s", exc)

    if settings.GEMINI_API_KEY:
        try:
            client = _get_gemini_client()
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "max_output_tokens": 400,
                },
            )
            return {"explanation": response.text}
        except Exception as exc:
            logger.exception("Gemini API call failed in explain: %s", exc)

    return {"explanation": ips.explanation}



@ai_router.post("/ml-summary", response_model=schemas.MLSummaryResponse)
def route_ml_summary(
    payload: schemas.ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Structured ML-only summary for a case — no LLM call.
    Returns:
      - top IPS entities
      - link predictions (with RF scores)
      - anomaly detections (with IF scores)
      - model status (trained / heuristic fallback)
    """
    from analytics import (
        compute_ips,
        compute_link_predictions,
        compute_anomaly_scores,
        get_model_status,
    )

    case_id = payload.case_id

    top_ips = compute_ips(case_id, db)[:10]
    link_preds = compute_link_predictions(case_id)[:10]
    anomalies = compute_anomaly_scores(case_id)[:10]
    model_status = get_model_status()

    log_action(db, current_user.id, "ml_summary", "case", case_id)

    return {
        "case_id":          case_id,
        "top_ips":          top_ips,
        "link_predictions": link_preds,
        "anomalies":        anomalies,
        "model_status":     model_status,
    }
