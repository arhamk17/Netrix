import React, { useState } from 'react';
import {
  Lock,
  Terminal,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { NetrixLogo } from '../common/NetrixLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EnclaveAuthModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

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
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('credentials')) {
        setError('Authentication denied. Invalid username, password, or security token.');
      } else if (err.status === 429 || err.message?.includes('rate')) {
        setError('Rate limit reached. Please wait a moment and try again.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 bg-[#09080E]/90 border border-[#E6003C]/40 shadow-[0_25px_80px_rgba(0,0,0,0.9)] text-slate-100 overflow-hidden"
        >
          {/* Top glowing accent line */}
          <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#E6003C] to-transparent shadow-[0_0_10px_#E6003C]" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header & Logo */}
          <div className="space-y-2 mb-6 text-center flex flex-col items-center">
            <div className="w-[260px] sm:w-[280px] max-w-full my-1">
              <NetrixLogo variant="full" glow={true} className="w-full" />
            </div>
            <p className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
              INVESTIGATOR AUTHENTICATION
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#FF2A5F]" />
                  <span>USERNAME</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">INVESTIGATOR ID</span>
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#06070B] focus:border-[#E6003C]/60 focus:outline-none text-slate-100 font-mono text-sm placeholder:text-slate-600 transition-all shadow-inner disabled:opacity-50"
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#FF2A5F]" />
                  <span>PASSWORD</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">SECURE</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-white/[0.08] bg-[#06070B] focus:border-[#E6003C]/60 focus:outline-none text-slate-100 font-mono text-sm placeholder:text-slate-600 transition-all shadow-inner disabled:opacity-50"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl border border-[#E6003C] bg-gradient-to-r from-[#E6003C] to-[#990026] hover:from-[#FF1A53] hover:to-[#B3002D] text-white font-tech font-bold text-xs uppercase tracking-[0.16em] transition-all shadow-[0_0_25px_rgba(230,0,60,0.35)] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </div>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#FF2A5F]" />
              <span>ROLE DETERMINED BY BACKEND</span>
            </div>
            <span>TLS 1.3 ENCRYPTED</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
