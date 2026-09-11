import React, { useState, useEffect, useRef } from 'react';
import {
  FileArchive,
  Upload,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  HardDrive,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  FileDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Evidence, EvidenceStatus } from '../../types';
import { GenerateReportModal } from '../common/GenerateReportModal';
import { exportToJSON, exportToCSV } from '../../utils/reportExport';

interface Props {
  onInspectIntegrity: (evidenceId: string) => void;
}

export const EvidenceVault: React.FC<Props> = ({ onInspectIntegrity }) => {
  const { activeCase, user } = useAuth();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvidence = async () => {
    if (!activeCase) return;
    setLoading(true);
    try {
      const caseId = activeCase.id || activeCase.case_id;
      if (!caseId) return;
      const data = await api.getCaseEvidence(caseId).catch(() => []);
      setEvidenceList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [activeCase]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeCase) return;
    const file = files[0];

    setUploading(true);
    setUploadProgress(15);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => (prev < 85 ? prev + 15 : prev));
    }, 120);

    try {
      const caseId = activeCase.id || activeCase.case_id;
      const newEv = await api.uploadEvidence(file, caseId);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => {
        setEvidenceList(prev => [newEv, ...prev]);
        setUploading(false);
        setUploadProgress(0);
      }, 400);
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
      alert(err.message || 'Evidence upload failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredEvidence = evidenceList.filter(ev => {
    const evId = ev.id || ev.evidence_id || '';
    const evName = ev.original_filename || ev.filename || '';
    const evHash = ev.sha256_hash || '';
    const evStatus = ev.processing_status || ev.status || 'PROCESSED';

    const matchesStatus = statusFilter === 'ALL' || evStatus === statusFilter;
    const matchesSearch =
      evId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evHash.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleExportEvidenceJSON = () => {
    const exportData = filteredEvidence.map(ev => ({
      evidence_id: ev.id || ev.evidence_id,
      case_id: ev.case_id,
      filename: ev.original_filename || ev.filename,
      source_type: ev.source_type || ev.file_type || 'DIGITAL_EVIDENCE',
      file_size_bytes: ev.file_size || 0,
      file_size_formatted: formatBytes(ev.file_size || 0),
      sha256_hash: ev.sha256_hash,
      stored_hash: ev.stored_hash || ev.sha256_hash,
      status: ev.processing_status || ev.status,
      validation_details: ev.validation_details || (ev.sha256_hash ? 'SHA-256 integrity hash recorded' : 'Pending computation'),
      upload_time: ev.uploaded_at || ev.upload_time,
      blockchain_registered: ev.blockchain_status === 'registered' || ev.blockchain_status === 'CONFIRMED' || ev.blockchain?.registered || false,
      blockchain_tx_hash: ev.blockchain_tx_hash || ev.blockchain?.tx_hash || 'N/A',
      blockchain_block_number: ev.blockchain_block_number || ev.blockchain?.block_number || 'N/A',
      blockchain_status: ev.blockchain_status || ev.blockchain?.integrity_status || (ev.processing_status === 'completed' ? 'registered' : ev.processing_status || 'pending')
    }));

    exportToJSON({
      filename: `NETRIX_Evidence_Vault_Report_${activeCase?.case_number || activeCase?.id || 'ALL'}_${new Date().toISOString().slice(0, 10)}.json`,
      moduleName: 'Immutable Evidence Vault',
      caseId: activeCase?.case_number || activeCase?.id,
      operator: user?.full_name || 'Authorized Lead Investigator',
      data: exportData
    });
  };

  const handleExportEvidenceCSV = () => {
    const exportData = filteredEvidence.map(ev => ({
      evidence_id: ev.id || ev.evidence_id,
      case_id: ev.case_id,
      filename: ev.original_filename || ev.filename,
      file_type: ev.source_type || ev.file_type || 'DIGITAL_EVIDENCE',
      file_size: formatBytes(ev.file_size || 0),
      sha256_hash: ev.sha256_hash,
      status: ev.processing_status || ev.status,
      upload_time: ev.uploaded_at || ev.upload_time,
      eth_block: ev.blockchain_block_number || ev.blockchain?.block_number || 'N/A',
      tx_hash: ev.blockchain_tx_hash || ev.blockchain?.tx_hash || 'N/A',
      integrity: ev.blockchain_status || ev.blockchain?.integrity_status || ev.processing_status || 'pending'
    }));

    const fields = [
      { key: 'evidence_id', label: 'Evidence ID' },
      { key: 'case_id', label: 'Case ID' },
      { key: 'filename', label: 'Filename' },
      { key: 'file_type', label: 'File Type' },
      { key: 'file_size', label: 'File Size' },
      { key: 'sha256_hash', label: 'SHA-256 Hash' },
      { key: 'status', label: 'Custody Status' },
      { key: 'upload_time', label: 'Ingestion Timestamp' },
      { key: 'eth_block', label: 'Ethereum Block' },
      { key: 'tx_hash', label: 'Attestation Tx Hash' },
      { key: 'integrity', label: 'Integrity Verdict' }
    ];

    exportToCSV({
      filename: `NETRIX_Evidence_Vault_Report_${activeCase?.case_number || activeCase?.id || 'ALL'}_${new Date().toISOString().slice(0, 10)}.csv`,
      moduleName: 'Immutable Evidence Vault',
      caseId: activeCase?.case_number || activeCase?.id,
      operator: user?.full_name,
      data: exportData,
      fields
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <FileArchive className="w-6 h-6 text-crimson-400" />
            <span>IMMUTABLE EVIDENCE VAULT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically sealed evidence files with Ethereum-attested SHA-256 integrity
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Generate Report Button - Crimson Aesthetic */}
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-crimson-600/60 bg-gradient-to-r from-crimson-900/60 to-black hover:from-crimson-800/70 hover:to-crimson-950/40 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(153,27,27,0.35)] cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-rose-300" />
            <span>GENERATE REPORT</span>
          </button>

          <button
            onClick={loadEvidence}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-black/40 hover:border-white/20 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Drag and Drop Ingestion Area */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all backdrop-blur-xl ${
          isDragOver
            ? 'border-crimson-500 bg-crimson-950/30 shadow-[0_0_30px_rgba(153,27,27,0.25)]'
            : 'border-[#1E293B] hover:border-crimson-500/50 bg-[#0E121D]/80 hover:bg-[#121824]/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => handleFileUpload(e.target.files)}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-crimson-500/30 bg-crimson-950/40 text-crimson-400 shadow-[0_0_15px_rgba(153,27,27,0.2)]">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-200 uppercase">
              DRAG & DROP INVESTIGATIVE EVIDENCE
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              TXT, CSV, JSON, PCAP, PDF, SQLITE, IMAGE & DATA DUMPS (UP TO 50GB)
            </p>
          </div>

          <div className="text-[11px] text-crimson-400/90 pt-1">
            Automatic SHA-256 Hashing & Blockchain Registration
          </div>
        </div>

        {uploading && (
          <div className="mt-6 max-w-md mx-auto space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>COMPUTING SHA-256 & RECORDING ON-CHAIN...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-crimson-600 to-rose-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search */}
      <div className="glass-panel rounded-xl p-3 border border-[#1E293B] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Evidence ID, Filename, or SHA-256 hash..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0E121D] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-crimson-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-slate-400">STATUS:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0E121D] border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-crimson-500/50"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="glass-panel rounded-xl border border-[#1E293B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E293B] bg-[#0E121D] text-slate-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5">EVD ID & FILENAME</th>
                <th className="p-3.5">FORMAT & SIZE</th>
                <th className="p-3.5">SHA-256 HASH FINGERPRINT</th>
                <th className="p-3.5">BLOCKCHAIN REGISTRATION</th>
                <th className="p-3.5">INTEGRITY</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/70 text-slate-300">
              {filteredEvidence.map(ev => {
                const evId = ev.id || ev.evidence_id || '';
                const evFilename = ev.original_filename || ev.filename || 'unnamed_evidence';
                const evFileType = ev.source_type || ev.file_type || 'DIGITAL_EVIDENCE';
                const evBlock = ev.blockchain_block_number || ev.blockchain?.block_number || 'N/A';
                const evTx = ev.blockchain_tx_hash || ev.blockchain?.tx_hash || 'N/A';
                const evStatus = ev.blockchain_status || (ev.processing_status === 'completed' ? 'registered' : ev.processing_status || 'pending');
                const evTime = ev.uploaded_at || ev.upload_time;

                return (
                  <tr key={evId} className="hover:bg-[#121824] transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-crimson-400" />
                        <span>{evId}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={evFilename}>
                        {evFilename}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="text-slate-200">{evFileType}</div>
                      <div className="text-[10px] text-slate-400">{formatBytes(ev.file_size || 0)}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-300 font-mono select-all">
                          {(ev.sha256_hash || 'SHA256-PENDING').slice(0, 12)}...{(ev.sha256_hash || '').slice(-8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(ev.sha256_hash || '')}
                          className="text-slate-500 hover:text-crimson-300 p-1"
                          title="Copy full SHA-256 hash"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedHash === ev.sha256_hash && (
                          <span className="text-[10px] text-emerald-400">COPIED</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Intake: {evTime ? new Date(evTime).toLocaleString() : 'N/A'}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ETH BLOCK #{evBlock}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        TX: {evTx.slice(0, 10)}...
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          evStatus === 'CONFIRMED' || evStatus === 'VERIFIED' || evStatus === 'PROCESSED'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30'
                            : evStatus === 'PROCESSING' || evStatus === 'PENDING'
                            ? 'border-amber-500/40 text-amber-300 bg-amber-950/30 animate-pulse'
                            : 'border-rose-500/40 text-rose-300 bg-rose-950/30'
                        }`}
                      >
                        {evStatus}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onInspectIntegrity(evId)}
                        className="px-2.5 py-1.5 rounded border border-crimson-500/40 text-crimson-300 hover:bg-crimson-950/50 text-[11px] transition-colors"
                      >
                        AUDIT INTEGRITY
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="IMMUTABLE EVIDENCE REPORT"
        subtitle="Export cryptographically attested chain of custody evidence records and on-chain verification logs"
        recordCount={filteredEvidence.length}
        onExportJSON={handleExportEvidenceJSON}
        onExportCSV={handleExportEvidenceCSV}
        details={[
          { label: 'Active Case Reference', value: activeCase ? `${activeCase.case_number} (${activeCase.title})` : 'All Cases' },
          { label: 'Custody Filter', value: statusFilter },
          { label: 'Investigator', value: user?.full_name || 'Authorized Lead Investigator' },
          { label: 'Hash Verification', value: 'SHA-256 / Merkle Attested' }
        ]}
      />
    </div>
  );
};
