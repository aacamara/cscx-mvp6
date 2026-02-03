/**
 * Universal Search Hook
 * PRD-219: AI-Powered Universal Search
 *
 * Custom hook for managing universal search state and operations.
 * Provides search, suggestions, recent searches, and saved searches.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  SearchResult,
  SearchSuggestion,
  ParsedQuery,
  QueryFilters,
  UserSearch,
  SavedSearch,
  SearchState,
  SearchableType,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUGGESTION_LIMIT,
  MAX_RECENT_SEARCHES
} from '../types/universalSearch';
import { useAuth } from '../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Debounce delay for suggestions
const SUGGESTION_DEBOUNCE_MS = 150;

interface UseUniversalSearchOptions {
  autoFetch?: boolean;
  defaultFilters?: QueryFilters;
}

interface UseUniversalSearchReturn {
  // State
  query: string;
  setQuery: (query: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isLoading: boolean;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  recentSearches: UserSearch[];
  savedSearches: SavedSearch[];
  filters: QueryFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueryFilters>>;
  error: string | null;
  total: number;
  hasMore: boolean;
  parsedQuery: ParsedQuery | null;
  searchTimeMs: number;

  // Actions
  search: (query?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  clearSearch: () => void;
  fetchSuggestions: (query: string) => Promise<void>;
  fetchRecentSearches: () => Promise<void>;
  fetchSavedSearches: () => Promise<void>;
  saveSearch: (searchId: string, name: string) => Promise<void>;
  deleteSavedSearch: (searchId: string) => Promise<void>;

  // Navigation helpers
  selectResult: (result: SearchResult) => void;
  selectSuggestion: (suggestion: SearchSuggestion) => void;
}

export const useUniversalSearch = (
  options: UseUniversalSearchOptions = {}
): UseUniversalSearchReturn => {
  const { autoFetch = false, defaultFilters = {} } = options;
  const { getAuthHeaders } = useAuth();

  // Search state
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<UserSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [filters, setFilters] = useState<QueryFilters>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [searchTimeMs, setSearchTimeMs] = useState(0);

  // Refs for debouncing and abort control
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate hasMore
  const hasMore = offset + results.length < total;

  /**
   * Build query params from filters
   */
  const buildQueryParams = useCallback((searchQuery: string, currentFilters: QueryFilters, currentOffset: number): URLSearchParams => {
    const params = new URLSearchParams();
    params.append('q', searchQuery);

    if (currentFilters.type?.length) {
      params.append('type', currentFilters.type.join(','));
    }
    if (currentFilters.customer_id) {
      params.append('customer_id', currentFilters.customer_id);
    }
    if (currentFilters.date_range?.from) {
      params.append('from', currentFilters.date_range.from);
    }
    if (currentFilters.date_range?.to) {
      params.append('to', currentFilters.date_range.to);
    }

    params.append('limit', String(DEFAULT_SEARCH_LIMIT));
    params.append('offset', String(currentOffset));

    return params;
  }, []);

  /**
   * Main search function
   */
  const search = useCallback(async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      setParsedQuery(null);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setOffset(0);

    try {
      const params = buildQueryParams(q, filters, 0);
      const response = await fetch(`${API_BASE}/search?${params}`, {
        headers: getAuthHeaders(),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Search failed');
      }

      const data = await response.json();

      setResults(data.results || []);
      setTotal(data.total || 0);
      setParsedQuery(data.parsed || null);
      setSearchTimeMs(data.search_time_ms || 0);

      // Update suggestions from search results
      if (data.suggestions?.length) {
        setSuggestions(prev => [
          ...prev.filter(s => s.type !== 'query'),
          ...data.suggestions.slice(0, 3).map((text: string) => ({
            type: 'query' as const,
            text,
            category: 'Suggested Search'
          }))
        ]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, buildQueryParams, getAuthHeaders]);

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !query.trim()) return;

    const newOffset = offset + DEFAULT_SEARCH_LIMIT;
    setIsLoading(true);

    try {
      const params = buildQueryParams(query, filters, newOffset);
      const response = await fetch(`${API_BASE}/search?${params}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to load more results');
      }

      const data = await response.json();

      setResults(prev => [...prev, ...(data.results || [])]);
      setOffset(newOffset);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load more';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, offset, hasMore, isLoading, buildQueryParams, getAuthHeaders]);

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setError(null);
    setTotal(0);
    setOffset(0);
    setParsedQuery(null);
  }, []);

  /**
   * Fetch suggestions as user types
   */
  const fetchSuggestions = useCallback(async (q: string) => {
    // Clear existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    if (!q || q.length < 2) {
      // Show recent searches if no query
      setSuggestions(recentSearches.slice(0, DEFAULT_SUGGESTION_LIMIT).map(s => ({
        type: 'recent' as const,
        text: s.query,
        category: 'Recent Search'
      })));
      return;
    }

    // Debounce
    suggestionTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/search/suggest?q=${encodeURIComponent(q)}&limit=${DEFAULT_SUGGESTION_LIMIT}`,
          { headers: getAuthHeaders() }
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }, SUGGESTION_DEBOUNCE_MS);
  }, [recentSearches, getAuthHeaders]);

  /**
   * Fetch recent searches
   */
  const fetchRecentSearches = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/search/recent?limit=${MAX_RECENT_SEARCHES}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setRecentSearches(data.searches || []);
      }
    } catch (err) {
      console.error('Recent searches error:', err);
    }
  }, [getAuthHeaders]);

  /**
   * Fetch saved searches
   */
  const fetchSavedSearches = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/search/saved`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.searches || []);
      }
    } catch (err) {
      console.error('Saved searches error:', err);
    }
  }, [getAuthHeaders]);

  /**
   * Save a search as favorite
   */
  const saveSearch = useCallback(async (searchId: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE}/search/saved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ search_id: searchId, name })
      });

      if (response.ok) {
        await fetchSavedSearches();
      }
    } catch (err) {
      console.error('Save search error:', err);
    }
  }, [getAuthHeaders, fetchSavedSearches]);

  /**
   * Delete a saved search
   */
  const deleteSavedSearch = useCallback(async (searchId: string) => {
    try {
      const response = await fetch(`${API_BASE}/search/saved/${searchId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await fetchSavedSearches();
      }
    } catch (err) {
      console.error('Delete saved search error:', err);
    }
  }, [getAuthHeaders, fetchSavedSearches]);

  /**
   * Handle selecting a search result
   */
  const selectResult = useCallback((result: SearchResult) => {
    // Close the search modal
    setIsOpen(false);

    // Dispatch navigation event based on result type
    const event = new CustomEvent('search:navigate', {
      detail: {
        type: result.type,
        id: result.id,
        metadata: result.metadata
      }
    });
    window.dispatchEvent(event);
  }, []);

  /**
   * Handle selecting a suggestion
   */
  const selectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'customer' || suggestion.type === 'stakeholder') {
      // Direct navigation to entity
      setIsOpen(false);
      const event = new CustomEvent('search:navigate', {
        detail: {
          type: suggestion.type,
          id: suggestion.id,
          metadata: suggestion.metadata
        }
      });
      window.dispatchEvent(event);
    } else {
      // Execute the suggested search
      setQuery(suggestion.text);
      search(suggestion.text);
    }
  }, [search]);

  // Keyboard shortcut to open search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Fetch recent/saved searches when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRecentSearches();
      fetchSavedSearches();
    }
  }, [isOpen, fetchRecentSearches, fetchSavedSearches]);

  // Update suggestions as query changes
  useEffect(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && query) {
      search();
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
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

    // Actions
    search,
    loadMore,
    clearSearch,
    fetchSuggestions,
    fetchRecentSearches,
    fetchSavedSearches,
    saveSearch,
    deleteSavedSearch,
    selectResult,
    selectSuggestion
  };
};

export default useUniversalSearch;
