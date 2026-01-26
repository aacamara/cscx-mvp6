/**
 * CSCX.AI Knowledge Base Types
 * Unified knowledge management across all data sources
 */

// ============================================
// Data Source Types
// ============================================

export type DataSourceType =
  | 'google_drive'
  | 'onedrive'
  | 'jira'
  | 'database'
  | 'email'
  | 'slack'
  | 'zoom'
  | 'google_meet'
  | 'notebook_lm'
  | 'otter_ai'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'internal';

export type ConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export interface DataSource {
  id: string;
  type: DataSourceType;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: ConnectionStatus;
  lastSync: Date | null;
  documentCount: number;
  category: 'storage' | 'communication' | 'productivity' | 'ai' | 'meetings';
  authType: 'oauth' | 'api_key' | 'webhook' | 'native';
  features: string[];
}

export interface DataSourceConfig {
  sourceId: string;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    webhookUrl?: string;
  };
  syncSettings: {
    autoSync: boolean;
    syncInterval: number; // minutes
    syncDepth: 'shallow' | 'deep';
    includeArchived: boolean;
  };
  filters: {
    folders?: string[];
    labels?: string[];
    dateRange?: { start: Date; end: Date };
    fileTypes?: string[];
  };
}

// ============================================
// Knowledge Document Types
// ============================================

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  summary?: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceUrl?: string;
  sourceName: string;

  // Metadata
  category: string;
  tags: string[];
  department?: string;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  indexedAt: Date;

  // Relevance
  viewCount: number;
  useCount: number; // How many times agents used this
  relevanceScore: number;

  // Embeddings for semantic search
  embedding?: number[];
  chunkIndex?: number;
  parentDocId?: string;
}

export interface AgentKnowledge extends KnowledgeDocument {
  generatedBy: 'chatgpt' | 'claude' | 'gemini' | 'agent';
  prompt?: string;
  context?: string;
  customerId?: string;
  customerName?: string;
  confidence: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
}

// ============================================
// Search Types
// ============================================

export interface KBSearchQuery {
  query: string;
  sources?: DataSourceType[];
  categories?: string[];
  departments?: string[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  limit?: number;
  includeAgentKnowledge?: boolean;
}

export interface KBSearchResult {
  document: KnowledgeDocument | AgentKnowledge;
  score: number;
  highlights: string[];
  matchedChunks?: string[];
}

export interface AIAnswer {
  answer: string;
  confidence: number;
  sources: Array<{
    document: KnowledgeDocument;
    relevance: number;
    excerpt: string;
  }>;
  suggestedFollowups: string[];
  generatedAt: Date;
  model: 'claude' | 'gemini' | 'chatgpt';
}

// ============================================
// Category Types
// ============================================

export interface KBCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  documentCount: number;
  description?: string;
  parentId?: string;
  children?: KBCategory[];
}

// ============================================
// Sync & Activity Types
// ============================================

export interface SyncActivity {
  id: string;
  sourceType: DataSourceType;
  sourceName: string;
  action: 'sync_started' | 'sync_completed' | 'sync_failed' | 'document_added' | 'document_updated' | 'document_deleted';
  documentCount?: number;
  timestamp: Date;
  details?: string;
  error?: string;
}

export interface KBStats {
  totalDocuments: number;
  totalSources: number;
  connectedSources: number;
  agentKnowledgeCount: number;
  searchesToday: number;
  topCategories: Array<{ name: string; count: number }>;
  recentActivity: SyncActivity[];
}

// ============================================
// Default Data Sources
// ============================================

export const defaultDataSources: DataSource[] = [
  // Storage
  {
    id: 'google_drive',
    type: 'google_drive',
    name: 'Google Drive',
    description: 'Documents, sheets, presentations, and files',
    icon: '📁',
    color: '#4285F4',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'storage',
    authType: 'oauth',
    features: ['docs', 'sheets', 'slides', 'pdfs', 'folders']
  },
  {
    id: 'onedrive',
    type: 'onedrive',
    name: 'OneDrive',
    description: 'Microsoft 365 documents and files',
    icon: '☁️',
    color: '#0078D4',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'storage',
    authType: 'oauth',
    features: ['word', 'excel', 'powerpoint', 'pdfs', 'folders']
  },

  // Productivity
  {
    id: 'jira',
    type: 'jira',
    name: 'Jira',
    description: 'Issues, projects, and sprint data',
    icon: '🎫',
    color: '#0052CC',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'productivity',
    authType: 'oauth',
    features: ['issues', 'projects', 'sprints', 'comments', 'attachments']
  },
  {
    id: 'database',
    type: 'database',
    name: 'Databases',
    description: 'Customer data, CRM records, analytics',
    icon: '🗄️',
    color: '#6366F1',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'productivity',
    authType: 'api_key',
    features: ['customers', 'contracts', 'health_scores', 'activities']
  },

  // Communication
  {
    id: 'email',
    type: 'email',
    name: 'Email',
    description: 'Gmail and Outlook email threads',
    icon: '✉️',
    color: '#EA4335',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'communication',
    authType: 'oauth',
    features: ['threads', 'attachments', 'labels', 'search']
  },
  {
    id: 'slack',
    type: 'slack',
    name: 'Slack',
    description: 'Channels, DMs, and shared files',
    icon: '💬',
    color: '#4A154B',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'communication',
    authType: 'oauth',
    features: ['channels', 'threads', 'files', 'search']
  },

  // Meetings
  {
    id: 'zoom',
    type: 'zoom',
    name: 'Zoom',
    description: 'Meeting recordings and transcripts',
    icon: '📹',
    color: '#2D8CFF',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'meetings',
    authType: 'oauth',
    features: ['recordings', 'transcripts', 'chat', 'participants']
  },
  {
    id: 'google_meet',
    type: 'google_meet',
    name: 'Google Meet',
    description: 'Meeting recordings and notes',
    icon: '🎥',
    color: '#00897B',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'meetings',
    authType: 'oauth',
    features: ['recordings', 'transcripts', 'attendance']
  },
  {
    id: 'otter_ai',
    type: 'otter_ai',
    name: 'Otter.ai',
    description: 'AI meeting transcriptions and summaries',
    icon: '🦦',
    color: '#3B82F6',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'meetings',
    authType: 'api_key',
    features: ['transcripts', 'summaries', 'action_items', 'speakers']
  },

  // AI Providers
  {
    id: 'notebook_lm',
    type: 'notebook_lm',
    name: 'NotebookLM',
    description: 'Google AI-powered research notebooks',
    icon: '📓',
    color: '#34A853',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'ai',
    authType: 'oauth',
    features: ['notebooks', 'sources', 'insights', 'summaries']
  },
  {
    id: 'chatgpt',
    type: 'chatgpt',
    name: 'ChatGPT',
    description: 'OpenAI conversation history and outputs',
    icon: '🤖',
    color: '#10A37F',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'ai',
    authType: 'api_key',
    features: ['conversations', 'outputs', 'custom_gpts']
  },
  {
    id: 'claude',
    type: 'claude',
    name: 'Claude',
    description: 'Anthropic Claude conversations and artifacts',
    icon: '🧠',
    color: '#D97706',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'ai',
    authType: 'api_key',
    features: ['conversations', 'artifacts', 'projects']
  },
  {
    id: 'gemini',
    type: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini conversations and analysis',
    icon: '✨',
    color: '#8B5CF6',
    status: 'disconnected',
    lastSync: null,
    documentCount: 0,
    category: 'ai',
    authType: 'api_key',
    features: ['conversations', 'analysis', 'multimodal']
  }
];

// ============================================
// Category Definitions
// ============================================

export const defaultCategories: KBCategory[] = [
  {
    id: 'playbooks',
    name: 'Playbooks',
    icon: '📋',
    color: '#e63946',
    documentCount: 0,
    description: 'Customer success playbooks and frameworks'
  },
  {
    id: 'customer_intel',
    name: 'Customer Intelligence',
    icon: '🎯',
    color: '#3B82F6',
    documentCount: 0,
    description: 'Customer research, notes, and insights'
  },
  {
    id: 'product',
    name: 'Product Knowledge',
    icon: '📦',
    color: '#10B981',
    documentCount: 0,
    description: 'Product docs, features, and roadmap'
  },
  {
    id: 'training',
    name: 'Training Materials',
    icon: '📚',
    color: '#8B5CF6',
    documentCount: 0,
    description: 'Onboarding and training content'
  },
  {
    id: 'meetings',
    name: 'Meeting Notes',
    icon: '📝',
    color: '#F59E0B',
    documentCount: 0,
    description: 'Call notes, transcripts, and summaries'
  },
  {
    id: 'contracts',
    name: 'Contracts',
    icon: '📄',
    color: '#6366F1',
    documentCount: 0,
    description: 'Agreements, SOWs, and legal docs'
  },
  {
    id: 'agent_generated',
    name: 'Agent Generated',
    icon: '🤖',
    color: '#EC4899',
    documentCount: 0,
    description: 'Knowledge created by AI agents'
  }
];
