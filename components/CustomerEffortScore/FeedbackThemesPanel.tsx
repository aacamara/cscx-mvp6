/**
 * Feedback Themes Panel
 * PRD-160: Analyzes and displays common feedback themes
 */

import React from 'react';
import { FeedbackTheme } from '../../types/customerEffortScore';

interface FeedbackThemesPanelProps {
  themes: FeedbackTheme[];
}

const getSentimentColor = (sentiment: 'positive' | 'negative' | 'neutral'): string => {
  switch (sentiment) {
    case 'positive': return 'text-green-400 bg-green-500/20';
    case 'negative': return 'text-red-400 bg-red-500/20';
    case 'neutral': return 'text-yellow-400 bg-yellow-500/20';
  }
};

const getSentimentIcon = (sentiment: 'positive' | 'negative' | 'neutral'): string => {
  switch (sentiment) {
    case 'positive': return '+';
    case 'negative': return '-';
    case 'neutral': return '~';
  }
};

export const FeedbackThemesPanel: React.FC<FeedbackThemesPanelProps> = ({
  themes
}) => {
  if (!themes || themes.length === 0) {
    return (
      <div className="p-4 text-center text-cscx-gray-500">
        No feedback themes identified
      </div>
    );
  }

  // Sort by count descending
  const sortedThemes = [...themes].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedThemes.map(t => t.count));

  return (
    <div className="space-y-4">
      {sortedThemes.map((theme) => (
        <div key={theme.theme} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getSentimentColor(theme.sentiment)}`}>
                {getSentimentIcon(theme.sentiment)}
              </span>
              <span className="text-white font-medium">{theme.theme}</span>
            </div>
            <span className="text-cscx-gray-400 text-sm">{theme.count} mentions</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                theme.sentiment === 'positive' ? 'bg-green-500' :
                theme.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${(theme.count / maxCount) * 100}%` }}
            />
          </div>

          {/* Example feedback */}
          {theme.example_feedback.length > 0 && (
            <div className="pl-8 space-y-1">
              {theme.example_feedback.slice(0, 2).map((feedback, i) => (
                <p key={i} className="text-xs text-cscx-gray-400 italic">
                  "{feedback}"
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FeedbackThemesPanel;
