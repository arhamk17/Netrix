import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Users,
  Network,
  FileText,
  Plus,
  X,
  AlertCircle,
  Check
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Case } from '../types';

interface CasesProps {
  activeCase?: Case | null;
  onSelectActiveCase?: (c: Case) => void;
  onNavigateToModule?: (mod: string) => void;
}

export const Cases: React.FC<CasesProps> = ({
  activeCase,
  onSelectActiveCase,
  onNavigateToModule
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Case Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleSelectActiveCase = (c: Case) => {
    // Clear API caches so stale data from previous case is never shown
    apiClient.clearCache();
    setSelectedCase(c);
    onSelectActiveCase?.(c);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.cases.list();
      setCases(list);
      if (activeCase) {
        const match = list.find(c => c.id === activeCase.id);
        setSelectedCase(match || activeCase);
      } else if (list.length > 0) {
        setSelectedCase(list[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch case repository.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter a case title.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiClient.cases.create({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        case_number: newCaseNumber.trim() || undefined
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewCaseNumber('');
      setNewPriority('medium');
      await fetchCases();
      setSelectedCase(created);
      onSelectActiveCase?.(created);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create case file.');
    } finally {
      setCreating(false);
    }
  };

  const filteredCases = cases.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD5]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            <span>Investigation repository</span>
            <span>·</span>
            <span>Case registry</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110]">
            Case Files
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Active criminal dossiers, target network topologies, and evidentiary files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#4E101B] transition-colors flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open New Case</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6760]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search case title, ID, notes..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827]"
          />
        </div>
        <div className="text-xs font-mono text-[#6B6760]">
          Total registered cases: {cases.length}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-[#6E1827]/10 border border-[#6E1827]/30 rounded-[2px] text-xs font-mono text-[#6E1827] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchCases} className="underline hover:text-[#4E101B]">
            Retry
          </button>
        </div>
      )}

      {/* Main Grid: Cases List + Case Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cases Catalog */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
              Loading case dossiers from backend...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
              No case records found. Click "Open New Case" to create your first case file.
            </div>
          ) : (
            filteredCases.map(c => {
              const isSelected = selectedCase?.id === c.id;
              const isActive = activeCase?.id === c.id;
              return (
                <motion.div
                  key={c.id}
                  layout
                  onClick={() => setSelectedCase(c)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 relative overflow-hidden ${
                    isActive
                      ? 'bg-white border-[#6E1827] ring-1 ring-[#6E1827]/30 shadow-xs'
                      : isSelected
                      ? 'bg-white border-[#121110] ring-1 ring-[#121110]'
                      : 'bg-white/90 border-[#E2DDD5] hover:border-[#C8C3BA] hover:bg-white'
                  }`}
                >
                  {/* Subtle active state left accent indicator */}
                  {isActive && (
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#6E1827]" />
                  )}

                  <div className="flex items-start justify-between gap-2 pl-1">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-xs font-mono text-[#6B6760]">
                          ID: {c.id.slice(0, 12)}...
                        </span>
                        {isActive && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>ACTIVE CASE</span>
                          </motion.span>
                        )}
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border text-[#6B6760] bg-[#F7F5F0] border-black/5">
                          {c.status}
                        </span>
                      </div>
                      <h3 className="text-base font-medium text-[#121110]">
                        {c.name}
                      </h3>
                    </div>

                    <span className="text-[10px] font-mono text-[#6E1827] bg-[#6E1827]/10 border border-[#6E1827]/20 px-2.5 py-0.5 rounded-full font-semibold uppercase">
                      {c.severity} priority
                    </span>
                  </div>

                  <p className="text-xs text-[#6B6760] line-clamp-2 font-sans pl-1">
                    {c.description}
                  </p>

                  <div className="pt-3 border-t border-[#E2DDD5] flex items-center justify-between text-[11px] font-mono pl-1">
                    <div className="flex items-center gap-4 text-[#6B6760]">
                      <span>{c.evidenceCount} evidence</span>
                      <span>{c.entitiesCount} entities</span>
                    </div>

                    {/* Dedicated Select Active Case Button on Card */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectActiveCase(c);
                      }}
                      className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold'
                          : 'bg-[#121110] text-white hover:bg-[#6E1827]'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                          <span>✓ Active Case</span>
                        </>
                      ) : (
                        <span>Select Active Case</span>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Right Column: Case Details & Switch Active */}
        <div className="lg:col-span-5 bg-white border border-[#E2DDD5] p-6 rounded-2xl space-y-6 shadow-xs">
          {selectedCase ? (
            <>
              <div className="space-y-1.5 pb-4 border-b border-[#E2DDD5]">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  Case dossier inspector
                </span>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  {selectedCase.name}
                </h3>
                <div className="text-xs font-mono text-[#6B6760]">
                  Assigned officer: {selectedCase.assignedInvestigator}
                </div>
              </div>

              <p className="text-xs text-[#121110] leading-relaxed font-sans">
                {selectedCase.description}
              </p>

              {/* Case Stats */}
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-xl">
                  <div className="text-[10px] text-[#6B6760] uppercase">Evidence</div>
                  <div className="text-lg font-medium text-[#121110] tabular-nums">
                    {selectedCase.evidenceCount}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-xl">
                  <div className="text-[10px] text-[#6B6760] uppercase">Entities</div>
                  <div className="text-lg font-medium text-[#121110] tabular-nums">
                    {selectedCase.entitiesCount}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-xl">
                  <div className="text-[10px] text-[#6E1827] uppercase">Priority</div>
                  <div className="text-xs font-bold text-[#6E1827] uppercase pt-1">
                    {selectedCase.severity}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2.5">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectActiveCase(selectedCase)}
                  className={`w-full py-2.5 text-xs font-mono font-medium rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    activeCase?.id === selectedCase.id
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-emerald-900/10'
                      : 'bg-[#6E1827] text-white hover:bg-[#52111C]'
                  }`}
                >
                  {activeCase?.id === selectedCase.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      <span>✓ Active Case</span>
                    </>
                  ) : (
                    <span>Select Active Case</span>
                  )}
                </motion.button>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => {
                      onSelectActiveCase?.(selectedCase);
                      onNavigateToModule?.('graph');
                    }}
                    className="py-2 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#F0ECE4] transition-colors flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>View Network</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectActiveCase?.(selectedCase);
                      onNavigateToModule?.('evidence');
                    }}
                    className="py-2 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#F0ECE4] transition-colors flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Evidence</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs font-mono text-[#6B6760]">
              Select a case file from the list.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Open New Case */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-[#E2DDD5] rounded-[2px] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD5]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  New Investigation
                </span>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  Open Case File
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[#6B6760] hover:text-[#121110]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-[#6E1827]/10 border border-[#6E1827]/30 text-xs font-mono text-[#6E1827] rounded-[2px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] text-[#6B6760] uppercase">
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Operation Crimson Dawn"
                  className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] text-[#6B6760] uppercase">
                    Case Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCaseNumber}
                    onChange={e => setNewCaseNumber(e.target.value)}
                    placeholder="CR-2026-009"
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#6B6760] uppercase">
                    Priority Level
                  </label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-[#6B6760] uppercase">
                  Investigation Summary
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Brief synopsis of criminal syndicate activity, targets, and initial findings..."
                  className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E2DDD5]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-[#E2DDD5] text-xs font-mono text-[#6B6760] hover:text-[#121110] rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#4E101B] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Case File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
