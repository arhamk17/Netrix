import React, { useEffect, useState, useRef } from 'react';
import {
  Clock,
  Filter,
  AlertTriangle,
  Calendar,
  Info,
  RefreshCw,
  FileText,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Sliders,
  Activity,
  Layers,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Entity, GraphData } from '../types';

export const TimelinePage: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-09-30');

  // Temporal Intelligence Playback States (Inspired by arhamk17/Netrix)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'BURST' | 'ANOMALOUS' | 'ELEVATED' | 'NORMAL'>('ALL');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const fetchTimelineData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.graph.getGraphData();
      setGraphData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch timeline metadata.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();
  }, []);

  // Filter and sort events based on active timestamp criteria
  const rawEvents = graphData
    ? graphData.nodes
        .filter(n => n.type === 'event' && n.properties.Timestamp)
        .filter(n => {
          const dateStr = (n.properties.Timestamp as string).substring(0, 10);
          return dateStr >= startDate && dateStr <= endDate;
        })
        .sort((a, b) => {
          return new Date(a.properties.Timestamp as string).getTime() - new Date(b.properties.Timestamp as string).getTime();
        })
    : [];

  // Categorize event severity for temporal analysis
  const enrichedEvents = rawEvents.map((evt, idx) => {
    const risk = evt.riskScore || 50;
    let severity: 'BURST' | 'ANOMALOUS' | 'ELEVATED' | 'NORMAL' = 'NORMAL';
    if (risk >= 85 || evt.label.toLowerCase().includes('blackout') || evt.label.toLowerCase().includes('bypass')) {
      severity = 'ANOMALOUS';
    } else if (risk >= 70 || evt.label.toLowerCase().includes('wire') || evt.label.toLowerCase().includes('burst')) {
      severity = 'BURST';
    } else if (risk >= 55) {
      severity = 'ELEVATED';
    }
    return { ...evt, severity };
  });

  const filteredEvents = enrichedEvents.filter(ev => {
    if (severityFilter === 'ALL') return true;
    return ev.severity === severityFilter;
  });

  // Keep playback index in bounds
  useEffect(() => {
    if (playbackIndex >= filteredEvents.length && filteredEvents.length > 0) {
      setPlaybackIndex(filteredEvents.length - 1);
    }
  }, [filteredEvents.length, playbackIndex]);

  // Automated step-through playback timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && filteredEvents.length > 0) {
      timer = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= filteredEvents.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const nextIndex = prev + 1;
          setSelectedEventId(filteredEvents[nextIndex].id);
          return nextIndex;
        });
      }, 1600);
    }
    return () => clearInterval(timer);
  }, [isPlaying, filteredEvents]);

  const activeEvent = filteredEvents[playbackIndex] || filteredEvents[0];

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'ANOMALOUS':
        return 'border-[#6D001A]/30 text-[#6D001A] bg-[#6D001A]/10 font-bold';
      case 'BURST':
        return 'border-amber-300 text-amber-900 bg-amber-50 font-bold';
      case 'ELEVATED':
        return 'border-blue-300 text-blue-900 bg-blue-50 font-bold';
      case 'NORMAL':
      default:
        return 'border-gray-200 text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-8" id="timeline-workspace">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200 pb-5" id="timeline-header">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#6D001A] uppercase font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#6D001A]" />
            TEMPORAL INTELLIGENCE & EVENT SEQUENCING
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-1">Operational Timeline Replay</h1>
          <p className="text-xs font-mono text-gray-500 mt-0.5">
            Chronological reconstruction of clandestine actions, telemetry bursts, and meeting windows
          </p>
        </div>

        {/* Date Filter Box */}
        <div className="flex items-center gap-3 mt-4 md:mt-0 text-xs font-mono" id="timeline-date-filters">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 bg-white rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-900 font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-200 bg-white rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-900 font-mono"
            />
          </div>
          <button
            onClick={fetchTimelineData}
            className="p-1.5 border border-gray-200 rounded hover:border-gray-900 bg-white cursor-pointer"
            title="Refresh Timeline"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Temporal Playback Controller Bar (Inspired by arhamk17/Netrix) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Media Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-[#6D001A] hover:bg-[#8B0024] text-white shadow-2xs'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY SEQUENCE'}</span>
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIndex(Math.max(0, playbackIndex - 1));
              }}
              disabled={playbackIndex === 0}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              title="Step Backward"
            >
              <SkipBack className="w-3.5 h-3.5 text-gray-700" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIndex(Math.min(filteredEvents.length - 1, playbackIndex + 1));
              }}
              disabled={playbackIndex >= filteredEvents.length - 1}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              title="Step Forward"
            >
              <SkipForward className="w-3.5 h-3.5 text-gray-700" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIndex(0);
              }}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
              title="Reset Timeline to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="hidden sm:block pl-2 text-xs font-mono text-gray-500">
              Event <span className="font-bold text-gray-900">{filteredEvents.length > 0 ? playbackIndex + 1 : 0}</span> of{' '}
              <span className="font-bold text-gray-900">{filteredEvents.length}</span>
            </div>
          </div>

          {/* Severity Classification Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-gray-400 uppercase mr-1">Filter:</span>
            {(['ALL', 'BURST', 'ANOMALOUS', 'ELEVATED', 'NORMAL'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => {
                  setSeverityFilter(sev);
                  setPlaybackIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-[#0D0D0C] text-white font-bold'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Scrubber */}
        {filteredEvents.length > 0 && (
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={filteredEvents.length - 1}
              value={playbackIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setPlaybackIndex(Number(e.target.value));
              }}
              className="w-full accent-[#6D001A] cursor-pointer"
            />
            <div className="flex justify-between text-[10.5px] font-mono text-gray-400">
              <span>{filteredEvents[0]?.properties.Timestamp ? String(filteredEvents[0].properties.Timestamp).substring(0, 10) : ''}</span>
              <span className="text-[#6D001A] font-bold">
                {activeEvent ? String(activeEvent.properties.Timestamp).substring(0, 19).replace('T', ' ') : ''} UTC
              </span>
              <span>{filteredEvents[filteredEvents.length - 1]?.properties.Timestamp ? String(filteredEvents[filteredEvents.length - 1].properties.Timestamp).substring(0, 10) : ''}</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16" id="timeline-loading">
          <span className="text-xs font-mono text-gray-400 animate-pulse uppercase">
            Reconstructing temporal event sequence across distributed nodes...
          </span>
        </div>
      ) : error ? (
        <div className="text-center py-12 border border-red-200 rounded-lg bg-red-50 text-red-700 font-mono text-xs" id="timeline-error">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl bg-white text-gray-400 font-mono text-xs" id="timeline-empty">
          No operational events detected matching the active severity filter.
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-200 space-y-10" id="timeline-chronological-flow">
          {filteredEvents.map((evt, index) => {
            const timestamp = evt.properties.Timestamp as string;
            const dateObj = new Date(timestamp);
            const relativeProperties = Object.entries(evt.properties).filter(([k]) => k !== 'Timestamp');
            const isCurrentlyActive = index === playbackIndex;

            return (
              <div
                key={evt.id}
                onClick={() => {
                  setPlaybackIndex(index);
                  setSelectedEventId(evt.id);
                }}
                className={`relative flex flex-col md:flex-row gap-4 md:gap-8 transition-all duration-300 cursor-pointer ${
                  isCurrentlyActive ? 'scale-[1.01]' : 'opacity-85 hover:opacity-100'
                }`}
                id={`timeline-evt-${evt.id}`}
              >
                {/* Timeline node icon */}
                <div
                  className={`absolute left-[-32px] sm:left-[-40px] top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shadow-xs z-10 transition-colors ${
                    isCurrentlyActive
                      ? 'bg-[#6D001A] border-[#6D001A] text-white ring-4 ring-[#6D001A]/20'
                      : 'bg-white border-gray-400 text-gray-700'
                  }`}
                >
                  <Clock className="h-2.5 w-2.5" />
                </div>

                {/* Left Side: Specific DateTime markers */}
                <div className="md:w-32 shrink-0 text-left md:text-right" id="timeline-date-side">
                  <span className={`text-xs font-mono font-bold block uppercase tracking-wider ${isCurrentlyActive ? 'text-[#6D001A]' : 'text-gray-900'}`}>
                    {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 uppercase mt-0.5 block">
                    {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                  </span>
                </div>

                {/* Right Side: Detailed Event discovery card */}
                <div
                  className={`flex-1 rounded-xl p-5 space-y-3 transition-all ${
                    isCurrentlyActive
                      ? 'bg-white border-2 border-[#6D001A] shadow-md'
                      : 'bg-white border border-gray-200 shadow-2xs hover:border-gray-400'
                  }`}
                  id="timeline-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2 text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 uppercase tracking-wider">
                        EVENT ID: {evt.id.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded border text-[9.5px] uppercase ${getSeverityBadge(evt.severity)}`}>
                        {evt.severity}
                      </span>
                    </div>

                    <span className="px-1.5 py-0.5 border border-gray-200 bg-gray-50 text-gray-700 rounded text-[10px] font-semibold uppercase">
                      Risk Score: {evt.riskScore}%
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-gray-900 mt-1">
                    {evt.label}
                  </h3>

                  {/* Attributes table */}
                  <div className="space-y-1.5 pt-1.5 font-mono text-xs">
                    {relativeProperties.map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1 border-b border-gray-50 text-[11px]">
                        <span className="text-gray-400 uppercase">{key}:</span>
                        <span className="text-gray-700 font-semibold text-right max-w-md truncate">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex flex-wrap justify-between items-center text-[9.5px] font-mono text-gray-400 uppercase gap-2">
                    <span>Reconstruction Method: HeteroCrimeGNN Sequence Extraction</span>
                    <span>Confidence Factor: {(evt.pagerank * 1.1).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelinePage;
