import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  ShieldCheck,
  Lock,
  Key,
  Clock,
  Activity,
  Check,
  AlertCircle,
  Mail,
  Building,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_DETAILS, ROLE_PERMISSIONS } from '../utils/rbac';
import { UserRole } from '../types';

interface ProfilePageProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { user, logout } = useAuth();
  const currentRole = (user?.role || 'investigator') as UserRole;
  const roleMeta = ROLE_DETAILS[currentRole] || ROLE_DETAILS.investigator;
  const permissions = ROLE_PERMISSIONS[currentRole] || [];

  // Account Form State (prefilled with real backend user details)
  const [fullName, setFullName] = useState(user?.name || user?.username || 'Officer');
  const [email, setEmail] = useState(user?.email || `${user?.username || 'user'}@netrix.org`);
  const [organization, setOrganization] = useState('Criminal Intelligence Division');
  const [department, setDepartment] = useState(user?.department || 'Special Investigations Command');
  const [designation, setDesignation] = useState('Senior Forensic Graph Investigator');
  const [infoSaveSuccess, setInfoSaveSuccess] = useState<string | null>(null);

  // Password Security Form State
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sign Out Confirmation Modal State
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Compute User Initials
  const getInitials = (name?: string, emailStr?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (emailStr) return emailStr.substring(0, 2).toUpperCase();
    return 'NT';
  };

  const handleSaveAccountInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSaveSuccess('Account identity preferences updated locally.');
    setTimeout(() => setInfoSaveSuccess(null), 3500);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters in length.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password confirmation does not match.');
      return;
    }

    setPasswordSuccess('Security credentials updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(null), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 max-w-5xl mx-auto pb-20 relative z-10"
    >
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6E1D8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
            <User className="w-3.5 h-3.5" />
            <span>Authenticated Identity</span>
            <span>·</span>
            <span>Backend RBAC Enforced</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110] mt-1">
            Officer Profile & Security
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Review your authenticated NETRIX session credentials, assigned clearance level, and security status.
          </p>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="px-4 py-2.5 bg-white hover:bg-[#FAF1F2] border border-[#E6E1D8] hover:border-[#6E1827]/30 text-[#6E1827] text-xs font-mono font-medium rounded-full transition-all cursor-pointer shadow-2xs flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Session</span>
        </button>
      </div>

      {/* 2. Profile Overview Header Card */}
      <div className="p-6 sm:p-8 bg-white border border-[#E6E1D8] rounded-3xl shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-[#E6E1D8]">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#121110] text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shrink-0 border-2 border-white ring-2 ring-[#121110]/10">
              {getInitials(fullName, email)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                  OFFICER DOSSIER
                </span>
                <span className="text-xs font-mono text-[#6B6760]">·</span>
                <span className="text-xs font-mono text-[#6B6760]">ID: {user?.id || 'AUTH-SESSION'}</span>
              </div>
              <h2 className="text-2xl font-serif text-[#121110] font-medium">{fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#6B6760]">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{email}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  <span>{organization}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${roleMeta.badgeColor}`}>
              {roleMeta.label} CLEARANCE
            </span>
            <span className="text-[11px] font-mono text-emerald-800 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Session Authenticated & Active</span>
            </span>
          </div>
        </div>

        {/* 3. Account Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl">
            <span className="text-[10px] text-[#6B6760] uppercase block">Username</span>
            <span className="text-xs font-medium text-[#121110]">{user?.username || 'user'}</span>
          </div>
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl">
            <span className="text-[10px] text-[#6B6760] uppercase block">Role Privilege</span>
            <span className="text-xs font-medium text-[#6E1827] uppercase">{user?.role || 'investigator'}</span>
          </div>
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl">
            <span className="text-[10px] text-[#6B6760] uppercase block">Clearance Status</span>
            <span className="text-xs font-medium text-emerald-800 uppercase">{user?.status || 'active'}</span>
          </div>
          <div className="p-3 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl">
            <span className="text-[10px] text-[#6B6760] uppercase block">Last Active</span>
            <span className="text-xs font-medium text-[#121110]">Just now</span>
          </div>
        </div>
      </div>

      {/* 4. RBAC Clearance & Permission Matrix */}
      <div className="p-6 sm:p-8 bg-white border border-[#E6E1D8] rounded-3xl shadow-2xs space-y-6">
        <div className="pb-4 border-b border-[#E6E1D8]">
          <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
            ACCESS CONTROLS
          </span>
          <h3 className="text-xl font-serif text-[#121110] mt-0.5">
            Role & Authorization Privileges
          </h3>
          <p className="text-xs text-[#6B6760] font-sans mt-1">
            Privileges are cryptographically validated by the backend JWT and database authority.
          </p>
        </div>

        <div className="p-4 bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6E1827]" />
              <span className="text-xs font-mono font-bold text-[#121110] uppercase">
                {roleMeta.label}
              </span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${roleMeta.badgeColor}`}>
              AUTHORITATIVE
            </span>
          </div>
          <p className="text-xs font-sans text-[#6B6760] leading-relaxed">
            {roleMeta.description}
          </p>

          <div className="pt-2 space-y-2">
            <span className="text-[10px] font-mono text-[#6B6760] uppercase font-bold block">
              Authorized Workspace Modules:
            </span>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {permissions.map(perm => (
                <span key={perm} className="px-2.5 py-1 bg-white border border-[#E6E1D8] text-[#121110] rounded-full flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span>{perm.toUpperCase()}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E6E1D8] rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold">
                Confirm Sign Out
              </span>
              <h3 className="text-lg font-serif text-[#121110]">
                Terminate Authentication Session?
              </h3>
              <p className="text-xs text-[#6B6760] font-sans">
                Your credentials and active session token will be cleared from this terminal.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 font-mono text-xs">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 border border-[#E6E1D8] hover:bg-[#F8F7F4] rounded-full text-[#6B6760]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSignOutConfirm(false);
                  logout();
                }}
                className="px-4 py-2 bg-[#6E1827] hover:bg-[#4E101B] text-white rounded-full font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
