import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  BrainCircuit,
  Lock,
  User,
  Check,
  Copy,
  CheckCircle2,
  XCircle,
  Key,
  Cpu,
  Terminal,
  Activity,
  Layers,
  FolderLock,
  FileCheck,
  RefreshCw,
  FileDown,
  ChevronRight,
  ExternalLink,
  ShieldQuestion,
  UserCheck,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SYSTEM_ROLES, getRoleDefinition, SystemRoleDefinition } from '../../data/rolesData';
import { ForensicAvatar } from './ForensicAvatar';
import type { UserRole } from '../../types';
import { exportToJSON } from '../../utils/reportExport';

export const ProfileSection: React.FC = () => {
  const { user } = useAuth();
  const [selectedRoleId, setSelectedRoleId] = useState<UserRole>(user?.role || 'admin');
  const [activeTab, setActiveTab] = useState<'roster' | 'matrix' | 'admin' | 'hardware'>('roster');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Admin user creation state
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'investigator' | 'supervisor'>('investigator');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [userCreateSuccess, setUserCreateSuccess] = useState<string | null>(null);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);

  const activeRoleDef = getRoleDefinition(user?.role || 'admin');
  const inspectedRoleDef = getRoleDefinition(selectedRoleId);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreateError(null);
    setUserCreateSuccess(null);

    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setUserCreateError('Username, email, and password are required.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const created = await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole
      });
      setUserCreateSuccess(`Account @${created.username} provisioned successfully with role ${created.role.toUpperCase()}`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
    } catch (err: any) {
      setUserCreateError(err.message || 'Failed to create user account');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleExportDossier = () => {
    const exportData = {
      investigator_dossier: {
        investigator_id: user?.id,
        username: user?.username || 'user',
        email: user?.email,
        role: user?.role || 'admin',
        is_active: user?.is_active !== false,
        clearance_level: activeRoleDef.clearanceLevel,
        hardware_token: activeRoleDef.securityHardware.keyType,
        enclave_node: activeRoleDef.securityHardware.enclaveNode,
        pgp_fingerprint: activeRoleDef.securityHardware.pgpKey,
        session_signature: activeRoleDef.securityHardware.sha256Signature,
        granted_permissions: activeRoleDef.permissions.filter(p => p.allowed).map(p => p.name),
        restricted_operations: activeRoleDef.permissions.filter(p => !p.allowed).map(p => p.name)
      }
    };

    exportToJSON({
      filename: `NETRIX_Investigator_Profile_${(user?.username || 'investigator')}_${new Date().toISOString().slice(0, 10)}.json`,
      moduleName: 'Personnel & Role Clearance Directory',
      operator: user?.username || 'Authorized Investigator',
      data: exportData
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. TOP HEADER & DOSSIER ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-tech text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-rose-400" />
            <span>INVESTIGATOR PROFILE & CLEARANCE DIRECTORY</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            User identity, cryptographic credentials, and multi-role clearance matrix
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportDossier}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#6D001A]/50 to-[#0A0204] hover:from-[#8B0024]/60 hover:to-[#6D001A]/40 text-white text-xs font-tech font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(109,0,26,0.4)] cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-rose-300" />
            <span>EXPORT PROFILE</span>
          </button>
        </div>
      </div>

      {/* 2. ACTIVE OPERATOR HERO DOSSIER CARD (Black / Burgundy / White Aesthetic) */}
      <div className="relative rounded-2xl border border-white/[0.12] bg-[#000000]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(109,0,26,0.15)] overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#6D001A] before:to-transparent">
        {/* Background glow & subtle watermark */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#6D001A]/20 blur-3xl pointer-events-none" />
        <div className="absolute right-8 bottom-8 text-[120px] font-tech font-bold text-white/[0.02] select-none pointer-events-none tracking-widest uppercase">
          {activeRoleDef.avatarConfig.initials}
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left: Avatar & Identity Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <ForensicAvatar
              role={user?.role || 'admin'}
              name={user?.username || 'Operator'}
              size="2xl"
              showBadge={true}
              showStatus={true}
              statusOnline={user?.is_active !== false}
              interactive={true}
            />

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md border border-[#6D001A] bg-[#6D001A]/40 text-rose-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                  {user?.role?.toUpperCase() || activeRoleDef.shortTitle}
                </span>
                <span className="px-2.5 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-slate-300 font-mono text-[11px]">
                  ID: {user?.id ? `${user.id.slice(0, 8)}...` : 'N/A'}
                </span>
                <span className={`flex items-center gap-1 text-[11px] font-mono ${user?.is_active !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user?.is_active !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {user?.is_active !== false ? 'AUTHENTICATED SESSION' : 'ACCOUNT DISABLED'}
                </span>
              </div>

              <h1 className="font-tech text-3xl sm:text-4xl font-bold text-white tracking-wide">
                @{user?.username || 'operator'}
              </h1>

              <div className="font-mono text-xs text-slate-400 flex flex-wrap items-center gap-y-1 gap-x-4">
                <span>EMAIL: <strong className="text-slate-200">{user?.email || 'N/A'}</strong></span>
                <span>•</span>
                <span>ROLE: <strong className="text-rose-400">{user?.role?.toUpperCase() || 'INVESTIGATOR'}</strong></span>
                <span>•</span>
                <span>STATUS: <strong className={user?.is_active !== false ? 'text-emerald-400' : 'text-rose-400'}>{user?.is_active !== false ? 'ACTIVE' : 'DISABLED'}</strong></span>
              </div>

              <p className="text-xs text-slate-300 max-w-2xl pt-1 leading-relaxed">
                {activeRoleDef.tagline}
              </p>
            </div>
          </div>

          {/* Right: Key Security Telemetry Mini-Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 shrink-0 lg:w-72 font-mono">
            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">CLEARANCE TIER</div>
              <div className="text-lg font-bold text-rose-400 font-tech">LEVEL {activeRoleDef.clearanceTierNumber} / 5</div>
              <div className="text-[9px] text-slate-500 truncate">ROLE-BASED ACCESS</div>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">ACCOUNT STATUS</div>
              <div className={`text-lg font-bold font-tech ${user?.is_active !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                {user?.is_active !== false ? 'ACTIVE' : 'DISABLED'}
              </div>
              <div className="text-[9px] text-slate-500 truncate">DATABASE ATTESTED</div>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">ROLE LEVEL</div>
              <div className="text-lg font-bold text-rose-400 uppercase">{user?.role || 'OPERATOR'}</div>
              <div className="text-[9px] text-slate-500 truncate">JWT ENFORCED</div>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-1">
              <div className="text-[10px] text-slate-400 uppercase">WORKSPACE HOST</div>
              <div className="text-lg font-bold text-emerald-400 font-tech">ONLINE</div>
              <div className="text-[9px] text-slate-500 truncate">FASTAPI + NEO4J</div>
            </div>
          </div>
        </div>

        {/* Cryptographic Key & Node Footprint Strip */}
        <div className="mt-6 pt-5 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">PGP FINGERPRINT</div>
              <div className="text-slate-300 text-[11px] truncate max-w-[200px]">
                {activeRoleDef.securityHardware.pgpKey}
              </div>
            </div>
            <button
              onClick={() => handleCopy(activeRoleDef.securityHardware.pgpKey, 'pgp')}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Copy PGP Fingerprint"
            >
              {copiedField === 'pgp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">HARDWARE TOKEN NODE</div>
              <div className="text-slate-300 text-[11px] truncate max-w-[200px]">
                {activeRoleDef.securityHardware.enclaveNode}
              </div>
            </div>
            <button
              onClick={() => handleCopy(activeRoleDef.securityHardware.enclaveNode, 'node')}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Copy Host Node ID"
            >
              {copiedField === 'node' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">USER DATABASE UUID</div>
              <div className="text-slate-300 text-[11px] truncate max-w-[200px]">
                {user?.id || 'N/A'}
              </div>
            </div>
            <button
              onClick={() => handleCopy(user?.id || '', 'uuid')}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Copy User UUID"
            >
              {copiedField === 'uuid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'roster'
              ? 'border border-[#6D001A] bg-[#6D001A]/30 text-white shadow-[0_0_15px_rgba(109,0,26,0.4)]'
              : 'border border-white/5 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <User className="w-4 h-4 text-rose-400" />
          <span>SYSTEM ROLES DIRECTORY ({SYSTEM_ROLES.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'border border-[#6D001A] bg-[#6D001A]/30 text-white shadow-[0_0_15px_rgba(109,0,26,0.4)]'
              : 'border border-white/5 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Layers className="w-4 h-4 text-rose-400" />
          <span>CLEARANCE & PERMISSIONS MATRIX</span>
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'border border-[#6D001A] bg-[#6D001A]/30 text-white shadow-[0_0_15px_rgba(109,0,26,0.4)]'
                : 'border border-white/5 bg-white/[0.02] text-rose-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <UserPlus className="w-4 h-4 text-rose-400" />
            <span>ADMIN USER PROVISIONING</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'hardware'
              ? 'border border-[#6D001A] bg-[#6D001A]/30 text-white shadow-[0_0_15px_rgba(109,0,26,0.4)]'
              : 'border border-white/5 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Key className="w-4 h-4 text-rose-400" />
          <span>HARDWARE SECURITY KEYS</span>
        </button>
      </div>

      {/* 4. TAB: ADMIN USER CREATION ENCLAVE */}
      {activeTab === 'admin' && user?.role === 'admin' && (
        <div className="rounded-2xl border border-white/[0.1] bg-[#050508] p-6 space-y-6">
          <div>
            <h3 className="font-tech text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-rose-400" />
              <span>ADMIN USER PROVISIONING (POST /auth/users)</span>
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Authorized administrators can provision new accounts with investigator or supervisor clearance. Public registration is permanently disabled.
            </p>
          </div>

          {userCreateSuccess && (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 font-mono text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{userCreateSuccess}</span>
            </div>
          )}

          {userCreateError && (
            <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-300 font-mono text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{userCreateError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4 max-w-xl font-mono text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">USERNAME</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. investigator_jones"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-black/60 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">OFFICIAL EMAIL</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. jones@forensics.agency"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-black/60 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">TEMPORARY PASSWORD</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Secure operator password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-black/60 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">ASSIGNED ROLE CLEARANCE</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-black/60 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="investigator">INVESTIGATOR (Evidence Ingestion & Graph Analysis)</option>
                <option value="supervisor">SUPERVISOR (Case Review & Operational Oversight)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreatingUser}
              className="px-5 py-2.5 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#6D001A] to-[#8B0024] hover:opacity-90 text-white font-tech text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(109,0,26,0.4)] cursor-pointer"
            >
              {isCreatingUser ? 'PROVISIONING USER ACCOUNT...' : 'PROVISION USER IN DATABASE'}
            </button>
          </form>
        </div>
      )}

      {/* 5. TAB: ALL SYSTEM ROLES & AVATAR ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Role Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SYSTEM_ROLES.map((roleDef) => {
              const isCurrentActive = (user?.role || 'admin') === roleDef.id;
              const isInspected = selectedRoleId === roleDef.id;

              return (
                <div
                  key={roleDef.id}
                  onClick={() => setSelectedRoleId(roleDef.id)}
                  className={`group relative rounded-2xl p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    isInspected
                      ? `border-white/30 bg-[#050508] shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_${roleDef.color.glow}]`
                      : 'border-white/[0.08] bg-[#000000]/60 hover:border-white/20 hover:bg-[#07070B]'
                  }`}
                >
                  {/* Active Operator Banner */}
                  {isCurrentActive && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-950/50 text-emerald-300 font-mono text-[9px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ACTIVE IDENTITY
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Top Avatar & Role Info */}
                    <div className="flex items-start gap-4">
                      <ForensicAvatar
                        role={roleDef.id}
                        name={roleDef.name}
                        size="lg"
                        showBadge={true}
                        showStatus={true}
                        statusOnline={true}
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          {roleDef.clearanceLevel}
                        </div>
                        <h3 className="font-tech text-base font-bold text-white truncate">
                          {roleDef.name}
                        </h3>
                        <div className="text-xs font-mono text-slate-300 uppercase">
                          Role ID: {roleDef.id}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {roleDef.tagline}
                    </p>

                    {/* Permissions preview count */}
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>PERMISSIONS:</span>
                      <span className="text-slate-200 font-bold">
                        {roleDef.permissions.filter(p => p.allowed).length} GRANTED / {roleDef.permissions.length} TOTAL
                      </span>
                    </div>
                  </div>

                  {/* View Details */}
                  <div className="pt-4 mt-3 border-t border-white/[0.06] flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRoleId(roleDef.id)}
                      className={`w-full py-2 px-3 rounded-xl font-tech text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isCurrentActive
                          ? 'border border-white/10 bg-white/[0.03] text-emerald-400 cursor-pointer'
                          : 'border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-slate-300 hover:text-white cursor-pointer'
                      }`}
                    >
                      {isCurrentActive ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>CURRENT ACTIVE ROLE</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3.5 h-3.5 text-rose-300" />
                          <span>INSPECT CLEARANCE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inspected Role In-Depth Inspector Panel */}
          <div className="rounded-2xl border border-white/[0.1] bg-[#050508] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-4">
                <ForensicAvatar
                  role={inspectedRoleDef.id}
                  name={inspectedRoleDef.name}
                  size="xl"
                  showBadge={true}
                  showStatus={true}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-rose-300 font-bold uppercase">
                      {inspectedRoleDef.clearanceLevel}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {inspectedRoleDef.id}
                    </span>
                  </div>
                  <h3 className="font-tech text-xl font-bold text-white mt-1">
                    {inspectedRoleDef.name}
                  </h3>
                  <div className="text-xs font-mono text-slate-400">
                    Tier #{inspectedRoleDef.clearanceTierNumber} Intelligence Authorization
                  </div>
                </div>
              </div>
            </div>

            {/* Responsibilities & Capabilities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Core Responsibilities */}
              <div className="space-y-3">
                <h4 className="font-tech text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>OPERATIONAL RESPONSIBILITIES & JURISDICTION</span>
                </h4>
                <div className="space-y-2">
                  {(inspectedRoleDef.responsibilities || []).map((resp, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-slate-300 flex items-start gap-2.5">
                      <ChevronRight className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{resp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Explicit Permissions Checklist */}
              <div className="space-y-3">
                <h4 className="font-tech text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>ACCESS CONTROL & ACTION PERMISSIONS</span>
                </h4>
                <div className="space-y-2">
                  {(inspectedRoleDef.permissions || []).map((perm, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                        perm.allowed
                          ? 'border-emerald-500/30 bg-emerald-950/20 text-slate-200'
                          : 'border-rose-900/30 bg-rose-950/10 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {perm.allowed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold">{perm.name}</div>
                          <div className="text-[10px] text-slate-500">{perm.description}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                          perm.allowed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {perm.allowed ? 'AUTHORIZED' : 'RESTRICTED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB: SYSTEM-WIDE PERMISSIONS COMPARISON MATRIX */}
      {activeTab === 'matrix' && (
        <div className="rounded-2xl border border-white/[0.1] bg-[#000000]/90 backdrop-blur-xl p-6 overflow-x-auto shadow-2xl">
          <div className="mb-4">
            <h3 className="font-tech text-lg font-bold text-white uppercase tracking-wide">
              CROSS-ROLE CLEARANCE & CAPABILITY MATRIX
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Granular security policy mapping across all operational tiers
            </p>
          </div>

          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.1] text-slate-400">
                <th className="p-3.5 font-tech text-xs tracking-wider uppercase">CAPABILITY / OPERATION</th>
                {SYSTEM_ROLES.map(r => (
                  <th key={r.id} className="p-3.5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <ForensicAvatar role={r.id} name={r.name} size="sm" showBadge={false} showStatus={false} />
                      <span className="font-tech text-white font-bold text-[11px] uppercase truncate max-w-[100px]">{r.shortTitle}</span>
                      <span className="text-[9px] text-slate-500">LVL {r.clearanceTierNumber}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {[
                { name: 'Full Kernel & Service Override', desc: 'Reconfigure backend nodes and services', roles: ['admin'] },
                { name: 'Cryptographic Key Genesis', desc: 'Generate PGP & Ethereum smart contract keys', roles: ['admin'] },
                { name: 'Operator Provisioning & RBAC', desc: 'Create investigator accounts and assign clearance', roles: ['admin'] },
                { name: 'Case Mandate Sealing & Approval', desc: 'Approve search warrants and formal forensic seals', roles: ['admin', 'supervisor'] },
                { name: 'Inter-Agency Intel Federation', desc: 'Export anonymized subgraphs to partner law enforcement', roles: ['admin', 'supervisor'] },
                { name: 'Raw Disk / Memory Ingestion', desc: 'Upload E01, RAW, PCAP, and JSON evidentiary artifacts', roles: ['admin', 'supervisor', 'investigator'] },
                { name: 'Hypothesis Lead Triage', desc: 'Accept, investigate, or dismiss investigative leads', roles: ['admin', 'supervisor', 'investigator', 'analyst'] },
                { name: '3D Graph Topological Clustering', desc: 'Execute Louvain community & Betweenness centrality routines', roles: ['admin', 'supervisor', 'investigator', 'analyst'] },
                { name: 'On-Chain Merkle Tamper Audit', desc: 'Verify SHA-256 block attestation against Ethereum state', roles: ['admin', 'supervisor', 'investigator', 'auditor'] },
                { name: 'Court-Attested Report Export', desc: 'Generate signed JSON/CSV evidentiary reports with proofs', roles: ['admin', 'supervisor', 'investigator', 'auditor'] }
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-white">{row.name}</div>
                    <div className="text-[10px] text-slate-500">{row.desc}</div>
                  </td>
                  {SYSTEM_ROLES.map(r => {
                    const isGranted = row.roles.includes(r.id);
                    return (
                      <td key={r.id} className="p-3.5 text-center">
                        {isGranted ? (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800/40 text-slate-600 border border-slate-700/30">
                            <Lock className="w-3 h-3" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. TAB: HARDWARE SECURITY KEYS & ATTESTATION */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/[0.1] bg-[#050508] p-6 space-y-4">
            <h3 className="font-tech text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-5 h-5 text-rose-400" />
              <span>CRYPTOGRAPHIC HARDWARE ATTESTATION</span>
            </h3>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              Every investigator is authenticated via a cryptographic hardware key, ensuring all case queries and reports carry verifiable cryptographic signatures.
            </p>

            <div className="space-y-3 pt-2 font-mono text-xs">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <div className="text-[10px] text-slate-500">HARDWARE TOKEN TYPE</div>
                <div className="text-white font-bold">{activeRoleDef.securityHardware.keyType}</div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <div className="text-[10px] text-slate-500">SECURITY HOST NODE</div>
                <div className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeRoleDef.securityHardware.enclaveNode}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <div className="text-[10px] text-slate-500">PGP PUBLIC KEY FINGERPRINT</div>
                <div className="text-slate-300 font-bold break-all">{activeRoleDef.securityHardware.pgpKey}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.1] bg-[#050508] p-6 space-y-4">
            <h3 className="font-tech text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-5 h-5 text-rose-400" />
              <span>ACTIVE SESSION INVESTIGATOR CERTIFICATE</span>
            </h3>

            <div className="rounded-xl border border-slate-800 bg-[#000000] p-4 font-mono text-[11px] text-emerald-400 space-y-1 overflow-x-auto leading-relaxed select-all">
              <div>-----BEGIN NETRIX SESSION CERTIFICATE-----</div>
              <div className="text-slate-400">Version: 1.0.0-PROD</div>
              <div className="text-slate-400">Investigator: {user?.username || 'arhamk_17'} [{user?.role || 'admin'}]</div>
              <div className="text-slate-400">UUID: {user?.id || 'N/A'} // Status: {user?.is_active !== false ? 'ACTIVE' : 'DISABLED'}</div>
              <div className="text-slate-400">Genesis Node: {activeRoleDef.securityHardware.enclaveNode}</div>
              <div className="text-slate-500">Signature: {activeRoleDef.securityHardware.sha256Signature}</div>
              <div className="text-slate-500">Attestation Timestamp: {new Date().toISOString()}</div>
              <div>-----END NETRIX SESSION CERTIFICATE-----</div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>HARDWARE VERIFIED (FIPS 140-3)</span>
              </span>

              <button
                onClick={() => handleCopy(activeRoleDef.securityHardware.sha256Signature, 'cert')}
                className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.05] text-white font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedField === 'cert' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>COPY ATTESTATION</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
