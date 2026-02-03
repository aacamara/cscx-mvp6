/**
 * Search Result Card Component
 * PRD-219: AI-Powered Universal Search
 *
 * Displays a single search result with type-specific formatting,
 * metadata, highlights, and action buttons.
 */

import React from 'react';
import {
  SearchResult,
  SearchableType,
  SEARCH_TYPE_LABELS
} from '../../types/universalSearch';

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
  dataIndex: number;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  isSelected,
  onClick,
  dataIndex
}) => {
  // Get icon for result type
  const getTypeIcon = (type: SearchableType) => {
    switch (type) {
      case 'customer':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'stakeholder':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'meeting':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'playbook':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'task':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'note':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'activity':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  // Get color for result type
  const getTypeColor = (type: SearchableType) => {
    const colors: Record<SearchableType, string> = {
      customer: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      stakeholder: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      email: 'bg-green-500/20 text-green-400 border-green-500/30',
      meeting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      document: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      playbook: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      task: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      note: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      activity: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  // Render highlighted content
  const renderHighlight = (text?: string) => {
    if (!text) return null;
    // Simple highlight rendering - replace <mark> tags with styled spans
    const parts = text.split(/(<mark>.*?<\/mark>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<mark>')) {
        const content = part.replace(/<\/?mark>/g, '');
        return (
          <span key={i} className="bg-cscx-accent/30 text-cscx-accent font-medium px-0.5 rounded">
            {content}
          </span>
        );
      }
      return part;
    });
  };

  // Get type-specific subtitle
  const getSubtitle = () => {
    const parts: string[] = [];

    if (result.metadata.customer_name) {
      parts.push(result.metadata.customer_name);
    }

    switch (result.type) {
      case 'email':
        if (result.metadata.from) {
          parts.push(`From: ${result.metadata.from}`);
        }
        break;
      case 'meeting':
        if (result.metadata.attendees?.length) {
          parts.push(`${result.metadata.attendees.length} attendees`);
        }
        break;
      case 'stakeholder':
        if (result.metadata.from) { // email
          parts.push(result.metadata.from);
        }
        break;
    }

    const date = formatDate(result.metadata.date);
    if (date) {
      parts.push(date);
    }

    return parts.join(' • ');
  };

  return (
    <button
      onClick={onClick}
      data-index={dataIndex}
      className={`w-full px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-cscx-gray-800' : 'hover:bg-cscx-gray-800/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div className={`p-2 rounded-lg border ${getTypeColor(result.type as SearchableType)}`}>
          {getTypeIcon(result.type as SearchableType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h4 className={`font-medium truncate ${isSelected ? 'text-white' : 'text-cscx-gray-200'}`}>
              {result.highlight?.title
                ? renderHighlight(result.highlight.title)
                : result.title}
            </h4>
            <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full border ${getTypeColor(result.type as SearchableType)}`}>
              {SEARCH_TYPE_LABELS[result.type as SearchableType] || result.type}
            </span>
          </div>

          {/* Subtitle / Metadata */}
          <p className="text-xs text-cscx-gray-500 mt-0.5 truncate">
            {getSubtitle()}
          </p>

          {/* Snippet */}
          <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
            {result.highlight?.content
              ? renderHighlight(result.highlight.content)
              : result.snippet}
          </p>
        </div>

        {/* Relevance Score */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              result.relevance_score > 0.8
                ? 'bg-green-400'
                : result.relevance_score > 0.6
                ? 'bg-yellow-400'
                : 'bg-gray-400'
            }`}
            title={`Relevance: ${Math.round(result.relevance_score * 100)}%`}
          />
          {isSelected && (
            <span className="text-xs text-cscx-gray-500">
              Enter
            </span>
          )}
        </div>
      </div>

      {/* Actions (shown when selected) */}
      {isSelected && result.actions.length > 0 && (
        <div className="flex items-center gap-2 mt-2 pl-12">
          {result.actions.slice(0, 3).map((action) => (
            <span
              key={action}
              className="px-2 py-0.5 text-xs bg-cscx-gray-700 text-cscx-gray-300 rounded"
            >
              {formatActionLabel(action)}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

// Helper to format action labels
function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    view_customer: 'View Customer',
    view_stakeholder: 'View Contact',
    open_email: 'Open Email',
    view_meeting: 'View Meeting',
    view_summary: 'View Summary',
    view_recording: 'View Recording',
    open_document: 'Open Document',
    view_playbook: 'View Playbook',
    view_task: 'View Task',
    view_note: 'View Note'
  };
  return labels[action] || action.replace(/_/g, ' ');
}

export default SearchResultCard;
