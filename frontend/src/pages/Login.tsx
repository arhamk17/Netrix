import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { apiClient } from '../api/client';
import { User } from '../types';
import { NetrixLogo } from '../components/common/NetrixLogo';

// Lazy-load non-critical dynamic visual backgrounds
const SubtleNetworkCanvas = lazy(() =>
  import('../components/SubtleNetworkCanvas').then((m) => ({ default: m.SubtleNetworkCanvas }))
);
const AnimatedBackground = lazy(() =>
  import('../components/AnimatedBackground').then((m) => ({ default: m.AnimatedBackground }))
);

interface LoginProps {
  onLoginSuccess: (token: string, user: User) => void;
  onBackToHome?: () => void;
}

type AuthStatus = 'idle' | 'authenticating' | 'granted' | 'error';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Progressive background stages:
  // Stage 0: Instant static paper canvas (frame 0, zero JS execution overhead)
  // Stage 1: Ambient soft background (~60ms)
  // Stage 2: Dynamic interactive network canvas (~160ms after form is interactive)
  const [visualStage, setVisualStage] = useState<0 | 1 | 2>(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    // If reduced motion is requested, load static background immediately
    if (prefersReduced) {
      setVisualStage(2);
      return;
    }

    const t1 = setTimeout(() => {
      setVisualStage(1);
    }, 60);

    const t2 = setTimeout(() => {
      setVisualStage(2);
    }, 180);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [prefersReduced]);

  // Interactive States
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    'invalid' | 'expired' | 'disabled' | 'unauthorized' | 'rate_limited' | 'server' | null
  >(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your clearance username and password.');
      setErrorType('invalid');
      return;
    }

    setAuthStatus('authenticating');
    setErrorMessage(null);
    setErrorType(null);

    try {
      const result = await apiClient.auth.login(identifier.trim(), password);
      setAuthStatus('granted');
      setTimeout(() => {
        onLoginSuccess(result.token, result.user);
      }, 500);
    } catch (err: any) {
      setAuthStatus('error');
      const msg = err.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);

      if (msg.includes('disabled') || msg.includes('suspended')) {
        setErrorType('disabled');
      } else if (msg.includes('expired')) {
        setErrorType('expired');
      } else if (msg.includes('locked') || msg.includes('Too many') || msg.includes('429')) {
        setErrorType('rate_limited');
      } else if (msg.includes('unauthorized') || msg.includes('forbidden')) {
        setErrorType('unauthorized');
      } else if (msg.includes('connect') || msg.includes('500') || msg.includes('unavailable')) {
        setErrorType('server');
      } else {
        setErrorType('invalid');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#121110] flex flex-col justify-between selection:bg-[#6E1827] selection:text-white relative overflow-x-hidden font-sans">
      {/* 1. Progressive Living Network Background */}
      {visualStage >= 1 ? (
        <Suspense fallback={<div className="fixed inset-0 pointer-events-none z-0 bg-[#F7F5F0]" />}>
          <AnimatedBackground context="auth" />
        </Suspense>
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 bg-[#F7F5F0]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 20%, rgba(110, 24, 39, 0.03) 0%, transparent 70%)'
          }}
        />
      )}

      {/* Top Application Bar with Navigation */}
      <header className="h-16 px-6 sm:px-12 flex items-center justify-between border-b border-[#E2DDD5] bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="flex items-center gap-2 text-xs font-mono text-[#6B6760] hover:text-[#121110] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>RETURN TO OVERVIEW</span>
            </button>
          )}
          <NetrixLogo size="xs" variant="horizontal" glow={false} showSubtext={false} />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#6B6760]">
          <span className="hidden sm:inline">AUTHENTICATION GATEWAY</span>
          <span className="hidden sm:inline">·</span>
          <span className="text-[#6E1827] font-semibold">JWT & RBAC ENFORCED</span>
        </div>
      </header>

      {/* Main Split-Screen Architecture */}
      <main className="flex-1 flex items-stretch">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px-48px)]">
          {/* ========================================================================= */}
          {/* LEFT SIDE: NETRIX BRANDING & SUBTLE NETWORK VISUALIZATION               */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 p-8 sm:p-14 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E2DDD5] bg-[#F7F5F0] relative overflow-hidden">
            {/* Top Branding Block */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4 relative z-10"
            >
              <NetrixLogo size="lg" variant="horizontal" glow={true} showSubtext={true} />

              <div className="space-y-3 pt-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal tracking-tight text-[#121110] leading-tight">
                  See what the data doesn't.
                </h1>
                <p className="text-sm text-[#6B6760] max-w-lg leading-relaxed font-sans">
                  Heterogeneous link prediction and cryptographic custody verification for high-consequence criminal network investigations.
                </p>
              </div>
            </motion.div>

            {/* Middle: Subtle Dynamic Canvas Network Visualization */}
            <div className="my-8 w-full h-72 sm:h-80 border border-[#E2DDD5] bg-white rounded-[2px] overflow-hidden relative">
              {visualStage >= 2 ? (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-white/60">
                      <div className="w-5 h-5 border border-[#6E1827]/30 border-t-[#6E1827] rounded-full animate-spin" />
                    </div>
                  }
                >
                  <SubtleNetworkCanvas className="w-full h-full" />
                </Suspense>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white">
                  <svg className="w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                    <line x1="20%" y1="35%" x2="50%" y2="50%" stroke="#6E1827" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="80%" y1="30%" x2="50%" y2="50%" stroke="#121110" strokeWidth="0.8" />
                    <line x1="50%" y1="50%" x2="30%" y2="70%" stroke="#121110" strokeWidth="0.8" />
                    <line x1="50%" y1="50%" x2="75%" y2="65%" stroke="#6E1827" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx="50%" cy="50%" r="4" fill="#6E1827" />
                    <circle cx="20%" cy="35%" r="3" fill="#121110" />
                    <circle cx="80%" cy="30%" r="3" fill="#121110" />
                    <circle cx="30%" cy="70%" r="3" fill="#121110" />
                    <circle cx="75%" cy="65%" r="3.5" fill="#6E1827" />
                  </svg>
                </div>
              )}

              <div className="absolute top-3 left-3 text-[10px] font-mono text-[#6B6760] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6E1827] animate-pulse" />
                <span>RELATIONAL TOPOLOGY SYNTHESIS</span>
              </div>

              <div className="absolute bottom-3 right-3 text-[9px] font-mono text-[#6B6760] tracking-wider">
                CRYPTOGRAPHIC INTEGRITY ASSURED
              </div>
            </div>

            {/* Bottom Metadata Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-3 gap-4 pt-4 border-t border-[#E2DDD5] text-xs font-mono text-[#6B6760]"
            >
              <div>
                <span className="text-[9px] uppercase tracking-wider block text-[#6B6760]">CLEARANCE PROTOCOL</span>
                <span className="text-[#121110] font-medium">STRICT RBAC</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider block text-[#6B6760]">EVIDENCE INTEGRITY</span>
                <span className="text-emerald-800 font-medium">SHA-256 ANCHORED</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider block text-[#6B6760]">INTELLIGENCE MODEL</span>
                <span className="text-[#121110] font-medium">LOCAL GNN ENGINE</span>
              </div>
            </motion.div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE: AUTHENTICATION PANEL                                         */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-white relative">
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md w-full mx-auto space-y-6"
            >
              {/* Header Title */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <NetrixLogo size="sm" variant="horizontal" glow={true} showSubtext={false} />
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] text-[#6B6760]">
                    SECURE ACCESS
                  </span>
                </div>
                <p className="text-xs font-mono text-[#6B6760] tracking-wide">
                  Sign in with authorized investigation credentials
                </p>
              </div>

              {/* Error Message Box */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-[#6E1827]/10 border border-[#6E1827]/30 rounded-[2px] text-xs font-mono text-[#6E1827] space-y-1"
                  >
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        {errorType === 'disabled'
                          ? 'ACCOUNT SUSPENDED'
                          : errorType === 'expired'
                          ? 'SESSION EXPIRED'
                          : errorType === 'rate_limited'
                          ? 'TEMPORARY LOCKOUT'
                          : errorType === 'unauthorized'
                          ? 'ACCESS DENIED'
                          : errorType === 'server'
                          ? 'GATEWAY UNAVAILABLE'
                          : 'AUTHENTICATION FAILED'}
                      </span>
                    </div>
                    <p className="text-[11px] font-sans text-[#6E1827] leading-relaxed">
                      {errorMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Auth Form */}
              <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
                <div className="space-y-1">
                  <label className="block text-[11px] text-[#6B6760] uppercase">
                    Clearance Identifier / Username
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your assigned username"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2DDD5] text-sm text-[#121110] rounded-[2px] focus:outline-none focus:border-[#6E1827] focus:ring-1 focus:ring-[#6E1827] transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#6B6760] uppercase">
                    Passphrase
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 bg-white border border-[#E2DDD5] text-sm text-[#121110] rounded-[2px] focus:outline-none focus:border-[#6E1827] focus:ring-1 focus:ring-[#6E1827] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#6B6760] hover:text-[#121110] transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action Button with Status Animations */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authStatus === 'authenticating' || authStatus === 'granted'}
                    className={`w-full py-3 px-4 rounded-[2px] text-xs font-mono font-medium tracking-wider uppercase transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827] ${
                      authStatus === 'granted'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-[#6E1827] text-white hover:bg-[#4E101B]'
                    } disabled:opacity-90`}
                  >
                    {authStatus === 'authenticating' ? (
                      <div className="flex items-center gap-2">
                        <span>AUTHENTICATING</span>
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    ) : authStatus === 'granted' ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-white" />
                        <span>ACCESS GRANTED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>AUTHENTICATE & ENTER</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                </div>
              </form>

              {/* Security and Compliance Seal */}
              <div className="pt-6 border-t border-[#E2DDD5] text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-[#6B6760]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                  <span>SESSION PROTECTED UNDER CJIS & NIST ENCRYPTION</span>
                </div>
                <p className="text-[10px] text-[#8C877E] leading-tight">
                  Unauthorized access attempts are monitored, logged, and cryptographically anchored.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 px-6 sm:px-12 border-t border-[#E2DDD5] bg-white flex items-center justify-between text-[11px] font-mono text-[#6B6760]">
        <div className="flex items-center gap-2.5">
          <img src="/LOGONETRIX.png" alt="NETRIX" className="w-4 h-4 object-contain" />
          <span>NETRIX CRIMINAL NETWORK INTELLIGENCE · SECURE SYSTEM</span>
        </div>
        <div>STRICT RBAC AUTHORIZATION</div>
      </footer>
    </div>
  );
};
