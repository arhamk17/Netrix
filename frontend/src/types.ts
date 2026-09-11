/**
 * NETRIX Criminal Network Intelligence Platform
 * Core Data Models & TypeScript Interfaces
 * Directly aligned with FastAPI / Neo4j / ML Backend Contracts
 */

export type UserRole = 'admin' | 'supervisor' | 'investigator' | 'analyst' | 'auditor';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_active?: boolean;
  badge_number?: string;
  department?: string;
  clearance_level?: string;
  avatar_url?: string;
  avatar_style?: string;
  public_key?: string;
  node_id?: string;
  assigned_cases?: string[];
  last_login?: string;
}

export interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  role: 'investigator' | 'supervisor' | 'INVESTIGATOR' | 'SUPERVISOR' | string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  user: User;
}

export type CaseStatus = 'OPEN' | 'ACTIVE' | 'PENDING_REVIEW' | 'CLOSED' | 'ARCHIVED' | 'open' | 'closed';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'low' | 'medium' | 'high' | 'critical';

export interface Case {
  id: string; // UUID (backend primary key)
  case_number: string; // Human-readable identifier e.g. "CASE-2026-0891"
  title: string;
  description?: string | null;
  status: CaseStatus;
  priority: CasePriority;
  tags?: string[];
  created_at: string;
  updated_at?: string;
  created_by?: string;
  assigned_to?: string;
  // Visual/derived conveniences
  case_id?: string;
  lead_investigator?: string;
  assigned_investigators?: string[];
  evidence_count?: number;
  entity_count?: number;
  relationship_count?: number;
  ips_average?: number;
  anomaly_count?: number;
}

export type EvidenceStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'VERIFIED' | 'FAILED';
export type IntegrityStatus = 'VERIFIED' | 'TAMPER_DETECTED' | 'PENDING_CONFIRMATION';

export interface BlockchainRecord {
  registered: boolean;
  evidence_id?: string;
  evidence_hash?: string;
  case_id?: string;
  timestamp?: number;
  registered_by?: string;
  blockchain_status?: string;
  blockchain_tx_hash?: string;
  blockchain_block_number?: number;
  tx_hash?: string;
  block_number?: number;
  contract_address?: string;
  merkle_root?: string;
  registered_wallet?: string;
  registration_time?: string;
  network?: string;
  integrity_status?: IntegrityStatus;
  confirmations?: number;
  custody_history?: CustodyEvent[];
}

export interface CustodyEvent {
  action: string;
  timestamp: any;
  performed_by: string;
  evidence_id?: string | null;
  event_id?: string;
  actor?: string;
  actor_role?: string;
  notes?: string;
  tx_hash?: string;
  verification_signature?: string;
}

export interface CustodyHistoryResponse {
  evidence_id: string;
  events: CustodyEvent[];
}

export interface EvidenceVerifyResponse {
  match: boolean;
  stored_hash: string;
  computed_hash: string;
  verified_at: string;
  blockchain_verified: boolean | null;
  blockchain_status: string;
  blockchain_tx_hash: string | null;
  blockchain_record?: Record<string, any> | null;
  custody_history?: CustodyEvent[];
  integrity_verdict?: 'VERIFIED' | 'TAMPER_DETECTED';
}

export interface Evidence {
  id: string; // UUID
  case_id: string; // UUID
  filename?: string;
  original_filename: string;
  file_type?: string | null;
  file_size_bytes?: number | null;
  sha256_hash: string;
  storage_path?: string;
  source_type: string;
  uploaded_by?: string | null;
  uploaded_at: string;
  processing_status: EvidenceStatus | string;
  processing_error?: string | null;
  extracted_data?: Record<string, any> | null;
  blockchain_status?: string;
  blockchain_tx_hash?: string | null;
  blockchain_block_number?: number | null;
  // Visual backward compat
  evidence_id?: string;
  file_size?: number;
  stored_hash?: string;
  upload_time?: string;
  status?: EvidenceStatus;
  validation_details?: string;
  blockchain?: BlockchainRecord;
}

export type EntityType = 
  | 'PERSON' 
  | 'ORGANIZATION' 
  | 'LOCATION'
  | 'PHONE' 
  | 'BANK_ACCOUNT'
  | 'VEHICLE'
  | 'TRANSACTION'
  | 'EMAIL' 
  | 'CRYPTO_WALLET' 
  | 'SERVER_IP' 
  | 'DOMAIN' 
  | 'DEVICE'
  | string;

export interface Entity {
  id: string;
  case_id?: string;
  entity_type?: EntityType | string;
  canonical_name?: string;
  aliases?: string[];
  attributes?: Record<string, any>;
  confidence: number;
  source_evidence_ids?: string[];
  neo4j_node_id?: string;
  created_at?: string;
  updated_at?: string;
  // Graph visual properties
  name?: string;
  type?: EntityType;
  ips_score?: number;
  degree?: number;
  betweenness?: number;
  pagerank?: number;
  anomaly_score?: number;
  provenance_evidence_ids?: string[];
  labels?: string[];
  notes?: string;
}

export type RelationshipType = 
  | 'CALLS'
  | 'COMMUNICATES_WITH' 
  | 'TRANSFERS_MONEY_TO' 
  | 'LOCATED_AT'
  | 'ASSOCIATE_OF'
  | 'MEMBER_OF'
  | 'OWNS'
  | 'USES'
  | 'OPERATES'
  | 'RELATED_TO'
  | 'MEETS_WITH'
  | 'EMPLOYED_BY'
  | 'AFFILIATED_WITH'
  | 'SUSPECT_IN'
  | 'PARTICIPATED_IN'
  | 'TRANSACTS_WITH'
  | 'CONTACTED'
  | 'KNOWS'
  | 'COLLABORATES_WITH'
  | 'CO_OCCURS_WITH'
  | string;

export interface Relationship {
  id: string;
  case_id?: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: RelationshipType;
  source?: string;
  target?: string;
  type?: RelationshipType;
  timestamp?: string | null;
  confidence?: number;
  provenance_type?: 'OBSERVED' | 'PREDICTED' | string;
  source_label?: string;
  evidence_id?: string | null;
  attributes?: Record<string, any>;
  created_at?: string;
  // Visual flags
  is_predicted?: boolean;
  category?: 'OBSERVED' | 'INFERRED' | 'POTENTIAL';
  predicted_probability?: number;
  weight?: number;
  amount?: string;
}

export interface GraphNode {
  id: string;
  label?: string;
  name: string;
  confidence?: number | null;
  ips_score?: number | null;
  // Derived/visual attributes
  type?: EntityType;
  degree?: number;
  betweenness?: number;
  pagerank?: number;
  anomaly_score?: number;
  labels?: string[];
  evidence_provenance?: string[];
  provenance_evidence_ids?: string[];
  notes?: string;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  type: string;
  confidence?: number | null;
  provenance_type?: 'OBSERVED' | 'PREDICTED' | string;
  evidence_id?: string | null;
  provenance_evidence_id?: string;
  timestamp?: string | null;
  category?: 'OBSERVED' | 'INFERRED' | 'POTENTIAL';
  is_predicted?: boolean;
  predicted_probability?: number;
  weight?: number;
  amount?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: {
    total_nodes: number;
    total_edges: number;
    observed_edges: number;
    predicted_edges: number;
    high_ips_count: number;
    anomalous_nodes_count: number;
  };
}

export interface PathNodeItem {
  name: string;
  type: string;
}

export interface PathRelationshipsItem {
  relationships: string[];
}

export type ShortestPathElement = PathNodeItem | PathRelationshipsItem;
export type ShortestPathResult = ShortestPathElement[];

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;

export type LeadType = 
  | 'NETWORK_HUB' 
  | 'HIDDEN_CONNECTION' 
  | 'TEMPORAL_ANOMALY' 
  | 'BEHAVIORAL_SHIFT' 
  | 'HIGH_VALUE_TRANSFER' 
  | 'COORDINATED_ACTIVITY'
  | string;

export interface BackendReasoningStep {
  step: number;
  signal_type: string;
  description: string;
  entities: any[];
  relationships: any[];
  evidence_ids: string[];
  sha256_hashes: string[];
}

export interface IntegrityCheck {
  all_evidence_verified: boolean;
  unverified_evidence_ids: string[];
}

export interface ExplainLeadResponse {
  lead_id: string;
  explanation: string;
  reasoning_chain: BackendReasoningStep[];
  integrity_check: IntegrityCheck;
}

export interface ReasoningStep {
  step: number;
  layer?: 'LEAD' | 'SIGNALS' | 'GRAPH_RELATIONSHIPS' | 'PHYSICAL_EVIDENCE' | 'SHA256_INTEGRITY' | string;
  signal_type?: string;
  title?: string;
  description: string;
  reference_id?: string;
  status?: 'VERIFIED' | 'DETECTED' | 'CORRELATED';
  entities?: any[];
  relationships?: any[];
  evidence_ids?: string[];
  sha256_hashes?: string[];
}

export interface InvestigativeLead {
  lead_id: string;
  case_id: string;
  lead_type: LeadType;
  entities_involved: string[];
  severity: SeverityLevel;
  confidence: number;
  confidence_score?: number;
  explanation: string;
  evidence_ids: string[];
  contributing_signals?: Record<string, any> | string[];
  generated_at?: string;
  created_at?: string;
  title?: string;
  reasoning_chain?: ReasoningStep[] | BackendReasoningStep[];
  disclaimer?: string;
  // Visual backward compat
  entities?: string[];
}

export interface LeadGenerateResponse {
  case_id: string;
  leads_generated: number;
  leads: InvestigativeLead[];
}

export interface TemporalEvent {
  from_entity?: string;
  from_type?: string;
  event_type?: string;
  to_entity?: string;
  timestamp: string;
  evidence_id?: string | null;
  confidence?: number;
  // Visual backward compat
  event_id?: string;
  id?: string;
  case_id?: string;
  entity_ids?: string[];
  relationship_type?: RelationshipType;
  description?: string;
  evidence_ref?: string;
  severity?: 'NORMAL' | 'BURST' | 'ANOMALOUS' | 'ELEVATED' | string;
  amount?: string;
  source_entity?: string;
  target_entity?: string;
  anomaly_score?: number;
}

export interface CentralityResult {
  name: string;
  type: string;
  degree: number;
  betweenness: number;
  pagerank: number;
  node_name?: string;
  closeness?: number;
  eigenvector?: number;
}

export interface AnomalyResult {
  name: string;
  entity_type: string;
  anomaly_score: number;
  degree: number;
  flag: string;
  description: string;
}

export interface IPSResultSchema {
  entity_name: string;
  entity_type: string;
  ips_score: number;
  contributing_factors: Record<string, any>;
  explanation: string;
}

export interface CommunityResult {
  community_id: number;
  members: string[];
  size: number;
}

export interface ModelMetricsResponse {
  id?: string;
  model_name: string;
  model_version: string;
  task_type: string;
  metrics: Record<string, any>;
  evaluated_at: string;
  notes?: string | null;
  // Visual conveniences
  model_id?: string;
  version?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  auc_roc?: number;
  last_trained?: string;
  trained_at?: string;
  status?: string;
  description?: string;
  task?: string;
}

export type ModelMetric = ModelMetricsResponse;

export interface AIAskRequest {
  case_id: string;
  query: string;
  conversation_history?: { role: string; content: string }[] | any[];
}

export interface AIAskResponse {
  answer: string;
  context_facts_used: number;
  confidence: string;
}

export interface AIExplainRequest {
  case_id: string;
  entity_name: string;
}

export interface AIExplainResponse {
  explanation: string;
}

export interface TopIpsItem {
  entity_name?: string;
  name?: string;
  entity_type?: string;
  ips_score: number;
  contributing_factors?: Record<string, any>;
  explanation?: string;
  betweenness?: number;
  degree?: number;
  pagerank?: number;
}

export interface LinkPredictionEntity {
  name: string;
  type?: string;
}

export interface LinkPrediction {
  entity_a: LinkPredictionEntity | string;
  entity_b: LinkPredictionEntity | string;
  score: number;
  algorithm: string;
  explanation: Record<string, any> | string;
}

export interface Anomaly {
  name: string;
  entity_type: string;
  anomaly_score: number;
  degree: number;
  flag: string;
  description: string;
}

export interface ModelStatus {
  link_prediction?: {
    trained?: boolean;
    model_path?: string;
    test_auc?: number;
    num_training_edges?: number;
    model_type?: string;
    status?: string;
    accuracy?: number;
  };
  anomaly_detection?: {
    trained?: boolean;
    model_path?: string;
    contamination?: number;
    num_training_nodes?: number;
    model_type?: string;
    status?: string;
  };
  centrality?: {
    status?: string;
  };
  [key: string]: any;
}

export interface AIMlSummaryResponse {
  case_id: string;
  top_ips?: TopIpsItem[];
  link_predictions?: LinkPrediction[];
  anomalies?: Anomaly[];
  model_status?: ModelStatus | Record<string, any>;
  executive_summary?: string;
  key_findings?: string[];
  anomalies_detected?: any[];
  risk_assessment?: {
    overall_score?: number;
    risk_tier?: string;
    primary_threat_vectors?: string[];
  };
  recommended_actions?: any[];
}

export interface TimelineItem {
  from_entity?: string;
  from_type?: string;
  event_type?: string;
  to_entity?: string;
  timestamp?: string;
  evidence_id?: string;
  confidence?: number;
}

// Convenience Type Aliases
export type LeadSeverity = SeverityLevel;

