import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  BrainCircuit,
  Lock,
  User,
  Cpu,
  Key,
  Database,
  Radio
} from 'lucide-react';
import type { UserRole } from '../../types';
import { getRoleDefinition } from '../../data/rolesData';

interface Props {
  role?: UserRole | string;
  name?: string;
  avatarStyle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showBadge?: boolean;
  showStatus?: boolean;
  statusOnline?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const ForensicAvatar: React.FC<Props> = ({
  role = 'investigator',
  name = 'Operator',
  avatarStyle,
  size = 'md',
  showBadge = true,
  showStatus = true,
  statusOnline = true,
  interactive = false,
  onClick,
  className = ''
}) => {
  const roleDef = getRoleDefinition(role);
  const initials = (name || roleDef.defaultUser.full_name)
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sizeStyles = {
    xs: {
      container: 'w-7 h-7',
      text: 'text-[10px]',
      icon: 'w-3 h-3',
      badge: 'w-3 h-3 text-[7px]',
      status: 'w-2 h-2',
      ring: 'p-0.5'
    },
    sm: {
      container: 'w-9 h-9',
      text: 'text-xs',
      icon: 'w-4 h-4',
      badge: 'w-3.5 h-3.5 text-[8px]',
      status: 'w-2.5 h-2.5',
      ring: 'p-0.5'
    },
    md: {
      container: 'w-12 h-12',
      text: 'text-sm font-bold',
      icon: 'w-5 h-5',
      badge: 'px-1.5 py-0.2 text-[8px]',
      status: 'w-3 h-3',
      ring: 'p-1'
    },
    lg: {
      container: 'w-16 h-16',
      text: 'text-base font-bold',
      icon: 'w-7 h-7',
      badge: 'px-2 py-0.5 text-[9px]',
      status: 'w-3.5 h-3.5',
      ring: 'p-1'
    },
    xl: {
      container: 'w-24 h-24',
      text: 'text-xl font-bold font-tech tracking-wider',
      icon: 'w-10 h-10',
      badge: 'px-2.5 py-1 text-[10px]',
      status: 'w-4 h-4',
      ring: 'p-1.5'
    },
    '2xl': {
      container: 'w-32 h-32',
      text: 'text-3xl font-bold font-tech tracking-widest',
      icon: 'w-14 h-14',
      badge: 'px-3 py-1 text-xs',
      status: 'w-5 h-5',
      ring: 'p-2'
    }
  }[size];

  const getRoleIcon = () => {
    switch (role) {
      case 'admin':
        return <ShieldAlert className={`${sizeStyles.icon} text-rose-300`} />;
      case 'supervisor':
        return <ShieldCheck className={`${sizeStyles.icon} text-blue-300`} />;
      case 'investigator':
        return <Fingerprint className={`${sizeStyles.icon} text-emerald-300`} />;
      case 'analyst':
        return <BrainCircuit className={`${sizeStyles.icon} text-rose-300`} />;
      case 'auditor':
        return <Lock className={`${sizeStyles.icon} text-amber-300`} />;
      default:
        return <User className={`${sizeStyles.icon} text-slate-300`} />;
    }
  };

  const getRoleCode = () => {
    switch (role) {
      case 'admin':
        return 'ADM';
      case 'supervisor':
        return 'SUP';
      case 'investigator':
        return 'INV';
      case 'analyst':
        return 'ANL';
      case 'auditor':
        return 'AUD';
      default:
        return 'OPS';
    }
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeStyles.container} ${
        interactive ? 'cursor-pointer group hover:scale-105 transition-transform duration-200' : ''
      } ${className}`}
      title={`${roleDef.name} — ${name}`}
    >
      {/* Outer Holographic Glow Ring */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${roleDef.avatarConfig.ringGradient} opacity-75 blur-[3px] group-hover:opacity-100 transition-opacity`}
      />

      {/* Futuristic Outer Border & Scan Shell */}
      <div
        className={`relative w-full h-full rounded-2xl bg-gradient-to-b ${roleDef.avatarConfig.bgGradient} border ${roleDef.color.border} p-1 flex items-center justify-center overflow-hidden shadow-2xl`}
      >
        {/* Cyber Grid Background lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:6px_6px]" />

        {/* Ambient Top Light Beam */}
        <div className="absolute -top-6 inset-x-0 h-10 bg-white/20 blur-md pointer-events-none transform -rotate-12" />

        {/* Center Emblem / Initials Container */}
        <div className="relative z-10 w-full h-full rounded-xl bg-[#000000]/70 flex flex-col items-center justify-center border border-white/10 overflow-hidden backdrop-blur-sm">
          {/* Subtle Scanline Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none opacity-30" />

          {size === 'xs' || size === 'sm' ? (
            <span className={`${sizeStyles.text} font-mono font-bold text-white tracking-tighter`}>
              {initials}
            </span>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="transition-transform duration-200 group-hover:scale-110">
                {getRoleIcon()}
              </div>
              {(size === 'xl' || size === '2xl') && (
                <span className={`${sizeStyles.text} text-white font-tech mt-1 tracking-wider`}>
                  {initials}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Role Badge Indicator */}
      {showBadge && (size === 'md' || size === 'lg' || size === 'xl' || size === '2xl') && (
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 ${sizeStyles.badge} rounded-md border border-white/30 ${roleDef.color.badgeBg} text-white font-mono font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap`}
        >
          <span>{getRoleCode()}</span>
        </div>
      )}

      {/* Online Status Beacon */}
      {showStatus && (
        <div
          className={`absolute -top-1 -right-1 z-20 ${sizeStyles.status} rounded-full border-2 border-[#000000] ${
            statusOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-slate-600'
          }`}
        >
          {statusOnline && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          )}
        </div>
      )}
    </div>
  );
};
