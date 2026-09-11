import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Plus,
  Search,
  Filter,
  Users,
  FileArchive,
  Activity,
  Layers,
  ChevronRight,
  Clock,
  ShieldAlert,
  CheckCircle2,
  X,
  FileText,
  FileDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Case, CasePriority, CaseStatus } from '../../types';
import { GenerateReportModal } from '../common/GenerateReportModal';
import { exportToJSON, exportToCSV } from '../../utils/reportExport';

export const CaseManagement: React.FC = () => {
  const { cases, currentCaseId, setCurrentCaseId, refreshCases, user } = useAuth();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);

  // Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newPriority, setNewPriority] = useState<CasePriority>('HIGH');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (cases.length > 0 && !selectedCase) {
      const active = cases.find(c => (c.id === currentCaseId || c.case_id === currentCaseId)) || cases[0];
      setSelectedCase(active);
    }
  }, [cases, currentCaseId, selectedCase]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      setFormError('Both title and description are mandatory.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await api.createCase({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority
      });
      await refreshCases();
      setSelectedCase(created);
      const createdId = created.id || created.case_id;
      if (createdId) {
        setCurrentCaseId(createdId);
      }
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to initialize case enclave.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCases = cases.filter(c => {
    const cid = c.id || c.case_id || '';
    const cnum = c.case_number || '';
    const ctitle = c.title || '';
    const cdesc = c.description || '';
    const matchesPriority = filterPriority === 'ALL' || c.priority === filterPriority;
    const matchesSearch =
      cid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cnum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cdesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  const handleExportCasesJSON = () => {
    const exportData = filteredCases.map(c => ({
      case_id: c.id || c.case_id,
      case_number: c.case_number || c.id || c.case_id,
      title: c.title,
      description: c.description,
      status: c.status,
      priority: c.priority,
      created_at: c.created_at,
      updated_at: c.updated_at,
      lead_investigator: c.lead_investigator || 'Authorized Lead Investigator',
      assigned_investigators: c.assigned_investigators || ['Authorized Lead Investigator'],
      evidence_count: c.evidence_count || 0,
      entity_count: c.entity_count || 0,
      relationship_count: c.relationship_count || 0,
      ips_average: c.ips_average ? `${(c.ips_average * 100).toFixed(1)}%` : 'N/A',
      anomaly_count: c.anomaly_count || 0
    }));

    exportToJSON({
      filename: `NETRIX_Case_Registry_Report_${new Date().toISOString().slice(0, 10)}.json`,
      moduleName: 'Case Registry & Investigation Management',
      operator: user?.full_name || 'Authorized Lead Investigator',
      data: exportData
    });
  };

  const handleExportCasesCSV = () => {
    const exportData = filteredCases.map(c => ({
      case_id: c.id || c.case_id,
      case_number: c.case_number || c.id || c.case_id,
      title: c.title,
      description: c.description,
      status: c.status,
      priority: c.priority,
      created_at: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A',
      lead_investigator: c.lead_investigator || 'Authorized Lead Investigator',
      evidence_count: c.evidence_count || 0,
      entity_count: c.entity_count || 0,
      relationship_count: c.relationship_count || 0,
      ips_average: c.ips_average ? `${(c.ips_average * 100).toFixed(1)}%` : 'N/A',
      anomaly_count: c.anomaly_count || 0
    }));

    const fields = [
      { key: 'case_id', label: 'Case ID' },
      { key: 'case_number', label: 'Case Number' },
      { key: 'title', label: 'Case Title' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'lead_investigator', label: 'Lead Investigator' },
      { key: 'evidence_count', label: 'Artifacts' },
      { key: 'entity_count', label: 'Entities' },
      { key: 'relationship_count', label: 'Graph Links' },
      { key: 'ips_average', label: 'Average IPS' },
      { key: 'anomaly_count', label: 'Anomalies' },
      { key: 'created_at', label: 'Date Initialized' }
    ];

    exportToCSV({
      filename: `NETRIX_Case_Registry_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      moduleName: 'Case Registry & Enclave Management',
      operator: user?.full_name,
      data: exportData,
      fields
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <FolderLock className="w-6 h-6 text-crimson-400" />
            <span>CASE REGISTRY & MANAGEMENT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active investigation cases, status tracking, and assigned investigators
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Generate Report Button - Crimson Aesthetic */}
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-crimson-600/60 bg-gradient-to-r from-crimson-900/60 to-black hover:from-crimson-800/70 hover:to-crimson-950/40 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(153,27,27,0.35)] cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-rose-300" />
            <span>GENERATE REPORT</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-crimson-500/50 bg-gradient-to-r from-crimson-700 to-crimson-900 hover:from-crimson-600 hover:to-crimson-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>INITIALIZE NEW CASE</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel rounded-xl p-3 border border-[#1E293B] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Case ID, Title, or Description..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0E121D] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-crimson-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-slate-400">PRIORITY:</span>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0E121D] border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-crimson-500/50"
          >
            <option value="ALL">ALL PRIORITIES</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
      </div>

      {/* Case Split Layout (List + Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Case Cards List */}
        <div className="lg:col-span-7 space-y-3">
          {filteredCases.map(c => {
            const caseId = c.id || c.case_id || '';
            const isSelected = (selectedCase?.id === caseId || selectedCase?.case_id === caseId);
            const isActiveEnclave = currentCaseId === caseId;
            const leadDisplay = (c.lead_investigator || c.assigned_to || c.created_by || 'Lead Investigator').toString().trim();
            const leadFirstName = leadDisplay ? leadDisplay.split(' ')[0] : 'Investigator';

            return (
              <div
                key={caseId}
                onClick={() => {
                  setSelectedCase(c);
                  setCurrentCaseId(caseId);
                }}
                className={`cursor-pointer rounded-xl p-4.5 border transition-all text-xs ${
                  isSelected
                    ? 'border-crimson-500/50 bg-[#121824] shadow-[0_0_20px_rgba(153,27,27,0.15)]'
                    : 'border-[#1E293B] bg-[#0E121D] hover:border-slate-700 hover:bg-[#121824]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100">{c.case_number || caseId || 'CASE-001'}</span>
                    {isActiveEnclave && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-crimson-950/60 border border-crimson-500/40 text-crimson-300">
                        ACTIVE CONSOLE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        (c.priority || '').toUpperCase() === 'CRITICAL'
                          ? 'border-rose-500/40 text-rose-300 bg-rose-950/30'
                          : (c.priority || '').toUpperCase() === 'HIGH'
                          ? 'border-amber-500/40 text-amber-300 bg-amber-950/30'
                          : 'border-crimson-500/40 text-crimson-300 bg-crimson-950/30'
                      }`}
                    >
                      {(c.priority || 'MEDIUM').toUpperCase()}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                      {(c.status || 'OPEN').toUpperCase()}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-100 tracking-wide mb-1.5">
                  {c.title || 'Untitled Case'}
                </h3>

                <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3">
                  {c.description || 'No description provided.'}
                </p>

                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <FileArchive className="w-3.5 h-3.5 text-crimson-400" />
                      {c.evidence_count ?? 0} Evidence Files
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-rose-400" />
                      {c.entity_count ?? 0} Entities
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Lead: <strong className="text-slate-300">{leadFirstName}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Case Enclave Detail */}
        <div className="lg:col-span-5">
          {selectedCase ? (
            <div className="rounded-xl p-5 border border-[#1E293B] bg-[#0E121D]/90 space-y-4 sticky top-20 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] text-crimson-400 block uppercase font-bold tracking-wider">
                    CASE DOSSIER & INTELLIGENCE METADATA
                  </span>
                  <span className="text-lg font-bold text-slate-100">
                    {selectedCase.case_number || selectedCase.case_id || (selectedCase.id && selectedCase.id.length > 18 ? `CASE-${selectedCase.id.slice(0, 8).toUpperCase()}` : selectedCase.id || 'CASE-001')}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentCaseId(selectedCase.id || selectedCase.case_id || '')}
                  className="px-2.5 py-1 rounded border border-crimson-500/40 text-crimson-300 text-xs bg-crimson-950/40 hover:bg-crimson-900/40 transition-colors"
                >
                  SET AS ACTIVE
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">CASE TITLE</span>
                <p className="text-sm font-semibold text-slate-200">{selectedCase.title || 'Untitled Case'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">DESCRIPTION & INVESTIGATIVE SCOPE</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-[#0A0E17] p-3 rounded-lg border border-slate-800">
                  {selectedCase.description || 'No description or investigative scope registered for this case.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded bg-[#121824] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">LEAD INVESTIGATOR</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                    {selectedCase.lead_investigator || selectedCase.assigned_to || selectedCase.created_by || 'Authorized Lead Investigator'}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#121824] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">IPS AVERAGE</span>
                  <span className="font-semibold text-crimson-300 mt-0.5 block">
                    {(((selectedCase.ips_average ?? 0.75)) * 100).toFixed(0)}% THREAT INDEX
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-crimson-400" />
                  <span>ASSIGNED INVESTIGATIVE ANALYSTS</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {((selectedCase.assigned_investigators && selectedCase.assigned_investigators.length > 0)
                    ? selectedCase.assigned_investigators
                    : [selectedCase.lead_investigator || selectedCase.assigned_to || selectedCase.created_by || 'Authorized Lead Investigator']
                  ).map((inv, invIdx) => (
                    <span
                      key={`${inv}-${invIdx}`}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div>CREATED: {selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleString() : 'N/A'}</div>
                <div>LAST TELEMETRY UPDATE: {selectedCase.updated_at ? new Date(selectedCase.updated_at).toLocaleString() : (selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleString() : 'N/A')}</div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-xs">
              SELECT A CASE TO VIEW INVESTIGATIVE DOSSIER
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Case */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="rounded-2xl w-full max-w-lg p-6 border border-crimson-500/40 bg-[#0E121D] shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <FolderLock className="w-5 h-5 text-crimson-400" />
                <span>CREATE NEW CASE</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Provisions a new investigation case and graph workspace
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300">OPERATION / CASE TITLE</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g., Operation Valkyrie: Ransomware Exfiltration"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-slate-800 text-slate-200 focus:outline-none focus:border-crimson-500 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">PRIORITY LEVEL</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as CasePriority)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-slate-800 text-slate-200 focus:outline-none focus:border-crimson-500 text-xs"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">INVESTIGATIVE MANDATE & SCOPE</label>
                <textarea
                  rows={4}
                  required
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Provide technical scope, seized systems, and preliminary evidence hypotheses..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0E17] border border-slate-800 text-slate-200 focus:outline-none focus:border-crimson-500 text-xs leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg border border-crimson-500/50 bg-crimson-700 hover:bg-crimson-600 text-white font-bold tracking-wider uppercase"
                >
                  {isSubmitting ? 'CREATING...' : 'CONFIRM & CREATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="CASE REGISTRY REPORT"
        subtitle="Export cataloged cases, lead investigators, and key metrics"
        recordCount={filteredCases.length}
        onExportJSON={handleExportCasesJSON}
        onExportCSV={handleExportCasesCSV}
        details={[
          { label: 'Priority Filter', value: filterPriority },
          { label: 'Cases Matching', value: `${filteredCases.length} Cases` },
          { label: 'Lead Investigator', value: user?.full_name || 'Authorized Lead Investigator' },
          { label: 'Status', value: 'Case Active' }
        ]}
      />
    </div>
  );
};
