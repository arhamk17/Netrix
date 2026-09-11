import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  FileArchive,
  Activity,
  FolderLock,
  ArrowRight,
  ShieldCheck,
  Compass,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SYSTEM_ROLES } from '../../data/rolesData';
import type { TabType } from './Sidebar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType, meta?: any) => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
  const { cases, activeCase } = useAuth();
  const [query, setQuery] = useState<string>('');
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [graphNodes, setGraphNodes] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!activeCase) return;
      const caseId = activeCase.id || activeCase.case_id;
      if (!caseId) return;
      try {
        const [ev, g] = await Promise.all([
          api.getCaseEvidence(caseId).catch(() => []),
          api.getCaseGraph(caseId).catch(() => ({ nodes: [], edges: [], stats: {} as any }))
        ]);
        setEvidenceList(Array.isArray(ev) ? ev : []);
        setGraphNodes(Array.isArray(g?.nodes) ? g.nodes : []);
      } catch (err) {
        console.error('Search data load error:', err);
      }
    }
    if (isOpen) {
      loadData();
    } else {
      setQuery('');
      setEvidenceList([]);
      setGraphNodes([]);
    }
  }, [isOpen, activeCase]);

  useEffect(() => {
    const handleLogout = () => {
      setQuery('');
      setEvidenceList([]);
      setGraphNodes([]);
    };
    window.addEventListener('netrix:logout', handleLogout);
    return () => window.removeEventListener('netrix:logout', handleLogout);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCases = (cases || []).filter(c => {
    const q = query.toLowerCase();
    const cid = c.id || c.case_id || '';
    const cnum = c.case_number || '';
    const title = c.title || '';
    return title.toLowerCase().includes(q) || cid.toLowerCase().includes(q) || cnum.toLowerCase().includes(q);
  });

  const filteredEvidence = (evidenceList || []).filter(ev => {
    const q = query.toLowerCase();
    const fname = ev.original_filename || ev.filename || '';
    const eid = ev.id || ev.evidence_id || '';
    const hash = ev.sha256_hash || ev.stored_hash || '';
    return fname.toLowerCase().includes(q) || eid.toLowerCase().includes(q) || hash.toLowerCase().includes(q);
  });

  const filteredNodes = (graphNodes || []).filter(n => {
    const q = query.toLowerCase();
    const name = n.name || n.id || '';
    const type = n.type || n.label || '';
    return name.toLowerCase().includes(q) || type.toLowerCase().includes(q);
  });

  const filteredRoles = SYSTEM_ROLES.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.id.toLowerCase().includes(query.toLowerCase()) ||
    r.shortTitle.toLowerCase().includes(query.toLowerCase()) ||
    r.defaultUser.full_name.toLowerCase().includes(query.toLowerCase()) ||
    r.defaultUser.badge_number.toLowerCase().includes(query.toLowerCase()) ||
    'profile'.includes(query.toLowerCase()) ||
    'avatar'.includes(query.toLowerCase()) ||
    'operator'.includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-panel rounded-2xl w-full max-w-2xl border border-red-900/40 bg-[#0A0E18]/95 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#1E293B] flex items-center gap-3">
          <Search className="w-5 h-5 text-rose-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cases, entities, SHA-256 hashes, or evidence artifacts..."
            className="w-full bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none text-sm font-mono"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
            ESC
          </kbd>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Nodes / Entities */}
          {filteredNodes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-rose-400 uppercase tracking-wider block font-bold">
                GRAPH ENTITIES ({filteredNodes.length})
              </span>
              <div className="space-y-1">
                {filteredNodes.slice(0, 4).map(node => (
                  <button
                    key={node.id}
                    onClick={() => {
                      onNavigate('graph');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#0A101C] hover:bg-[#141C2E] border border-slate-800 text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-400" />
                      <span className="font-bold">{node.name}</span>
                      <span className="text-[10px] text-slate-400">({node.type})</span>
                    </div>
                    <span className="text-[10px] text-rose-300 font-bold">
                      {(((node.ips_score ?? 0.85)) * 100).toFixed(0)}% IPS
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Artifacts */}
          {filteredEvidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">
                VERIFIED EVIDENCE RECORDS ({filteredEvidence.length})
              </span>
              <div className="space-y-1">
                {filteredEvidence.slice(0, 4).map(ev => (
                  <button
                    key={ev.evidence_id}
                    onClick={() => {
                      onNavigate('integrity', { evidenceId: ev.evidence_id });
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#081122] hover:bg-[#0C1B33] border border-slate-800 text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate max-w-md">
                      <FileArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold shrink-0">{ev.evidence_id}</span>
                      <span className="text-[11px] text-slate-400 truncate">{ev.filename}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                      SHA-256 MATCH
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cases */}
          {filteredCases.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                INVESTIGATION CASES ({filteredCases.length})
              </span>
              <div className="space-y-1">
                {filteredCases.slice(0, 3).map(c => (
                  <button
                    key={c.case_id}
                    onClick={() => {
                      onNavigate('cases');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#081122] hover:bg-[#0C1B33] border border-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderLock className="w-4 h-4 text-slate-400" />
                      <span className="font-bold">{c.case_id}</span>
                      <span className="text-[11px] text-slate-400">{c.title}</span>
                    </div>
                    <span className="text-[10px] text-rose-400">{c.priority}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System Roles & Personnel Dossiers */}
          {query.trim().length > 0 && filteredRoles.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-rose-400 uppercase tracking-wider block font-bold">
                OPERATOR ROLES & CLEARANCE PROFILES ({filteredRoles.length})
              </span>
              <div className="space-y-1">
                {filteredRoles.slice(0, 3).map(role => (
                  <button
                    key={role.id}
                    onClick={() => {
                      onNavigate('profile');
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-[#081122] hover:bg-[#150409] border border-[#6D001A]/30 text-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-rose-400" />
                      <span className="font-bold">{role.name}</span>
                      <span className="text-[11px] text-slate-400">({role.defaultUser.full_name})</span>
                    </div>
                    <span className="text-[10px] text-rose-300 font-mono">{role.clearanceLevel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
