import React, { useState } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  X,
  ShieldCheck,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  recordCount: number;
  onExportJSON: () => void;
  onExportCSV: () => void;
  details?: { label: string; value: string | number }[];
}

export const GenerateReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Cryptographically structured data export for audit and investigative discovery',
  recordCount,
  onExportJSON,
  onExportCSV,
  details = []
}) => {
  const [downloadedFormat, setDownloadedFormat] = useState<'JSON' | 'CSV' | null>(null);

  if (!isOpen) return null;

  const handleExport = (format: 'JSON' | 'CSV') => {
    if (format === 'JSON') {
      onExportJSON();
    } else {
      onExportCSV();
    }
    setDownloadedFormat(format);
    setTimeout(() => {
      setDownloadedFormat(null);
    }, 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg rounded-3xl border-2 border-[#6D001A] bg-gradient-to-b from-[#0C0204] via-[#050204] to-[#000000] p-6 sm:p-8 shadow-[0_25px_80px_rgba(109,0,26,0.35),0_0_60px_rgba(0,0,0,0.95)] text-slate-100 overflow-hidden"
        >
          {/* Subtle Ambient Burgundy Glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#6D001A]/30 blur-[90px] pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#6D001A] bg-[#6D001A]/30 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
              <FileDown className="w-3.5 h-3.5 text-rose-300" />
              <span>INTELLIGENCE EXPORT ENGINE</span>
            </div>

            <h3 className="font-tech text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              {title}
            </h3>

            <p className="font-mono text-xs text-slate-400 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Record Summary Box */}
          <div className="mt-6 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <span className="text-slate-400 uppercase">RECORDS READY FOR EXPORT</span>
              <span className="text-white font-bold px-2 py-0.5 rounded bg-[#6D001A]/40 border border-[#6D001A] text-xs">
                {recordCount} items
              </span>
            </div>

            {details.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                {details.map((d, i) => (
                  <div key={i} className="space-y-0.5">
                    <span className="text-slate-500 uppercase block">{d.label}</span>
                    <span className="text-slate-200 font-semibold truncate block">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Includes cryptographic metadata &amp; timestamp signatures</span>
            </div>
          </div>

          {/* Download Success Notice */}
          {downloadedFormat && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 font-mono text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadedFormat} intelligence report successfully exported to downloads!</span>
            </motion.div>
          )}

          {/* Export Action Buttons */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* JSON Export */}
            <button
              onClick={() => handleExport('JSON')}
              className="group p-4 rounded-2xl border border-[#6D001A] bg-[#6D001A]/20 hover:bg-[#6D001A]/45 hover:border-[#8B0024] text-left transition-all cursor-pointer flex flex-col justify-between shadow-[0_4px_20px_rgba(109,0,26,0.2)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-rose-300 group-hover:text-white transition-colors">
                  <FileCode className="w-5 h-5" />
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </div>

              <div>
                <div className="font-tech text-sm font-bold text-white uppercase tracking-wider">
                  EXPORT JSON
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Complete structured schema with investigative metadata
                </div>
              </div>
            </button>

            {/* CSV Export */}
            <button
              onClick={() => handleExport('CSV')}
              className="group p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-left transition-all cursor-pointer flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </div>

              <div>
                <div className="font-tech text-sm font-bold text-white uppercase tracking-wider">
                  EXPORT CSV
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Tabular spreadsheet format for investigative analysis
                </div>
              </div>
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>NETRIX Intelligence Export</span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
