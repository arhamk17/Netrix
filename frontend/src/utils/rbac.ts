import { UserRole } from '../types';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  investigator: 3,
  analyst: 2,
  viewer: 1
};

export const ROLE_DETAILS: Record<UserRole, { label: string; description: string; badgeColor: string }> = {
  admin: {
    label: 'ADMINISTRATOR',
    description: 'Supreme operational access across all nodes, cases, cryptoseals, audit ledgers, and user authorization controls.',
    badgeColor: 'text-[#6E1827] bg-[#6E1827]/10 border-[#6E1827]/30'
  },
  investigator: {
    label: 'INVESTIGATOR',
    description: 'Active case intelligence, forensic evidence ingestion, ML link tracking, and on-chain verification privileges.',
    badgeColor: 'text-[#0D0D0D] bg-[#0D0D0D]/10 border-[#0D0D0D]/25'
  },
  analyst: {
    label: 'ANALYST',
    description: 'Analytical access to knowledge graph topological metrics, centrality models, AI predictions, and chronological leads.',
    badgeColor: 'text-indigo-900 bg-indigo-50 border-indigo-200'
  },
  viewer: {
    label: 'VIEWER',
    description: 'Read-only clearance to approved case profiles, relational graphs, entity registries, and audit records.',
    badgeColor: 'text-[#77736F] bg-[#F0EEE9] border-[#0D0D0D]/15'
  }
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'dashboard',
    'cases',
    'evidence',
    'graph',
    'predictions',
    'leads',
    'analytics',
    'entities',
    'timeline',
    'verification',
    'admin',
    'profile'
  ],
  investigator: [
    'dashboard',
    'cases',
    'evidence',
    'graph',
    'predictions',
    'leads',
    'entities',
    'timeline',
    'verification',
    'profile'
  ],
  analyst: [
    'dashboard',
    'cases',
    'graph',
    'predictions',
    'analytics',
    'leads',
    'entities',
    'timeline',
    'profile'
  ],
  viewer: [
    'dashboard',
    'cases',
    'graph',
    'entities',
    'timeline',
    'verification',
    'profile'
  ]
};

export function canAccessTab(role: UserRole | string | undefined | null, tabId: string): boolean {
  if (!role) return false;
  const permissions = (ROLE_PERMISSIONS as any)[role] || [];
  return permissions.includes(tabId);
}

export function isActionPermitted(
  role: UserRole | string | undefined | null,
  action: 'modify_case' | 'modify_evidence' | 'verify_evidence' | 'manage_users' | 'export_report' | 'manage_roles'
): boolean {
  if (role === 'admin') return true;
  if (role === 'investigator') {
    return ['modify_case', 'modify_evidence', 'verify_evidence', 'export_report'].includes(action);
  }
  if (role === 'analyst') {
    return ['export_report'].includes(action);
  }
  if (role === 'viewer') {
    return ['export_report'].includes(action);
  }
  return false;
}
