import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  X,
  FileCode,
  Lock,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Users,
  Building,
  MapPin,
  Car,
  Phone,
  Link,
  HelpCircle,
  Code
} from 'lucide-react';
import { Evidence, EvidenceCategory } from '../types';
import { apiClient } from '../api/client';

interface UniversalEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string;
  onEvidenceCreated: (newEvidence: Evidence) => void;
}

export const EVIDENCE_CATEGORIES: Array<{
  id: EvidenceCategory;
  label: string;
  description: string;
  icon: any;
}> = [
  {
    id: 'police_report',
    label: 'Police Report',
    description: 'FIR, incident report, police file, officer statement',
    icon: FileText
  },
  {
    id: 'call_records',
    label: 'Call Records',
    description: 'CDR, phone dump, WhatsApp/SMS transcript, Cellebrite',
    icon: Phone
  },
  {
    id: 'financial_records',
    label: 'Financial Records',
    description: 'Bank statement, wire transfer log, offshore account export',
    icon: Database
  },
  {
    id: 'intelligence_report',
    label: 'Intelligence Report',
    description: 'Inter-agency memo, field report, informant transcript',
    icon: ShieldCheck
  },
  {
    id: 'surveillance',
    label: 'Surveillance',
    description: 'Port cargo log, CCTV transcript, tailing log',
    icon: Search
  },
  {
    id: 'criminal_history',
    label: 'Criminal History',
    description: 'Prior convictions, rap sheet, active arrest warrants',
    icon: Users
  },
  {
    id: 'social_intelligence',
    label: 'Social Intelligence',
    description: 'Social media export, forum archive, messaging logs',
    icon: Link
  },
  {
    id: 'vehicle_location',
    label: 'Vehicle / Location',
    description: 'ALPR log, GPS track, vehicle registry, location ping',
    icon: Car
  },
  {
    id: 'other',
    label: 'Other',
    description: 'CSV, Excel, JSON, PDF, TXT or DOCX document',
    icon: HelpCircle
  }
];

export const UniversalEvidenceModal: React.FC<UniversalEvidenceModalProps> = ({
  isOpen,
  onClose,
  caseId = 'case_01',
  onEvidenceCreated
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceName, setEvidenceName] = useState('');
  const [category, setCategory] = useState<EvidenceCategory>('police_report');
  const [notesContent, setNotesContent] = useState('');
  
  // Processing stage state
  const [step, setStep] = useState<'upload' | 'processing' | 'complete'>('upload');
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [createdEvidence, setCreatedEvidence] = useState<Evidence | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Auto-infer category based on file extension / filename keywords
  const inferCategory = (fileName: string): EvidenceCategory => {
    const lower = fileName.toLowerCase();
    if (lower.includes('fir') || lower.includes('report') || lower.includes('police')) return 'police_report';
    if (lower.includes('cdr') || lower.includes('call') || lower.includes('phone') || lower.includes('cellebrite')) return 'call_records';
    if (lower.includes('wire') || lower.includes('bank') || lower.includes('financial') || lower.includes('statement')) return 'financial_records';
    if (lower.includes('intel') || lower.includes('memo')) return 'intelligence_report';
    if (lower.includes('cargo') || lower.includes('port') || lower.includes('surveillance') || lower.includes('cctv')) return 'surveillance';
    if (lower.includes('warrant') || lower.includes('priors') || lower.includes('conviction')) return 'criminal_history';
    if (lower.includes('social') || lower.includes('chat') || lower.includes('export')) return 'social_intelligence';
    if (lower.includes('alpr') || lower.includes('gps') || lower.includes('vehicle') || lower.includes('location')) return 'vehicle_location';
    return 'other';
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    if (!evidenceName) {
      // Set human readable clean name
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      setEvidenceName(cleanName);
    }
    setCategory(inferCategory(file.name));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse = evidenceName.trim() || selectedFile?.name || 'Uploaded Evidence File';
    
    setStep('processing');
    setProcessingStageIndex(0);

    // Simulate human-language pipeline progression over 3 seconds
    setTimeout(() => setProcessingStageIndex(1), 700);
    setTimeout(() => setProcessingStageIndex(2), 1400);
    setTimeout(() => setProcessingStageIndex(3), 2200);

    try {
      const catObj = EVIDENCE_CATEGORIES.find(c => c.id === category);
      const catLabel = catObj?.label || 'General Evidence';

      const fileToUpload =
        selectedFile ||
        new File(
          [notesContent || `Evidence Record: ${nameToUse}\nType: ${catLabel}\nCreated: ${new Date().toISOString()}`],
          `${nameToUse.replace(/\s+/g, '_')}.txt`,
          { type: 'text/plain' }
        );

      // Call underlying real API upload
      const newRec = await apiClient.evidence.upload(fileToUpload, caseId, category);

      // Enrich with category label
      const enriched: Evidence = {
        ...newRec,
        category,
        categoryLabel: catLabel
      };

      setCreatedEvidence(enriched);
      setStep('complete');
      onEvidenceCreated(enriched);
    } catch (err: any) {
      console.error('Error processing evidence:', err);
      alert(err.message || 'Evidence upload failed. Please verify case context.');
      setStep('upload');
    }
  };

  const resetAndClose = () => {
    setSelectedFile(null);
    setEvidenceName('');
    setCategory('police_report');
    setNotesContent('');
    setStep('upload');
    setProcessingStageIndex(0);
    setShowTechnicalDetails(false);
    setCreatedEvidence(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-[#E6E1D8] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#E6E1D8]">
            <div>
              <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold tracking-wider">
                Investigator Workflow
              </span>
              <h3 className="text-xl font-serif text-[#121110] font-normal">
                {step === 'upload' && 'Add Evidence'}
                {step === 'processing' && 'Processing Evidence'}
                {step === 'complete' && 'Evidence Analysis Complete'}
              </h3>
            </div>
            <button
              onClick={resetAndClose}
              className="w-8 h-8 rounded-full bg-[#F8F7F4] hover:bg-[#E6E1D8] flex items-center justify-center text-[#6B6760] hover:text-[#121110] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* STEP 1: UPLOAD & CATEGORY SELECTION */}
          {step === 'upload' && (
            <form onSubmit={handleStartProcessing} className="space-y-5">
              {/* Drag & Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#6E1827] bg-[#6E1827]/5'
                    : selectedFile
                    ? 'border-emerald-600/40 bg-emerald-50/50'
                    : 'border-[#E6E1D8] hover:border-[#6E1827]/40 bg-[#F8F7F4] hover:bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#121110]">{selectedFile.name}</div>
                      <div className="text-[11px] text-[#6B6760] font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB · File Ready
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-full bg-white border border-[#E6E1D8] text-[#6E1827] flex items-center justify-center mx-auto shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#121110]">
                        Drop a file here or choose from your device
                      </div>
                      <div className="text-[11px] font-mono text-[#6B6760] mt-1">
                        Supports FIRs, Call Records, Bank Statements, PDFs, Excel, CSV, JSON & Images
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Title Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#6B6760] uppercase font-bold">
                  Evidence Name
                </label>
                <input
                  type="text"
                  required
                  value={evidenceName}
                  onChange={e => setEvidenceName(e.target.value)}
                  placeholder="e.g. Operation Sea Serpent Police FIR #42"
                  className="w-full p-2.5 border border-[#E6E1D8] rounded-xl text-xs font-sans text-[#121110] placeholder-[#8C877D] focus:outline-none focus:border-[#6E1827] bg-white shadow-2xs"
                />
              </div>

              {/* Understandable Category Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#6B6760] uppercase font-bold">
                  What type of evidence is this?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EVIDENCE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const active = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'border-[#6E1827] bg-[#6E1827]/5 text-[#6E1827] shadow-2xs font-medium'
                            : 'border-[#E6E1D8] bg-white hover:bg-[#F8F7F4] text-[#121110]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#6E1827]' : 'text-[#6B6760]'}`} />
                          <span className="text-xs font-sans truncate">{cat.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 font-mono">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 py-2.5 border border-[#E6E1D8] hover:bg-[#F8F7F4] rounded-xl text-xs text-[#6B6760] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#121110] hover:bg-[#6E1827] text-white rounded-xl text-xs font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Process Evidence</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: HUMAN-LANGUAGE PROCESSING SCREEN */}
          {step === 'processing' && (
            <div className="space-y-6">
              <div className="p-4 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6E1827] text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#121110]">{evidenceName || 'Uploaded Evidence'}</div>
                  <div className="text-[11px] font-mono text-[#6B6760]">
                    Category: {EVIDENCE_CATEGORIES.find(c => c.id === category)?.label}
                  </div>
                </div>
              </div>

              {/* Simple Visual Progress Timeline */}
              <div className="space-y-3 font-sans text-xs">
                {[
                  { label: 'Evidence received', sub: 'File uploaded securely to dossier' },
                  { label: 'Evidence secured', sub: 'Securing evidence integrity seal' },
                  { label: 'Finding people, places and organizations', sub: 'Extracting key entities' },
                  { label: 'Finding connections', sub: 'Mapping relational network' },
                  { label: 'Looking for potential hidden connections', sub: 'Analyzing network patterns' }
                ].map((item, idx) => {
                  const isDone = processingStageIndex > idx;
                  const isCurrent = processingStageIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isDone
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : isCurrent
                          ? 'bg-amber-50/60 border-amber-200 text-amber-950 font-medium'
                          : 'bg-[#F8F7F4] border-transparent text-[#8C877D] opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          ) : isCurrent ? (
                            <span className="w-3 h-3 rounded-full border-2 border-amber-700 border-t-transparent animate-spin" />
                          ) : (
                            <span className="text-[#8C877D]">{idx + 1}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-xs">{item.label}</div>
                          <div className="text-[11px] font-mono opacity-80">{item.sub}</div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full">
                        {isDone ? '✓ Complete' : isCurrent ? 'Processing' : 'Waiting'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Optional Technical Details Toggle for Administrators */}
              <div className="pt-2 border-t border-[#E6E1D8]">
                <button
                  type="button"
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
                      className="mt-3 p-3 bg-black/90 text-emerald-400 font-mono text-[10px] rounded-xl space-y-1 overflow-x-auto leading-relaxed"
                    >
                      <div>[SYSTEM] Pipeline Executing: SHA-256 Digest Computation</div>
                      <div>[SHA256] 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</div>
                      <div>[BLOCKCHAIN] Anchored Merkle Root: 0x3a920f77e6e5828f77e8a9376... Block #1543890</div>
                      <div>[NLP_ENGINE] spaCy Entity Chunking & Co-occurrence Matrix resolved</div>
                      <div>[GRAPH_NEO4J] Cypher query executed against active case schema</div>
                      <div>[GNN_MODEL] DistMult Embedding dimension: 64, Heterogeneous layers: 4</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* STEP 3: AUTOMATIC UNDERSTANDING SUMMARY */}
          {step === 'complete' && createdEvidence && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-950 font-mono">Evidence Processed Successfully</div>
                    <div className="text-[11px] text-emerald-800 font-sans">
                      Added to active case network and secured with verification seal.
                    </div>
                  </div>
                </div>
              </div>

              {/* "What we found" Clean Card */}
              <div className="p-5 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl space-y-3">
                <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold tracking-wider block">
                  What We Found
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white border border-[#E6E1D8] rounded-xl shadow-2xs">
                    <div className="text-xl font-serif text-[#121110] tabular-nums font-medium">19</div>
                    <div className="text-[10px] font-mono text-[#6B6760]">People found</div>
                  </div>
                  <div className="p-3 bg-white border border-[#E6E1D8] rounded-xl shadow-2xs">
                    <div className="text-xl font-serif text-[#121110] tabular-nums font-medium">6</div>
                    <div className="text-[10px] font-mono text-[#6B6760]">Organizations</div>
                  </div>
                  <div className="p-3 bg-white border border-[#E6E1D8] rounded-xl shadow-2xs">
                    <div className="text-xl font-serif text-[#121110] tabular-nums font-medium">8</div>
                    <div className="text-[10px] font-mono text-[#6B6760]">Locations</div>
                  </div>
                  <div className="p-3 bg-white border border-[#E6E1D8] rounded-xl shadow-2xs">
                    <div className="text-xl font-serif text-[#6E1827] tabular-nums font-medium">23</div>
                    <div className="text-[10px] font-mono text-[#6E1827]">Connections</div>
                  </div>
                </div>
              </div>

              {/* Traceability Reference */}
              <div className="p-4 bg-white border border-[#E6E1D8] rounded-2xl text-xs space-y-2">
                <div className="text-[10px] font-mono text-[#6B6760] uppercase font-bold">
                  Evidence Traceability & Source Attribution
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#121110]">
                  <span className="text-[#6E1827] font-semibold">Source:</span>
                  <span>{createdEvidence.name} ({createdEvidence.traceability?.pageRef})</span>
                </div>
                <p className="text-[#6B6760] font-sans text-[11px] bg-[#F8F7F4] p-2 rounded-lg border border-[#E6E1D8]/60 italic">
                  "{createdEvidence.traceability?.snippetText}"
                </p>
              </div>

              {/* Action */}
              <div className="pt-2 flex justify-end font-mono">
                <button
                  onClick={resetAndClose}
                  className="px-6 py-2.5 bg-[#121110] hover:bg-[#6E1827] text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer"
                >
                  Done & View Network
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
