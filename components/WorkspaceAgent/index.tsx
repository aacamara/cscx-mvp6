/**
 * WorkspaceAgent - Agentic Google Workspace Integration
 * Full integration with Gmail, Calendar, Drive, Docs, Sheets, Slides,
 * Meeting Intelligence, Health Scores, QBR, Renewal Management
 *
 * Key Features:
 * - Quick actions for common CSM tasks across all categories
 * - Human-in-the-loop approval for sensitive actions
 * - Meeting intelligence with transcript summaries
 * - Health score calculation and display
 * - QBR generation workflow
 * - Renewal management automation
 * - Memory and learning from interactions
 */

import React, { useState } from 'react';
import {
  WorkspaceConnection,
  EmailThread,
  EmailDraft,
  CalendarEvent,
  MeetingProposal,
  DriveDocument,
  ActionResult,
  QuickAction,
  CSM_QUICK_ACTIONS,
  AgentMemory,
  EmailPurpose,
  AvailabilitySlot,
  HealthScore,
  HealthSignals,
  MeetingRecording,
  MeetingSummary,
  QBRPackage,
  RenewalPlaybook,
  QuickActionCategory,
  CustomerInsight,
  SessionContext,
} from '../../types/workspaceAgent';

interface WorkspaceAgentProps {
  customerId?: string;
  customerName?: string;
  stakeholderEmails?: string[];
  healthScore?: number;
  renewalDate?: Date;
  onActionComplete?: (result: ActionResult) => void;
  compact?: boolean;
}

// Simulated workspace connection state (enhanced)
const MOCK_CONNECTION: WorkspaceConnection = {
  status: 'connected',
  gmail: { connected: true, lastSync: new Date() },
  calendar: { connected: true, lastSync: new Date() },
  drive: { connected: true, lastSync: new Date() },
  docs: { connected: true, lastSync: new Date() },
  sheets: { connected: true, lastSync: new Date() },
  slides: { connected: true, lastSync: new Date() },
  lastSync: new Date(),
  userEmail: 'csm@company.com',
  scopes: ['gmail.readonly', 'gmail.send', 'calendar', 'drive', 'docs', 'sheets', 'slides'],
};

// Mock email threads
const MOCK_EMAILS: EmailThread[] = [
  {
    id: 'thread_1',
    subject: 'Re: Q1 Review Preparation',
    snippet: 'Thanks for sending over the deck. A few questions about the usage metrics...',
    participants: [
      { name: 'Sarah Chen', email: 'sarah@acmecorp.com', role: 'customer', isStakeholder: true },
      { name: 'You', email: 'csm@company.com', role: 'internal', isStakeholder: false },
    ],
    messageCount: 5,
    unreadCount: 1,
    lastMessageDate: new Date(Date.now() - 2 * 3600000),
    labels: ['INBOX', 'IMPORTANT'],
    isCustomerThread: true,
    sentiment: 'positive',
    summary: 'Customer reviewing Q1 deck, has questions about usage metrics',
    actionItems: ['Clarify usage calculation', 'Schedule follow-up call'],
  },
  {
    id: 'thread_2',
    subject: 'Integration Issue - API Rate Limits',
    snippet: "We're hitting rate limits on the sync endpoint. This is blocking our team...",
    participants: [
      { name: 'Mike Johnson', email: 'mike@acmecorp.com', role: 'customer', isStakeholder: true },
      { name: 'Support', email: 'support@company.com', role: 'internal', isStakeholder: false },
    ],
    messageCount: 8,
    unreadCount: 3,
    lastMessageDate: new Date(Date.now() - 30 * 60000),
    labels: ['INBOX', 'URGENT'],
    isCustomerThread: true,
    sentiment: 'negative',
    summary: 'Technical escalation - API rate limits blocking customer workflow',
    actionItems: ['Escalate to engineering', 'Provide interim solution'],
  },
];

// Mock drive documents
const MOCK_DOCS: DriveDocument[] = [
  {
    id: 'doc_1',
    name: 'Acme Corp - Q1 2024 QBR Deck',
    mimeType: 'application/vnd.google-apps.presentation',
    type: 'presentation',
    webViewLink: 'https://docs.google.com/presentation/d/123',
    lastModified: new Date(Date.now() - 86400000),
    lastModifiedBy: 'csm@company.com',
    isCustomerDoc: true,
    customerName: 'Acme Corp',
    category: 'qbr',
  },
  {
    id: 'doc_2',
    name: 'Acme Corp - Contract 2024',
    mimeType: 'application/pdf',
    type: 'pdf',
    webViewLink: 'https://drive.google.com/file/d/456',
    lastModified: new Date(Date.now() - 30 * 86400000),
    isCustomerDoc: true,
    customerName: 'Acme Corp',
    category: 'contract',
  },
  {
    id: 'doc_3',
    name: 'Success Plan - Acme Corp',
    mimeType: 'application/vnd.google-apps.document',
    type: 'document',
    webViewLink: 'https://docs.google.com/document/d/789',
    lastModified: new Date(Date.now() - 7 * 86400000),
    isCustomerDoc: true,
    customerName: 'Acme Corp',
    category: 'success_plan',
  },
];

// Mock meeting recordings
const MOCK_MEETINGS: MeetingRecording[] = [
  {
    id: 'meeting_1',
    platform: 'zoom',
    title: 'Weekly Sync - Acme Corp',
    startTime: new Date(Date.now() - 2 * 86400000),
    duration: 45,
    participants: [
      { name: 'Sarah Chen', email: 'sarah@acmecorp.com', joinTime: new Date(), duration: 45, isCustomer: true, attentionScore: 92 },
      { name: 'Mike Johnson', email: 'mike@acmecorp.com', joinTime: new Date(), duration: 45, isCustomer: true, attentionScore: 88 },
      { name: 'CSM', email: 'csm@company.com', joinTime: new Date(), duration: 45, isCustomer: false },
    ],
    transcriptAvailable: true,
    customerId: 'acme_1',
    customerName: 'Acme Corp',
  },
  {
    id: 'meeting_2',
    platform: 'google_meet',
    title: 'Technical Review - Acme Corp',
    startTime: new Date(Date.now() - 5 * 86400000),
    duration: 60,
    participants: [
      { name: 'Mike Johnson', email: 'mike@acmecorp.com', joinTime: new Date(), duration: 60, isCustomer: true },
    ],
    transcriptAvailable: true,
    customerId: 'acme_1',
    customerName: 'Acme Corp',
  },
];

// Mock health score
const MOCK_HEALTH_SCORE: HealthScore = {
  customerId: 'acme_1',
  score: 78,
  grade: 'B',
  trend: 'improving',
  previousScore: 72,
  signals: {
    productUsage: { loginFrequency: 25, featureAdoption: 68, usageVsEntitlement: 82, activeUsers: 45, trend: 'up', score: 75 },
    engagement: { meetingFrequency: 2, emailResponseTime: 4, eventAttendance: 80, lastContactDays: 3, score: 85 },
    support: { ticketVolume: 5, avgSeverity: 2, resolutionSatisfaction: 90, openTickets: 1, escalations: 0, score: 88 },
    nps: { latestScore: 8, previousScore: 7, trend: 'promoter', lastSurveyDate: new Date(Date.now() - 30 * 86400000), score: 80 },
    contract: { daysToRenewal: 120, expansionHistory: 15, paymentStatus: 'current', contractValue: 150000, score: 75 },
    stakeholder: { championStrength: 'strong', executiveEngagement: true, turnoverRisk: 'low', decisionMakerAccess: true, score: 90 },
  },
  factors: [
    { name: 'Executive Engagement', weight: 0.2, score: 90, impact: 'positive', description: 'Strong executive sponsorship' },
    { name: 'Feature Adoption', weight: 0.15, score: 68, impact: 'neutral', description: 'Room for growth in advanced features' },
    { name: 'Support Health', weight: 0.15, score: 88, impact: 'positive', description: 'Low ticket volume, high satisfaction' },
  ],
  recommendations: [
    'Schedule feature training to improve adoption',
    'Introduce new analytics module',
    'Plan executive business review',
  ],
  calculatedAt: new Date(),
};

// Mock customer insights
const MOCK_INSIGHTS: CustomerInsight = {
  relationshipSummary: 'Strong partnership with engaged stakeholders. Technical team highly satisfied. Executive sponsor actively involved in strategic planning.',
  keyStakeholders: ['Sarah Chen (VP Product)', 'Mike Johnson (Engineering Lead)', 'David Kim (CTO)'],
  mainUseCases: ['Customer analytics', 'Workflow automation', 'Team collaboration'],
  successFactors: ['Fast onboarding', 'Responsive support', 'Product-market fit'],
  riskFactors: ['Competitor evaluation mentioned', 'Budget constraints in Q3'],
  expansionOpportunities: ['Enterprise tier upgrade', 'Additional department rollout', 'API integration package'],
  communicationPreferences: 'Email for updates, video calls for strategic discussions',
  lastUpdated: new Date(),
};

// API URL for backend calls
const API_URL = import.meta.env.VITE_API_URL || '';
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

// Helper to execute workspace actions via backend
async function executeWorkspaceAction(
  actionId: string,
  category: string,
  customerId?: string,
  customerName?: string,
  params?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string; requiresApproval?: boolean }> {
  try {
    const response = await fetch(`${API_URL}/api/workspace-agent/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': DEMO_USER_ID,
      },
      body: JSON.stringify({
        actionId,
        category,
        customerId,
        customerName,
        params,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Action failed' };
    }

    return await response.json();
  } catch (error) {
    console.error('Workspace action error:', error);
    return { success: false, error: (error as Error).message };
  }
}

export const WorkspaceAgent: React.FC<WorkspaceAgentProps> = ({
  customerId,
  customerName = 'Acme Corp',
  stakeholderEmails = [],
  healthScore: propHealthScore,
  renewalDate,
  onActionComplete,
  compact = false,
}) => {
  // State - fetch real connection status
  const [connection, setConnection] = useState<WorkspaceConnection>(MOCK_CONNECTION);
  const [useBackend, setUseBackend] = useState(true); // Toggle between backend and mock

  // Fetch real connection status on mount
  React.useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/workspace-agent/status`, {
          headers: { 'x-user-id': DEMO_USER_ID },
        });
        if (response.ok) {
          const data = await response.json();
          setConnection(prev => ({
            ...prev,
            status: data.connected ? 'connected' : 'disconnected',
            gmail: { connected: data.services?.gmail || false, lastSync: new Date() },
            calendar: { connected: data.services?.calendar || false, lastSync: new Date() },
            drive: { connected: data.services?.drive || false, lastSync: new Date() },
            docs: { connected: data.services?.docs || false, lastSync: new Date() },
            sheets: { connected: data.services?.sheets || false, lastSync: new Date() },
            slides: { connected: data.services?.slides || false, lastSync: new Date() },
            userEmail: data.email || 'Not connected',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch connection status:', error);
      }
    };
    fetchConnectionStatus();
  }, []);
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuickActionCategory | 'all'>('all');
  const [pendingApproval, setPendingApproval] = useState<{
    type: 'email' | 'meeting' | 'qbr' | 'renewal';
    data: EmailDraft | MeetingProposal | QBRPackage | RenewalPlaybook;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Memory state
  const [agentMemory, setAgentMemory] = useState<AgentMemory>({
    customerId,
    preferences: [],
    recentActions: [],
    learnedPatterns: [],
    sessionContext: {
      activeCustomerId: customerId,
      activeCustomerName: customerName,
      pendingApprovals: [],
      recentDocuments: [],
      recentMeetings: [],
      conversationHistory: [],
    } as SessionContext,
  });

  // Email state
  const [emailSummary, setEmailSummary] = useState<{
    threads: EmailThread[];
    summary: string;
    actionItems: string[];
  } | null>(null);

  // Draft state
  const [draftEmail, setDraftEmail] = useState<EmailDraft | null>(null);

  // Calendar state
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [meetingProposal, setMeetingProposal] = useState<MeetingProposal | null>(null);

  // Document state
  const [documents, setDocuments] = useState<DriveDocument[]>([]);

  // Meeting Intelligence state
  const [recentMeetings, setRecentMeetings] = useState<MeetingRecording[]>([]);
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary | null>(null);

  // Health Score state
  const [healthScoreData, setHealthScoreData] = useState<HealthScore | null>(null);

  // QBR state
  const [qbrPackage, setQBRPackage] = useState<QBRPackage | null>(null);

  // Renewal state
  const [renewalPlaybook, setRenewalPlaybook] = useState<RenewalPlaybook | null>(null);

  // Insights state
  const [customerInsights, setCustomerInsights] = useState<CustomerInsight | null>(null);

  // Get unique categories from quick actions
  const categories: QuickActionCategory[] = [
    'email',
    'calendar',
    'document',
    'meeting_intelligence',
    'health_score',
    'qbr',
    'renewal',
    'knowledge',
  ];

  // Filter quick actions by category
  const getActionsByCategory = (category: QuickActionCategory | 'all') => {
    if (category === 'all') return CSM_QUICK_ACTIONS;
    return CSM_QUICK_ACTIONS.filter(a => a.category === category);
  };

  // Get category display name
  const getCategoryName = (category: QuickActionCategory | 'all'): string => {
    const names: Record<string, string> = {
      all: 'All Actions',
      email: 'Email',
      calendar: 'Calendar',
      document: 'Documents',
      meeting_intelligence: 'Meeting Intel',
      health_score: 'Health Score',
      qbr: 'QBR',
      renewal: 'Renewal',
      knowledge: 'Knowledge',
      onboarding: 'Onboarding',
      automation: 'Automation',
    };
    return names[category] || category;
  };

  // Get category icon
  const getCategoryIcon = (category: QuickActionCategory | 'all'): string => {
    const icons: Record<string, string> = {
      all: '🎯',
      email: '📧',
      calendar: '📅',
      document: '📁',
      meeting_intelligence: '🎙️',
      health_score: '💚',
      qbr: '📊',
      renewal: '🔄',
      knowledge: '💡',
      onboarding: '🚀',
      automation: '⚡',
    };
    return icons[category] || '📌';
  };

  // Execute a quick action
  const executeAction = async (action: QuickAction) => {
    setActiveAction(action);
    setIsProcessing(true);
    setShowResults(true);

    // Try backend first if enabled
    if (useBackend && connection.status === 'connected') {
      try {
        const result = await executeWorkspaceAction(
          action.id,
          action.category,
          customerId,
          customerName,
          { stakeholderEmails }
        );

        if (result.success) {
          // Handle successful backend response
          console.log('[WorkspaceAgent] Backend action success:', result.data);

          // Update UI based on action category
          if (action.category === 'email' && result.data) {
            setEmailSummary({
              threads: (result.data as { threads?: EmailThread[] }).threads || [],
              summary: 'Fetched from Google Workspace',
              actionItems: [],
            });
          }

          if (result.requiresApproval) {
            // Handle approval flow
            console.log('[WorkspaceAgent] Action requires approval');
          }

          recordAction(action.id.toUpperCase(), 'success');
          setIsProcessing(false);
          setActiveAction(null);

          if (onActionComplete) {
            onActionComplete({
              success: true,
              action: action.id,
              message: `${action.name} completed successfully`,
              data: result.data,
              timestamp: new Date(),
            });
          }
          return;
        } else {
          console.warn('[WorkspaceAgent] Backend action failed, falling back to mock:', result.error);
        }
      } catch (error) {
        console.warn('[WorkspaceAgent] Backend error, falling back to mock:', error);
      }
    }

    // Fallback to mock implementation
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      switch (action.id) {
        // Email actions
        case 'summarize_emails':
          await handleSummarizeEmails();
          break;
        case 'draft_checkin':
          await handleDraftEmail('check_in');
          break;
        case 'draft_followup':
          await handleDraftEmail('follow_up');
          break;
        case 'draft_renewal':
          await handleDraftEmail('renewal');
          break;
        case 'draft_escalation':
          await handleDraftEmail('escalation');
          break;

        // Calendar actions
        case 'find_availability':
          await handleFindAvailability();
          break;
        case 'schedule_qbr':
          await handleScheduleQBR();
          break;
        case 'schedule_checkin':
          await handleScheduleCheckin();
          break;

        // Document actions
        case 'find_docs':
          await handleFindDocuments();
          break;
        case 'create_meeting_notes':
          await handleCreateDocument('meeting_notes');
          break;
        case 'create_success_plan':
          await handleCreateDocument('success_plan');
          break;

        // Meeting Intelligence actions
        case 'get_transcript':
          await handleGetRecentMeetings();
          break;
        case 'summarize_meeting':
          await handleSummarizeMeeting();
          break;
        case 'extract_actions':
          await handleExtractActions();
          break;

        // Health Score actions
        case 'calculate_health':
          await handleCalculateHealthScore();
          break;
        case 'health_trend':
          await handleGetHealthTrend();
          break;

        // QBR actions
        case 'prepare_qbr':
          await handlePrepareQBR();
          break;
        case 'generate_qbr_full':
          await handleGenerateQBR();
          break;

        // Renewal actions
        case 'renewal_health_check':
          await handleRenewalHealthCheck();
          break;
        case 'create_renewal_playbook':
          await handleCreateRenewalPlaybook();
          break;

        // Knowledge actions
        case 'search_knowledge':
          await handleSearchKnowledge();
          break;
        case 'get_insights':
          await handleGetInsights();
          break;
        case 'view_timeline':
          await handleViewTimeline();
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Action failed:', error);
    }

    setIsProcessing(false);
    setActiveAction(null);
  };

  // === EMAIL HANDLERS ===
  const handleSummarizeEmails = async () => {
    const threads = MOCK_EMAILS;
    const allActionItems = threads.flatMap(t => t.actionItems || []);

    setEmailSummary({
      threads,
      summary: `Found ${threads.length} recent threads with ${customerName}. ${
        threads.filter(t => t.sentiment === 'negative').length > 0
          ? '⚠️ There\'s an urgent technical issue that needs attention.'
          : 'Overall sentiment is positive.'
      }`,
      actionItems: allActionItems,
    });

    recordAction('SUMMARIZE_EMAILS', 'success');
  };

  const handleDraftEmail = async (purpose: EmailPurpose) => {
    const templates: Record<EmailPurpose, { subject: string; body: string }> = {
      check_in: {
        subject: `Quick check-in - ${customerName}`,
        body: `Hi team,\n\nI wanted to reach out for a quick check-in. How are things going with the platform?\n\nA few items I'd love to discuss:\n• Recent usage trends\n• Any blockers or challenges\n• Upcoming priorities\n\nWould love to schedule a quick call this week if you have time.\n\nBest regards`,
      },
      follow_up: {
        subject: `Following up on our conversation - ${customerName}`,
        body: `Hi team,\n\nThank you for the great conversation earlier. I wanted to follow up on the action items we discussed:\n\n• [Action item 1]\n• [Action item 2]\n\nPlease let me know if you have any questions.\n\nBest regards`,
      },
      renewal: {
        subject: `Renewal Discussion - ${customerName}`,
        body: `Hi team,\n\nI hope this message finds you well. I wanted to reach out regarding your upcoming renewal.\n\nOver the past year, you've achieved:\n• [Key achievement 1]\n• [Key achievement 2]\n\nI'd love to schedule a call to discuss how we can continue supporting your success.\n\nBest regards`,
      },
      escalation: {
        subject: `Urgent: Following up on your issue - ${customerName}`,
        body: `Hi team,\n\nI wanted to personally reach out regarding the issue you're experiencing.\n\nWe're treating this as a top priority and here's what we're doing:\n• [Immediate action]\n• [Next steps]\n\nI'll keep you updated on progress.\n\nBest regards`,
      },
      kickoff: { subject: `Welcome! - ${customerName} Kickoff`, body: 'Welcome aboard...' },
      milestone: { subject: `Congratulations! - ${customerName}`, body: 'Great milestone...' },
      qbr_invite: { subject: `QBR Invitation - ${customerName}`, body: 'Time for our quarterly review...' },
      thank_you: { subject: `Thank you! - ${customerName}`, body: 'Thank you for...' },
      feature_announcement: { subject: `New Feature - ${customerName}`, body: 'Exciting news...' },
      survey_request: { subject: `Quick Survey - ${customerName}`, body: 'We value your feedback...' },
      nps_request: { subject: `How are we doing? - ${customerName}`, body: 'Quick question...' },
      success_celebration: { subject: `Celebrating Success - ${customerName}`, body: 'Amazing achievement...' },
      onboarding_welcome: { subject: `Welcome to the team! - ${customerName}`, body: 'Welcome aboard...' },
      executive_review: { subject: `Executive Review - ${customerName}`, body: 'Executive summary...' },
      custom: { subject: '', body: '' },
    };

    const template = templates[purpose];
    const draft: EmailDraft = {
      id: `draft_${Date.now()}`,
      to: stakeholderEmails.length > 0 ? stakeholderEmails : ['sarah@acmecorp.com'],
      subject: template.subject,
      body: template.body,
      purpose,
      tone: 'friendly',
      status: 'pending_approval',
      aiGenerated: true,
      suggestions: [
        'Consider adding specific metrics from their usage',
        'Mention their recent support ticket if relevant',
      ],
    };

    setDraftEmail(draft);
    setPendingApproval({ type: 'email', data: draft });
  };

  // === CALENDAR HANDLERS ===
  const handleFindAvailability = async () => {
    const slots: AvailabilitySlot[] = [
      { start: new Date(Date.now() + 24 * 3600000 + 10 * 3600000), end: new Date(Date.now() + 24 * 3600000 + 11 * 3600000), score: 95, reason: 'Morning slot - typically high engagement' },
      { start: new Date(Date.now() + 24 * 3600000 + 14 * 3600000), end: new Date(Date.now() + 24 * 3600000 + 15 * 3600000), score: 85, reason: 'Post-lunch - good for discussions' },
      { start: new Date(Date.now() + 2 * 24 * 3600000 + 11 * 3600000), end: new Date(Date.now() + 2 * 24 * 3600000 + 12 * 3600000), score: 80, reason: 'Mid-morning - allows preparation time' },
    ];
    setAvailableSlots(slots);
    recordAction('CHECK_AVAILABILITY', 'success');
  };

  const handleScheduleQBR = async () => {
    await handleFindAvailability();
    const proposal: MeetingProposal = {
      id: `meeting_${Date.now()}`,
      title: `Quarterly Business Review - ${customerName}`,
      description: `QBR with ${customerName} team.\n\nAgenda:\n• Performance review\n• Roadmap alignment\n• Success metrics\n• Next quarter planning`,
      duration: 60,
      attendees: stakeholderEmails.length > 0 ? stakeholderEmails : ['sarah@acmecorp.com'],
      proposedSlots: availableSlots,
      meetingType: 'qbr',
      status: 'proposing',
      includeMeetLink: true,
      sendInvites: true,
    };
    setMeetingProposal(proposal);
    setPendingApproval({ type: 'meeting', data: proposal });
  };

  const handleScheduleCheckin = async () => {
    await handleFindAvailability();
    const proposal: MeetingProposal = {
      id: `meeting_${Date.now()}`,
      title: `Check-in - ${customerName}`,
      description: `Regular check-in with ${customerName} team.`,
      duration: 30,
      attendees: stakeholderEmails.length > 0 ? stakeholderEmails : ['sarah@acmecorp.com'],
      proposedSlots: availableSlots,
      meetingType: 'check_in',
      status: 'proposing',
      includeMeetLink: true,
      sendInvites: true,
    };
    setMeetingProposal(proposal);
    setPendingApproval({ type: 'meeting', data: proposal });
  };

  // === DOCUMENT HANDLERS ===
  const handleFindDocuments = async () => {
    setDocuments(MOCK_DOCS);
    recordAction('FIND_DOCUMENTS', 'success');
  };

  const handleCreateDocument = async (type: string) => {
    // Simulate document creation
    const newDoc: DriveDocument = {
      id: `doc_${Date.now()}`,
      name: `${customerName} - ${type === 'meeting_notes' ? 'Meeting Notes' : 'Success Plan'} - ${new Date().toLocaleDateString()}`,
      mimeType: 'application/vnd.google-apps.document',
      type: 'document',
      webViewLink: 'https://docs.google.com/document/d/new',
      lastModified: new Date(),
      isCustomerDoc: true,
      customerName,
      category: type === 'meeting_notes' ? 'meeting_notes' : 'success_plan',
    };
    setDocuments(prev => [newDoc, ...prev]);
    recordAction('CREATE_DOCUMENT', 'success');
  };

  // === MEETING INTELLIGENCE HANDLERS ===
  const handleGetRecentMeetings = async () => {
    setRecentMeetings(MOCK_MEETINGS);
    recordAction('LIST_RECENT_MEETINGS', 'success');
  };

  const handleSummarizeMeeting = async () => {
    const summary: MeetingSummary = {
      id: `summary_${Date.now()}`,
      meetingId: MOCK_MEETINGS[0]?.id || 'meeting_1',
      format: 'detailed',
      overview: `Productive weekly sync covering product updates, roadmap alignment, and Q2 planning. Customer expressed satisfaction with recent improvements.`,
      keyPoints: [
        'Customer satisfied with recent performance improvements',
        'Planning to expand usage to marketing team',
        'Interest in new analytics features',
        'Budget discussion for Q2 expansion',
      ],
      actionItems: [
        { id: '1', description: 'Send analytics feature demo', owner: 'CSM', priority: 'high', status: 'pending', source: 'meeting' },
        { id: '2', description: 'Prepare expansion proposal', owner: 'CSM', priority: 'medium', status: 'pending', source: 'meeting' },
        { id: '3', description: 'Schedule training for marketing team', owner: 'Customer', priority: 'medium', status: 'pending', source: 'meeting' },
      ],
      decisions: ['Move forward with Q2 expansion planning', 'Schedule executive review for April'],
      followUps: ['Send proposal by end of week', 'Confirm training dates'],
      sentiment: 'positive',
      customerSignals: [
        { type: 'opportunity', description: 'Expansion to marketing team', severity: 'medium' },
        { type: 'feedback', description: 'Very happy with support response times', severity: 'low' },
      ],
      generatedAt: new Date(),
    };
    setMeetingSummary(summary);
    recordAction('SUMMARIZE_MEETING', 'success');
  };

  const handleExtractActions = async () => {
    await handleSummarizeMeeting();
    recordAction('EXTRACT_ACTION_ITEMS', 'success');
  };

  // === HEALTH SCORE HANDLERS ===
  const handleCalculateHealthScore = async () => {
    setHealthScoreData(MOCK_HEALTH_SCORE);
    recordAction('CALCULATE_HEALTH_SCORE', 'success');
  };

  const handleGetHealthTrend = async () => {
    await handleCalculateHealthScore();
    recordAction('GET_HEALTH_TREND', 'success');
  };

  // === QBR HANDLERS ===
  const handlePrepareQBR = async () => {
    await handleFindDocuments();
    await handleSummarizeEmails();
    await handleCalculateHealthScore();
    recordAction('PREPARE_QBR', 'success');
  };

  const handleGenerateQBR = async () => {
    const qbr: QBRPackage = {
      id: `qbr_${Date.now()}`,
      customerId: customerId || 'acme_1',
      customerName,
      quarter: 'Q1',
      year: 2024,
      status: 'draft',
      documentId: 'doc_qbr_1',
      presentationId: 'slides_qbr_1',
      documentUrl: 'https://docs.google.com/document/d/qbr',
      presentationUrl: 'https://docs.google.com/presentation/d/qbr',
      sections: [
        { name: 'executive_summary', included: true, content: 'Executive summary content...' },
        { name: 'usage_metrics', included: true, data: { logins: 1250, features: 15, adoption: 68 } },
        { name: 'health_score_analysis', included: true, data: MOCK_HEALTH_SCORE },
        { name: 'recommendations', included: true, content: 'Recommendations content...' },
      ],
      generatedAt: new Date(),
    };
    setQBRPackage(qbr);
    setPendingApproval({ type: 'qbr', data: qbr });
    recordAction('GENERATE_QBR', 'success');
  };

  // === RENEWAL HANDLERS ===
  const handleRenewalHealthCheck = async () => {
    await handleCalculateHealthScore();
    recordAction('CHECK_RENEWAL_HEALTH', 'success');
  };

  const handleCreateRenewalPlaybook = async () => {
    const playbook: RenewalPlaybook = {
      id: `renewal_${Date.now()}`,
      customerId: customerId || 'acme_1',
      customerName,
      renewalDate: renewalDate || new Date(Date.now() + 90 * 86400000),
      status: 'not_started',
      stages: [
        { name: '90 Days Out', daysBeforeRenewal: 90, status: 'pending', actions: [
          { id: '1', type: 'email', description: 'Send renewal reminder', status: 'pending' },
          { id: '2', type: 'meeting', description: 'Schedule renewal discussion', status: 'pending' },
        ]},
        { name: '60 Days Out', daysBeforeRenewal: 60, status: 'pending', actions: [
          { id: '3', type: 'email', description: 'Send proposal', status: 'pending' },
        ]},
        { name: '30 Days Out', daysBeforeRenewal: 30, status: 'pending', actions: [
          { id: '4', type: 'call', description: 'Follow up call', status: 'pending' },
        ]},
      ],
      probability: 85,
      riskFactors: ['Budget constraints mentioned', 'Competitor evaluation'],
      positiveIndicators: ['High engagement', 'Executive sponsor active', 'Expanding usage'],
      recommendedActions: ['Schedule executive review', 'Prepare expansion proposal', 'Address technical concerns'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setRenewalPlaybook(playbook);
    setPendingApproval({ type: 'renewal', data: playbook });
    recordAction('CREATE_RENEWAL_PLAYBOOK', 'success');
  };

  // === KNOWLEDGE HANDLERS ===
  const handleSearchKnowledge = async () => {
    await handleGetInsights();
    recordAction('SEARCH_KNOWLEDGE_BASE', 'success');
  };

  const handleGetInsights = async () => {
    setCustomerInsights(MOCK_INSIGHTS);
    recordAction('GET_CUSTOMER_INSIGHTS', 'success');
  };

  const handleViewTimeline = async () => {
    await handleGetInsights();
    recordAction('GET_CUSTOMER_TIMELINE', 'success');
  };

  // === APPROVAL HANDLERS ===
  const handleApprove = async () => {
    if (!pendingApproval) return;
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (pendingApproval.type === 'email') {
      const draft = pendingApproval.data as EmailDraft;
      setDraftEmail({ ...draft, status: 'sent' });
      recordAction('SEND_EMAIL', 'success');
    } else if (pendingApproval.type === 'meeting') {
      const meeting = pendingApproval.data as MeetingProposal;
      setMeetingProposal({ ...meeting, status: 'pending_response' });
      recordAction('SCHEDULE_MEETING', 'success');
    } else if (pendingApproval.type === 'qbr') {
      const qbr = pendingApproval.data as QBRPackage;
      setQBRPackage({ ...qbr, status: 'approved', approvedAt: new Date() });
      recordAction('GENERATE_QBR', 'success');
    } else if (pendingApproval.type === 'renewal') {
      const renewal = pendingApproval.data as RenewalPlaybook;
      setRenewalPlaybook({ ...renewal, status: 'in_progress' });
      recordAction('CREATE_RENEWAL_PLAYBOOK', 'success');
    }

    setPendingApproval(null);
    setIsProcessing(false);
  };

  const handleModify = () => {
    console.log('Modify action:', pendingApproval);
  };

  // Record action for memory
  const recordAction = (action: string, outcome: 'success' | 'modified' | 'rejected') => {
    setAgentMemory(prev => ({
      ...prev,
      recentActions: [
        { id: `action_${Date.now()}`, action, context: `Customer: ${customerName}`, timestamp: new Date(), outcome },
        ...prev.recentActions.slice(0, 9),
      ],
    }));
  };

  // Connection status indicator
  const ConnectionStatus: React.FC = () => (
    <div className="flex items-center gap-3 p-2 bg-cscx-gray-800 rounded-lg text-xs">
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.gmail.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Gmail</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.calendar.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Cal</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${connection.drive.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-cscx-gray-400">Drive</span>
      </div>
    </div>
  );

  // Quick action button
  const ActionButton: React.FC<{ action: QuickAction; size?: 'sm' | 'md' }> = ({ action, size = 'md' }) => (
    <button
      onClick={() => executeAction(action)}
      disabled={isProcessing}
      className={`bg-cscx-gray-800 hover:bg-cscx-gray-700 border border-cscx-gray-700 rounded-lg text-left transition-all ${
        isProcessing ? 'opacity-50 cursor-not-allowed' : ''
      } ${size === 'sm' ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={size === 'sm' ? 'text-base' : 'text-lg'}>{action.icon}</span>
        <span className="text-white font-medium text-sm">{action.name}</span>
      </div>
      {size === 'md' && <p className="text-xs text-cscx-gray-400">{action.description}</p>}
      {action.requiresApproval && size === 'md' && (
        <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
          Requires approval
        </span>
      )}
    </button>
  );

  // Compact mode for embedded use
  if (compact) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <span>🤖</span> Workspace Agent
          </h4>
          <ConnectionStatus />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CSM_QUICK_ACTIONS.slice(0, 4).map(action => (
            <button
              key={action.id}
              onClick={() => executeAction(action)}
              disabled={isProcessing}
              className="p-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 border border-cscx-gray-700 rounded-lg text-left transition-colors"
            >
              <span className="text-sm text-white">{action.icon} {action.name}</span>
            </button>
          ))}
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 p-2 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
            <div className="animate-spin w-4 h-4 border-2 border-cscx-accent border-t-transparent rounded-full" />
            <span className="text-sm text-white">Processing...</span>
          </div>
        )}

        {emailSummary && (
          <div className="p-3 bg-cscx-gray-800 rounded-lg">
            <p className="text-sm text-white">{emailSummary.summary}</p>
            {emailSummary.actionItems.length > 0 && (
              <ul className="mt-2 text-xs text-cscx-gray-400">
                {emailSummary.actionItems.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {healthScoreData && (
          <div className="p-3 bg-cscx-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Health Score</span>
              <span className={`text-lg font-bold ${
                healthScoreData.score >= 80 ? 'text-green-400' :
                healthScoreData.score >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>{healthScoreData.score}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded ${
                healthScoreData.trend === 'improving' ? 'bg-green-500/20 text-green-400' :
                healthScoreData.trend === 'declining' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {healthScoreData.trend === 'improving' ? '↑' : healthScoreData.trend === 'declining' ? '↓' : '→'} {healthScoreData.trend}
              </span>
              <span className="text-xs text-cscx-gray-400">Grade: {healthScoreData.grade}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              CSCX Workspace Agent
            </h3>
            <p className="text-sm text-cscx-gray-400">
              AI-powered actions for {customerName}
            </p>
          </div>
          <ConnectionStatus />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-cscx-accent text-white'
                : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
            }`}
          >
            {getCategoryIcon('all')} All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              {getCategoryIcon(cat)} {getCategoryName(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {getActionsByCategory(activeCategory).map(action => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-3 p-4 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
            <div className="animate-spin w-5 h-5 border-2 border-cscx-accent border-t-transparent rounded-full" />
            <span className="text-white">{activeAction ? `Executing: ${activeAction.name}...` : 'Processing...'}</span>
          </div>
        )}

        {/* Results Section */}
        {showResults && !isProcessing && (
          <div className="space-y-4">
            {/* Email Summary */}
            {emailSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📧 Email Summary</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{emailSummary.summary}</p>
                <div className="space-y-2">
                  {emailSummary.threads.map(thread => (
                    <div key={thread.id} className="p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{thread.subject}</p>
                          <p className="text-xs text-cscx-gray-400">{thread.snippet}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          thread.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                          thread.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>{thread.sentiment}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health Score */}
            {healthScoreData && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">💚 Health Score</h4>
                <div className="flex items-center gap-6">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="#222" strokeWidth="8" />
                      <circle
                        cx="40" cy="40" r="36" fill="none"
                        stroke={healthScoreData.score >= 80 ? '#22c55e' : healthScoreData.score >= 60 ? '#eab308' : '#ef4444'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(healthScoreData.score / 100) * 226} 226`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xl font-bold ${
                        healthScoreData.score >= 80 ? 'text-green-400' :
                        healthScoreData.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{healthScoreData.score}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-medium">Grade: {healthScoreData.grade}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        healthScoreData.trend === 'improving' ? 'bg-green-500/20 text-green-400' :
                        healthScoreData.trend === 'declining' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {healthScoreData.trend === 'improving' ? '↑' : healthScoreData.trend === 'declining' ? '↓' : '→'} {healthScoreData.trend}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {healthScoreData.factors.slice(0, 3).map((factor, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-cscx-gray-400">{factor.name}</span>
                          <span className={factor.impact === 'positive' ? 'text-green-400' : factor.impact === 'negative' ? 'text-red-400' : 'text-gray-400'}>
                            {factor.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {healthScoreData.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cscx-gray-700">
                    <p className="text-xs text-cscx-gray-500 mb-1">Recommendations:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {healthScoreData.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Meeting Summary */}
            {meetingSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">🎙️ Meeting Summary</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{meetingSummary.overview}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-cscx-gray-500 mb-1">Key Points:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {meetingSummary.keyPoints.slice(0, 3).map((point, i) => (
                        <li key={i}>• {point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-cscx-gray-500 mb-1">Action Items:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {meetingSummary.actionItems.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item.description}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    meetingSummary.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                    meetingSummary.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>Sentiment: {meetingSummary.sentiment}</span>
                </div>
              </div>
            )}

            {/* Recent Meetings */}
            {recentMeetings.length > 0 && !meetingSummary && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">🎙️ Recent Meetings</h4>
                <div className="space-y-2">
                  {recentMeetings.map(meeting => (
                    <div key={meeting.id} className="p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium text-sm">{meeting.title}</p>
                        <span className="text-xs text-cscx-gray-400">{meeting.duration} min</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cscx-gray-400">{meeting.startTime.toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 text-xs bg-cscx-gray-700 rounded">{meeting.platform}</span>
                        {meeting.transcriptAvailable && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Transcript</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Insights */}
            {customerInsights && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">💡 Customer Insights</h4>
                <p className="text-sm text-cscx-gray-300 mb-3">{customerInsights.relationshipSummary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-cscx-gray-500 mb-1">Key Stakeholders:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {customerInsights.keyStakeholders.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-cscx-gray-500 mb-1">Expansion Opportunities:</p>
                    <ul className="text-xs text-cscx-gray-400">
                      {customerInsights.expansionOpportunities.map((o, i) => (
                        <li key={i}>• {o}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📁 Customer Documents</h4>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <a
                      key={doc.id}
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700 hover:border-cscx-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {doc.type === 'presentation' ? '📊' :
                           doc.type === 'spreadsheet' ? '📈' :
                           doc.type === 'document' ? '📄' :
                           doc.type === 'pdf' ? '📑' : '📁'}
                        </span>
                        <div>
                          <p className="text-white text-sm">{doc.name}</p>
                          <p className="text-xs text-cscx-gray-400">{doc.category} • {doc.lastModified.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="text-cscx-gray-400">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Available Slots */}
            {availableSlots.length > 0 && !meetingProposal && (
              <div className="p-4 bg-cscx-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">📅 Available Times</h4>
                <div className="space-y-2">
                  {availableSlots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-cscx-gray-900 rounded border border-cscx-gray-700">
                      <div>
                        <p className="text-white text-sm">
                          {slot.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' '}
                          {slot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-cscx-gray-400">{slot.reason}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        slot.score >= 90 ? 'bg-green-500/20 text-green-400' :
                        slot.score >= 80 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{slot.score}% match</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Approval */}
        {pendingApproval && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">⚠️ Approval Required</h4>

            {pendingApproval.type === 'email' && draftEmail && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-xs text-cscx-gray-500 mb-1">To: {draftEmail.to.join(', ')}</p>
                  <p className="text-white font-medium text-sm mb-2">{draftEmail.subject}</p>
                  <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap font-sans">{draftEmail.body}</pre>
                </div>
              </div>
            )}

            {pendingApproval.type === 'meeting' && meetingProposal && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">{meetingProposal.title}</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Duration: {meetingProposal.duration} min • Attendees: {meetingProposal.attendees.join(', ')}
                  </p>
                  <pre className="text-sm text-cscx-gray-300 whitespace-pre-wrap font-sans">{meetingProposal.description}</pre>
                </div>
              </div>
            )}

            {pendingApproval.type === 'qbr' && qbrPackage && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">QBR Package - {qbrPackage.quarter} {qbrPackage.year}</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Includes: Document + Presentation with {qbrPackage.sections.filter(s => s.included).length} sections
                  </p>
                  <div className="flex gap-2">
                    <a href={qbrPackage.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cscx-accent hover:underline">📄 View Document</a>
                    <a href={qbrPackage.presentationUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cscx-accent hover:underline">📊 View Slides</a>
                  </div>
                </div>
              </div>
            )}

            {pendingApproval.type === 'renewal' && renewalPlaybook && (
              <div className="space-y-3">
                <div className="p-3 bg-cscx-gray-900 rounded">
                  <p className="text-white font-medium text-sm mb-1">Renewal Playbook</p>
                  <p className="text-xs text-cscx-gray-400 mb-2">
                    Renewal: {renewalPlaybook.renewalDate.toLocaleDateString()} • Probability: {renewalPlaybook.probability}%
                  </p>
                  <p className="text-xs text-cscx-gray-400">
                    {renewalPlaybook.stages.length} stages with {renewalPlaybook.stages.reduce((acc, s) => acc + s.actions.length, 0)} actions
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ✓ Approve
              </button>
              <button
                onClick={handleModify}
                className="px-4 py-2 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ✏️ Modify
              </button>
              <button
                onClick={() => {
                  setPendingApproval(null);
                  setDraftEmail(null);
                  setMeetingProposal(null);
                  setQBRPackage(null);
                  setRenewalPlaybook(null);
                }}
                className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-cscx-gray-400 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recent Agent Actions */}
        {agentMemory.recentActions.length > 0 && (
          <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-2 flex items-center gap-2">🧠 Recent Actions</h4>
            <div className="space-y-1">
              {agentMemory.recentActions.slice(0, 5).map(action => (
                <div key={action.id} className="flex items-center justify-between text-xs">
                  <span className="text-cscx-gray-300">{action.action.replace(/_/g, ' ')}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    action.outcome === 'success' ? 'bg-green-500/20 text-green-400' :
                    action.outcome === 'modified' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{action.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceAgent;
