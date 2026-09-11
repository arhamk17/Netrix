import React, { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  Terminal,
  Send,
  X,
  FileArchive,
  Fingerprint,
  Copy,
  Download,
  ShieldAlert,
  User,
  Clock,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { AIAskResponse } from '../../types';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  context_facts_used?: number;
  confidence?: string;
  timestamp: string;
}

export const AIConsoleModal: React.FC = () => {
  const { activeCase, aiConsoleOpen, setAiConsoleOpen } = useAuth();
  const [inputQuery, setInputQuery] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'ai',
      text: 'NETRIX Investigative Intelligence Console online. Loaded active case graph, timeline sequence bursts, and cryptographic custody records. How may I assist your investigation?',
      context_facts_used: 14,
      confidence: 'HIGH',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  if (!aiConsoleOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || !activeCase) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsAnalyzing(true);

    try {
      const caseId = activeCase.id || activeCase.case_id;
      const conversationHistory = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        content: m.text
      }));

      const res: AIAskResponse = await api.askAI(textToSend.trim(), caseId, conversationHistory);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        context_facts_used: res.context_facts_used,
        confidence: res.confidence,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Error communicating with Intelligence Engine: ${err.message || 'Service unavailable'}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportChat = () => {
    const chatContent = JSON.stringify(messages, null, 2);
    const blob = new Blob([chatContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NETRIX_INTELLIGENCE_DOSSIER_${activeCase?.case_id || 'EXPORT'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="glass-panel rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-red-900/40 shadow-2xl overflow-hidden bg-[#07090F]/95">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-[#090C16] flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-red-800/40 bg-red-950/40 text-rose-400 flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.3)]">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-tech text-base font-bold text-slate-100">
                  INVESTIGATIVE INTELLIGENCE CONSOLE
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded border border-red-800/40 text-rose-300 bg-red-950/30">
                  ANALYTICAL CORE
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                ACTIVE CASE CONTEXT: <strong className="text-rose-300">{activeCase?.case_id || activeCase?.case_number}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportChat}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              title="Export Transcript (JSON)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAiConsoleOpen(false)}
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono text-[10px] flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>
            INVESTIGATIVE INTEGRITY: Citations reflect cryptographically sealed evidence files. Hypotheses and predicted links require investigator corroboration.
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-mono text-xs">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  msg.sender === 'user'
                    ? 'border-red-800/40 bg-red-950/40 text-rose-300'
                    : 'border-white/10 bg-slate-900 text-slate-300'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4 text-rose-400" />}
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  msg.sender === 'user'
                    ? 'border-red-900/40 bg-[#160B0F] text-slate-100 rounded-tr-none'
                    : 'border-white/10 bg-[#0A0E18] text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 gap-4">
                  <span>{msg.sender === 'user' ? 'LEAD INVESTIGATOR' : 'INTELLIGENCE ENGINE'}</span>
                  <div className="flex items-center gap-2">
                    {msg.sender === 'ai' && (
                      <div className="flex items-center gap-1 text-[9px] font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">FACT</span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">OBSERVED</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">PREDICTED</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">EXPLANATION</span>
                      </div>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>

                {/* Grounding & Confidence Metadata */}
                {msg.sender === 'ai' && (
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-rose-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>GROUNDED IN {msg.context_facts_used ?? 0} GRAPH FACTS</span>
                      </span>
                    </div>

                    {msg.confidence && (
                      <span
                        className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${
                          msg.confidence === 'HIGH'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30'
                            : 'border-amber-500/40 text-amber-300 bg-amber-950/30'
                        }`}
                      >
                        CONFIDENCE: {msg.confidence}
                      </span>
                    )}
                  </div>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => copyToClipboard(msg.text, msg.id)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === msg.id ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-7 h-7 rounded-lg border border-red-800/40 bg-red-950/40 text-rose-400 flex items-center justify-center shrink-0 animate-pulse">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-none border border-red-900/40 bg-[#0E0B12] text-rose-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs">CROSS-REFERENCING GRAPH TOPOLOGY &amp; SHA-256 REGISTRIES...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-[#070A12]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Terminal className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputQuery}
                onChange={e => setInputQuery(e.target.value)}
                placeholder="Ask intelligence console to analyze evidence, graph paths, or transaction flows..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#090E1A] border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-red-600/60"
              />
            </div>

            <button
              type="submit"
              disabled={isAnalyzing || !inputQuery.trim()}
              className="px-4 py-2.5 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#8B0024] to-[#6D001A] hover:from-[#9E002B] hover:to-[#7E0020] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(109,0,26,0.4)]"
            >
              <span>DISPATCH</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
