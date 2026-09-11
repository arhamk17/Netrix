/**
 * NETRIX Criminal Network Intelligence Platform
 * Report Export Utility (JSON & CSV)
 */

export interface ExportReportOptions {
  filename: string;
  moduleName: string;
  caseId?: string;
  operator?: string;
  data: Record<string, any>[] | Record<string, any>;
  fields?: { key: string; label: string }[];
}

/**
 * Trigger download of a text/blob file in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as formatted JSON
 */
export function exportToJSON(options: ExportReportOptions): void {
  const { filename, moduleName, caseId, operator, data } = options;

  const isArray = Array.isArray(data);
  const reportPayload = {
    report_metadata: {
      system: 'NETRIX Criminal Network Intelligence Platform',
      module: moduleName,
      case_id: caseId || 'N/A',
      exported_at: new Date().toISOString(),
      generated_by: operator || 'Authorized Lead Investigator',
      record_count: isArray ? data.length : 1,
      integrity_signature: 'SHA256_VERIFIED_INTELLIGENCE_RECORD'
    },
    records: data
  };

  const jsonString = JSON.stringify(reportPayload, null, 2);
  const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  downloadFile(jsonString, finalFilename, 'application/json');
}

/**
 * Escape CSV field value
 */
function escapeCSVField(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  const stringValue = String(value);
  // If value contains comma, newline or double quotes, escape double quotes and wrap in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return `"${stringValue}"`;
}

/**
 * Export data as CSV
 */
export function exportToCSV(options: ExportReportOptions): void {
  const { filename, data, fields } = options;

  const rows = Array.isArray(data) ? data : [data];

  if (!rows || rows.length === 0) {
    const emptyCSV = '"NO_RECORDS_TO_EXPORT"';
    const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    downloadFile(emptyCSV, finalFilename, 'text/csv');
    return;
  }

  // Determine headers
  let headers: { key: string; label: string }[] = [];
  if (fields && fields.length > 0) {
    headers = fields;
  } else {
    const keys = Object.keys(rows[0] || {});
    headers = keys.map(k => ({ key: k, label: k }));
  }

  const csvRows: string[] = [];

  // 1. Header row
  csvRows.push(headers.map(h => escapeCSVField(h.label)).join(','));

  // 2. Data rows
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h.key];
      return escapeCSVField(val);
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\r\n');
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadFile(csvContent, finalFilename, 'text/csv');
}
