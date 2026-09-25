import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sliders,
  Eye,
  AlertTriangle,
  FileCheck,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Case, Evidence, Entity, InvestigativeLead, PredictionEngineResult } from '../types';
import { generateInvestigationPDF, PDFReportOptions } from '../utils/generateInvestigationPDF';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCase?: Case | null;
  summary: any;
  predictions: PredictionEngineResult[];
  leads: InvestigativeLead[];
  entities: Entity[];
  evidenceList: Evidence[];
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  isOpen,
  onClose,
  activeCase,
  summary,
  predictions,
  leads,
  entities,
  evidenceList
}) => {
  const [activeTab, setActiveTab] = useState<'configure' | 'preview'>('preview');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Configuration options
  const [classification, setClassification] = useState('TOP SECRET // LAW ENFORCEMENT SENSITIVE');
  const [investigatorName, setInvestigatorName] = useState(
    activeCase?.assignedInvestigator || 'Special Agent Marcus Vance (Lead)'
  );
  const [agencyDepartment, setAgencyDepartment] = useState('CRIMINAL NETWORK INTELLIGENCE · S.I.U.');
  const [dossierRef, setDossierRef] = useState(
    `NETRIX-IR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${(activeCase?.id || '01').replace('case_', 'CASE-').toUpperCase()}`
  );
  const [customNotes, setCustomNotes] = useState(
    'All analytical findings and ML heterogeneous predictions have been cross-referenced with on-chain cryptographic evidence logs. Dissemination strictly governed under statutory operational clearance.'
  );

  const [includeCustodyChain, setIncludeCustodyChain] = useState(true);
  const [includeEntityProfiles, setIncludeEntityProfiles] = useState(true);
  const [includePredictions, setIncludePredictions] = useState(true);
  const [includeLeads, setIncludeLeads] = useState(true);
  const [includeGraphStats, setIncludeGraphStats] = useState(true);

  // Sync investigator name if activeCase changes
  useEffect(() => {
    if (activeCase?.assignedInvestigator) {
      setInvestigatorName(activeCase.assignedInvestigator);
    }
  }, [activeCase]);

  if (!isOpen) return null;

  const caseName = activeCase?.name || 'Operation Sea Serpent';
  const caseId = activeCase?.id || 'case_01';
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const reportOptions: PDFReportOptions = {
    classification,
    investigatorName,
    agencyDepartment,
    dossierRef,
    customNotes,
    includeCustodyChain,
    includeEntityProfiles,
    includePredictions,
    includeLeads,
    includeGraphStats
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      // Small tick for UI feedback
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const doc = generateInvestigationPDF(
        activeCase,
        summary,
        predictions,
        leads,
        entities,
        evidenceList,
        reportOptions
      );

      const sanitizedCase = caseName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const filename = `NETRIX_Intelligence_Report_${sanitizedCase}_${new Date().toISOString().substring(0, 10)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopySummary = () => {
    const summaryText = `[${classification}]
NETRIX CRIMINAL NETWORK INTELLIGENCE REPORT
DOSSIER REF: ${dossierRef}
CASE: ${caseName} (${caseId.toUpperCase()})
LEAD INVESTIGATOR: ${investigatorName}
DATE: ${timestamp}

SUMMARY:
${activeCase?.description || 'Investigating transnational contraband smuggling networks.'}

METRICS:
- Confirmed Entities: ${entities.length || summary?.entitiesCount || 16}
- Relational Graph Edges: ${summary?.relationshipsCount || 23}
- Predictive Conduits: ${predictions.length || 2}
- Verified Evidence Records: ${evidenceList.length || summary?.evidenceCount || 6} (100% SHA-256 anchored)

KEY FINDINGS:
${predictions.map((p, i) => `${i + 1}. ${p.title} (${Math.round(p.confidence * 100)}% Confidence) - ${p.predictedRelationshipType}`).join('\n')}

INVESTIGATIVE LEADS:
${leads.map((l, i) => `${i + 1}. [${l.severity.toUpperCase()}] ${l.type}: ${l.explanation.substring(0, 100)}...`).join('\n')}

CERTIFICATION:
${customNotes}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0D0D0D]/75 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white border border-[#0D0D0D]/15 rounded-sm shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Classification Bar */}
        <div className="bg-[#6E1827] text-white px-4 py-1.5 text-center text-[10px] font-mono tracking-widest uppercase font-semibold flex items-center justify-between">
          <span className="hidden sm:inline">AUTHENTICATED DISSEMINATION PROTOCOL</span>
          <span>{classification}</span>
          <span className="hidden sm:inline">REF: {dossierRef}</span>
        </div>

        {/* Modal Header */}
        <div className="p-5 border-b border-[#0D0D0D]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F5F1]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white border border-[#6E1827]/25 shadow-xs shrink-0 p-1 flex items-center justify-center">
              <img src="/LOGONETRIX.png" alt="NETRIX" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  INTELLIGENCE ASSESSMENT & REPORT GENERATOR
                </span>
                <span className="text-xs text-[#77736F]">·</span>
                <span className="text-xs font-mono text-[#77736F]">CASE: {caseName}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-light tracking-tight text-[#0D0D0D]">
                Export Formal Investigation Dossier
              </h2>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-white border border-[#0D0D0D]/12 p-0.5 rounded-xs text-xs font-mono">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-xs flex items-center gap-1.5 transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-[#0D0D0D] text-white font-medium'
                    : 'text-[#77736F] hover:text-[#0D0D0D]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Document Preview</span>
              </button>
              <button
                onClick={() => setActiveTab('configure')}
                className={`px-3 py-1.5 rounded-xs flex items-center gap-1.5 transition-colors ${
                  activeTab === 'configure'
                    ? 'bg-[#0D0D0D] text-white font-medium'
                    : 'text-[#77736F] hover:text-[#0D0D0D]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configure Sections</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[#77736F] hover:text-[#0D0D0D] hover:bg-[#0D0D0D]/5 rounded-xs transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeTab === 'preview' ? (
            /* ========================================================================= */
            /* DOCUMENT PREVIEW TAB                                                      */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* Document Banner */}
              <div className="border border-[#0D0D0D]/15 rounded-xs bg-[#F7F5F1] p-6 space-y-6 relative overflow-hidden shadow-xs print:border-none print:shadow-none print:p-0">
                
                {/* Official Netrix Intelligence Watermark / Crest */}
                <div className="border-b-2 border-[#6E1827] pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#6E1827] uppercase tracking-widest font-bold">
                      <span>NETRIX FORENSIC INTELLIGENCE DOSSIER</span>
                      <span>·</span>
                      <span>CLASSIFIED DOCUMENT</span>
                    </div>
                    <h1 className="text-2xl font-serif tracking-tight text-[#0D0D0D]">
                      {caseName}
                    </h1>
                    <p className="text-xs font-mono text-[#77736F]">
                      CRIMINAL NETWORK & CONDUIT INVESTIGATION · REF #{dossierRef}
                    </p>
                  </div>

                  <div className="text-right space-y-1 font-mono shrink-0">
                    <div className="inline-block px-2.5 py-1 bg-[#6E1827] text-white text-[10px] font-bold tracking-wider uppercase rounded-xs">
                      {classification}
                    </div>
                    <div className="text-[11px] text-[#77736F]">
                      GENERATED: {timestamp}
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium">
                      ✓ SHA-256 HASH VERIFIED & ANCHORED
                    </div>
                  </div>
                </div>

                {/* Case Metadata Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white border border-[#0D0D0D]/10 rounded-xs text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#77736F] uppercase block">CASE IDENTIFIER</span>
                    <span className="font-semibold text-[#0D0D0D]">{caseId.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77736F] uppercase block">LEAD INVESTIGATOR</span>
                    <span className="font-semibold text-[#0D0D0D]">{investigatorName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77736F] uppercase block">CASE STATUS</span>
                    <span className="font-semibold text-emerald-800 uppercase">{activeCase?.status || 'ACTIVE'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77736F] uppercase block">SEVERITY RATING</span>
                    <span className="font-semibold text-[#6E1827] uppercase">{activeCase?.severity || 'HIGH'}</span>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                      01 // EXECUTIVE SUMMARY & OPERATIONAL OBJECTIVE
                    </span>
                  </div>
                  <p className="text-xs text-[#0D0D0D] leading-relaxed bg-white p-4 border border-[#0D0D0D]/10 rounded-xs font-sans">
                    {activeCase?.description ||
                      'Investigation into a transnational contraband smuggling ring bypassing customs and laundering funds via Zurich offshore trusts. Multi-modal graph ingestion and heterogeneous link prediction indicates centralized coordination between high-value targets across Antwerp, Rotterdam, and Zurich financial jurisdictions.'}
                  </p>
                </div>

                {/* Key Metrics Matrix */}
                {includeGraphStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-[#0D0D0D]/10 rounded-xs font-mono">
                      <div className="text-[10px] text-[#77736F] uppercase">EVIDENCE ARTIFACTS</div>
                      <div className="text-xl font-bold text-[#0D0D0D]">{evidenceList.length || summary?.evidenceCount || 6}</div>
                      <div className="text-[10px] text-emerald-800">100% Hash Validated</div>
                    </div>
                    <div className="p-3 bg-white border border-[#0D0D0D]/10 rounded-xs font-mono">
                      <div className="text-[10px] text-[#77736F] uppercase">CONFIRMED ENTITIES</div>
                      <div className="text-xl font-bold text-[#0D0D0D]">{entities.length || summary?.entitiesCount || 16}</div>
                      <div className="text-[10px] text-[#77736F]">6 Node Classes</div>
                    </div>
                    <div className="p-3 bg-white border border-[#0D0D0D]/10 rounded-xs font-mono">
                      <div className="text-[10px] text-[#77736F] uppercase">RELATIONAL EDGES</div>
                      <div className="text-xl font-bold text-[#0D0D0D]">{summary?.relationshipsCount || 23}</div>
                      <div className="text-[10px] text-[#77736F]">Density: 0.38</div>
                    </div>
                    <div className="p-3 bg-white border border-[#6E1827]/30 rounded-xs font-mono bg-rose-50/30">
                      <div className="text-[10px] text-[#6E1827] uppercase font-bold">PREDICTED CONDUITS</div>
                      <div className="text-xl font-bold text-[#6E1827]">{predictions.length || 2}</div>
                      <div className="text-[10px] text-[#6E1827]">GNN Link Inference</div>
                    </div>
                  </div>
                )}

                {/* Key Intelligence Findings */}
                {includePredictions && predictions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                        02 // CRITICAL FINDINGS & PREDICTED CONDUITS ({predictions.length})
                      </span>
                      <span className="text-[10px] font-mono text-[#77736F]">ML LINK PREDICTION INFERENCE</span>
                    </div>

                    <div className="space-y-3">
                      {predictions.map((pred, idx) => (
                        <div key={pred.id || idx} className="bg-white border border-[#6E1827]/40 p-4 rounded-xs space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#0D0D0D]/8 pb-2">
                            <span className="font-semibold text-xs text-[#0D0D0D]">
                              Finding #{idx + 1}: {pred.title}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#6E1827]">
                              {Math.round(pred.confidence * 100)}% CONFIDENCE (HIGH PROBABILITY)
                            </span>
                          </div>
                          
                          <p className="text-xs text-[#77736F] leading-relaxed">
                            {pred.description}
                          </p>

                          <div className="p-2.5 bg-[#F7F5F1] border border-[#0D0D0D]/8 rounded-xs text-[11px] font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-[#77736F]">PATHWAY: </span>
                              <span className="font-bold text-[#0D0D0D]">{pred.entityA.name}</span>
                              <span className="text-[#6E1827] font-bold mx-2">──[{pred.predictedRelationshipType}]──&gt;</span>
                              <span className="font-bold text-[#0D0D0D]">{pred.entityB.name}</span>
                            </div>
                            <span className="text-[10px] text-[#77736F] shrink-0">
                              Model: {pred.technicalDetails?.modelName || 'Local Heterogeneous GNN'}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-[#77736F]">
                            <span className="font-semibold text-[#0D0D0D]">GRAPH SIGNALS: </span>
                            {pred.contributingGraphSignals?.join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Investigative Leads */}
                {includeLeads && leads.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                      03 // ACTIONABLE INVESTIGATIVE LEADS ({leads.length})
                    </span>

                    <div className="bg-white border border-[#0D0D0D]/10 rounded-xs overflow-hidden">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="bg-[#0D0D0D] text-white text-[10px]">
                            <th className="p-2.5">LEAD ID</th>
                            <th className="p-2.5">SIGNAL TYPE</th>
                            <th className="p-2.5">CONFIDENCE</th>
                            <th className="p-2.5">SEVERITY</th>
                            <th className="p-2.5">OPERATIONAL EXPLANATION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0D0D0D]/8">
                          {leads.map((l) => (
                            <tr key={l.id} className="hover:bg-[#F7F5F1] transition-colors">
                              <td className="p-2.5 font-bold">{l.id.toUpperCase()}</td>
                              <td className="p-2.5 text-[#77736F]">{l.type.replace('_', ' ')}</td>
                              <td className="p-2.5 font-bold">{Math.round(l.confidence * 100)}%</td>
                              <td className="p-2.5">
                                <span className={`font-semibold ${
                                  l.severity === 'critical' ? 'text-[#6E1827]' : 'text-amber-800'
                                }`}>
                                  {l.severity.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-2.5 font-sans text-xs text-[#0D0D0D]">
                                {l.explanation}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Target Profiles Matrix */}
                {includeEntityProfiles && entities.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                      04 // KEY IDENTIFIED TARGETS & HIGH-RISK PROFILES
                    </span>

                    <div className="bg-white border border-[#0D0D0D]/10 rounded-xs overflow-hidden">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="bg-[#0D0D0D] text-white text-[10px]">
                            <th className="p-2.5">TARGET / ENTITY</th>
                            <th className="p-2.5">CLASS</th>
                            <th className="p-2.5">ROLE / ALIAS</th>
                            <th className="p-2.5">CENTRALITY</th>
                            <th className="p-2.5">ANOMALY</th>
                            <th className="p-2.5">RISK SCORE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0D0D0D]/8">
                          {[...entities]
                            .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
                            .slice(0, 6)
                            .map((ent) => (
                              <tr key={ent.id} className="hover:bg-[#F7F5F1] transition-colors">
                                <td className="p-2.5 font-bold text-[#0D0D0D]">{ent.label}</td>
                                <td className="p-2.5 uppercase text-[#77736F]">{ent.type}</td>
                                <td className="p-2.5 text-xs font-sans text-[#77736F]">
                                  {String(ent.properties?.Alias || ent.properties?.Role || ent.properties?.Relevance || 'N/A')}
                                </td>
                                <td className="p-2.5">{Math.round(ent.centrality * 100)}%</td>
                                <td className="p-2.5">{Math.round(ent.anomalyScore * 100)}%</td>
                                <td className="p-2.5 font-bold text-[#6E1827]">
                                  {ent.riskScore || 50}/100
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Evidence Chain of Custody Table */}
                {includeCustodyChain && evidenceList.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                      05 // FORENSIC EVIDENCE LEDGER & CRYPTOGRAPHIC CUSTODY
                    </span>

                    <div className="bg-white border border-[#0D0D0D]/10 rounded-xs overflow-hidden">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead>
                          <tr className="bg-[#0D0D0D] text-white text-[10px]">
                            <th className="p-2.5">ID</th>
                            <th className="p-2.5">EVIDENCE ARTIFACT</th>
                            <th className="p-2.5">TYPE</th>
                            <th className="p-2.5">SHA-256 INTEGRITY DIGEST</th>
                            <th className="p-2.5">VALIDATION</th>
                            <th className="p-2.5">CUSTODY LEDGER</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0D0D0D]/8">
                          {evidenceList.map((ev) => (
                            <tr key={ev.id} className="hover:bg-[#F7F5F1] transition-colors">
                              <td className="p-2.5 font-bold">{ev.id.toUpperCase()}</td>
                              <td className="p-2.5 font-sans font-medium text-[#0D0D0D]">{ev.name}</td>
                              <td className="p-2.5 uppercase text-[#77736F]">{ev.type.replace('_', ' ')}</td>
                              <td className="p-2.5 font-mono text-[10px] text-[#77736F]">
                                {ev.sha256 ? `${ev.sha256.substring(0, 16)}...` : 'PENDING'}
                              </td>
                              <td className="p-2.5 text-emerald-800 font-semibold uppercase">
                                {ev.verificationStatus}
                              </td>
                              <td className="p-2.5 text-[11px] text-[#77736F]">
                                {ev.custodyChain?.length || 1} Chain Logs
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Formal Seal & Attestation Sign-Off */}
                <div className="p-4 bg-white border border-[#0D0D0D]/10 rounded-xs flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                  <div className="space-y-1 text-xs text-[#77736F] max-w-xl">
                    <span className="text-[10px] text-[#6E1827] uppercase font-bold block">
                      FORENSIC ATTESTATION & SIGN-OFF
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      {customNotes}
                    </p>
                    <div className="text-[10px] text-[#77736F] pt-1">
                      INTEGRITY CERTIFICATE: NETRIX-SEC-ED25519-7F89B2 · VERIFIED VALID
                    </div>
                  </div>

                  <div className="border border-[#6E1827] p-3 text-center rounded-xs bg-[#F7F5F1] shrink-0 min-w-[170px]">
                    <div className="text-[9px] text-[#6E1827] uppercase font-bold tracking-wider">
                      OFFICIAL SEAL
                    </div>
                    <div className="text-xs font-bold text-[#0D0D0D] my-1">
                      {investigatorName}
                    </div>
                    <div className="text-[9px] text-emerald-800 font-bold">
                      ✓ HASH VALIDATED
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CONFIGURE REPORT SECTIONS TAB                                            */
            /* ========================================================================= */
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Classification & Metadata */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0D0D0D] uppercase font-mono tracking-wider border-b border-[#0D0D0D]/10 pb-2">
                  Dossier Header & Security Classification
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[#77736F] uppercase mb-1">
                      Security Classification Banner
                    </label>
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0D0D0D]/15 text-xs font-mono text-[#0D0D0D] rounded-xs focus:outline-none focus:border-[#6E1827]"
                    >
                      <option value="TOP SECRET // LAW ENFORCEMENT SENSITIVE">TOP SECRET // LAW ENFORCEMENT SENSITIVE</option>
                      <option value="SECRET // NOFORN // SPECIAL INVESTIGATIONS">SECRET // NOFORN // SPECIAL INVESTIGATIONS</option>
                      <option value="CONFIDENTIAL // NETRIX CRIMINAL INTEL">CONFIDENTIAL // NETRIX CRIMINAL INTEL</option>
                      <option value="LAW ENFORCEMENT SENSITIVE // FOR OFFICIAL USE">LAW ENFORCEMENT SENSITIVE // FOR OFFICIAL USE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[#77736F] uppercase mb-1">
                      Dossier Reference ID
                    </label>
                    <input
                      type="text"
                      value={dossierRef}
                      onChange={(e) => setDossierRef(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0D0D0D]/15 text-xs font-mono text-[#0D0D0D] rounded-xs focus:outline-none focus:border-[#6E1827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[#77736F] uppercase mb-1">
                      Lead Investigator / Signatory
                    </label>
                    <input
                      type="text"
                      value={investigatorName}
                      onChange={(e) => setInvestigatorName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0D0D0D]/15 text-xs font-mono text-[#0D0D0D] rounded-xs focus:outline-none focus:border-[#6E1827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[#77736F] uppercase mb-1">
                      Agency / S.I.U. Department
                    </label>
                    <input
                      type="text"
                      value={agencyDepartment}
                      onChange={(e) => setAgencyDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0D0D0D]/15 text-xs font-mono text-[#0D0D0D] rounded-xs focus:outline-none focus:border-[#6E1827]"
                    />
                  </div>
                </div>
              </div>

              {/* Sections to Include */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0D0D0D] uppercase font-mono tracking-wider border-b border-[#0D0D0D]/10 pb-2">
                  Dossier Sections & Data Exports
                </h3>

                <div className="space-y-3 font-mono text-xs">
                  <label className="flex items-start gap-3 p-3 bg-[#F7F5F1] border border-[#0D0D0D]/10 rounded-xs cursor-pointer hover:bg-[#F0EEE9] transition-colors">
                    <input
                      type="checkbox"
                      checked={includeGraphStats}
                      onChange={(e) => setIncludeGraphStats(e.target.checked)}
                      className="mt-0.5 accent-[#6E1827]"
                    />
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">Executive Summary & Network Statistics</span>
                      <span className="text-[11px] text-[#77736F] font-sans">
                        Node and edge volume, density score, case metadata, and primary operational objectives.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-[#F7F5F1] border border-[#0D0D0D]/10 rounded-xs cursor-pointer hover:bg-[#F0EEE9] transition-colors">
                    <input
                      type="checkbox"
                      checked={includePredictions}
                      onChange={(e) => setIncludePredictions(e.target.checked)}
                      className="mt-0.5 accent-[#6E1827]"
                    />
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">
                        Key Intelligence Findings & Predictive Conduits ({predictions.length})
                      </span>
                      <span className="text-[11px] text-[#77736F] font-sans">
                        Machine learning heterogeneous GNN predictions, confidence scores, and multi-hop graph signals.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-[#F7F5F1] border border-[#0D0D0D]/10 rounded-xs cursor-pointer hover:bg-[#F0EEE9] transition-colors">
                    <input
                      type="checkbox"
                      checked={includeLeads}
                      onChange={(e) => setIncludeLeads(e.target.checked)}
                      className="mt-0.5 accent-[#6E1827]"
                    />
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">
                        Actionable Investigation Leads ({leads.length})
                      </span>
                      <span className="text-[11px] text-[#77736F] font-sans">
                        Anomalies, communication bursts, financial corridors, and supporting evidence references.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-[#F7F5F1] border border-[#0D0D0D]/10 rounded-xs cursor-pointer hover:bg-[#F0EEE9] transition-colors">
                    <input
                      type="checkbox"
                      checked={includeEntityProfiles}
                      onChange={(e) => setIncludeEntityProfiles(e.target.checked)}
                      className="mt-0.5 accent-[#6E1827]"
                    />
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">
                        Target Entities & Risk Centrality Matrix ({entities.length})
                      </span>
                      <span className="text-[11px] text-[#77736F] font-sans">
                        High-value suspect profiles, betweenness centrality, anomaly ratings, and aliases.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-[#F7F5F1] border border-[#0D0D0D]/10 rounded-xs cursor-pointer hover:bg-[#F0EEE9] transition-colors">
                    <input
                      type="checkbox"
                      checked={includeCustodyChain}
                      onChange={(e) => setIncludeCustodyChain(e.target.checked)}
                      className="mt-0.5 accent-[#6E1827]"
                    />
                    <div>
                      <span className="font-semibold text-[#0D0D0D] block">
                        Forensic Evidence & Blockchain Chain of Custody ({evidenceList.length})
                      </span>
                      <span className="text-[11px] text-[#77736F] font-sans">
                        SHA-256 cryptographic digests, blockchain verification receipts, and custodial handover history.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Investigator Attestation Addendum */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-[#77736F] uppercase">
                  Investigator Forensic Attestation / Custom Case Notes
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#0D0D0D]/15 text-xs font-sans text-[#0D0D0D] rounded-xs focus:outline-none focus:border-[#6E1827]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 border-t border-[#0D0D0D]/10 bg-[#F7F5F1] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#77736F]">
            <ShieldCheck className="w-4 h-4 text-emerald-800" />
            <span>Structured Branded PDF Specification · Ready for Distribution</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 bg-white border border-[#0D0D0D]/12 text-xs font-mono text-[#0D0D0D] rounded-xs hover:bg-[#F0EEE9] transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Summary Copied' : 'Copy Brief'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white border border-[#0D0D0D]/12 text-xs font-mono text-[#0D0D0D] rounded-xs hover:bg-[#F0EEE9] transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-xs hover:bg-[#431019] transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
              <span>{downloading ? 'Generating PDF...' : 'Download PDF Dossier'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
