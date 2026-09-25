import React, { useState, useEffect } from 'react';
import { Search, X, User, FileText, Briefcase, Lightbulb, ArrowRight, Loader2 } from 'lucide-react';
import { searchService, apiClient } from '../api/client';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity?: (entity: any) => void;
  onSelectEvidence?: (evidence: any) => void;
  onSelectLead?: () => void;
  onNavigate?: (page: string, targetId?: string) => void;
}

import { SearchResultItem } from '../types';

interface SearchItem {
  id: string;
  title: string;
  type: 'case' | 'entity' | 'evidence' | 'lead' | 'prediction';
  subtitle: string;
  category: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectEntity,
  onSelectEvidence,
  onSelectLead,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchService.query(query);
        setResults(res);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getItemIcon = (type: SearchItem['type']) => {
    switch (type) {
      case 'entity':
        return <User className="h-3.5 w-3.5 text-[#121110]" />;
      case 'evidence':
        return <FileText className="h-3.5 w-3.5 text-[#6E1827]" />;
      case 'case':
        return <Briefcase className="h-3.5 w-3.5 text-[#121110]" />;
      case 'lead':
        return <Lightbulb className="h-3.5 w-3.5 text-[#6E1827]" />;
    }
  };

  const handleItemClick = async (item: SearchItem) => {
    if (item.type === 'entity' && onSelectEntity) {
      try {
        const g = await apiClient.graph.getGraphData();
        const found = g.nodes.find(n => n.id === item.id);
        if (found) {
          onSelectEntity(found);
          onClose();
          return;
        }
      } catch (e) {
        // fallback
      }
    }
    if (item.type === 'evidence' && onSelectEvidence) {
      onSelectEvidence({ name: item.title, id: item.id });
      onClose();
      return;
    }
    if (item.type === 'lead' && onSelectLead) {
      onSelectLead();
      onClose();
      return;
    }
    if (onNavigate) {
      const page = item.type === 'case' ? 'cases' : item.type === 'evidence' ? 'evidence' : item.type === 'lead' ? 'leads' : 'entities';
      onNavigate(page, item.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-[#121110]/40 p-4" id="global-search-modal">
      <div className="w-full max-w-2xl bg-white rounded-[2px] border border-[#E2DDD5] overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#E2DDD5] flex items-center gap-3 bg-[#F7F5F0]">
          <Search className="h-4 w-4 text-[#6B6760] shrink-0 ml-1" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities, evidence files, cases, or investigation leads..."
            className="w-full bg-transparent text-xs text-[#121110] placeholder-[#6B6760] focus:outline-none font-medium font-mono"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#6B6760] hover:text-[#121110] rounded-[2px] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-[10px] font-mono border border-[#E2DDD5] bg-white px-1.5 py-0.5 rounded-[2px] text-[#6B6760] uppercase">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {isSearching ? (
            <div className="flex items-center justify-center p-8 text-[#6B6760] font-mono gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#6E1827]" />
              <span>Searching intelligence registry...</span>
            </div>
          ) : query.trim() && results.length === 0 ? (
            <div className="p-8 text-center text-[#6B6760] font-mono">
              No intelligence records found matching "{query}"
            </div>
          ) : !query.trim() ? (
            <div className="p-6 text-center text-[#6B6760] space-y-2 font-mono">
              <p className="text-[#121110] font-medium font-sans">Global Network Search</p>
              <p className="text-[11px] font-sans">Type an entity name, alias, phone identifier, artifact hash, or case name.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase font-semibold text-[#6B6760] px-2 pb-1">
                Matching Intelligence ({results.length})
              </div>
              {results.map((item) => (
                <button
                  key={`${item.type}_${item.id}`}
                  onClick={() => handleItemClick(item)}
                  className="w-full text-left p-2.5 rounded-[2px] hover:bg-[#F7F5F0] border border-transparent hover:border-[#E2DDD5] transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-[2px] bg-[#F7F5F0] border border-[#E2DDD5] shrink-0">
                      {getItemIcon(item.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#121110] group-hover:text-[#6E1827] transition-colors font-sans">{item.title}</span>
                        <span className="text-[9px] font-mono uppercase px-1 rounded-[2px] bg-[#F7F5F0] text-[#6B6760] border border-[#E2DDD5]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B6760] font-mono mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[#6B6760] group-hover:text-[#6E1827] transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-[#E2DDD5] bg-[#F7F5F0] text-[10px] font-mono text-[#6B6760] flex items-center justify-between">
          <span>NETRIX Local Knowledge & Evidence Registry</span>
          <span className="text-[#6E1827] font-semibold">LOCAL ML ENGINE ACTIVE</span>
        </div>
      </div>
    </div>
  );
};
