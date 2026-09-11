/**
 * NETRIX Criminal Network Intelligence Platform - Centralized API Service Layer
 * Directly aligned with FastAPI backend ground truth contracts.
 * Backend = Source of Truth.
 */

import type {
  AuthResponse,
  User,
  UserCreateRequest,
  Case,
  Evidence,
  Entity,
  Relationship,
  GraphData,
  GraphNode,
  GraphEdge,
  ShortestPathResult,
  CustodyHistoryResponse,
  EvidenceVerifyResponse,
  InvestigativeLead,
  LeadGenerateResponse,
  ExplainLeadResponse,
  TemporalEvent,
  ModelMetricsResponse,
  CentralityResult,
  AnomalyResult,
  IPSResultSchema,
  CommunityResult,
  AIAskResponse,
  AIExplainResponse,
  AIMlSummaryResponse
} from '../types';

const BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';

export function getAuthToken(): string | null {
  try {
    const token = localStorage.getItem('netrix_access_token');
    if (!token || token === 'undefined' || token === 'null') return null;
    return token;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    if (!token || token === 'undefined' || token === 'null') {
      clearAuthToken();
      return;
    }
    localStorage.setItem('netrix_access_token', token);
  } catch (err) {
    console.warn('[NETRIX API] Failed to set token in storage:', err);
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem('netrix_access_token');
    localStorage.removeItem('netrix_user');
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('netrix:unauthorized'));
    throw new Error('Authentication expired or invalid credentials.');
  }

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
      if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
    } catch {
      // fallback to status text
    }
    throw new Error(errorDetail);
  }

  return (await response.json()) as T;
}

export const api = {
  // ---------------------------------------------------------------------------
  // Authentication & Users
  // ---------------------------------------------------------------------------
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return res;
  },

  getCurrentUser: async (): Promise<User> => {
    return request<User>('/auth/me');
  },

  createUser: async (payload: UserCreateRequest): Promise<User> => {
    return request<User>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ---------------------------------------------------------------------------
  // Cases (case_id is the primary UUID)
  // ---------------------------------------------------------------------------
  getCases: async (): Promise<Case[]> => {
    const rawCases = await request<Case[]>('/cases');
    return (rawCases || []).map(c => ({
      ...c,
      case_id: c.id || c.case_id,
      case_number: c.case_number || c.id || 'CR/2024/NETRIX/001',
      title: c.title || 'Untitled Investigation Case',
      description: c.description || 'No description provided.',
      status: (c.status || 'open') as CaseStatus,
      priority: (c.priority || 'medium') as CasePriority,
      tags: Array.isArray(c.tags) ? c.tags : [],
      created_at: c.created_at || new Date().toISOString(),
      updated_at: c.updated_at || c.created_at || new Date().toISOString(),
      lead_investigator: c.lead_investigator || c.assigned_to || c.created_by || 'Lead Investigator',
      assigned_investigators: Array.isArray(c.assigned_investigators) && c.assigned_investigators.length > 0
        ? c.assigned_investigators
        : [c.lead_investigator || c.assigned_to || c.created_by || 'Lead Investigator'],
      evidence_count: typeof c.evidence_count === 'number' ? c.evidence_count : 0,
      entity_count: typeof c.entity_count === 'number' ? c.entity_count : 0,
      relationship_count: typeof c.relationship_count === 'number' ? c.relationship_count : 0,
      ips_average: typeof c.ips_average === 'number' ? c.ips_average : 0.75,
      anomaly_count: typeof c.anomaly_count === 'number' ? c.anomaly_count : 0
    }));
  },

  createCase: async (payload: {
    title: string;
    description?: string;
    priority?: string;
    tags?: string[];
    case_number?: string;
  }): Promise<Case> => {
    const caseNumber = payload.case_number?.trim() || `CASE-${Date.now().toString().slice(-6)}`;
    const created = await request<Case>('/cases', {
      method: 'POST',
      body: JSON.stringify({
        case_number: caseNumber,
        title: payload.title,
        description: payload.description || '',
        priority: (payload.priority || 'medium').toLowerCase(),
        tags: payload.tags || []
      })
    });
    return {
      ...created,
      case_id: created.id || created.case_id,
      case_number: created.case_number || created.id || caseNumber,
      title: created.title || payload.title,
      description: created.description || payload.description || '',
      status: (created.status || 'open') as CaseStatus,
      priority: (created.priority || payload.priority || 'medium') as CasePriority,
      tags: Array.isArray(created.tags) ? created.tags : (payload.tags || []),
      created_at: created.created_at || new Date().toISOString(),
      updated_at: created.updated_at || created.created_at || new Date().toISOString(),
      lead_investigator: created.lead_investigator || created.assigned_to || created.created_by || 'Lead Investigator',
      assigned_investigators: Array.isArray(created.assigned_investigators) && created.assigned_investigators.length > 0
        ? created.assigned_investigators
        : [created.lead_investigator || created.assigned_to || created.created_by || 'Lead Investigator'],
      evidence_count: 0,
      entity_count: 0,
      relationship_count: 0,
      ips_average: 0.75,
      anomaly_count: 0
    };
  },

  getCase: async (caseId: string): Promise<{
    case: Case;
    evidence: Evidence[];
    entity_count: number;
    top_ips_results: { entity_name: string; entity_type: string; ips_score: number; explanation: string }[];
  }> => {
    return request<any>(`/cases/${encodeURIComponent(caseId)}`);
  },

  updateCase: async (caseId: string, payload: Partial<Case>): Promise<Case> => {
    const updated = await request<Case>(`/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return {
      ...updated,
      case_id: updated.id || updated.case_id,
      case_number: updated.case_number || updated.id
    };
  },

  getCaseEntities: async (caseId: string): Promise<Entity[]> => {
    return request<Entity[]>(`/cases/${encodeURIComponent(caseId)}/entities`);
  },

  getCaseRelationships: async (caseId: string): Promise<Relationship[]> => {
    return request<Relationship[]>(`/cases/${encodeURIComponent(caseId)}/relationships`);
  },

  getCaseEvidence: async (caseId: string): Promise<Evidence[]> => {
    const list = await request<Evidence[]>(`/cases/${encodeURIComponent(caseId)}/evidence`);
    return (list || []).map(ev => ({
      ...ev,
      evidence_id: ev.id || ev.evidence_id,
      filename: ev.original_filename || ev.filename || 'evidence_artifact',
      status: (ev.processing_status as any) || ev.status || 'pending',
      upload_time: ev.uploaded_at || ev.upload_time || new Date().toISOString()
    }));
  },

  // ---------------------------------------------------------------------------
  // Evidence & Blockchain Integrity
  // ---------------------------------------------------------------------------
  uploadEvidence: async (file: File, caseId: string, sourceType: string = 'report'): Promise<Evidence> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    formData.append('source_type', sourceType);

    const uploaded = await request<Evidence>('/evidence/upload', {
      method: 'POST',
      body: formData
    });
    return {
      ...uploaded,
      evidence_id: uploaded.id || uploaded.evidence_id,
      filename: uploaded.original_filename || uploaded.filename || file.name,
      status: (uploaded.processing_status as any) || uploaded.status || 'pending',
      upload_time: uploaded.uploaded_at || uploaded.upload_time || new Date().toISOString()
    };
  },

  getEvidence: async (evidenceId: string): Promise<Evidence> => {
    const ev = await request<Evidence>(`/evidence/${encodeURIComponent(evidenceId)}`);
    return {
      ...ev,
      evidence_id: ev.id || ev.evidence_id,
      filename: ev.original_filename || ev.filename,
      status: (ev.processing_status as any) || ev.status,
      upload_time: ev.uploaded_at || ev.upload_time
    };
  },

  getEvidenceStatus: async (evidenceId: string): Promise<any> => {
    return request<any>(`/evidence/${encodeURIComponent(evidenceId)}/status`);
  },

  verifyEvidence: async (evidenceId: string): Promise<EvidenceVerifyResponse> => {
    return request<EvidenceVerifyResponse>(`/evidence/${encodeURIComponent(evidenceId)}/verify`);
  },

  getEvidenceBlockchain: async (evidenceId: string): Promise<any> => {
    return request<any>(`/evidence/${encodeURIComponent(evidenceId)}/blockchain`);
  },

  getEvidenceCustodyHistory: async (evidenceId: string): Promise<CustodyHistoryResponse> => {
    return request<CustodyHistoryResponse>(`/evidence/${encodeURIComponent(evidenceId)}/blockchain/history`);
  },

  // ---------------------------------------------------------------------------
  // Graph Intelligence (Neo4j Backend)
  // ---------------------------------------------------------------------------
  getCaseGraph: async (caseId: string): Promise<GraphData> => {
    const raw = await request<any>(`/graph/case/${encodeURIComponent(caseId)}`);
    const nodes: GraphNode[] = (raw?.nodes || []).map((n: any) => {
      const type = (n.label || n.type || n.entity_type || 'PERSON').toUpperCase();
      return {
        id: n.id || n.name,
        label: n.label || type,
        name: n.name || n.canonical_name || n.id,
        confidence: typeof n.confidence === 'number' ? n.confidence : 0.8,
        ips_score: typeof n.ips_score === 'number' ? (n.ips_score > 1.0 ? Math.min(1.0, n.ips_score / 100.0) : Math.max(0.0, Math.min(1.0, n.ips_score))) : 0.5,
        type,
        degree: typeof n.degree === 'number' ? n.degree : 1,
        betweenness: typeof n.betweenness === 'number' ? n.betweenness : 0.0,
        pagerank: n.pagerank,
        anomaly_score: n.anomaly_score
      };
    });

    const edges: GraphEdge[] = (raw?.edges || []).map((e: any, idx: number) => {
      const provenance = (e.provenance_type || 'OBSERVED').toUpperCase();
      return {
        id: e.id || `edge-${idx}`,
        source: e.source || e.source_entity_id,
        target: e.target || e.target_entity_id,
        type: e.type || e.relationship_type || 'RELATED_TO',
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.8,
        provenance_type: provenance,
        evidence_id: e.evidence_id || null,
        timestamp: e.timestamp || null,
        category: provenance === 'PREDICTED' ? 'INFERRED' : 'OBSERVED',
        is_predicted: provenance === 'PREDICTED'
      };
    });

    const observedCount = edges.filter(e => e.provenance_type === 'OBSERVED').length;
    const predictedCount = edges.filter(e => e.provenance_type === 'PREDICTED').length;

    return {
      nodes,
      edges,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        observed_edges: observedCount,
        predicted_edges: predictedCount,
        high_ips_count: nodes.filter(n => (n.ips_score ?? 0) >= 0.7).length,
        anomalous_nodes_count: nodes.filter(n => (n.anomaly_score ?? 0) >= 0.7).length
      }
    };
  },

  getShortestPath: async (caseId: string, from: string, to: string): Promise<ShortestPathResult> => {
    return request<ShortestPathResult>(
      `/graph/path?case_id=${encodeURIComponent(caseId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
  },

  getEntityNeighbors: async (name: string, caseId: string): Promise<any[]> => {
    return request<any[]>(`/graph/entity/${encodeURIComponent(name)}?case_id=${encodeURIComponent(caseId)}`);
  },

  getTimeline: async (caseId: string): Promise<TemporalEvent[]> => {
    const raw = await request<any[]>(`/timeline/${encodeURIComponent(caseId)}`);
    return (raw || []).map((ev: any, idx: number) => {
      const eid = ev.id || ev.event_id || `evt-${caseId}-${idx}`;
      return {
        ...ev,
        id: eid,
        event_id: eid,
        case_id: ev.case_id || caseId,
        from_entity: ev.from_entity || ev.source_entity || 'Unknown',
        from_type: ev.from_type || 'Entity',
        event_type: ev.event_type || ev.relationship_type || 'INTERACTION',
        to_entity: ev.to_entity || ev.target_entity || 'Unknown',
        timestamp: ev.timestamp || new Date().toISOString(),
        evidence_id: ev.evidence_id || null,
        confidence: typeof ev.confidence === 'number' ? ev.confidence : 0.8,
        description: `${ev.from_entity || 'Entity'} ${ev.event_type || 'interacted with'} ${ev.to_entity || 'Target'}`,
        source_entity: ev.from_entity || ev.source_entity,
        target_entity: ev.to_entity || ev.target_entity
      };
    });
  },

  // ---------------------------------------------------------------------------
  // Analytics & ML Scores
  // ---------------------------------------------------------------------------
  getCentrality: async (caseId: string): Promise<CentralityResult[]> => {
    return request<CentralityResult[]>(`/analytics/centrality?case_id=${encodeURIComponent(caseId)}`);
  },

  getIPS: async (caseId: string): Promise<IPSResultSchema[]> => {
    return request<IPSResultSchema[]>(`/analytics/ips?case_id=${encodeURIComponent(caseId)}`);
  },

  getAnomalies: async (caseId: string): Promise<AnomalyResult[]> => {
    return request<AnomalyResult[]>(`/analytics/anomalies?case_id=${encodeURIComponent(caseId)}`);
  },

  getLinkPredictions: async (caseId: string): Promise<any[]> => {
    return request<any[]>(`/analytics/link-predictions?case_id=${encodeURIComponent(caseId)}`);
  },

  getCommunities: async (caseId: string): Promise<CommunityResult[]> => {
    return request<CommunityResult[]>(`/analytics/communities?case_id=${encodeURIComponent(caseId)}`);
  },

  getModelStatus: async (): Promise<any> => {
    return request<any>('/analytics/model-status');
  },

  // ---------------------------------------------------------------------------
  // Investigative Leads & Explainability
  // ---------------------------------------------------------------------------
  generateLeads: async (caseId: string): Promise<LeadGenerateResponse> => {
    return request<LeadGenerateResponse>(`/leads/generate?case_id=${encodeURIComponent(caseId)}`, {
      method: 'POST'
    });
  },

  getLeads: async (caseId: string): Promise<InvestigativeLead[]> => {
    const query = caseId ? `?case_id=${encodeURIComponent(caseId)}` : '';
    const leads = await request<InvestigativeLead[]>(`/leads${query}`);
    return (leads || []).map(l => ({
      ...l,
      entities: l.entities_involved || (l as any).entities || [],
      title: l.title || `${l.lead_type.replace(/_/g, ' ')}: ${(l.entities_involved || []).join(' ↔ ')}`,
      created_at: l.generated_at || l.created_at || new Date().toISOString()
    }));
  },

  getLead: async (leadId: string): Promise<InvestigativeLead> => {
    const l = await request<InvestigativeLead>(`/leads/${encodeURIComponent(leadId)}`);
    return {
      ...l,
      entities: l.entities_involved || (l as any).entities || [],
      title: l.title || `${l.lead_type.replace(/_/g, ' ')}: ${(l.entities_involved || []).join(' ↔ ')}`,
      created_at: l.generated_at || l.created_at || new Date().toISOString()
    };
  },

  explainLead: async (leadId: string): Promise<ExplainLeadResponse> => {
    return request<ExplainLeadResponse>(`/leads/${encodeURIComponent(leadId)}/explain`);
  },

  // ---------------------------------------------------------------------------
  // AI Assistant & Machine Learning Summary
  // ---------------------------------------------------------------------------
  getMLSummary: async (caseId: string): Promise<AIMlSummaryResponse> => {
    return request<AIMlSummaryResponse>('/ai/ml-summary', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId })
    });
  },

  getAIMLSummary: async (caseId: string): Promise<AIMlSummaryResponse> => {
    return request<AIMlSummaryResponse>('/ai/ml-summary', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId })
    });
  },

  askAI: async (
    query: string,
    caseId: string,
    conversationHistory: { role: string; content: string }[] = []
  ): Promise<AIAskResponse> => {
    return request<AIAskResponse>('/ai/ask', {
      method: 'POST',
      body: JSON.stringify({
        case_id: caseId,
        query,
        conversation_history: conversationHistory
      })
    });
  },

  explainEntity: async (entityName: string, caseId: string): Promise<AIExplainResponse> => {
    return request<AIExplainResponse>('/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        entity_name: entityName,
        case_id: caseId
      })
    });
  },

  // ---------------------------------------------------------------------------
  // Model Metrics Evaluation
  // ---------------------------------------------------------------------------
  getModelMetrics: async (taskType?: string, modelName?: string): Promise<ModelMetricsResponse[]> => {
    const params = new URLSearchParams();
    if (taskType) params.append('task_type', taskType);
    if (modelName) params.append('model_name', modelName);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ModelMetricsResponse[]>(`/model-metrics/latest${qs}`).catch(async () => {
      return request<ModelMetricsResponse[]>(`/model-metrics${qs}`);
    });
  },

  getAllModelMetrics: async (taskType?: string, modelName?: string): Promise<ModelMetricsResponse[]> => {
    const params = new URLSearchParams();
    if (taskType) params.append('task_type', taskType);
    if (modelName) params.append('model_name', modelName);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ModelMetricsResponse[]>(`/model-metrics${qs}`);
  }
};
