import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Terminal,
  KeyRound,
  AlertCircle,
  Radio,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Server,
  Activity,
  Cpu
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { NetrixLogo } from '../common/NetrixLogo';

export const LandingLogin: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide valid investigator credentials.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('credentials')) {
        setError('Authentication denied. Invalid username, password, or security token.');
      } else if (err.status === 429 || err.message?.includes('rate')) {
        setError('Rate limit reached. Access temporarily locked. Retry in 60 seconds.');
      } else if (!navigator.onLine || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        setError('Network connection error. Unable to connect to NETRIX server.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 lg:p-8 overflow-hidden z-10">
      {/* Background Subtle Coordinate Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(185,28,28,0.15)_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.08] pointer-events-none" />

      {/* Motion Container */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg mx-auto"
      >
        {/* Layered Glass Enclave Surface */}
        <div className="relative rounded-2xl p-8 sm:p-10 text-slate-100 bg-[#090D15]/85 border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-red-950/[0.15] before:via-transparent before:to-transparent before:pointer-events-none">
          
          {/* Subtle Top Accent Beam */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#8B0024] to-transparent opacity-80" />

          {/* Staggered Header & Logo */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-center space-y-3 mb-8 flex flex-col items-center"
          >
            {/* Centered Master Netrix Logo */}
            <div className="w-[280px] sm:w-[320px] max-w-full my-2">
              <NetrixLogo variant="full" glow={true} className="w-full" />
            </div>

            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-sans">
              Criminal Network Intelligence &amp; Investigative Analysis Platform.
            </p>
          </motion.div>

          {/* Enclave Gateway Telemetry Strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-6 p-2.5 rounded-xl border border-white/[0.06] bg-[#05080E]/70 flex items-center justify-between text-[11px] font-mono text-slate-400"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">GATEWAY SERVICE:</span>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span>TLS 1.3 ENCRYPTION</span>
              <span className="text-slate-700">|</span>
              <span>EVIDENCE INTEGRITY</span>
            </div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-start gap-2.5 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Username / Email */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="space-y-1.5"
            >
              <label className="text-[11px] font-mono tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  <span>USERNAME / EMAIL</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">IDENTIFIER</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-[#060910] focus:border-red-600 focus:bg-[#0E0C12] focus:outline-none text-slate-100 font-mono text-sm placeholder:text-slate-600 transition-all shadow-inner disabled:opacity-50"
                  placeholder="Enter authorized username or email"
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="space-y-1.5"
            >
              <label className="text-[11px] font-mono tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                  <span>PASSWORD</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">ENCRYPTED</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-white/[0.08] bg-[#060910] focus:border-red-600 focus:bg-[#0E0C12] focus:outline-none text-slate-100 font-mono text-sm placeholder:text-slate-600 transition-all shadow-inner disabled:opacity-50"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  tabIndex={-1}
                  title={showPassword ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>

            {/* Authenticate Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="pt-2"
            >
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#8B0024] to-[#6D001A] hover:from-[#9E002B] hover:to-[#7E0020] text-white font-mono font-bold text-xs sm:text-sm tracking-[0.18em] uppercase transition-all shadow-[0_0_25px_rgba(109,0,26,0.5)] flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>VERIFYING CREDENTIALS...</span>
                  </div>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          {/* Footer Security Stamp */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              <span>SECURE SESSION AUTHENTICATION</span>
            </div>
            <div>
              <span>NODE #194</span>
            </div>
          </motion.div>
        </div>

        {/* Legal Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="text-center mt-5 text-[10px] font-mono text-slate-500 tracking-wider uppercase"
        >
          Authorized law enforcement &amp; investigative intelligence access only. All sessions logged and timestamped on-chain.
        </motion.p>
      </motion.div>
    </div>
  );
};
