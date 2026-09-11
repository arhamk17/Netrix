import React, { useState, useEffect } from 'react';
import {
  History,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Filter,
  ArrowRight,
  FileArchive,
  Activity,
  Layers,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { TimelineEvent } from '../../types';

export const TemporalIntelligence: React.FC = () => {
  const { currentCaseId, activeCase } = useAuth();
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  useEffect(() => {
    async function loadTimeline() {
      if (!currentCaseId) return;
      setLoading(true);
      try {
        const events = await api.getTimeline(currentCaseId);
        if (Array.isArray(events) && events.length > 0) {
          // Sort chronologically
          const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setTimelineEvents(sorted);
          setSelectedEvent(sorted[0]);
          setPlaybackIndex(sorted.length - 1);
        } else {
          setTimelineEvents([]);
          setSelectedEvent(null);
        }
      } catch (err) {
        console.error('Failed to load timeline events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTimeline();
  }, [currentCaseId]);

  // Automated step-through playback timer
  useEffect(() => {
    let timer: any;
    if (isPlaying && timelineEvents.length > 0) {
      timer = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= timelineEvents.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const nextIndex = prev + 1;
          setSelectedEvent(timelineEvents[nextIndex]);
          return nextIndex;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timelineEvents]);

  const filteredEvents = timelineEvents.filter(ev => {
    if (severityFilter === 'ALL') return true;
    return ev.severity === severityFilter;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'BURST':
      case 'ANOMALOUS':
        return 'border-rose-500/50 text-rose-400 bg-rose-950/40 animate-pulse';
      case 'ELEVATED':
        return 'border-amber-500/50 text-amber-400 bg-amber-950/40';
      case 'NORMAL':
      default:
        return 'border-slate-700 text-slate-300 bg-slate-800/40';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400 font-mono text-xs">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
        <p>RECONSTRUCTING TEMPORAL EVENT SEQUENCE...</p>
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex items-center gap-2.5">
          <History className="w-6 h-6 text-rose-400" />
          <h2 className="font-tech text-2xl font-bold text-slate-100 uppercase tracking-wide">
            TEMPORAL INTELLIGENCE &amp; EVENT SEQUENCING
          </h2>
        </div>
        <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center font-mono text-xs text-slate-500 space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <p>No chronological events recorded for the active case.</p>
          <p className="text-[11px] text-slate-600">Ingest timestamped investigative evidence or communications to populate the timeline stream.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-tech text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <History className="w-6 h-6 text-rose-400" />
            <span>TEMPORAL INTELLIGENCE &amp; EVENT SEQUENCING</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Chronological event stream with anomalous frequency detection, C2 burst spikes, and communications
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              isPlaying
                ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                : 'border-red-900/40 bg-red-950/30 text-rose-300 hover:bg-red-900/40'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE SEQUENCE' : 'REPLAY TEMPORAL ARC'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setPlaybackIndex(0);
            }}
            className="p-1.5 rounded-lg border border-slate-800 bg-[#0A101C] hover:border-slate-700 text-slate-400 cursor-pointer"
            title="Rewind to Inception"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Scrubber Card */}
      <div className="glass-panel rounded-xl p-4 border border-white/10 space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">SEVERITY FILTER:</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-[#070C16] border border-slate-800 text-slate-200 text-xs focus:outline-none"
            >
              <option value="ALL">ALL EVENTS ({timelineEvents.length})</option>
              <option value="BURST">BURST / ANOMALOUS</option>
              <option value="ELEVATED">ELEVATED</option>
              <option value="NORMAL">NORMAL TRAFFIC</option>
            </select>
          </div>

          <div className="text-slate-400">
            FRAME {playbackIndex + 1} OF {timelineEvents.length} ACTIVE
          </div>
        </div>

        {/* Timeline Range Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={Math.max(0, timelineEvents.length - 1)}
            value={playbackIndex}
            onChange={e => setPlaybackIndex(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>INCEPTION: {timelineEvents[0]?.timestamp ? new Date(timelineEvents[0].timestamp).toLocaleDateString() : 'START'}</span>
            <span>PRESENT: {timelineEvents[timelineEvents.length - 1]?.timestamp ? new Date(timelineEvents[timelineEvents.length - 1].timestamp).toLocaleDateString() : 'END'}</span>
          </div>
        </div>
      </div>

      {/* Timeline Stream & Event Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Chronological Events List */}
        <div className="lg:col-span-8 space-y-3 font-mono text-xs">
          {filteredEvents.map((ev, index) => {
            const isSelected = selectedEvent?.id === ev.id;
            const isVisibleInScrubber = index <= playbackIndex;

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  !isVisibleInScrubber ? 'opacity-30' : 'opacity-100'
                } ${
                  isSelected
                    ? 'border-red-600/50 bg-[#140B10] shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                    : 'border-white/10 bg-[#080E1B] hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                      {ev.event_type}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(ev.severity)}`}>
                      {ev.severity}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-100 font-semibold text-xs mb-1.5">
                  <span className="text-rose-300">{ev.source_entity}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-rose-300">{ev.target_entity}</span>
                </div>

                <p className="text-slate-400 font-sans text-xs leading-relaxed mb-2">
                  {ev.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                  <div className="flex items-center gap-1 text-rose-300">
                    <FileArchive className="w-3 h-3 text-rose-400" />
                    <span>Artifact: {ev.evidence_ref}</span>
                  </div>
                  <div className="text-slate-400">
                    Anomaly Score: <strong className="text-slate-200">{(((ev.anomaly_score ?? 0.7)) * 100).toFixed(0)}%</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Event Dossier */}
        <div className="lg:col-span-4">
          {selectedEvent ? (
            <div className="glass-panel rounded-xl p-5 border border-red-900/40 font-mono text-xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div>
                  <span className="text-[10px] text-rose-400 uppercase tracking-widest block">
                    EVENT TELEMETRY DOSSIER
                  </span>
                  <span className="font-tech text-base font-bold text-slate-100">
                    {selectedEvent.id}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(selectedEvent.severity)}`}>
                  {selectedEvent.severity}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">TIMESTAMP OF RECORD</span>
                <p className="text-slate-200 font-bold">
                  {new Date(selectedEvent.timestamp).toUTCString()}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-slate-400">INVOLVED ENTITY HOPS</span>
                <div className="p-2.5 rounded bg-black/40 border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[10px]">SOURCE:</div>
                  <div className="font-bold text-slate-200">{selectedEvent.source_entity}</div>
                  <div className="text-slate-400 text-[10px] mt-2">TARGET:</div>
                  <div className="font-bold text-slate-200">{selectedEvent.target_entity}</div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">INTELLIGENCE EVENT SUMMARY</span>
                <p className="text-xs text-slate-300 font-sans leading-relaxed bg-[#070D18] p-3 rounded-lg border border-slate-800">
                  {selectedEvent.description}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400">ASSOCIATED EVIDENCE REFERENCE</span>
                <div className="p-2 rounded bg-red-950/30 border border-red-900/30 text-rose-300 flex items-center justify-between">
                  <span>{selectedEvent.evidence_ref}</span>
                  <span className="text-emerald-400 text-[10px]">VERIFIED</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 font-mono text-xs">
              SELECT AN EVENT FROM THE SEQUENCE TO INSPECT
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
