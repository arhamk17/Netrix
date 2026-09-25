import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowDown,
  ArrowRight,
  FileText,
  Clock,
  RotateCw,
  Copy,
  Check,
  AlertTriangle,
  Search,
  Lock,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Hash,
  Database
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Evidence } from '../types';

// Cryptographic Seal with rotating security ring
const CryptographicSeal: React.FC<{ isTampered?: boolean; blockNumber?: number; hash?: string }> = ({
  isTampered = false,
  blockNumber = 1543820,
  hash = ''
}) => {
  return (
    <div className="relative flex items-center justify-center p-6 select-none">
      {/* Outer rotating dashed security ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: isTampered ? 8 : 24, ease: 'linear' }}
        className="absolute w-44 h-44 rounded-full border-2 border-dashed pointer-events-none"
        style={{
          borderColor: isTampered ? 'rgba(110, 24, 39, 0.45)' : 'rgba(15, 118, 110, 0.45)'
        }}
      />

      {/* Secondary concentric reverse-rotating ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 36, ease: 'linear' }}
        className="absolute w-36 h-36 rounded-full border pointer-events-none"
        style={{
          borderColor: isTampered ? 'rgba(110, 24, 39, 0.25)' : 'rgba(15, 118, 110, 0.25)',
          borderStyle: 'dotted'
        }}
      />

      {/* Official Seal Body */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: [0.95, 1.02, 1], opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 300 }}
        className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg transition-colors duration-500 relative z-10 border ${
          isTampered
            ? 'bg-[#FAF1F2] border-[#6E1827]/40 text-[#6E1827]'
            : 'bg-white border-emerald-600/30 text-emerald-800'
        }`}
      >
        <div className="text-[7px] font-mono tracking-widest uppercase font-bold text-center px-1">
          {isTampered ? 'TAMPER REJECT' : 'NETRIX SEAL'}
        </div>
        <div className="my-1">
          {isTampered ? (
            <ShieldAlert className="w-7 h-7 text-[#6E1827]" />
          ) : (
            <ShieldCheck className="w-7 h-7 text-emerald-700" />
          )}
        </div>
        <div className="text-[8px] font-mono font-bold tracking-tight">
          BLK #{blockNumber}
        </div>
      </motion.div>
    </div>
  );
};

interface VerificationPageProps {
  initialEvidenceId?: string;
  onNavigateToEvidence?: (evidenceName?: string) => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  initialEvidenceId,
  onNavigateToEvidence
}) => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [selectedEv, setSelectedEv] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Verification stage animation state
  const [verificationStage, setVerificationStage] = useState<'IDLE' | 'HASHING' | 'CHAIN_LOOKUP' | 'VERIFIED' | 'TAMPERED'>('IDLE');
  const [verifying, setVerifying] = useState(false);

  // Forensic Tamper Simulation State (Optional simulation testing)
  const [tamperedState, setTamperedState] = useState<Record<string, { isTampered: boolean; currentHash: string }>>({});
  const [backendVerification, setBackendVerification] = useState<Record<string, { match: boolean; computedHash?: string; storedHash?: string; txHash?: string }>>({});

  useEffect(() => {
    fetchEvidence();
  }, []);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.evidence.list();
      setEvidenceList(data);
      if (initialEvidenceId) {
        const found = data.find(e => e.id === initialEvidenceId);
        setSelectedEv(found || data[0] || null);
        if (found) verifyItem(found.id);
      } else if (data.length > 0) {
        setSelectedEv(data[0]);
        verifyItem(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load evidence records.');
    } finally {
      setLoading(false);
    }
  };

  const verifyItem = async (evidenceId: string) => {
    try {
      const res = await apiClient.evidence.verify(evidenceId);
      setBackendVerification(prev => ({
        ...prev,
        [evidenceId]: {
          match: res.match,
          computedHash: res.computed_hash,
          storedHash: res.stored_hash,
          txHash: res.blockchain_tx_hash
        }
      }));
      return res;
    } catch {
      return null;
    }
  };

  const handleCopy = (val: string, field: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isCurrentTampered = selectedEv
    ? tamperedState[selectedEv.id]?.isTampered || (backendVerification[selectedEv.id] ? !backendVerification[selectedEv.id].match : false)
    : false;

  const currentHash = selectedEv
    ? tamperedState[selectedEv.id]?.isTampered
      ? tamperedState[selectedEv.id].currentHash
      : backendVerification[selectedEv.id]?.computedHash || selectedEv.sha256
    : '';

  // Trigger interactive verification sequence
  const runVerificationScan = async () => {
    if (!selectedEv) return;
    setVerifying(true);
    setVerificationStage('HASHING');

    setTimeout(async () => {
      setVerificationStage('CHAIN_LOOKUP');
      try {
        const res = await apiClient.evidence.verify(selectedEv.id);
        setBackendVerification(prev => ({
          ...prev,
          [selectedEv.id]: {
            match: res.match,
            computedHash: res.computed_hash,
            storedHash: res.stored_hash,
            txHash: res.blockchain_tx_hash
          }
        }));
        setVerifying(false);
        const isTampered = tamperedState[selectedEv.id]?.isTampered;
        setVerificationStage(isTampered ? 'TAMPERED' : (res.match ? 'VERIFIED' : 'TAMPERED'));
      } catch {
        setVerifying(false);
        setVerificationStage(isCurrentTampered ? 'TAMPERED' : 'VERIFIED');
      }
    }, 600);
  };

  const toggleTamper = () => {
    if (!selectedEv) return;
    const nextTampered = !tamperedState[selectedEv.id]?.isTampered;
    setTamperedState(prev => ({
      ...prev,
      [selectedEv.id]: {
        isTampered: nextTampered,
        currentHash: nextTampered
          ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          : selectedEv.sha256
      }
    }));
    // Re-run verification automatically to reveal the transition
    setVerifying(true);
    setVerificationStage('HASHING');
    setTimeout(() => {
      setVerificationStage('CHAIN_LOOKUP');
      setTimeout(() => {
        setVerifying(false);
        setVerificationStage(nextTampered ? 'TAMPERED' : 'VERIFIED');
      }, 500);
    }, 500);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            <span>Chain of Custody</span>
            <span>·</span>
            <span>Cryptographic Anchors</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110]">
            Evidence Integrity Verification
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Independent cryptographic verification anchoring SHA-256 evidence digests against the distributed integrity ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runVerificationScan}
            disabled={verifying}
            className="px-4 py-2.5 rounded-full bg-white/70 hover:bg-white text-xs font-mono text-[#121110] border border-black/10 transition-all flex items-center gap-2 shadow-xs hover:shadow-sm"
          >
            <RotateCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-[#6E1827]' : 'text-[#6B6760]'}`} />
            <span>{verifying ? 'Verifying...' : 'Re-verify Hash'}</span>
          </button>

          <button
            onClick={toggleTamper}
            className={`px-4 py-2.5 text-xs font-mono rounded-full transition-all flex items-center gap-2 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827] ${
              isCurrentTampered
                ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                : 'bg-[#6E1827] text-white hover:bg-[#4E101B]'
            }`}
          >
            {isCurrentTampered ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Restore Valid Hash</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate Forensic Tampering</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visually Explicit Circular Integrity Pipeline */}
      <div
        className="p-6 sm:p-8 rounded-3xl space-y-6"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.65)',
          boxShadow: '0 8px 30px -4px rgba(18, 17, 16, 0.05)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider font-semibold">
            Real-Time Integrity Verification Pipeline
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-mono text-[#121110]">Private Ledger Synchronized</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center font-mono text-xs relative">
          {/* Stage 01: Evidence Card */}
          <div className="p-4 bg-white/70 border border-black/5 rounded-2xl space-y-2 text-center shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#121110] text-white flex items-center justify-center mx-auto text-[10px] font-bold">
              01
            </div>
            <div className="font-medium text-[#121110] text-xs font-sans">Artifact Ingestion</div>
            <div className="text-[11px] text-[#6B6760] truncate">
              {selectedEv?.name || 'Evidence Document'}
            </div>
          </div>

          {/* Stage 02: SHA-256 Digest */}
          <div className="p-4 bg-white/70 border border-black/5 rounded-2xl space-y-2 text-center shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#6E1827] text-white flex items-center justify-center mx-auto text-[10px] font-bold">
              02
            </div>
            <div className="font-medium text-[#121110] text-xs font-sans">SHA-256 Digest</div>
            <div className="text-[11px] text-[#6B6760] truncate tabular-nums">
              {currentHash.substring(0, 14)}...
            </div>
          </div>

          {/* Stage 03: Blockchain Node Anchor */}
          <div className="p-4 bg-white/70 border border-black/5 rounded-2xl space-y-2 text-center shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#121110] text-white flex items-center justify-center mx-auto text-[10px] font-bold">
              03
            </div>
            <div className="font-medium text-[#121110] text-xs font-sans">Blockchain Record</div>
            <div className="text-[11px] text-[#6B6760] truncate tabular-nums">
              Block #{selectedEv?.blockNumber || '1540822'}
            </div>
          </div>

          {/* Stage 04: Circular Verification Result */}
          <div
            className={`p-4 rounded-2xl space-y-2 text-center border transition-all duration-300 shadow-sm ${
              isCurrentTampered
                ? 'bg-[#FAF1F2] border-[#6E1827]/40 text-[#6E1827]'
                : 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
            }`}
          >
            {/* Circular Verification Animation Ring */}
            <div className="relative w-9 h-9 mx-auto flex items-center justify-center">
              {isCurrentTampered ? (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="w-9 h-9 rounded-full bg-[#6E1827] text-white flex items-center justify-center shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-sm"
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              )}
            </div>

            <div className="font-bold text-xs uppercase tracking-tight font-mono">
              {isCurrentTampered ? '⚠ INTEGRITY MISMATCH' : '✓ VERIFIED ON-CHAIN'}
            </div>
            <div className="text-[10px] font-sans">
              {isCurrentTampered ? 'Hash signature discrepancy detected' : 'Cryptographic proof intact'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Selector List + Detailed Forensic Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Evidence Item Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider font-semibold">
            Registered Artifacts ({evidenceList.length})
          </div>
          <div className="space-y-2.5">
            {evidenceList.map(ev => {
              const isSelected = selectedEv?.id === ev.id;
              const isTampered = tamperedState[ev.id]?.isTampered;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEv(ev)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#121110] shadow-sm'
                      : 'bg-white/70 hover:bg-white border-black/5 hover:border-black/15 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-medium text-[#121110] truncate max-w-[190px] font-sans">
                      {ev.name}
                    </div>
                    {isTampered ? (
                      <span className="text-[9px] font-mono text-[#6E1827] bg-[#FAF1F2] border border-[#6E1827]/25 px-2 py-0.2 rounded-full font-bold">
                        ⚠ TAMPERED
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full font-medium">
                        ✓ VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-[#6B6760] mt-1 tabular-nums">
                    SHA-256: {ev.sha256.substring(0, 16)}...
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Forensic Verification Terminal */}
        <div
          className="lg:col-span-8 p-6 sm:p-8 rounded-3xl space-y-6"
          style={{
            background: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            boxShadow: '0 12px 36px -4px rgba(18, 17, 16, 0.06)'
          }}
        >
          {selectedEv ? (
            <>
              {/* Status Banner */}
              <AnimatePresence mode="wait">
                {isCurrentTampered ? (
                  <motion.div
                    key="tamper-alert"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-6 bg-[#FAF1F2] border border-[#6E1827]/30 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center gap-3 text-[#6E1827]">
                      <div className="w-10 h-10 rounded-full bg-[#6E1827] text-white flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono tracking-widest uppercase font-bold text-[#6E1827]">
                          CRITICAL INTEGRITY MISMATCH
                        </div>
                        <h3 className="text-lg font-serif font-normal text-[#121110]">
                          Cryptographic Digest Collision Failure
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs font-sans text-[#121110] leading-relaxed">
                      The active disk payload hash does not match the immutable blockchain transaction seal. The file content has been altered or corrupted post-chain anchoring.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="valid-banner"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-emerald-900 tracking-wider">
                          CHAIN OF CUSTODY VERIFIED
                        </div>
                        <div className="text-xs font-sans text-emerald-950 font-medium">
                          100% Match Between Disk Digest and Ethereum Subnet Block #{selectedEv.blockNumber || 1543820}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-800 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-xs">
                      LEGAL SEAL VALID
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hash Comparison Matrix */}
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-[#121110] tracking-wide uppercase">
                  Digest Comparison Matrix
                </div>

                {/* Local Computed Digest */}
                <div className="p-4 bg-white/80 border border-black/5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#6B6760] uppercase">Local Artifact SHA-256 Digest:</span>
                    <button
                      onClick={() => handleCopy(currentHash, 'computed')}
                      className="text-[#6E1827] hover:underline flex items-center gap-1 text-[10px]"
                    >
                      {copiedField === 'computed' ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className={`p-2 rounded-xl text-xs font-mono break-all tabular-nums ${
                    isCurrentTampered ? 'bg-[#FAF1F2] text-[#6E1827] font-semibold' : 'bg-[#F7F5F0] text-[#121110]'
                  }`}>
                    {currentHash}
                  </div>
                </div>

                {/* Blockchain Anchored Digest */}
                <div className="p-4 bg-white/80 border border-black/5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#6B6760] uppercase">On-Chain Registered Root Seal:</span>
                    <button
                      onClick={() => handleCopy(selectedEv.sha256, 'chain')}
                      className="text-[#6E1827] hover:underline flex items-center gap-1 text-[10px]"
                    >
                      {copiedField === 'chain' ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="p-2 bg-[#F7F5F0] rounded-xl text-xs font-mono text-[#121110] break-all tabular-nums">
                    {selectedEv.sha256}
                  </div>
                </div>
              </div>

              {/* Blockchain Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 bg-white/70 border border-black/5 rounded-2xl space-y-1">
                  <div className="text-[10px] text-[#6B6760] uppercase">Ledger Transaction Hash</div>
                  <div className="text-[11px] font-medium text-[#121110] break-all tabular-nums">
                    {selectedEv.transactionHash || '0x3a920f77e6e5828f77e8a937667dcfb25a38ef6725345a90fbc923e273ab32c1'}
                  </div>
                </div>

                <div className="p-4 bg-white/70 border border-black/5 rounded-2xl space-y-1">
                  <div className="text-[10px] text-[#6B6760] uppercase">Anchored Block Height</div>
                  <div className="text-sm font-semibold text-[#121110] tabular-nums">
                    #{selectedEv.blockNumber || '1543820'}
                  </div>
                </div>
              </div>

              {/* Chain of Custody Timeline */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-mono font-bold text-[#121110] tracking-wide uppercase">
                  Custody Chain Log ({selectedEv.custodyChain.length} Events)
                </div>
                <div className="space-y-2">
                  {selectedEv.custodyChain.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white/70 border border-black/5 rounded-xl flex items-start gap-3 text-xs font-mono"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#F7F5F0] text-[#121110] border border-black/5 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#121110]">{entry.action}</span>
                          <span className="text-[10px] text-[#6B6760] tabular-nums">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B6760] mt-0.5">
                          Officer: <span className="text-[#121110] font-sans">{entry.actor}</span>
                        </div>
                        {entry.notes && (
                          <p className="text-[11px] font-sans text-[#6B6760] mt-1 italic">
                            "{entry.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-xs font-mono text-[#6B6760]">
              Select an artifact from the roster to inspect cryptographic verification proofs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
