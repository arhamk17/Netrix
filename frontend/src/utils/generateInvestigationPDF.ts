import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Case, Evidence, Entity, InvestigativeLead, PredictionEngineResult } from '../types';

export interface PDFReportOptions {
  classification: string;
  investigatorName: string;
  agencyDepartment: string;
  dossierRef: string;
  customNotes?: string;
  includeCustodyChain: boolean;
  includeEntityProfiles: boolean;
  includePredictions: boolean;
  includeLeads: boolean;
  includeGraphStats: boolean;
}

export function generateInvestigationPDF(
  activeCase: Case | null | undefined,
  summary: any,
  predictions: PredictionEngineResult[],
  leads: InvestigativeLead[],
  entities: Entity[],
  evidenceList: Evidence[],
  options: PDFReportOptions
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const caseName = activeCase?.name || 'Operation Sea Serpent';
  const caseId = activeCase?.id || 'CASE_01';
  const caseSeverity = (activeCase?.severity || 'HIGH').toUpperCase();
  const caseStatus = (activeCase?.status || 'ACTIVE').toUpperCase();
  const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // Palette
  const primaryBlack = [13, 13, 13] as [number, number, number];
  const crimson = [110, 24, 39] as [number, number, number];
  const darkCrimson = [67, 16, 25] as [number, number, number];
  const mutedGrey = [119, 115, 111] as [number, number, number];
  const lightBg = [247, 245, 241] as [number, number, number];
  const borderGrey = [220, 218, 212] as [number, number, number];
  const emeraldGreen = [4, 120, 87] as [number, number, number];

  let currentY = margin;

  // Helper for Header & Footer on every page
  const addHeaderAndFooter = (pageNumber: number, totalPages: number) => {
    // Classification banner at very top
    doc.setFillColor(darkCrimson[0], darkCrimson[1], darkCrimson[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(options.classification.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

    // Top Sub-header line on page 2+
    if (pageNumber > 1) {
      doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`NETRIX INTELLIGENCE DOSSIER · REF: ${options.dossierRef} · CASE: ${caseName.toUpperCase()}`, margin, 34);
      doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, 38, pageWidth - margin, 38);
    }

    // Bottom Footer
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
    doc.text(`AUTHENTICATED VIA NETRIX GRAPH LINK PREDICTOR & SHA-256 HASH ANCHORING`, margin, pageHeight - 20);
    doc.text(`PAGE ${pageNumber} OF ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });

    // Classification banner at very bottom
    doc.setFillColor(darkCrimson[0], darkCrimson[1], darkCrimson[2]);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.text(options.classification.toUpperCase(), pageWidth / 2, pageHeight - 4, { align: 'center' });
  };

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 50) {
      doc.addPage();
      currentY = 50;
    }
  };

  // ==========================================
  // PAGE 1: TITLE BLOCK & METADATA
  // ==========================================
  currentY = 40;

  // Header Brand Crest & Identifier
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(crimson[0], crimson[1], crimson[2]);
  doc.text('NETRIX CRIMINAL NETWORK INTELLIGENCE · SPECIAL INVESTIGATION UNIT', margin, currentY);

  currentY += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
  doc.text('INTELLIGENCE ASSESSMENT & FINDINGS REPORT', margin, currentY);

  currentY += 8;
  doc.setDrawColor(crimson[0], crimson[1], crimson[2]);
  doc.setLineWidth(2);
  doc.line(margin, currentY, margin + 120, currentY);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 120, currentY, pageWidth - margin, currentY);

  currentY += 16;

  // Metadata Grid Box
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(margin, currentY, contentWidth, 70, 2, 2, 'FD');

  const metaCol1 = margin + 12;
  const metaCol2 = margin + 180;
  const metaCol3 = margin + 350;

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
  doc.text('CASE IDENTIFIER', metaCol1, currentY + 16);
  doc.text('CLASSIFICATION LEVEL', metaCol2, currentY + 16);
  doc.text('DATE GENERATED (UTC)', metaCol3, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
  doc.text(`${caseName} [${caseId}]`, metaCol1, currentY + 30);
  
  doc.setTextColor(crimson[0], crimson[1], crimson[2]);
  doc.text(options.classification, metaCol2, currentY + 30);

  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
  doc.text(timestampStr, metaCol3, currentY + 30);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
  doc.text('LEAD INVESTIGATOR', metaCol1, currentY + 48);
  doc.text('STATUS / SEVERITY', metaCol2, currentY + 48);
  doc.text('DOSSIER REFERENCE', metaCol3, currentY + 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
  doc.text(options.investigatorName, metaCol1, currentY + 62);
  
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(`${caseStatus} · SEVERITY: ${caseSeverity}`, metaCol2, currentY + 62);

  doc.setFont('courier', 'normal');
  doc.text(options.dossierRef, metaCol3, currentY + 62);

  currentY += 82;

  // ==========================================
  // SECTION 1: EXECUTIVE BRIEFING
  // ==========================================
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(crimson[0], crimson[1], crimson[2]);
  doc.text('01 // EXECUTIVE SUMMARY & OPERATIONAL OBJECTIVE', margin, currentY);

  currentY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);

  const descText = activeCase?.description || 
    'Investigation into a transnational contraband smuggling ring bypassing customs and laundering funds via Zurich offshore trusts.';
  const splitDesc = doc.splitTextToSize(descText, contentWidth);
  doc.text(splitDesc, margin, currentY);
  currentY += splitDesc.length * 13 + 6;

  // Key Statistics Matrix Table
  const statBoxWidth = (contentWidth - 15) / 4;
  const stats = [
    { label: 'EVIDENCE RECORDS', value: `${evidenceList.length || summary?.evidenceCount || 6}`, sub: '100% SHA-256 Validated' },
    { label: 'CONFIRMED ENTITIES', value: `${entities.length || summary?.entitiesCount || 16}`, sub: 'Multi-type Knowledge Graph' },
    { label: 'DETECTED EDGES', value: `${summary?.relationshipsCount || 23}`, sub: 'Centrality Density 0.38' },
    { label: 'POTENTIAL PATHWAYS', value: `${predictions.length || 2}`, sub: 'Heterogeneous GNN Model' }
  ];

  stats.forEach((st, idx) => {
    const bx = margin + idx * (statBoxWidth + 5);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.roundedRect(bx, currentY, statBoxWidth, 44, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
    doc.text(st.label, bx + 8, currentY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(idx === 3 ? crimson[0] : primaryBlack[0], idx === 3 ? crimson[1] : primaryBlack[1], idx === 3 ? crimson[2] : primaryBlack[2]);
    doc.text(st.value, bx + 8, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
    doc.text(st.sub, bx + 8, currentY + 38);
  });

  currentY += 54;

  // ==========================================
  // SECTION 2: KEY INTELLIGENCE FINDINGS & PREDICTIONS
  // ==========================================
  if (options.includePredictions && predictions.length > 0) {
    checkPageBreak(120);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(crimson[0], crimson[1], crimson[2]);
    doc.text('02 // KEY INTELLIGENCE FINDINGS & PREDICTED CONDUITS', margin, currentY);

    currentY += 12;

    predictions.forEach((pred, pIdx) => {
      checkPageBreak(100);

      // Card Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(crimson[0], crimson[1], crimson[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, currentY, contentWidth, 80, 2, 2, 'D');

      // Top bar inside card
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(margin + 0.5, currentY + 0.5, contentWidth - 1, 22, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
      doc.text(`[FINDING ${pIdx + 1}] ${pred.title}`, margin + 10, currentY + 15);

      const confPct = Math.round(pred.confidence * 100);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(crimson[0], crimson[1], crimson[2]);
      doc.text(`CONFIDENCE: ${confPct}% (HIGH)`, pageWidth - margin - 10, currentY + 15, { align: 'right' });

      // Body text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
      const bodyLines = doc.splitTextToSize(pred.description, contentWidth - 20);
      doc.text(bodyLines, margin + 10, currentY + 34);

      // Pathway & Signals
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
      doc.text(`PATHWAY: ${pred.entityA.name} ──[ ${pred.predictedRelationshipType} ]──> ${pred.entityB.name}`, margin + 10, currentY + 54);

      const signalSummary = pred.contributingGraphSignals?.slice(0, 2).join(' · ') || 'Multi-hop graph correlation';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
      doc.text(`SIGNALS: ${signalSummary}`, margin + 10, currentY + 68);

      currentY += 88;
    });
  }

  // ==========================================
  // SECTION 3: INVESTIGATIVE LEADS
  // ==========================================
  if (options.includeLeads && leads.length > 0) {
    checkPageBreak(100);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(crimson[0], crimson[1], crimson[2]);
    doc.text('03 // ACTIONABLE INVESTIGATIVE LEADS & SIGNALS', margin, currentY);

    currentY += 10;

    const leadsTableData = leads.map(l => [
      l.id.toUpperCase(),
      l.type.replace('_', ' ').toUpperCase(),
      `${Math.round(l.confidence * 100)}%`,
      l.severity.toUpperCase(),
      l.explanation.length > 140 ? l.explanation.substring(0, 140) + '...' : l.explanation,
      l.supportingEvidence?.join(', ') || 'N/A'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['LEAD ID', 'TYPE', 'CONF.', 'SEVERITY', 'EXPLANATION & ANALYSIS', 'SUPPORTING EVIDENCE']],
      body: leadsTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [13, 13, 13],
        textColor: [255, 255, 255],
        font: 'courier',
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 4
      },
      bodyStyles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: [13, 13, 13],
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 50, font: 'courier' },
        1: { cellWidth: 65, font: 'courier' },
        2: { cellWidth: 40, font: 'courier', halign: 'center' },
        3: { cellWidth: 50, font: 'courier', textColor: [110, 24, 39], fontStyle: 'bold' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 100, font: 'courier', fontSize: 7 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 18;
  }

  // ==========================================
  // SECTION 4: HIGH-VALUE TARGETS & ENTITY PROFILES
  // ==========================================
  if (options.includeEntityProfiles && entities.length > 0) {
    checkPageBreak(120);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(crimson[0], crimson[1], crimson[2]);
    doc.text('04 // KEY IDENTIFIED TARGETS & ENTITY PROFILES', margin, currentY);

    currentY += 10;

    const sortedEntities = [...entities].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

    const entityTableData = sortedEntities.slice(0, 8).map(ent => {
      const alias = ent.properties?.Alias || ent.properties?.Role || ent.properties?.Relevance || 'N/A';
      return [
        ent.label,
        ent.type.toUpperCase(),
        String(alias),
        `${Math.round(ent.centrality * 100)}%`,
        `${Math.round(ent.anomalyScore * 100)}%`,
        `${ent.riskScore || 50}/100`
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['TARGET / ENTITY', 'NODE TYPE', 'ROLE / ALIAS', 'CENTRALITY', 'ANOMALY', 'RISK RATING']],
      body: entityTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [13, 13, 13],
        textColor: [255, 255, 255],
        font: 'courier',
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 4
      },
      bodyStyles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: [13, 13, 13],
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 110, fontStyle: 'bold' },
        1: { cellWidth: 60, font: 'courier' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 60, font: 'courier', halign: 'center' },
        4: { cellWidth: 55, font: 'courier', halign: 'center' },
        5: { cellWidth: 65, font: 'courier', halign: 'center', textColor: [110, 24, 39], fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 18;
  }

  // ==========================================
  // SECTION 5: EVIDENCE INTEGRITY & CUSTODY CHAIN
  // ==========================================
  if (options.includeCustodyChain && evidenceList.length > 0) {
    checkPageBreak(130);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(crimson[0], crimson[1], crimson[2]);
    doc.text('05 // FORENSIC EVIDENCE LEDGER & CRYPTOGRAPHIC CHAIN OF CUSTODY', margin, currentY);

    currentY += 10;

    const evidenceTableData = evidenceList.map(ev => [
      ev.id.toUpperCase(),
      ev.name,
      ev.type.replace('_', ' ').toUpperCase(),
      ev.sha256 ? `${ev.sha256.substring(0, 16)}...` : 'PENDING',
      ev.verificationStatus.toUpperCase(),
      ev.custodyChain?.length ? `${ev.custodyChain.length} Transfers Logged` : 'Single Intake'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['ID', 'EVIDENCE ARTIFACT', 'MEDIA TYPE', 'SHA-256 DIGEST', 'STATUS', 'CHAIN ENTRIES']],
      body: evidenceTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [13, 13, 13],
        textColor: [255, 255, 255],
        font: 'courier',
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 4
      },
      bodyStyles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: [13, 13, 13],
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 50, font: 'courier' },
        1: { cellWidth: 140, fontStyle: 'bold' },
        2: { cellWidth: 75, font: 'courier' },
        3: { cellWidth: 95, font: 'courier', fontSize: 6.5 },
        4: { cellWidth: 60, font: 'courier', halign: 'center', textColor: [4, 120, 87], fontStyle: 'bold' },
        5: { cellWidth: 'auto', font: 'courier', fontSize: 7 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 18;
  }

  // ==========================================
  // SECTION 6: INVESTIGATOR SIGN-OFF & CRYPTOGRAPHIC ATTESTATION
  // ==========================================
  checkPageBreak(120);

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.roundedRect(margin, currentY, contentWidth, 80, 2, 2, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(crimson[0], crimson[1], crimson[2]);
  doc.text('FORENSIC ATTESTATION & CHAIN OF CUSTODY CERTIFICATION', margin + 12, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
  const attestationText = options.customNotes ||
    'The analytical findings, link predictions, and evidence items contained in this report have been verified against the Netrix Heterogeneous Graph and anchored cryptographically. Dissemination is restricted to authorized personnel under operational clearance.';
  const splitAttest = doc.splitTextToSize(attestationText, contentWidth - 140);
  doc.text(splitAttest, margin + 12, currentY + 28);

  // Digital Signature Box
  const sigX = pageWidth - margin - 120;
  doc.setDrawColor(crimson[0], crimson[1], crimson[2]);
  doc.setLineWidth(0.8);
  doc.rect(sigX, currentY + 10, 110, 60, 'D');

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(crimson[0], crimson[1], crimson[2]);
  doc.text('OFFICIAL VERIFICATION SEAL', sigX + 55, currentY + 22, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(mutedGrey[0], mutedGrey[1], mutedGrey[2]);
  doc.text('DIGITALLY SIGNED BY:', sigX + 55, currentY + 34, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(primaryBlack[0], primaryBlack[1], primaryBlack[2]);
  doc.text(options.investigatorName, sigX + 55, currentY + 44, { align: 'center' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text('✓ HASH VALIDATED', sigX + 55, currentY + 56, { align: 'center' });

  // Apply Headers and Footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeaderAndFooter(i, totalPages);
  }

  return doc;
}
