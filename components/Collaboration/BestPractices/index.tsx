/**
 * Best Practices Component
 * PRD-254: Best Practice Sharing
 *
 * Enables CSMs to share and discover successful strategies.
 * Features: browse, search, create, vote, comment, save.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  Filter,
  Star,
  TrendingUp,
  Clock,
  User,
  Tag,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Send,
  BarChart3,
  Target,
  Users,
  Sparkles,
  Eye,
  Award,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface Attachment {
  type: string;
  name: string;
  url: string;
  mimeType?: string;
}

interface BestPractice {
  id: string;
  createdByUserId: string;
  createdByUserName?: string;
  title: string;
  problemStatement: string;
  solution: string;
  expectedOutcomes?: string;
  variations?: string;
  pitfalls?: string;
  category?: string;
  tags: string[];
  customerSegment?: string;
  applicableIndustries: string[];
  linkedCustomerIds: string[];
  attachments: Attachment[];
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  publishedAt?: string;
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  saveCount: number;
  useCount: number;
  commentCount: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  userVote?: number;
  isSaved?: boolean;
}

interface BestPracticeComment {
  id: string;
  bestPracticeId: string;
  userId: string;
  userName?: string;
  parentCommentId?: string;
  content: string;
  isQuestion: boolean;
  isResolved: boolean;
  upvoteCount: number;
  createdAt: string;
  replies?: BestPracticeComment[];
}

interface Category {
  id: string;
  label: string;
  count: number;
  icon: string;
}

interface BestPracticesProps {
  initialCategory?: string;
  showCreateButton?: boolean;
  compact?: boolean;
  onSelectPractice?: (practice: BestPractice) => void;
}

// ============================================
// API
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchBestPractices(params: {
  q?: string;
  category?: string;
  sortBy?: string;
  tags?: string[];
  featured?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ bestPractices: BestPractice[]; total: number; hasMore: boolean }> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.category) searchParams.set('category', params.category);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.tags) searchParams.set('tags', params.tags.join(','));
  if (params.featured !== undefined) searchParams.set('featured', String(params.featured));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  const response = await fetch(`${API_BASE}/best-practices?${searchParams}`);
  const data = await response.json();
  return data.success ? data.data : { bestPractices: [], total: 0, hasMore: false };
}

async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE}/best-practices/categories`);
  const data = await response.json();
  return data.success ? data.data.categories : [];
}

async function fetchPracticeById(id: string): Promise<BestPractice | null> {
  const response = await fetch(`${API_BASE}/best-practices/${id}`);
  const data = await response.json();
  return data.success ? data.data.bestPractice : null;
}

async function fetchComments(practiceId: string): Promise<BestPracticeComment[]> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/comments`);
  const data = await response.json();
  return data.success ? data.data.comments : [];
}

async function votePractice(practiceId: string, vote: 1 | -1 | 0): Promise<{ upvoteCount: number; downvoteCount: number }> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote }),
  });
  const data = await response.json();
  return data.success ? data.data : { upvoteCount: 0, downvoteCount: 0 };
}

async function savePractice(practiceId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  return data.success;
}

async function unsavePractice(practiceId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/save`, {
    method: 'DELETE',
  });
  const data = await response.json();
  return data.success;
}

async function addComment(practiceId: string, content: string, isQuestion?: boolean): Promise<BestPracticeComment | null> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, isQuestion }),
  });
  const data = await response.json();
  return data.success ? data.data.comment : null;
}

async function createPractice(input: {
  title: string;
  problemStatement: string;
  solution: string;
  expectedOutcomes?: string;
  variations?: string;
  pitfalls?: string;
  category?: string;
  tags?: string[];
}): Promise<BestPractice | null> {
  const response = await fetch(`${API_BASE}/best-practices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  return data.success ? data.data.bestPractice : null;
}

async function submitForReview(practiceId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/submit`, {
    method: 'POST',
  });
  const data = await response.json();
  return data.success;
}

async function recordUsage(practiceId: string, customerId?: string, outcome?: string, notes?: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/best-practices/${practiceId}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, outcome, notes }),
  });
  const data = await response.json();
  return data.success;
}

// ============================================
// Category Config
// ============================================

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  onboarding: Target,
  renewal: RefreshCw,
  expansion: TrendingUp,
  risk: AlertCircle,
  communication: MessageSquare,
  adoption: Users,
  general: BookOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
  onboarding: 'text-blue-400 bg-blue-500/10',
  renewal: 'text-green-400 bg-green-500/10',
  expansion: 'text-purple-400 bg-purple-500/10',
  risk: 'text-red-400 bg-red-500/10',
  communication: 'text-cyan-400 bg-cyan-500/10',
  adoption: 'text-orange-400 bg-orange-500/10',
  general: 'text-gray-400 bg-gray-500/10',
};

// ============================================
// Practice Card Component
// ============================================

const PracticeCard: React.FC<{
  practice: BestPractice;
  onSelect: () => void;
  onVote: (vote: 1 | -1 | 0) => void;
  onSave: () => void;
}> = ({ practice, onSelect, onVote, onSave }) => {
  const CategoryIcon = CATEGORY_ICONS[practice.category || 'general'] || BookOpen;
  const categoryColor = CATEGORY_COLORS[practice.category || 'general'] || CATEGORY_COLORS.general;
  const netVotes = practice.upvoteCount - practice.downvoteCount;

  return (
    <div
      className="bg-cscx-gray-800 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-all cursor-pointer group"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${categoryColor}`}>
            <CategoryIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {practice.isFeatured && (
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              )}
              <h3 className="text-white font-medium truncate group-hover:text-cscx-accent transition-colors">
                {practice.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="capitalize">{practice.category || 'General'}</span>
              <span>|</span>
              <span>{new Date(practice.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Problem Statement Preview */}
      <p className="text-sm text-gray-400 line-clamp-2 mb-3">
        {practice.problemStatement}
      </p>

      {/* Tags */}
      {practice.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {practice.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded"
            >
              {tag}
            </span>
          ))}
          {practice.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{practice.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: Stats & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span>{practice.viewCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{practice.commentCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{practice.useCount} used</span>
          </div>
        </div>

        {/* Vote & Save Actions */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 bg-gray-700/50 rounded-full px-2 py-1">
            <button
              onClick={() => onVote(practice.userVote === 1 ? 0 : 1)}
              className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                practice.userVote === 1 ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <span className={`text-xs font-medium ${
              netVotes > 0 ? 'text-green-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {netVotes > 0 ? '+' : ''}{netVotes}
            </span>
            <button
              onClick={() => onVote(practice.userVote === -1 ? 0 : -1)}
              className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                practice.userVote === -1 ? 'text-red-400' : 'text-gray-400'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onSave}
            className={`p-1.5 rounded-full hover:bg-gray-600 transition-colors ${
              practice.isSaved ? 'text-yellow-400' : 'text-gray-400'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${practice.isSaved ? 'fill-yellow-400' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Practice Detail Modal
// ============================================

const PracticeDetailModal: React.FC<{
  practice: BestPractice;
  onClose: () => void;
  onVote: (vote: 1 | -1 | 0) => void;
  onSave: () => void;
  onUse: (outcome?: string, notes?: string) => void;
}> = ({ practice, onClose, onVote, onSave, onUse }) => {
  const [comments, setComments] = useState<BestPracticeComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [useOutcome, setUseOutcome] = useState<string>('');
  const [useNotes, setUseNotes] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);

  const CategoryIcon = CATEGORY_ICONS[practice.category || 'general'] || BookOpen;
  const categoryColor = CATEGORY_COLORS[practice.category || 'general'] || CATEGORY_COLORS.general;
  const netVotes = practice.upvoteCount - practice.downvoteCount;

  useEffect(() => {
    fetchComments(practice.id).then((c) => {
      setComments(c);
      setLoadingComments(false);
    });
  }, [practice.id]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const comment = await addComment(practice.id, newComment.trim(), isQuestion);
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      setIsQuestion(false);
    }
  };

  const handleUse = () => {
    onUse(useOutcome || undefined, useNotes || undefined);
    setShowUseDialog(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${categoryColor}`}>
              <CategoryIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {practice.isFeatured && (
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                )}
                <h2 className="text-xl font-semibold text-white">{practice.title}</h2>
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {practice.createdByUserName || 'Anonymous'}
                </span>
                <span>|</span>
                <span className="capitalize">{practice.category || 'General'}</span>
                <span>|</span>
                <span>{new Date(practice.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Problem Statement */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              Problem / When to Use
            </h3>
            <p className="text-white whitespace-pre-wrap">{practice.problemStatement}</p>
          </div>

          {/* Solution */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Solution Approach
            </h3>
            <p className="text-white whitespace-pre-wrap">{practice.solution}</p>
          </div>

          {/* Expected Outcomes */}
          {practice.expectedOutcomes && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                Expected Outcomes
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap">{practice.expectedOutcomes}</p>
            </div>
          )}

          {/* Variations */}
          {practice.variations && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Variations
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap">{practice.variations}</p>
            </div>
          )}

          {/* Pitfalls */}
          {practice.pitfalls && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                Pitfalls to Avoid
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap">{practice.pitfalls}</p>
            </div>
          )}

          {/* Tags */}
          {practice.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {practice.tags.map((tag, i) => (
                  <span key={i} className="text-sm px-3 py-1 bg-gray-700 text-gray-300 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-cscx-gray-800 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">{practice.viewCount}</div>
              <div className="text-xs text-gray-500">Views</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${netVotes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netVotes > 0 ? '+' : ''}{netVotes}
              </div>
              <div className="text-xs text-gray-500">Net Votes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">{practice.commentCount}</div>
              <div className="text-xs text-gray-500">Comments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">{practice.useCount}</div>
              <div className="text-xs text-gray-500">Times Used</div>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comments ({comments.length})
            </h3>

            {loadingComments ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Comment List */}
                <div className="space-y-4 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-cscx-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-white">{comment.userName || 'Anonymous'}</span>
                          {comment.isQuestion && (
                            <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                              Question
                            </span>
                          )}
                          {comment.isResolved && (
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                              Resolved
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-300">{comment.content}</p>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No comments yet. Be the first to share your thoughts!
                    </p>
                  )}
                </div>

                {/* Add Comment */}
                <div className="bg-cscx-gray-800 rounded-lg p-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment or ask a question..."
                    className="w-full bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isQuestion}
                        onChange={(e) => setIsQuestion(e.target.checked)}
                        className="rounded bg-gray-700 border-gray-600"
                      />
                      Mark as question
                    </label>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-cscx-gray-800">
          <div className="flex items-center gap-3">
            {/* Vote */}
            <div className="flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1.5">
              <button
                onClick={() => onVote(practice.userVote === 1 ? 0 : 1)}
                className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                  practice.userVote === 1 ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <span className={`text-sm font-medium px-2 ${
                netVotes > 0 ? 'text-green-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {netVotes}
              </span>
              <button
                onClick={() => onVote(practice.userVote === -1 ? 0 : -1)}
                className={`p-1 rounded hover:bg-gray-600 transition-colors ${
                  practice.userVote === -1 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>

            {/* Save */}
            <button
              onClick={onSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                practice.isSaved
                  ? 'border-yellow-500 text-yellow-400'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${practice.isSaved ? 'fill-yellow-400' : ''}`} />
              {practice.isSaved ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* Use This Practice */}
          <div className="flex items-center gap-3">
            {showUseDialog ? (
              <div className="flex items-center gap-2">
                <select
                  value={useOutcome}
                  onChange={(e) => setUseOutcome(e.target.value)}
                  className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Outcome (optional)</option>
                  <option value="helpful">Helpful</option>
                  <option value="somewhat_helpful">Somewhat Helpful</option>
                  <option value="not_helpful">Not Helpful</option>
                </select>
                <button
                  onClick={handleUse}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Record
                </button>
                <button
                  onClick={() => setShowUseDialog(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowUseDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                I Used This
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Create Practice Modal
// ============================================

const CreatePracticeModal: React.FC<{
  onClose: () => void;
  onCreated: (practice: BestPractice) => void;
}> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [solution, setSolution] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [variations, setVariations] = useState('');
  const [pitfalls, setPitfalls] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (submitForReviewAfter: boolean = false) => {
    if (!title.trim() || !problemStatement.trim() || !solution.trim()) {
      setError('Title, problem statement, and solution are required');
      return;
    }

    setSaving(true);
    setError(null);

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const practice = await createPractice({
      title: title.trim(),
      problemStatement: problemStatement.trim(),
      solution: solution.trim(),
      expectedOutcomes: expectedOutcomes.trim() || undefined,
      variations: variations.trim() || undefined,
      pitfalls: pitfalls.trim() || undefined,
      category: category || undefined,
      tags,
    });

    if (practice) {
      if (submitForReviewAfter) {
        await submitForReview(practice.id);
        practice.status = 'pending_review';
      }
      onCreated(practice);
      onClose();
    } else {
      setError('Failed to create best practice. Please try again.');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cscx-accent/20 text-cscx-accent">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-white">Share a Best Practice</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A clear, descriptive title for your best practice"
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
            >
              <option value="">Select a category</option>
              <option value="onboarding">Onboarding</option>
              <option value="renewal">Renewal</option>
              <option value="expansion">Expansion</option>
              <option value="risk">Risk Management</option>
              <option value="communication">Communication</option>
              <option value="adoption">Adoption</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Problem Statement */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Problem / When to Use <span className="text-red-400">*</span>
            </label>
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="Describe the problem this solves or when to use this approach"
              rows={4}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Solution */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Solution Approach <span className="text-red-400">*</span>
            </label>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Step-by-step approach to solve the problem"
              rows={6}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Expected Outcomes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expected Outcomes
            </label>
            <textarea
              value={expectedOutcomes}
              onChange={(e) => setExpectedOutcomes(e.target.value)}
              placeholder="What results should the user expect?"
              rows={3}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Variations */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Variations
            </label>
            <textarea
              value={variations}
              onChange={(e) => setVariations(e.target.value)}
              placeholder="Alternative approaches for different scenarios"
              rows={3}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Pitfalls */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pitfalls to Avoid
            </label>
            <textarea
              value={pitfalls}
              onChange={(e) => setPitfalls(e.target.value)}
              placeholder="Common mistakes or things to watch out for"
              rows={3}
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., enterprise, B2B, technical"
              className="w-full px-4 py-3 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-cscx-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCreate(false)}
              disabled={saving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleCreate(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const BestPractices: React.FC<BestPracticesProps> = ({
  initialCategory,
  showCreateButton = true,
  compact = false,
  onSelectPractice,
}) => {
  const [practices, setPractices] = useState<BestPractice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPractice, setSelectedPractice] = useState<BestPractice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || '');
  const [sortBy, setSortBy] = useState('popular');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [practicesData, categoriesData] = await Promise.all([
        fetchBestPractices({
          q: searchQuery || undefined,
          category: selectedCategory || undefined,
          sortBy,
          featured: showFeaturedOnly ? true : undefined,
          limit: 20,
        }),
        fetchCategories(),
      ]);

      setPractices(practicesData.bestPractices);
      setCategories(categoriesData);
    } catch (err) {
      setError('Failed to load best practices');
      console.error('[BestPractices] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, sortBy, showFeaturedOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVote = async (practiceId: string, vote: 1 | -1 | 0) => {
    const result = await votePractice(practiceId, vote);
    setPractices((prev) =>
      prev.map((p) =>
        p.id === practiceId
          ? {
              ...p,
              upvoteCount: result.upvoteCount,
              downvoteCount: result.downvoteCount,
              userVote: vote === 0 ? undefined : vote,
            }
          : p
      )
    );
    if (selectedPractice?.id === practiceId) {
      setSelectedPractice((p) =>
        p
          ? {
              ...p,
              upvoteCount: result.upvoteCount,
              downvoteCount: result.downvoteCount,
              userVote: vote === 0 ? undefined : vote,
            }
          : null
      );
    }
  };

  const handleSave = async (practiceId: string, currentlySaved: boolean) => {
    const success = currentlySaved
      ? await unsavePractice(practiceId)
      : await savePractice(practiceId);

    if (success) {
      setPractices((prev) =>
        prev.map((p) =>
          p.id === practiceId ? { ...p, isSaved: !currentlySaved } : p
        )
      );
      if (selectedPractice?.id === practiceId) {
        setSelectedPractice((p) => (p ? { ...p, isSaved: !currentlySaved } : null));
      }
    }
  };

  const handleUse = async (practiceId: string, outcome?: string, notes?: string) => {
    const success = await recordUsage(practiceId, undefined, outcome, notes);
    if (success) {
      setPractices((prev) =>
        prev.map((p) =>
          p.id === practiceId ? { ...p, useCount: p.useCount + 1 } : p
        )
      );
      if (selectedPractice?.id === practiceId) {
        setSelectedPractice((p) =>
          p ? { ...p, useCount: p.useCount + 1 } : null
        );
      }
    }
  };

  const handleSelectPractice = async (practice: BestPractice) => {
    if (onSelectPractice) {
      onSelectPractice(practice);
      return;
    }
    // Fetch full details
    const fullPractice = await fetchPracticeById(practice.id);
    if (fullPractice) {
      setSelectedPractice(fullPractice);
    }
  };

  const handleCreated = (practice: BestPractice) => {
    setPractices((prev) => [practice, ...prev]);
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cscx-accent" />
            Best Practices
          </h3>
          <button
            onClick={loadData}
            className="p-1 rounded hover:bg-gray-700 text-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {practices.slice(0, 5).map((practice) => (
              <div
                key={practice.id}
                onClick={() => handleSelectPractice(practice)}
                className="p-3 bg-cscx-gray-800 rounded-lg cursor-pointer hover:bg-cscx-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {practice.isFeatured && (
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  )}
                  <span className="text-sm text-white truncate">{practice.title}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="capitalize">{practice.category || 'General'}</span>
                  <span>+{practice.upvoteCount - practice.downvoteCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-cscx-accent" />
            Best Practices
          </h1>
          <p className="text-gray-400 mt-1">
            Share and discover successful CSM strategies from your team
          </p>
        </div>

        {showCreateButton && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Share Practice
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search best practices..."
            className="w-full pl-10 pr-4 py-2.5 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label} ({cat.count})
              </option>
            ))}
          </select>
          <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2.5 bg-cscx-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
        >
          <option value="popular">Most Popular</option>
          <option value="recent">Most Recent</option>
          <option value="most_used">Most Used</option>
        </select>

        {/* Featured Toggle */}
        <button
          onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
            showFeaturedOnly
              ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
              : 'border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <Star className={`w-4 h-4 ${showFeaturedOnly ? 'fill-yellow-400' : ''}`} />
          Featured
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-red-400">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      ) : practices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <BookOpen className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-2">No Best Practices Found</h3>
          <p className="text-center max-w-md">
            {searchQuery || selectedCategory
              ? 'Try adjusting your search or filters'
              : 'Be the first to share a best practice with your team!'}
          </p>
          {showCreateButton && !searchQuery && !selectedCategory && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg"
            >
              <Plus className="w-5 h-5" />
              Share Practice
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {practices.map((practice) => (
            <PracticeCard
              key={practice.id}
              practice={practice}
              onSelect={() => handleSelectPractice(practice)}
              onVote={(vote) => handleVote(practice.id, vote)}
              onSave={() => handleSave(practice.id, practice.isSaved || false)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedPractice && !onSelectPractice && (
        <PracticeDetailModal
          practice={selectedPractice}
          onClose={() => setSelectedPractice(null)}
          onVote={(vote) => handleVote(selectedPractice.id, vote)}
          onSave={() => handleSave(selectedPractice.id, selectedPractice.isSaved || false)}
          onUse={(outcome, notes) => handleUse(selectedPractice.id, outcome, notes)}
        />
      )}

      {showCreateModal && (
        <CreatePracticeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default BestPractices;
