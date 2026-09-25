import React from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { UserRole } from '../types';
import { ROLE_DETAILS } from '../utils/rbac';

interface AccessRestrictedProps {
  currentRole?: UserRole | string;
  requiredRole?: string;
  resourceName?: string;
  onReturnToDashboard?: () => void;
}

export const AccessRestricted: React.FC<AccessRestrictedProps> = ({
  currentRole = 'viewer',
  requiredRole = 'investigator',
  resourceName = 'This Module',
  onReturnToDashboard
}) => {
  const currentRoleMeta = ROLE_DETAILS[currentRole as UserRole] || {
    label: String(currentRole).toUpperCase(),
    description: 'Current session role permissions applied.',
    badgeColor: 'text-[#6B6760] bg-[#F7F5F0] border-[#E2DDD5]'
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#E2DDD5] rounded-[2px] p-8 text-center space-y-6 animate-fade-in">
        <div className="w-12 h-12 rounded-[2px] bg-[#FAF1F2] text-[#6E1827] border border-[#6E1827]/25 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            Security Protocol 403 · Forbidden
          </span>
          <h2 className="text-2xl font-serif font-normal tracking-tight text-[#121110]">
            Access Restricted
          </h2>
          <p className="text-xs text-[#6B6760] font-sans leading-relaxed">
            You don't have permission to access this resource.
          </p>
        </div>

        <div className="p-3.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-left space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#6B6760]">Current session role:</span>
            <span className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-medium uppercase ${currentRoleMeta.badgeColor}`}>
              {currentRoleMeta.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#6B6760]">Required clearance:</span>
            <span className="text-[#6E1827] font-semibold uppercase">
              {requiredRole.toUpperCase()} or higher
            </span>
          </div>
          <div className="text-[10px] text-[#6B6760] pt-1 border-t border-[#E2DDD5]">
            Access attempts are cryptographically timestamped and dispatched to the centralized audit ledger.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          {onReturnToDashboard && (
            <button
              onClick={onReturnToDashboard}
              className="w-full py-2.5 px-4 bg-[#121110] hover:bg-[#262524] text-white text-xs font-mono rounded-[2px] transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Overview</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
