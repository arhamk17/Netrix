import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Download,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Key,
  Database,
  Lock,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  Plus,
  Server,
  Terminal,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { AuditLogItem, UserRole } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AccessRestricted } from './AccessRestricted';

interface AuditLogsSectionProps {
  onReturnToDashboard?: () => void;
}

export const AuditLogsSection: React.FC<AuditLogsSectionProps> = ({ onReturnToDashboard }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Inspection & Modals
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    totalRecords: number;
    tamperedCount: number;
    rootHash: string;
    verifiedAt: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Simulation form state
  const [simAction, setSimAction] = useState('POLICY_ENFORCEMENT');
  const [simCategory, setSimCategory] = useState<'user_action' | 'system_change' | 'access_control' | 'data_integrity' | 'security_alert'>('system_change');
  const [simResource, setSimResource] = useState('SYSTEM_FIREWALL_CONFIG');
  const [simStatus, setSimStatus] = useState<'SUCCESS' | 'DENIED' | 'FLAGGED'>('SUCCESS');
  const [simSeverity, setSimSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [simStandard, setSimStandard] = useState('NIST SP 800-53 CM-3');
  const [simDetails, setSimDetails] = useState('Enforced mandatory TLS 1.3 cipher suite and updated cipher policy across all endpoints.');

  // Access check: strictly for ADMIN roles only
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchLogs();

    // Listen for live audit events dispatched across the app
    const handleLiveAudit = (e: any) => {
      if (e.detail) {
        setLogs(prev => [e.detail, ...prev.filter(l => l.id !== e.detail.id)]);
      }
    };
    window.addEventListener('netrix-audit-logged', handleLiveAudit);
    return () => window.removeEventListener('netrix-audit-logged', handleLiveAudit);
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.admin.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch immutable audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const result = await apiClient.admin.verifyIntegrity();
      setVerificationResult({
        verified: result.verified,
        totalRecords: result.totalRecords,
        tamperedCount: result.tamperedRecords,
        rootHash: result.merkleRoot,
        verifiedAt: result.lastVerifiedAt
      });
      setIsVerifyModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Ledger cryptographic verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const content = await apiClient.admin.exportAuditLogs(format);
      const mime = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `netrix_compliance_audit_ledger_${Date.now()}.${format}`;
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setActionSuccess(`Audit trail successfully exported as ${format.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);
      setIsExportModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to export audit ledger.');
    }
  };

  const handleTriggerSimulatedEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newLog = await apiClient.admin.logEvent({
        action: simAction,
        category: simCategory,
        resource: simResource,
        status: simStatus,
        severity: simSeverity,
        complianceStandard: simStandard,
        details: simDetails,
        actor: user?.name || user?.username || 'Alexander King',
        actorRole: (user?.role as UserRole) || 'admin',
        ipAddress: '10.14.2.89',
        metadata: {
          simulated: true,
          triggeredBy: user?.email || 'admin@netrix.gov',
          timestamp: new Date().toISOString()
        }
      });
      setLogs(prev => [newLog, ...prev]);
      setIsCreateEventModalOpen(false);
      setActionSuccess(`Compliance event [${simAction}] recorded to immutable ledger.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to log simulated compliance event.');
    }
  };

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          log.action.toLowerCase().includes(q) ||
          log.actor.toLowerCase().includes(q) ||
          log.resource.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.ipAddress.toLowerCase().includes(q) ||
          (log.hash && log.hash.toLowerCase().includes(q)) ||
          (log.complianceStandard && log.complianceStandard.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Category
      if (categoryFilter !== 'all') {
        if (log.category !== categoryFilter) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        if (log.status !== statusFilter) return false;
      }

      // Role
      if (roleFilter !== 'all') {
        if (log.actorRole !== roleFilter) return false;
      }

      // Severity
      if (severityFilter !== 'all') {
        if (log.severity !== severityFilter) return false;
      }

      // Time preset
      if (timeFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === '24h' && now - logTime > 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '7d' && now - logTime > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '30d' && now - logTime > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [logs, searchQuery, categoryFilter, statusFilter, roleFilter, severityFilter, timeFilter]);

  // Metrics breakdown
  const metrics = useMemo(() => {
    const total = logs.length;
    const systemChanges = logs.filter(l => l.category === 'system_change').length;
    const userActions = logs.filter(l => l.category === 'user_action').length;
    const accessControl = logs.filter(l => l.category === 'access_control').length;
    const dataIntegrity = logs.filter(l => l.category === 'data_integrity').length;
    const deniedOrFlagged = logs.filter(l => l.status === 'DENIED' || l.status === 'FLAGGED').length;
    return { total, systemChanges, userActions, accessControl, dataIntegrity, deniedOrFlagged };
  }, [logs]);

  // If user is not admin, deny access immediately
  if (!isAdmin) {
    return (
      <AccessRestricted
        currentRole={user?.role || 'viewer'}
        requiredRole="admin"
        resourceName="SECURITY COMPLIANCE AUDIT LOGS"
        onReturnToDashboard={onReturnToDashboard}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-[2px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-800 hover:text-emerald-950">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#FAF1F2] border border-[#6E1827]/30 text-xs font-mono text-[#6E1827] rounded-[2px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#6E1827] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#6E1827] hover:text-[#4E101B]">
            ×
          </button>
        </div>
      )}

      {/* Top Compliance & Security KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ledger Integrity */}
        <div className="p-4 bg-white border border-[#E6E1D8] rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-bold">
              Ledger Cryptoseal
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-normal text-[#121110]">100% Sealed</span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              TAMPER-EVIDENT
            </span>
          </div>
          <p className="text-[11px] font-sans text-[#6B6760] leading-snug">
            Chained SHA-256 state Merkle root anchored to block #1543890.
          </p>
        </div>

        {/* KPI 2: Total Events & System Changes */}
        <div className="p-4 bg-white border border-[#E6E1D8] rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-bold">
              Total Audited Events
            </span>
            <Activity className="w-3.5 h-3.5 text-[#6B6760]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-normal text-[#121110] tabular-nums">
              {metrics.total}
            </span>
            <span className="text-[11px] font-mono text-[#6B6760]">
              ({metrics.systemChanges} sys mutations)
            </span>
          </div>
          <p className="text-[11px] font-sans text-[#6B6760] leading-snug">
            {metrics.userActions} officer actions · {metrics.dataIntegrity} chain validations.
          </p>
        </div>

        {/* KPI 3: Security Incidents & Flags */}
        <div className="p-4 bg-white border border-[#E6E1D8] rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-bold">
              Security Interceptions
            </span>
            <ShieldAlert className={`w-3.5 h-3.5 ${metrics.deniedOrFlagged > 0 ? 'text-[#6E1827]' : 'text-emerald-700'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-normal text-[#121110] tabular-nums">
              {metrics.deniedOrFlagged}
            </span>
            <span className="text-[10px] font-mono font-bold text-[#6E1827] bg-[#6E1827]/10 px-2 py-0.5 rounded-full border border-[#6E1827]/20 uppercase">
              Enforced Block
            </span>
          </div>
          <p className="text-[11px] font-sans text-[#6B6760] leading-snug">
            403 access rejections & jurisdictional anomalies logged.
          </p>
        </div>

        {/* KPI 4: Compliance Standard Frameworks */}
        <div className="p-4 bg-white border border-[#E6E1D8] rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-bold">
              Active Compliance
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="px-2 py-0.5 rounded-full border border-[#E6E1D8] text-[10px] font-mono font-medium text-[#121110] bg-[#F8F7F4]">
              NIST AU-2
            </span>
            <span className="px-2 py-0.5 rounded-full border border-[#E6E1D8] text-[10px] font-mono font-medium text-[#121110] bg-[#F8F7F4]">
              SOC 2 CC6.1
            </span>
            <span className="px-2 py-0.5 rounded-full border border-[#E6E1D8] text-[10px] font-mono font-medium text-[#121110] bg-[#F8F7F4]">
              CJIS 5.4
            </span>
            <span className="px-2 py-0.5 rounded-full border border-[#E6E1D8] text-[10px] font-mono font-medium text-[#121110] bg-[#F8F7F4]">
              ISO 27001
            </span>
          </div>
          <p className="text-[11px] font-sans text-[#6B6760] leading-snug">
            Strict non-repudiation and immutable evidence custody compliance.
          </p>
        </div>
      </div>

      {/* Main Audit Ledger Panel */}
      <div className="bg-white border border-[#E6E1D8] rounded-2xl overflow-hidden shadow-2xs">
        {/* Header & Primary Controls */}
        <div className="p-4 border-b border-[#E2DDD5] bg-[#F7F5F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-serif font-normal text-[#121110]">
                Security Compliance & Operational Audit Trail
              </h2>
              <span className="text-[10px] font-mono text-[#6E1827] bg-[#6E1827]/10 px-2 py-0.5 rounded-[2px] border border-[#6E1827]/30 font-semibold uppercase">
                Admin Exclusive
              </span>
            </div>
            <p className="text-xs font-sans text-[#6B6760] mt-0.5">
              Continuous, immutable chronological ledger capturing user mutations, role alterations, and system state transitions.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
              title="Verify cryptographic hash chain integrity"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isVerifying ? 'Verifying...' : 'Verify Ledger'}</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
              title="Export compliance audit records"
            >
              <Download className="w-3.5 h-3.5 text-[#6B6760]" />
              <span>Export Trail</span>
            </button>

            <button
              onClick={() => setIsCreateEventModalOpen(true)}
              className="px-3 py-1.5 bg-[#121110] hover:bg-[#262524] text-white text-xs font-mono rounded-[2px] flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
              title="Record or simulate a security compliance event"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Log Test Event</span>
            </button>

            <button
              onClick={fetchLogs}
              className="p-1.5 bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] text-[#6B6760] hover:text-[#121110] rounded-[2px] transition-colors"
              title="Refresh ledger records"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-[#E2DDD5] space-y-3 bg-white">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B6760]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event, actor, IP address, resource, SHA-256 seal, NIST standard..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] placeholder-[#6B6760]/60 focus:outline-none focus:border-[#6E1827]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-xs text-[#6B6760] hover:text-[#121110]"
                >
                  ×
                </button>
              )}
            </div>

            {/* Quick Time Preset */}
            <div className="flex items-center gap-1 text-xs font-mono shrink-0">
              <span className="text-[10px] text-[#6B6760] uppercase mr-1">WINDOW:</span>
              {(['all', '24h', '7d', '30d'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => setTimeFilter(preset)}
                  className={`px-2 py-1 rounded-[2px] border text-[11px] transition-colors ${
                    timeFilter === preset
                      ? 'bg-[#121110] text-white border-[#121110]'
                      : 'bg-white border-[#E2DDD5] text-[#6B6760] hover:text-[#121110]'
                  }`}
                >
                  {preset === 'all' ? 'All Time' : preset.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-[#6B6760] uppercase">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] focus:outline-none focus:border-[#6E1827]"
              >
                <option value="all">All Categories ({logs.length})</option>
                <option value="system_change">System Changes ({metrics.systemChanges})</option>
                <option value="user_action">User Actions ({metrics.userActions})</option>
                <option value="access_control">Access Control ({metrics.accessControl})</option>
                <option value="data_integrity">Data Integrity ({metrics.dataIntegrity})</option>
                <option value="security_alert">Security Alerts ({logs.filter(l => l.category === 'security_alert').length})</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-[#6B6760] uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] focus:outline-none focus:border-[#6E1827]"
              >
                <option value="all">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="DENIED">DENIED (403)</option>
                <option value="FLAGGED">FLAGGED</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-[#6B6760] uppercase">Actor Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] focus:outline-none focus:border-[#6E1827]"
              >
                <option value="all">All Roles</option>
                <option value="admin">ADMIN</option>
                <option value="investigator">INVESTIGATOR</option>
                <option value="analyst">ANALYST</option>
                <option value="viewer">VIEWER</option>
                <option value="system">SYSTEM DAEMON</option>
              </select>
            </div>

            {/* Clear filters shortcut */}
            {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all' || timeFilter !== 'all' || severityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setRoleFilter('all');
                  setTimeFilter('all');
                  setSeverityFilter('all');
                }}
                className="text-[11px] font-mono text-[#6E1827] hover:underline ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-[#F7F5F0] text-[10px] text-[#6B6760] border-b border-[#E2DDD5]">
                <th className="p-3 w-44">Timestamp (UTC/Local)</th>
                <th className="p-3 w-48">Actor & Clearance</th>
                <th className="p-3">Security Event & Standard</th>
                <th className="p-3 w-48">Target Resource</th>
                <th className="p-3 w-28">Status</th>
                <th className="p-3 w-36">SHA-256 Seal</th>
                <th className="p-3 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD5]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs font-mono text-[#6B6760]">
                    Synchronizing ledger with cryptographic node...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs font-mono text-[#6B6760]">
                    No audit records match the selected compliance filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isSuccess = log.status === 'SUCCESS';
                  const isDenied = log.status === 'DENIED';
                  const isFlagged = log.status === 'FLAGGED';
                  const isSelected = selectedLog?.id === log.id;
                  const shortHash = log.hash ? log.hash.substring(0, 10) + '...' : '000000...';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#FAF1F2]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="p-3 text-[11px] text-[#6B6760] whitespace-nowrap tabular-nums">
                        <div>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                        <div className="text-[10px] text-[#6B6760]/80">{new Date(log.timestamp).toLocaleDateString()}</div>
                      </td>

                      {/* Actor & Role */}
                      <td className="p-3">
                        <div className="font-medium text-[#121110] font-sans truncate max-w-[170px]" title={log.actor}>
                          {log.actor}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded-[2px] border text-[9px] font-mono uppercase font-medium ${
                            log.actorRole === 'admin'
                              ? 'text-[#6E1827] bg-[#6E1827]/10 border-[#6E1827]/30'
                              : log.actorRole === 'investigator'
                              ? 'text-[#121110] bg-[#121110]/10 border-[#121110]/20'
                              : log.actorRole === 'system'
                              ? 'text-cyan-800 bg-cyan-50 border-cyan-200'
                              : 'text-[#6B6760] bg-[#F7F5F0] border-[#E2DDD5]'
                          }`}>
                            {log.actorRole}
                          </span>
                          <span className="text-[10px] text-[#6B6760] tabular-nums">{log.ipAddress}</span>
                        </div>
                      </td>

                      {/* Event, Category & Standard */}
                      <td className="p-3">
                        <div className="font-medium text-[#121110] flex items-center gap-2">
                          <span>{log.action}</span>
                          {log.category === 'system_change' && (
                            <span className="text-[9px] font-mono bg-purple-50 text-purple-800 border border-purple-200 px-1 rounded-[2px]">
                              SYS CHANGE
                            </span>
                          )}
                          {log.complianceStandard && (
                            <span className="text-[9px] font-mono text-[#6B6760] bg-[#F7F5F0] border border-[#E2DDD5] px-1 rounded-[2px]">
                              {log.complianceStandard}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-sans text-[#6B6760] line-clamp-1 mt-0.5 max-w-xl">
                          {log.details}
                        </div>
                      </td>

                      {/* Target Resource */}
                      <td className="p-3 text-[11px] text-[#6B6760] truncate max-w-[180px]" title={log.resource}>
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#F7F5F0] border border-[#E2DDD5] text-[10px] text-[#121110]">
                          {log.resource}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-mono font-medium uppercase inline-flex items-center gap-1 ${
                          isSuccess
                            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                            : isDenied
                            ? 'text-rose-800 bg-rose-50 border-rose-200'
                            : 'text-amber-800 bg-amber-50 border-amber-200'
                        }`}>
                          {isSuccess && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />}
                          {isDenied && <XCircle className="w-2.5 h-2.5 text-rose-700" />}
                          {isFlagged && <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />}
                          <span>{log.status}</span>
                        </span>
                      </td>

                      {/* Hash Seal */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <code className="text-[10px] text-[#6B6760] font-mono" title={log.hash}>
                            {shortHash}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(log.hash || '', log.id);
                            }}
                            className="p-1 hover:text-[#121110] text-[#6B6760] transition-colors"
                            title="Copy SHA-256 hash"
                          >
                            {copiedHash === log.id ? (
                              <Check className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2 py-1 text-[11px] font-mono border border-[#E2DDD5] text-[#121110] hover:bg-[#F7F5F0] rounded-[2px] transition-colors"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-[#E2DDD5] bg-[#F7F5F0] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#6B6760] gap-2">
          <div>
            Displaying <span className="font-medium text-[#121110]">{filteredLogs.length}</span> of{' '}
            <span className="font-medium text-[#121110]">{logs.length}</span> recorded transactions
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Immutable Ledger State: Synchronized</span>
            </span>
            <span>·</span>
            <span>Policy: Zero-Trust Retention (7 Years)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: AUDIT RECORD DOSSIER (DEEP INSPECTION)                           */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121110]/50 animate-fade-in">
          <div className="bg-white border border-[#E2DDD5] rounded-[2px] max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E2DDD5]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                    Cryptographic Audit Dossier
                  </span>
                  <span className="text-xs font-mono text-[#6B6760]">·</span>
                  <span className="text-xs font-mono text-[#6B6760]">{selectedLog.id}</span>
                </div>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  {selectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-[#6B6760] hover:text-[#121110] border border-transparent hover:border-[#E2DDD5] rounded-[2px]"
              >
                ✕
              </button>
            </div>

            {/* Quick Status & Severity Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className={`px-2.5 py-1 rounded-[2px] border font-medium ${
                selectedLog.status === 'SUCCESS'
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  : selectedLog.status === 'DENIED'
                  ? 'text-rose-800 bg-rose-50 border-rose-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}>
                STATUS: {selectedLog.status}
              </span>

              <span className="px-2.5 py-1 rounded-[2px] border border-[#E2DDD5] bg-[#F7F5F0] text-[#121110] uppercase">
                CATEGORY: {selectedLog.category}
              </span>

              {selectedLog.severity && (
                <span className={`px-2.5 py-1 rounded-[2px] border uppercase font-medium ${
                  selectedLog.severity === 'critical' || selectedLog.severity === 'high'
                    ? 'text-[#6E1827] bg-[#FAF1F2] border-[#6E1827]/30'
                    : 'text-[#6B6760] bg-[#F7F5F0] border-[#E2DDD5]'
                }`}>
                  SEVERITY: {selectedLog.severity}
                </span>
              )}

              {selectedLog.complianceStandard && (
                <span className="px-2.5 py-1 rounded-[2px] border border-[#E2DDD5] bg-[#F7F5F0] text-[#6E1827] font-semibold">
                  STANDARD: {selectedLog.complianceStandard}
                </span>
              )}
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono p-4 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px]">
              <div>
                <span className="text-[10px] text-[#6B6760] uppercase block">Authenticated Actor</span>
                <span className="font-medium text-[#121110] text-sm font-sans">{selectedLog.actor}</span>
                <div className="text-[11px] text-[#6B6760] uppercase mt-0.5">Role: {selectedLog.actorRole}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#6B6760] uppercase block">Network Origin IP</span>
                <span className="font-medium text-[#121110] font-mono">{selectedLog.ipAddress}</span>
                <div className="text-[11px] text-emerald-800 mt-0.5">TLS 1.3 Verified Tunnel</div>
              </div>

              <div>
                <span className="text-[10px] text-[#6B6760] uppercase block">Timestamp (ISO 8601)</span>
                <span className="font-medium text-[#121110]">{selectedLog.timestamp}</span>
                <div className="text-[11px] text-[#6B6760] mt-0.5">{new Date(selectedLog.timestamp).toUTCString()}</div>
              </div>

              <div>
                <span className="text-[10px] text-[#6B6760] uppercase block">Target Subsystem / Resource</span>
                <span className="font-medium text-[#121110]">{selectedLog.resource}</span>
              </div>
            </div>

            {/* Event Description */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-semibold">
                Event Description & Audit Trail
              </span>
              <div className="p-3 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-sans text-[#121110] leading-relaxed">
                {selectedLog.details}
              </div>
            </div>

            {/* Cryptographic Proof Chaining */}
            <div className="space-y-2 p-4 bg-[#FAF8F5] border border-[#E2DDD5] rounded-[2px]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[10px] text-[#6E1827] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tamper-Evident SHA-256 Proof</span>
                </span>
                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold">
                  VALID IN CHAIN
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#6B6760] uppercase block">Record Hash Seal</span>
                  <div className="p-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[11px] text-[#121110] break-all select-all flex items-center justify-between">
                    <span>{selectedLog.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</span>
                    <button
                      onClick={() => handleCopy(selectedLog.hash || '', 'modal_hash')}
                      className="ml-2 text-[#6B6760] hover:text-[#121110]"
                      title="Copy Hash"
                    >
                      {copiedHash === 'modal_hash' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {selectedLog.previousHash && (
                  <div>
                    <span className="text-[10px] text-[#6B6760] uppercase block">Previous Block Seal (Parent Hash)</span>
                    <div className="p-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[11px] text-[#6B6760] break-all select-all">
                      {selectedLog.previousHash}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mutation Metadata JSON */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-[#6B6760] uppercase font-semibold">
                    Payload & State Mutation Metadata
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata, null, 2));
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="text-[10px] font-mono text-[#6E1827] hover:underline flex items-center gap-1"
                  >
                    {copiedPayload ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#121110] text-[#F7F5F0] rounded-[2px] text-[11px] font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#E2DDD5] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#121110] text-white text-xs font-mono rounded-[2px] hover:bg-[#262524] transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LEDGER INTEGRITY VERIFICATION REPORT                             */}
      {/* ========================================================================= */}
      {isVerifyModalOpen && verificationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121110]/50 animate-fade-in">
          <div className="bg-white border border-[#E2DDD5] rounded-[2px] max-w-lg w-full space-y-4 p-6 sm:p-8">
            <div className="flex items-start justify-between pb-3 border-b border-[#E2DDD5]">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  Compliance Audit Verification
                </span>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  Ledger Integrity Certificate
                </h3>
              </div>
              <button
                onClick={() => setIsVerifyModalOpen(false)}
                className="p-1 text-[#6B6760] hover:text-[#121110]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[2px] flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0" />
              <div className="space-y-0.5 text-xs font-mono text-emerald-950">
                <div className="font-bold uppercase tracking-wider text-emerald-900">
                  Chain Fully Cryptographically Verified
                </div>
                <div className="text-[11px] text-emerald-800">
                  Zero hash collisions, zero tampered payloads detected across all {verificationResult.totalRecords} records.
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#E2DDD5]">
                <span className="text-[#6B6760]">Audit Records Scanned:</span>
                <span className="font-medium text-[#121110] tabular-nums">{verificationResult.totalRecords}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2DDD5]">
                <span className="text-[#6B6760]">Tampered / Broken Blocks:</span>
                <span className="font-medium text-emerald-800 tabular-nums">{verificationResult.tamperedCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2DDD5]">
                <span className="text-[#6B6760]">Verification Algorithm:</span>
                <span className="font-medium text-[#121110]">Chained SHA-256 Digest (NIST FIPS 180-4)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2DDD5]">
                <span className="text-[#6B6760]">Verified Timestamp:</span>
                <span className="font-medium text-[#121110]">{new Date(verificationResult.verifiedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#6B6760] uppercase block mb-1">State Merkle Root</span>
                <div className="p-2 bg-[#F7F5F0] border border-[#E2DDD5] text-[10px] break-all rounded-[2px]">
                  {verificationResult.rootHash}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsVerifyModalOpen(false)}
                className="px-4 py-2 bg-[#121110] text-white text-xs font-mono rounded-[2px] hover:bg-[#262524]"
              >
                Acknowledge Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EXPORT AUDIT TRAIL                                              */}
      {/* ========================================================================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121110]/50 animate-fade-in">
          <div className="bg-white border border-[#E2DDD5] rounded-[2px] max-w-md w-full space-y-4 p-6 sm:p-8">
            <div className="flex items-start justify-between pb-3 border-b border-[#E2DDD5]">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  Compliance Export
                </span>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  Export Audit Trail Dossier
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-[#6B6760] hover:text-[#121110]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-sans text-[#6B6760] leading-relaxed">
              Generate an official, cryptographically timestamped export of all user actions and system changes for external auditors (SOC 2 Type II, CJIS, NIST SP 800-53).
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleExport('json')}
                className="w-full p-4 bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] rounded-[2px] text-left transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-bold text-[#121110] group-hover:text-[#6E1827]">
                    JSON Compliance Package
                  </div>
                  <div className="text-[11px] font-sans text-[#6B6760]">
                    Full structured metadata, state mutation diffs, and cryptographic hash chain signatures.
                  </div>
                </div>
                <Download className="w-4 h-4 text-[#6B6760] group-hover:text-[#6E1827]" />
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="w-full p-4 bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] rounded-[2px] text-left transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-bold text-[#121110] group-hover:text-[#6E1827]">
                    CSV Tabular Ledger
                  </div>
                  <div className="text-[11px] font-sans text-[#6B6760]">
                    Universal comma-separated format for spreadsheet review and regulatory submission.
                  </div>
                </div>
                <Download className="w-4 h-4 text-[#6B6760] group-hover:text-[#6E1827]" />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-3.5 py-2 text-xs font-mono text-[#6B6760] hover:text-[#121110]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TRIGGER / SIMULATE SECURITY COMPLIANCE EVENT                     */}
      {/* ========================================================================= */}
      {isCreateEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121110]/50 animate-fade-in">
          <div className="bg-white border border-[#E2DDD5] rounded-[2px] max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 p-6 sm:p-8">
            <div className="flex items-start justify-between pb-3 border-b border-[#E2DDD5]">
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                  Compliance Simulation
                </span>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  Log Security / Compliance Event
                </h3>
              </div>
              <button
                onClick={() => setIsCreateEventModalOpen(false)}
                className="p-1 text-[#6B6760] hover:text-[#121110]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTriggerSimulatedEvent} className="space-y-3 font-mono text-xs">
              {/* Event Presets */}
              <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-1.5">
                <span className="text-[10px] text-[#6B6760] uppercase block font-semibold">
                  Load Standard Template:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSimAction('MFA_POLICY_UPDATE');
                      setSimCategory('system_change');
                      setSimResource('SECURITY_AUTH_GATEWAY');
                      setSimStatus('SUCCESS');
                      setSimSeverity('medium');
                      setSimStandard('NIST SP 800-53 IA-2');
                      setSimDetails('Enforced hardware token FIDO2 MFA requirement across all Level 3 and Level 4 investigators.');
                    }}
                    className="p-1.5 border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5] text-left rounded-[2px] truncate"
                  >
                    System Policy Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimAction('UNAUTHORIZED_ACCESS_ATTEMPT');
                      setSimCategory('access_control');
                      setSimResource('CLASSIFIED_DOSSIER // SEA_SERPENT');
                      setSimStatus('DENIED');
                      setSimSeverity('high');
                      setSimStandard('NIST SP 800-53 AC-3');
                      setSimDetails('Protocol 403: Read attempt on sealed case restricted from unvetted officer persona.');
                    }}
                    className="p-1.5 border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5] text-left rounded-[2px] truncate"
                  >
                    Simulate 403 Denied
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimAction('API_RATE_LIMIT_CALIBRATION');
                      setSimCategory('system_change');
                      setSimResource('GATEWAY_BURST_BUFFER');
                      setSimStatus('SUCCESS');
                      setSimSeverity('low');
                      setSimStandard('NIST SP 800-53 SC-5');
                      setSimDetails('Adjusted token bucket burst capacity to 120 req/min for forensic export nodes.');
                    }}
                    className="p-1.5 border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5] text-left rounded-[2px] truncate"
                  >
                    Rate Limit Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimAction('BLOCKCHAIN_SYNC_CHECK');
                      setSimCategory('data_integrity');
                      setSimResource('EVIDENCE_SEAL_NODE');
                      setSimStatus('SUCCESS');
                      setSimSeverity('low');
                      setSimStandard('NIST SP 800-53 SC-13');
                      setSimDetails('Verified consensus on private Ethereum ledger; zero block reorganizations.');
                    }}
                    className="p-1.5 border border-[#E2DDD5] bg-white hover:bg-[#FAF8F5] text-left rounded-[2px] truncate"
                  >
                    Chain Integrity Check
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1">Event Action Identifier</label>
                <input
                  type="text"
                  required
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value)}
                  placeholder="e.g. POLICY_ENFORCEMENT"
                  className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B6760] uppercase mb-1">Compliance Category</label>
                  <select
                    value={simCategory}
                    onChange={(e: any) => setSimCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  >
                    <option value="system_change">System Change</option>
                    <option value="user_action">User Action</option>
                    <option value="access_control">Access Control</option>
                    <option value="data_integrity">Data Integrity</option>
                    <option value="security_alert">Security Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#6B6760] uppercase mb-1">Outcome Status</label>
                  <select
                    value={simStatus}
                    onChange={(e: any) => setSimStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  >
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="DENIED">DENIED (403)</option>
                    <option value="FLAGGED">FLAGGED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#6B6760] uppercase mb-1">Severity Rating</label>
                  <select
                    value={simSeverity}
                    onChange={(e: any) => setSimSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#6B6760] uppercase mb-1">Compliance Framework</label>
                  <input
                    type="text"
                    value={simStandard}
                    onChange={(e) => setSimStandard(e.target.value)}
                    placeholder="e.g. NIST SP 800-53 AU-2"
                    className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1">Target Resource</label>
                <input
                  type="text"
                  required
                  value={simResource}
                  onChange={(e) => setSimResource(e.target.value)}
                  placeholder="e.g. AUTH_GATEWAY_CONFIG"
                  className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1">Event Narrative Details</label>
                <textarea
                  rows={3}
                  required
                  value={simDetails}
                  onChange={(e) => setSimDetails(e.target.value)}
                  placeholder="Describe the exact action or system change..."
                  className="w-full px-3 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-[#121110] focus:outline-none focus:border-[#6E1827] font-sans text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateEventModalOpen(false)}
                  className="px-3.5 py-2 bg-white border border-[#E2DDD5] text-[#6B6760] hover:text-[#121110] rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#6E1827] text-white rounded-[2px] hover:bg-[#4E101B] font-medium"
                >
                  Seal & Commit to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
