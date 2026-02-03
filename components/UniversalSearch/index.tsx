/**
 * Universal Search Component
 * PRD-219: AI-Powered Universal Search
 *
 * Command palette style search interface accessible via Cmd+K / Ctrl+K.
 * Supports natural language queries, instant suggestions, and result actions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useUniversalSearch } from '../../hooks/useUniversalSearch';
import {
  SearchResult,
  SearchSuggestion,
  SearchableType,
  SEARCH_TYPE_LABELS,
  QueryFilters
} from '../../types/universalSearch';
import { SearchResultCard } from './SearchResultCard';
import { SearchFilters } from './SearchFilters';

interface UniversalSearchProps {
  onNavigate?: (type: string, id: string, metadata?: Record<string, unknown>) => void;
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({ onNavigate }) => {
  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    isLoading,
    results,
    suggestions,
    recentSearches,
    savedSearches,
    filters,
    setFilters,
    error,
    total,
    hasMore,
    parsedQuery,
    searchTimeMs,
    search,
    loadMore,
    clearSearch,
    selectResult,
    selectSuggestion
  } = useUniversalSearch();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results, suggestions]);

  // Listen for navigation events
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (onNavigate) {
        onNavigate(e.detail.type, e.detail.id, e.detail.metadata);
      }
    };

    window.addEventListener('search:navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('search:navigate', handleNavigate as EventListener);
  }, [onNavigate]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = query.trim() ? results : suggestions;
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (query.trim() && results.length > 0) {
          selectResult(results[selectedIndex]);
        } else if (!query.trim() && suggestions.length > 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (query.trim()) {
          search();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        // Toggle filters on Tab
        if (e.shiftKey) {
          e.preventDefault();
          setShowFilters(prev => !prev);
        }
        break;
    }
  }, [query, results, suggestions, selectedIndex, search, selectResult, selectSuggestion, setIsOpen]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      search();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="search-modal"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-start justify-center pt-[10vh] px-4">
        <div
          className="relative w-full max-w-2xl bg-cscx-gray-900 rounded-xl shadow-2xl border border-cscx-gray-700 overflow-hidden transform transition-all"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center px-4 border-b border-cscx-gray-700">
              {/* Search Icon */}
              <svg
                className="w-5 h-5 text-cscx-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search across everything..."
                className="flex-1 px-4 py-4 bg-transparent text-white placeholder-cscx-gray-400 focus:outline-none text-lg"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Loading indicator */}
              {isLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-accent border-t-transparent" />
              )}

              {/* Clear button */}
              {query && !isLoading && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="p-1 text-cscx-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Keyboard shortcut */}
              <kbd className="hidden sm:inline-flex ml-2 px-2 py-1 text-xs text-cscx-gray-400 bg-cscx-gray-800 rounded border border-cscx-gray-700">
                ESC
              </kbd>
            </div>
          </form>

          {/* Filters Toggle */}
          {query.trim() && (
            <div className="px-4 py-2 border-b border-cscx-gray-700 flex items-center justify-between">
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className="text-sm text-cscx-gray-400 hover:text-white flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {Object.keys(filters).length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-cscx-accent rounded-full">
                    {Object.keys(filters).length}
                  </span>
                )}
              </button>

              {parsedQuery?.natural_language_intent && (
                <span className="text-xs text-cscx-gray-500">
                  Understanding: "{parsedQuery.natural_language_intent}"
                </span>
              )}
            </div>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              onSearch={() => search()}
            />
          )}

          {/* Results / Suggestions */}
          <div
            ref={resultsContainerRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {/* Error State */}
            {error && (
              <div className="p-4 text-center text-red-400">
                <p>{error}</p>
              </div>
            )}

            {/* Search Results */}
            {query.trim() && results.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-2 flex items-center justify-between text-xs text-cscx-gray-500">
                  <span>{total} results ({searchTimeMs}ms)</span>
                  {parsedQuery?.filters?.type?.length && (
                    <span>Filtered: {parsedQuery.filters.type.join(', ')}</span>
                  )}
                </div>

                {results.map((result, index) => (
                  <SearchResultCard
                    key={`${result.type}-${result.id}`}
                    result={result}
                    isSelected={index === selectedIndex}
                    onClick={() => selectResult(result)}
                    dataIndex={index}
                  />
                ))}

                {/* Load More */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="w-full py-3 text-sm text-cscx-accent hover:bg-cscx-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Loading...' : 'Load More Results'}
                  </button>
                )}
              </div>
            )}

            {/* No Results */}
            {query.trim() && !isLoading && results.length === 0 && !error && (
              <div className="p-8 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-cscx-gray-600 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-cscx-gray-400">No results found for "{query}"</p>
                <p className="text-sm text-cscx-gray-500 mt-2">
                  Try a different search term or use natural language
                </p>
              </div>
            )}

            {/* Suggestions (when no query) */}
            {!query.trim() && suggestions.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-2 text-xs font-medium text-cscx-gray-500 uppercase tracking-wider">
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => (
                  <SuggestionItem
                    key={`${suggestion.type}-${suggestion.text}-${index}`}
                    suggestion={suggestion}
                    isSelected={index === selectedIndex}
                    onClick={() => selectSuggestion(suggestion)}
                    dataIndex={index}
                  />
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {!query.trim() && recentSearches.length > 0 && (
              <div className="py-2 border-t border-cscx-gray-800">
                <div className="px-4 py-2 text-xs font-medium text-cscx-gray-500 uppercase tracking-wider">
                  Recent Searches
                </div>
                {recentSearches.slice(0, 5).map((search, index) => (
                  <button
                    key={search.id || index}
                    onClick={() => {
                      setQuery(search.query);
                      search.query && window.setTimeout(() => {
                        inputRef.current?.focus();
                      }, 0);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-cscx-gray-300 hover:bg-cscx-gray-800 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {search.query}
                  </button>
                ))}
              </div>
            )}

            {/* Saved Searches */}
            {!query.trim() && savedSearches.length > 0 && (
              <div className="py-2 border-t border-cscx-gray-800">
                <div className="px-4 py-2 text-xs font-medium text-cscx-gray-500 uppercase tracking-wider">
                  Saved Searches
                </div>
                {savedSearches.slice(0, 5).map((search) => (
                  <button
                    key={search.id}
                    onClick={() => {
                      setQuery(search.query);
                      window.setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-cscx-gray-300 hover:bg-cscx-gray-800 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span className="font-medium">{search.name}</span>
                    <span className="text-cscx-gray-500 text-xs ml-auto">{search.query}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!query.trim() && suggestions.length === 0 && recentSearches.length === 0 && (
              <div className="p-8 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-cscx-gray-600 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-cscx-gray-400">Search across customers, emails, meetings, and more</p>
                <p className="text-sm text-cscx-gray-500 mt-2">
                  Try: "emails from Sarah about renewal" or "at-risk accounts"
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-cscx-gray-700 bg-cscx-gray-900/80 flex items-center justify-between text-xs text-cscx-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded border border-cscx-gray-700">Enter</kbd>
                to select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded border border-cscx-gray-700">Tab</kbd>
                filters
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-cscx-gray-800 rounded border border-cscx-gray-700">Esc</kbd>
                close
              </span>
            </div>
            <span>Powered by AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Suggestion Item Component
interface SuggestionItemProps {
  suggestion: SearchSuggestion;
  isSelected: boolean;
  onClick: () => void;
  dataIndex: number;
}

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  isSelected,
  onClick,
  dataIndex
}) => {
  const getIcon = () => {
    switch (suggestion.type) {
      case 'customer':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'stakeholder':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'query':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'recent':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      data-index={dataIndex}
      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
        isSelected ? 'bg-cscx-gray-800' : 'hover:bg-cscx-gray-800/50'
      }`}
    >
      <span className={`text-cscx-gray-400 ${isSelected ? 'text-cscx-accent' : ''}`}>
        {getIcon()}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isSelected ? 'text-white' : 'text-cscx-gray-300'}`}>
          {suggestion.text}
        </p>
        {suggestion.metadata?.company && (
          <p className="text-xs text-cscx-gray-500 truncate">
            {suggestion.metadata.company}
          </p>
        )}
      </div>
      <span className="text-xs text-cscx-gray-500 shrink-0">
        {suggestion.category}
      </span>
    </button>
  );
};

export default UniversalSearch;
