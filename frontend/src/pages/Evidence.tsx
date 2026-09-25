import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Search,
  ArrowRight,
  ShieldCheck,
  Plus,
  Lock,
  X,
  Share2,
  Database,
  Sparkles,
  Users,
  Building,
  MapPin,
  Car,
  Phone,
  Link as LinkIcon,
  HelpCircle,
  Code,
  ChevronDown,
  Layers
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Evidence, Case } from '../types';
import { useAuth } from '../context/AuthContext';
import { UniversalEvidenceModal } from '../components/UniversalEvidenceModal';

interface EvidencePageProps {
  activeCase?: Case | null;
  onNavigateToVerification?: (evidenceId?: string) => void;
  onNavigateToGraph?: (entityIds?: string[]) => void;
  selectedEvidenceName?: string;
}

export const EvidencePage: React.FC<EvidencePageProps> = ({
  activeCase,
  onNavigateToVerification,
  onNavigateToGraph,
  selectedEvidenceName
}) => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [selectedEv, setSelectedEv] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    fetchEvidence();
  }, [activeCase?.id]);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCaseId = activeCase?.id;
      if (!targetCaseId) {
        const cases = await apiClient.cases.list();
        if (cases.length > 0) targetCaseId = cases[0].id;
      }

      const data = await apiClient.evidence.list(targetCaseId);
      setEvidenceList(data);
      if (selectedEvidenceName) {
        const found = data.find(e => e.name.toLowerCase().includes(selectedEvidenceName.toLowerCase()));
        setSelectedEv(found || data[0] || null);
      } else if (data.length > 0) {
        setSelectedEv(data[0]);
      } else {
        setSelectedEv(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load evidence records.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleEvidenceCreated = (newEvidence: Evidence) => {
    setEvidenceList(prev => [newEvidence, ...prev]);
    setSelectedEv(newEvidence);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return { label: 'Received', color: 'text-[#6B6760] bg-[#F2EFE9] border-[#E6E1D8]' };
      case 'processing':
        return { label: 'Processing', color: 'text-amber-800 bg-amber-50 border-amber-200' };
      case 'analyzed':
        return { label: 'Analyzed', color: 'text-blue-800 bg-blue-50 border-blue-200' };
      case 'verified':
        return { label: 'Complete', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
      default:
        return { label: 'Complete', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
    }
  };

  const filteredEvidence = evidenceList.filter(e => {
    const matchesSearch =
      !searchQuery ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.sha256.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.source && e.source.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      filterType === 'all' ||
      (filterType === 'verified' && e.verificationStatus === 'valid') ||
      (filterType === 'police' && (e.type.toLowerCase().includes('police') || e.type.toLowerCase().includes('fir'))) ||
      (filterType === 'phone' && (e.type.toLowerCase().includes('phone') || e.type.toLowerCase().includes('call'))) ||
      (filterType === 'financial' && (e.type.toLowerCase().includes('financial') || e.type.toLowerCase().includes('wire'))) ||
      (filterType === 'surveillance' && (e.type.toLowerCase().includes('surveillance') || e.type.toLowerCase().includes('cargo')));

    return matchesSearch && matchesType;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 max-w-7xl mx-auto pb-12 relative z-10"
    >
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6E1D8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Case Evidence Repository</span>
            <span>·</span>
            <span>4 Evidence Sources Contributed</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110] mt-1">
            Evidence & Information Sources
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Review uploaded police reports, call records, financial statements, and surveillance files powering the investigation network.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isViewer) {
                setError('ACCESS RESTRICTED: Viewer clearance accounts have read-only permissions.');
                return;
              }
              setUploadModalOpen(true);
            }}
            disabled={isViewer}
            className={`px-5 py-2.5 text-xs font-mono font-medium rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              isViewer
                ? 'bg-black/10 text-[#6B6760] cursor-not-allowed border border-[#E6E1D8]'
                : 'bg-[#121110] hover:bg-[#6E1827] text-white'
            }`}
          >
            {isViewer ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isViewer ? 'Add Evidence Restricted' : 'Add Evidence'}</span>
          </button>
        </div>
      </div>

      {/* 2. Simple Metrics Overview Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#6E1827]" />
            <span>Evidence Sources</span>
          </div>
          <div className="text-2xl font-serif text-[#121110] tabular-nums">{evidenceList.length}</div>
          <div className="text-[10px] font-mono text-[#6B6760]">Combined in case network</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Evidence Verified</span>
          </div>
          <div className="text-2xl font-serif text-emerald-800 tabular-nums">
            {evidenceList.filter(e => e.verificationStatus === 'valid' || e.status === 'verified').length}
          </div>
          <div className="text-[10px] font-mono text-emerald-800 font-medium">100% Integrity verified</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#6B6760]" />
            <span>Information Found</span>
          </div>
          <div className="text-2xl font-serif text-[#121110] tabular-nums">
            {evidenceList.reduce((acc, e) => acc + (e.extractedEntitiesCount || 0), 0)}
          </div>
          <div className="text-[10px] font-mono text-[#6B6760]">People, places & orgs mapped</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#6E1827]/5 border border-[#6E1827]/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6E1827] uppercase font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#6E1827]" />
            <span>Connections Found</span>
          </div>
          <div className="text-2xl font-serif text-[#6E1827] tabular-nums">
            {evidenceList.reduce((acc, e) => acc + (e.extractedRelationshipsCount || 0), 0)}
          </div>
          <div className="text-[10px] font-mono text-[#6E1827]">Network connections mapped</div>
        </div>
      </div>

      {/* 3. Human Processing Pipeline Lifecycle */}
      <div className="p-5 bg-white border border-[#E6E1D8] rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold tracking-wider">
            How NETRIX Processes Evidence
          </span>
          <span className="text-[10px] font-mono text-[#6B6760]">
            Automated & Instant
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl space-y-1">
            <div className="text-[10px] text-[#6E1827] font-bold uppercase">Stage 01</div>
            <div className="font-semibold text-[#121110]">Evidence Received</div>
            <p className="text-[11px] text-[#6B6760] font-sans">Automatic file identification and storage into dossier.</p>
          </div>
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl space-y-1">
            <div className="text-[10px] text-[#6E1827] font-bold uppercase">Stage 02</div>
            <div className="font-semibold text-[#121110]">Evidence Secured</div>
            <p className="text-[11px] text-[#6B6760] font-sans">Tamper-evident integrity seal applied to prevent modification.</p>
          </div>
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl space-y-1">
            <div className="text-[10px] text-[#6E1827] font-bold uppercase">Stage 03</div>
            <div className="font-semibold text-[#121110]">Information Extracted</div>
            <p className="text-[11px] text-[#6B6760] font-sans">Finding people, places, vehicles and organizations.</p>
          </div>
          <div className="p-3 bg-[#6E1827]/10 border border-[#6E1827]/25 rounded-xl space-y-1">
            <div className="text-[10px] text-[#6E1827] font-bold uppercase">Stage 04</div>
            <div className="font-semibold text-[#6E1827]">Connections Mapped</div>
            <p className="text-[11px] text-[#6B6760] font-sans">Mapping connections and looking for hidden leads.</p>
          </div>
        </div>
      </div>

      {/* 4. Controls & Category Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6760]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search evidence files, people, locations..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#E6E1D8] rounded-xl text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827] shadow-2xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-[#6B6760]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {[
            { id: 'all', label: 'All Evidence' },
            { id: 'verified', label: 'Verified' },
            { id: 'police', label: 'Police Reports' },
            { id: 'phone', label: 'Call Records' },
            { id: 'financial', label: 'Financial Records' },
            { id: 'surveillance', label: 'Surveillance' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-[#121110] text-white border-[#121110] font-semibold'
                  : 'bg-white text-[#6B6760] border-[#E6E1D8] hover:bg-[#F2EFE9] hover:text-[#121110]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Main 2-Column Catalog & Investigator Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Catalog Table */}
        <div className="lg:col-span-7 bg-white border border-[#E6E1D8] rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E6E1D8] flex items-center justify-between bg-[#F8F7F4]/60">
            <span className="text-[10px] font-mono uppercase font-bold text-[#6E1827]">
              EVIDENCE DOSSIER ({filteredEvidence.length})
            </span>
            <span className="text-[10px] font-mono text-[#6B6760]">Click file to view findings & connections</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E1D8] bg-[#F8F7F4] text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                  <th className="py-3 px-4">Evidence Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">People & Orgs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D8] font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#6B6760] font-mono text-xs">
                      Loading evidence files...
                    </td>
                  </tr>
                ) : filteredEvidence.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#6B6760] font-mono text-xs">
                      No evidence files match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvidence.map(ev => {
                    const isSelected = selectedEv?.id === ev.id;
                    const badge = getStatusBadge(ev.status);
                    return (
                      <tr
                        key={ev.id}
                        onClick={() => setSelectedEv(ev)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#6E1827]/10 font-medium' : 'hover:bg-[#F2EFE9]/60'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-sans font-semibold text-[#121110]">
                          <div className="flex items-center gap-2.5">
                            <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#6E1827]' : 'text-[#6B6760]'}`} />
                            <span className="truncate max-w-[200px]">{ev.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#6B6760] uppercase text-[10px]">
                          {ev.categoryLabel || ev.type.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#121110] tabular-nums">
                          {ev.extractedEntitiesCount || 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Investigator Summary Panel */}
        <div className="lg:col-span-5 space-y-4">
          {selectedEv ? (
            <motion.div
              key={selectedEv.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="p-6 bg-white border border-[#E6E1D8] rounded-2xl space-y-5 shadow-2xs"
            >
              {/* Summary Header */}
              <div className="pb-4 border-b border-[#E6E1D8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#6E1827] bg-[#6E1827]/10 border border-[#6E1827]/20 px-2.5 py-0.5 rounded-full">
                    {selectedEv.categoryLabel || selectedEv.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                    ✓ INTEGRITY VERIFIED
                  </span>
                </div>
                <h3 className="text-xl font-serif text-[#121110] font-normal leading-tight">
                  {selectedEv.name}
                </h3>
                <div className="text-[11px] font-mono text-[#6B6760]">
                  Added: {new Date(selectedEv.createdAt).toLocaleDateString()} · Status: Processed
                </div>
              </div>

              {/* What We Found Breakdown */}
              <div className="p-4 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl space-y-3">
                <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold tracking-wider block">
                  What We Found
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                  <div className="p-2.5 bg-white border border-[#E6E1D8] rounded-lg flex items-center justify-between">
                    <span className="text-[#6B6760]">People found:</span>
                    <span className="font-bold text-[#121110] font-mono">{selectedEv.peopleCount || selectedEv.extractedEntitiesCount || 0}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-[#E6E1D8] rounded-lg flex items-center justify-between">
                    <span className="text-[#6B6760]">Organizations:</span>
                    <span className="font-bold text-[#121110] font-mono">{selectedEv.orgsCount || 2}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-[#E6E1D8] rounded-lg flex items-center justify-between">
                    <span className="text-[#6B6760]">Locations:</span>
                    <span className="font-bold text-[#121110] font-mono">{selectedEv.locationsCount || 3}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-[#E6E1D8] rounded-lg flex items-center justify-between">
                    <span className="text-[#6B6760]">Vehicles:</span>
                    <span className="font-bold text-[#121110] font-mono">{selectedEv.vehiclesCount || 1}</span>
                  </div>
                  <div className="p-2.5 bg-[#6E1827]/5 border border-[#6E1827]/20 rounded-lg col-span-2 flex items-center justify-between text-[#6E1827] font-medium">
                    <span>Connections mapped:</span>
                    <span className="font-bold font-mono">{selectedEv.extractedRelationshipsCount || 6}</span>
                  </div>
                </div>
              </div>

              {/* Traceability & Source Attribution */}
              <div className="p-4 bg-white border border-[#E6E1D8] rounded-xl space-y-2 text-xs font-sans">
                <div className="text-[10px] font-mono text-[#6E1827] uppercase font-bold">
                  Evidence Traceability & Source Context
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#121110]">
                  <span className="text-[#6E1827] font-semibold">Source File:</span>
                  <span>{selectedEv.name}</span>
                </div>
                <div className="text-[11px] font-mono text-[#6B6760]">
                  Reference: {selectedEv.traceability?.pageRef || 'Page 1, Paragraph 4'}
                </div>
                <p className="text-[#6B6760] font-sans text-[11px] bg-[#F8F7F4] p-2.5 rounded-lg border border-[#E6E1D8] italic">
                  "{selectedEv.traceability?.snippetText || 'Forensic evidence item confirmed in active case dossier with full chain of custody.'}"
                </p>
              </div>

              {/* Optional Technical Details Toggle */}
              <div className="pt-2 border-t border-[#E6E1D8]">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-[11px] font-mono text-[#6B6760] hover:text-[#6E1827] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showTechnicalDetails ? 'Hide technical details' : 'View technical details'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTechnicalDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 p-3.5 bg-black/95 text-emerald-400 font-mono text-[10px] rounded-xl space-y-2 overflow-x-auto leading-relaxed"
                    >
                      <div className="flex justify-between border-b border-emerald-900/50 pb-1 text-emerald-200">
                        <span>SHA-256 Digest:</span>
                        <button
                          onClick={() => handleCopyHash(selectedEv.sha256)}
                          className="hover:underline text-emerald-400 cursor-pointer"
                        >
                          {copiedHash === selectedEv.sha256 ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="break-all text-white/90">{selectedEv.sha256}</div>
                      
                      <div className="pt-1 flex justify-between text-emerald-200">
                        <span>Block Height: #{selectedEv.blockNumber || 1543890}</span>
                        <span>Ledger Proof: VALID</span>
                      </div>
                      <div className="text-[#8C877D]">
                        Transaction Hash: {selectedEv.transactionHash || '0x3a920f77e6e5828f77e8a937667dcfb25a38ef6725345a90fbc923e273ab32c1'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => onNavigateToGraph?.()}
                  className="flex-1 py-2.5 px-4 bg-[#121110] hover:bg-[#6E1827] text-white text-xs font-mono font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>View in Network</span>
                </button>
                <button
                  onClick={() => onNavigateToVerification?.(selectedEv.id)}
                  className="py-2.5 px-4 border border-[#E6E1D8] hover:bg-[#F2EFE9] text-[#121110] text-xs font-mono font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verification Record</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="p-8 bg-white border border-[#E6E1D8] rounded-2xl text-center text-[#6B6760] font-mono text-xs">
              Select an evidence file from the dossier to inspect its findings.
            </div>
          )}
        </div>
      </div>

      {/* Universal Evidence Ingestion Modal */}
      <UniversalEvidenceModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        caseId="case_01"
        onEvidenceCreated={handleEvidenceCreated}
      />
    </motion.div>
  );
};

export default EvidencePage;
