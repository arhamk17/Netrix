import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Cpu,
  Lock,
  Search,
  Check,
  X,
  AlertTriangle,
  RotateCw,
  Clock,
  Terminal,
  Server,
  UserPlus
} from 'lucide-react';
import { User, UserRole, AuditLogItem } from '../types';
import { apiClient } from '../api/client';
import { ROLE_DETAILS } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import { AccessRestricted } from '../components/AccessRestricted';
import { AuditLogsSection } from '../components/AuditLogsSection';

export const Administration: React.FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit' | 'system'>('audit');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // User search & filters
  const [userQuery, setUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('investigator');

  // Add user modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('investigator');
  const [newDepartment, setNewDepartment] = useState('Special Investigation Unit');

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Defensive role guard: Accessible ONLY to ADMIN roles
  if (user && user.role !== 'admin') {
    return (
      <AccessRestricted
        currentRole={user.role}
        requiredRole="admin"
        resourceName="ADMINISTRATION & AUDIT LOGS"
      />
    );
  }

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, logs] = await Promise.all([
        apiClient.users.list(),
        apiClient.admin.getAuditLogs()
      ]);
      setUsers(userList);
      setAuditLogs(logs);
      if (userList.length > 0) {
        setSelectedUser(userList[0]);
        setEditRole(userList[0].role);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch administration controls.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, targetRole: UserRole) => {
    try {
      await apiClient.users.updateRole(userId, targetRole);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: targetRole } : u)));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: targetRole } : null);
      }
      setActionSuccess(`User clearance role updated to ${targetRole.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);
      
      const logs = await apiClient.admin.getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to update user role.');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await apiClient.users.updateStatus(userId, nextStatus);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: nextStatus } : u)));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, status: nextStatus } : null);
      }
      setActionSuccess(`User status updated to ${nextStatus.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);

      const logs = await apiClient.admin.getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle account status.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.users.create({
        username: newUsername,
        email: newEmail,
        password: newPassword || 'Netrix@2026',
        role: newRole
      });
      setUsers(prev => [created, ...prev]);
      setIsAddUserOpen(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setActionSuccess(`New credential account created for ${created.name || created.username}`);
      setTimeout(() => setActionSuccess(null), 3000);

      const logs = await apiClient.admin.getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to provision account.');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(userQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 max-w-7xl mx-auto pb-12"
    >
      {/* Top Administration Header */}
      <div className="p-6 bg-white border border-[#E6E1D8] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
              Administration Gateway
            </span>
            <span className="text-[11px] font-mono text-[#6B6760]">·</span>
            <span className="text-xs font-mono text-[#6B6760]">Clearance: Level 4 (Admin)</span>
            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase font-bold">
              Enforced
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[#121110]">
            System Administration & RBAC Management
          </h1>
          <p className="text-sm text-[#6B6760] max-w-2xl font-sans">
            Oversee user authorization hierarchies, inspect immutable audit ledgers, verify model inference gateways, and audit security parameters.
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex bg-[#F8F7F4] border border-[#E6E1D8] p-1 rounded-full text-xs font-mono">
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'audit'
                  ? 'bg-[#121110] text-white font-medium shadow-2xs'
                  : 'text-[#6B6760] hover:text-[#121110]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSubTab === 'audit' ? 'bg-[#6E1827] text-white' : 'bg-[#E6E1D8] text-[#121110]'
              }`}>
                {auditLogs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'users'
                  ? 'bg-[#121110] text-white font-medium shadow-2xs'
                  : 'text-[#6B6760] hover:text-[#121110]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users & Roles</span>
            </button>
            <button
              onClick={() => setActiveSubTab('system')}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'system'
                  ? 'bg-[#121110] text-white font-medium shadow-2xs'
                  : 'text-[#6B6760] hover:text-[#121110]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>System Health</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#FAF1F2] border border-[#6E1827]/30 text-xs font-mono text-[#6E1827] rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#6E1827]" />
          <span>{error}</span>
        </div>
      )}

      {/* SUB-TAB 1: USER & ROLE MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#6B6760]" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Filter by name, email, clearance role..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-xs font-mono text-[#121110] focus:outline-none focus:border-[#6E1827] shadow-2xs"
              />
            </div>

            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-4 py-2.5 bg-[#121110] hover:bg-[#6E1827] text-white text-xs font-mono rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Provision User</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* User Roster Table */}
            <div className="lg:col-span-8 bg-white border border-[#E6E1D8] rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-[#E6E1D8] flex items-center justify-between bg-[#F8F7F4]/60">
                <div className="text-xs font-mono font-bold text-[#121110]">
                  Authorized Personnel Directory ({filteredUsers.length})
                </div>
                <div className="text-[11px] font-mono text-[#6B6760]">
                  Server authoritative role matrix
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-[#F8F7F4] text-[10px] text-[#6B6760] border-b border-[#E6E1D8]">
                      <th className="p-3.5">Officer / Name</th>
                      <th className="p-3.5">Assigned Role</th>
                      <th className="p-3.5">Department</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E1D8]">
                    {filteredUsers.map(u => {
                      const roleMeta = ROLE_DETAILS[u.role] || {
                        label: u.role.toUpperCase(),
                        badgeColor: 'text-[#6B6760] bg-[#F8F7F4] border-[#E6E1D8]'
                      };
                      const isSelected = selectedUser?.id === u.id;
                      const isSuspended = u.status === 'suspended';

                      return (
                        <tr
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setEditRole(u.role);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#6E1827]/10 font-medium' : 'hover:bg-[#F2EFE9]/60'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="font-semibold text-[#121110] font-sans">{u.name || u.username}</div>
                            <div className="text-[11px] text-[#6B6760]">{u.email}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase ${roleMeta.badgeColor}`}>
                              {roleMeta.label}
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px] text-[#6B6760] font-sans">
                            {u.department || 'General Investigation'}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${
                              isSuspended
                                ? 'text-rose-800 bg-rose-50 border-rose-200'
                                : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                            }`}>
                              {isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(u.id, u.status);
                              }}
                              className={`px-3 py-1 rounded-full border text-[10px] font-mono transition-colors cursor-pointer ${
                                isSuspended
                                  ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                                  : 'border-[#6E1827]/30 text-[#6E1827] hover:bg-[#FAF1F2]'
                              }`}
                            >
                              {isSuspended ? 'Activate' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected User Inspection */}
            <div className="lg:col-span-4 bg-white border border-[#E6E1D8] p-6 rounded-2xl space-y-4 shadow-2xs">
              {selectedUser ? (
                <>
                  <div className="space-y-1 pb-3 border-b border-[#E6E1D8]">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                      Officer Clearance Dossier
                    </span>
                    <h3 className="text-base font-serif font-normal text-[#121110]">
                      {selectedUser.name || selectedUser.username}
                    </h3>
                    <div className="text-xs font-mono text-[#6B6760]">{selectedUser.email}</div>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#6B6760] uppercase block font-medium">Department / Unit</span>
                      <span className="text-[#121110] font-sans">{selectedUser.department || 'Special Investigations'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6B6760] uppercase block font-medium">Account Identifier</span>
                      <span className="text-[#121110]">{selectedUser.id}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#6B6760] uppercase block mb-1 font-medium">
                        Authorize Role Level
                      </span>
                      <select
                        value={editRole}
                        onChange={(e) => {
                          const r = e.target.value as UserRole;
                          setEditRole(r);
                          handleUpdateRole(selectedUser.id, r);
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-xs font-mono text-[#121110] focus:outline-none focus:border-[#6E1827]"
                      >
                        <option value="admin">ADMIN (All Nodes, Audit & User Controls)</option>
                        <option value="investigator">INVESTIGATOR (Evidence, Graph, Cases, Verification)</option>
                        <option value="analyst">ANALYST (Graph Analytics, Predictions, Leads)</option>
                        <option value="viewer">VIEWER (Read-Only Permitted Access)</option>
                      </select>
                    </div>

                    <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl text-[11px] font-sans text-[#6B6760] leading-relaxed">
                      {ROLE_DETAILS[selectedUser.role]?.description}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-[#6B6760]">Account Status</span>
                      <button
                        onClick={() => handleToggleStatus(selectedUser.id, selectedUser.status)}
                        className="text-xs text-[#6E1827] font-semibold underline hover:text-[#4E101B] cursor-pointer"
                      >
                        {selectedUser.status === 'suspended' ? 'Re-enable Access' : 'Suspend Account'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-xs font-mono text-[#6B6760]">
                  Select a user to review role clearances.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUDIT LOGS SECTION */}
      {activeSubTab === 'audit' && (
        <AuditLogsSection onReturnToDashboard={() => setActiveSubTab('users')} />
      )}

      {/* SUB-TAB 3: MODEL & SYSTEM STATUS */}
      {activeSubTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border border-[#E6E1D8] rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                Local GNN Pipeline
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <h3 className="text-base font-serif font-normal text-[#121110]">
              Heterogeneous Graph Model
            </h3>
            <div className="space-y-2 text-xs font-mono text-[#6B6760]">
              <div className="flex justify-between">
                <span>Architecture:</span>
                <span className="font-semibold text-[#121110]">RGCN + DistMult Decoder</span>
              </div>
              <div className="flex justify-between">
                <span>Embedding Dims:</span>
                <span className="font-semibold text-[#121110]">64-dim float32</span>
              </div>
              <div className="flex justify-between">
                <span>Inference Latency:</span>
                <span className="font-semibold text-emerald-800 tabular-nums">38 ms</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-[#E6E1D8] rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                Blockchain Sync
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <h3 className="text-base font-serif font-normal text-[#121110]">
              Ledger Cryptographic Anchor
            </h3>
            <div className="space-y-2 text-xs font-mono text-[#6B6760]">
              <div className="flex justify-between">
                <span>Block Height:</span>
                <span className="font-semibold text-[#121110]">#1543890</span>
              </div>
              <div className="flex justify-between">
                <span>Sync Status:</span>
                <span className="font-semibold text-emerald-800">100% Synchronized</span>
              </div>
              <div className="flex justify-between">
                <span>Chain Standard:</span>
                <span className="font-semibold text-[#121110]">SHA-256 Merkle Root</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-[#E6E1D8] rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                Security & RBAC
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <h3 className="text-base font-serif font-normal text-[#121110]">
              Access Gateway
            </h3>
            <div className="space-y-2 text-xs font-mono text-[#6B6760]">
              <div className="flex justify-between">
                <span>Auth Scheme:</span>
                <span className="font-semibold text-[#121110]">RS256 JWT Signed</span>
              </div>
              <div className="flex justify-between">
                <span>Token Expiry:</span>
                <span className="font-semibold text-[#121110]">8 Hours (Strict)</span>
              </div>
              <div className="flex justify-between">
                <span>Role Matrix:</span>
                <span className="font-semibold text-emerald-800">Server Authoritative</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provision User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E6E1D8] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-3">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                  Personnel Enrollment
                </span>
                <h3 className="text-base font-serif text-[#121110]">
                  Provision New Clearance Account
                </h3>
              </div>
              <button onClick={() => setIsAddUserOpen(false)} className="text-[#6B6760] hover:text-[#121110]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Officer Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Special Agent Jordan Blake"
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="jordan_blake"
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Email Identifier</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jordan@netrix.gov"
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Assigned RBAC Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                >
                  <option value="investigator">INVESTIGATOR (Evidence, Graph, Cases, Verification)</option>
                  <option value="analyst">ANALYST (Graph Analytics, Predictions, Leads)</option>
                  <option value="viewer">VIEWER (Read-Only Permitted Access)</option>
                  <option value="admin">ADMIN (Supreme Operational Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#6B6760] uppercase mb-1 font-bold text-[10px]">Assigned Department</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E6E1D8] rounded-xl text-[#121110] focus:outline-none focus:border-[#6E1827]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E6E1D8] text-xs font-mono text-[#6B6760] hover:text-[#121110] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-xl hover:bg-[#4E101B] cursor-pointer"
                >
                  Confirm Provisioning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Administration;
