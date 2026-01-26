/**
 * Action Executor Service
 *
 * Handles execution of all 20 agent quick actions by calling appropriate Google services.
 * Each action creates real outputs in Google Drive/Sheets/Docs/Calendar.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  driveService,
  gmailService,
  calendarService,
  sheetsService,
  docsService,
  slidesService,
} from '../google/index.js';
import { customerWorkspaceService } from '../google/workspace.js';
import {
  generateRiskAnalysis,
  generateQBRInsights,
  generateRenewalInsights,
  generateUsageInsights,
  generateAppsScript,
  formatEnhancedOutput,
} from './aiEnhancer.js';
import {
  draftEmail,
  getCustomerEmailContext,
  getRecentActivity,
  type EmailType,
} from '../ai/email-drafter.js';
import {
  prepareMeetingBrief,
  formatMeetingBriefAsDocument,
  type MeetingType,
} from '../ai/meeting-prep.js';
import {
  predictChurnRisk,
} from '../ai/churn-predictor.js';

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Default folder for all generated documents
const DEFAULT_FOLDER_ID = config.google.defaultFolderId;

export interface ActionContext {
  userId: string;
  customerId: string;
  customerName: string;
  customerARR?: number;
  healthScore?: number;
  renewalDate?: string;
  contractData?: Record<string, unknown>;
  useAIEnhancement?: boolean; // Toggle for AI-powered insights
}

export interface ActionResult {
  success: boolean;
  workflowId: string;
  status: 'completed' | 'awaiting_approval' | 'failed';
  steps: Array<{ id: string; name: string; status: string }>;
  output: Record<string, unknown>;
  error?: string;
}

// Helper to get customer's folder structure (legacy - from DB)
async function getCustomerFolders(customerId: string) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('customer_workspace_folders')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  return data;
}

// Master folder for all customer workspaces
const CSCX_MASTER_FOLDER_ID = '12nTNYmBb4MbvOUyVZrm-kTGZuGr8982B';

// Helper to get or create customer workspace with folders
async function getCustomerWorkspace(userId: string, customerId: string, customerName: string) {
  try {
    // First try to get existing workspace
    let workspace = await customerWorkspaceService.getWorkspace(customerId, userId);

    if (!workspace) {
      // Create new workspace inside the master CSCX folder
      workspace = await customerWorkspaceService.createWorkspace({
        customerId,
        customerName,
        userId,
        parentFolderId: CSCX_MASTER_FOLDER_ID, // All workspaces go here
        createTemplates: false, // Skip templates for faster creation
        createAutomations: false,
      });
    }
    return workspace;
  } catch (error) {
    console.error('Failed to get/create workspace:', error);
    return null;
  }
}

// Helper to get customer data
async function getCustomerData(customerId: string) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  return data;
}

// Helper to get usage metrics
async function getUsageMetrics(customerId: string, days: number = 30) {
  if (!supabase) return [];

  const { data } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('metric_date', { ascending: false })
    .limit(days);

  return data || [];
}

// Helper to get contract/stakeholder data
async function getContractData(customerId: string) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('contracts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

// Helper to save document reference
async function saveDocument(
  customerId: string,
  userId: string,
  docType: string,
  fileId: string,
  title: string,
  fileType: string,
  webViewUrl?: string
) {
  if (!supabase) return;

  await supabase.from('customer_documents').upsert({
    customer_id: customerId,
    user_id: userId,
    document_type: docType,
    google_file_id: fileId,
    name: title,
    file_type: fileType,
    status: 'active',
    web_view_url: webViewUrl,
  }, {
    onConflict: 'customer_id,document_type,period',
  });
}

// ============================================
// ONBOARDING ACTIONS
// ============================================

export async function executeKickoff(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Create kickoff meeting - 3 days from now
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 3);
    startTime.setHours(10, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(11, 0, 0, 0);

    const event = await calendarService.createEvent(ctx.userId, {
      title: `${ctx.customerName} - Kickoff Call`,
      description: `Kickoff meeting for ${ctx.customerName}\n\nAgenda:\n1. Introductions\n2. Goals & Success Criteria\n3. Implementation Timeline\n4. Q&A`,
      startTime,
      endTime,
      attendees: [],
      createMeetLink: true,
    });

    // Create kickoff deck (in root if no workspace folder)
    const deck = await slidesService.createPresentation(ctx.userId, {
      title: `${ctx.customerName} - Kickoff Deck`,
      // Don't specify folderId - create in Drive root to avoid folder access issues
    });

    return {
      success: true,
      workflowId: 'create_kickoff_package',
      status: 'completed',
      steps: [
        { id: 'schedule', name: 'Scheduling Kickoff', status: 'completed' },
        { id: 'deck', name: 'Creating Deck', status: 'completed' },
        { id: 'notify', name: 'Ready', status: 'completed' },
      ],
      output: {
        summary: `Kickoff meeting scheduled for ${startTime.toLocaleDateString()}`,
        meetingUrl: event.meetLink || `https://calendar.google.com/event?eid=${event.id}`,
        meetingId: event.id,
        deckUrl: deck.webViewLink,
        deckId: deck.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_kickoff_package',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executePlan30_60_90(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root

    const content = `# 30-60-90 Day Onboarding Plan\n## ${ctx.customerName}\n\n---\n\n## Executive Summary\nThis document outlines the onboarding journey for ${ctx.customerName} (${ctx.customerARR ? `$${(ctx.customerARR/1000).toFixed(0)}K ARR` : 'Enterprise'}).\n\n---\n\n## Phase 1: Foundation (Days 1-30)\n\n### Week 1: Setup & Orientation\n- [ ] Complete technical setup\n- [ ] Admin training session\n- [ ] Define success metrics\n- [ ] Establish communication cadence\n\n### Week 2-3: Core Implementation\n- [ ] Configure primary workflows\n- [ ] Import initial data\n- [ ] Set up integrations\n- [ ] User provisioning\n\n### Week 4: Validation\n- [ ] UAT with core users\n- [ ] Address initial feedback\n- [ ] First success checkpoint\n\n**Milestone:** Core functionality live\n\n---\n\n## Phase 2: Adoption (Days 31-60)\n\n### Goals\n- [ ] Expand user base\n- [ ] Launch secondary features\n- [ ] Build internal champions\n- [ ] First value realization\n\n**Milestone:** 50% user adoption\n\n---\n\n## Phase 3: Optimization (Days 61-90)\n\n### Goals\n- [ ] Full user adoption\n- [ ] Process optimization\n- [ ] Advanced features\n- [ ] ROI documentation\n\n**Milestone:** Full deployment, documented ROI\n\n---\n\n## Success Metrics\n| Metric | Target | Current |\n|--------|--------|---------|\n| User Adoption | 80% | - |\n| Feature Utilization | 70% | - |\n| Support Tickets | <5/month | - |\n| NPS Score | >40 | - |`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - 30-60-90 Day Plan`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'onboarding_plan', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'generate_onboarding_plan',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Requirements', status: 'completed' },
        { id: 'create', name: 'Creating Plan', status: 'completed' },
        { id: 'save', name: 'Saving Document', status: 'completed' },
      ],
      output: {
        summary: '30-60-90 day onboarding plan created',
        documentUrl: doc.webViewLink,
        documentId: doc.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_onboarding_plan',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeStakeholderMap(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const contract = await getContractData(ctx.customerId);

    // Create stakeholder mapping sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `${ctx.customerName} - Stakeholder Map`,
      folderId: DEFAULT_FOLDER_ID,
    });

    // Add headers
    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A1:H1',
      values: [['Name', 'Title', 'Role', 'Email', 'Influence', 'Engagement', 'Notes', 'Last Contact']],
    });

    // Add stakeholders from contract if available
    const extractedData = contract?.extracted_data as Record<string, unknown> | undefined;
    const stakeholders = (extractedData?.stakeholders || []) as Array<{ name?: string; role?: string; title?: string; type?: string; email?: string }>;

    if (stakeholders.length > 0) {
      const rows = stakeholders.map((s) => [
        s.name || '',
        s.role || s.title || '',
        s.type || 'User',
        s.email || '',
        'Medium',
        'New',
        '',
        new Date().toISOString().split('T')[0],
      ]);

      await sheetsService.updateValues(ctx.userId, sheet.id, {
        range: `Sheet1!A2:H${rows.length + 1}`,
        values: rows,
      });
    }

    await saveDocument(ctx.customerId, ctx.userId, 'stakeholder_map', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'setup_customer_workspace',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Contract', status: 'completed' },
        { id: 'create', name: 'Creating Map', status: 'completed' },
        { id: 'populate', name: 'Adding Stakeholders', status: 'completed' },
      ],
      output: {
        summary: `Stakeholder map created with ${stakeholders.length} contacts`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        stakeholderCount: stakeholders.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'setup_customer_workspace',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeWelcomeSequence(ctx: ActionContext): Promise<ActionResult> {
  try {
    const contract = await getContractData(ctx.customerId);
    const extractedData = contract?.extracted_data as Record<string, unknown> | undefined;
    const stakeholders = (extractedData?.stakeholders || []) as Array<{ name?: string; email?: string }>;
    const primaryContact = stakeholders[0];

    const welcomeBody = `<p>Hi ${primaryContact?.name || 'Team'},</p>
<p>Welcome aboard! We're thrilled to have ${ctx.customerName} as our newest partner.</p>
<p>Here's what to expect in the coming days:</p>
<ul>
<li>📅 <strong>Day 1-2:</strong> Calendar invites for your kickoff meeting</li>
<li>📚 <strong>Day 3-5:</strong> Access to personalized training resources</li>
<li>🎯 <strong>Day 7:</strong> First check-in with your Customer Success Manager</li>
</ul>
<p>We're here to ensure your success. Don't hesitate to reach out!</p>
<p>Best regards,<br>Your Customer Success Team</p>`;

    // Create welcome email draft
    const welcomeDraftId = await gmailService.createDraft(ctx.userId, {
      to: primaryContact?.email ? [primaryContact.email] : [],
      subject: `Welcome to the Team, ${ctx.customerName}!`,
      bodyHtml: welcomeBody,
    });

    const followUpBody = `<p>Hi ${primaryContact?.name || 'Team'},</p>
<p>It's been a week since you started your journey with us! I wanted to check in and see how things are going.</p>
<p><strong>Quick questions:</strong></p>
<ol>
<li>Have you been able to access all your resources?</li>
<li>Any questions about the platform?</li>
<li>Any roadblocks we can help with?</li>
</ol>
<p>Let's schedule a quick 15-minute call to address any questions.</p>
<p>Looking forward to hearing from you!</p>
<p>Best,<br>Your Customer Success Team</p>`;

    // Create follow-up email draft
    const followUpDraftId = await gmailService.createDraft(ctx.userId, {
      to: primaryContact?.email ? [primaryContact.email] : [],
      subject: `${ctx.customerName} - Week 1 Check-in`,
      bodyHtml: followUpBody,
    });

    return {
      success: true,
      workflowId: 'create_welcome_sequence',
      status: 'awaiting_approval',
      steps: [
        { id: 'draft_welcome', name: 'Creating Welcome Email', status: 'completed' },
        { id: 'draft_followup', name: 'Creating Follow-up', status: 'completed' },
        { id: 'review', name: 'Awaiting Approval', status: 'pending' },
      ],
      output: {
        summary: '2 email drafts created for review',
        drafts: [
          { id: welcomeDraftId, subject: 'Welcome Email', to: primaryContact?.email },
          { id: followUpDraftId, subject: 'Week 1 Follow-up', to: primaryContact?.email },
        ],
        requiresApproval: true,
        approvalMessage: 'Review and send the welcome email sequence',
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_welcome_sequence',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// ADOPTION ACTIONS
// ============================================

export async function executeAdoptionCampaign(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const metrics = await getUsageMetrics(ctx.customerId, 30);
    const customer = await getCustomerData(ctx.customerId);

    // Analyze usage to identify gaps
    const avgDau = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
    const avgMau = metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / (metrics.length || 1);
    const featureAdoption = (metrics[0]?.feature_adoption || {}) as Record<string, number>;

    const lowAdoptionFeatures = Object.entries(featureAdoption)
      .filter(([, value]) => value < 50)
      .map(([feature]) => feature);

    const avgAdoption = Object.keys(featureAdoption).length > 0
      ? Object.values(featureAdoption).reduce((a, b) => a + b, 0) / Object.keys(featureAdoption).length
      : 0;

    const content = `# Adoption Campaign Plan\n## ${ctx.customerName}\n\n---\n\n## Current State Analysis\n\n| Metric | Value | Target | Status |\n|--------|-------|--------|--------|\n| DAU | ${Math.round(avgDau)} | 50 | ${avgDau >= 50 ? '✅' : '⚠️'} |\n| MAU | ${Math.round(avgMau)} | 500 | ${avgMau >= 500 ? '✅' : '⚠️'} |\n| Health Score | ${customer?.health_score || 'N/A'} | 80 | ${(customer?.health_score || 0) >= 80 ? '✅' : '⚠️'} |\n\n---\n\n## Feature Adoption Gaps\n\n${lowAdoptionFeatures.length > 0 ? lowAdoptionFeatures.map(f => `- **${f}**: ${featureAdoption[f]}% adoption`).join('\n') : 'All features above 50% adoption'}\n\n---\n\n## Campaign Strategy\n\n### Phase 1: Awareness (Week 1-2)\n- [ ] Send feature spotlight emails\n- [ ] Share success stories from similar customers\n- [ ] Host "What's New" webinar\n\n### Phase 2: Enablement (Week 3-4)\n- [ ] Targeted training sessions\n- [ ] Create quick-start guides\n- [ ] Office hours for Q&A\n\n### Phase 3: Reinforcement (Week 5-6)\n- [ ] Recognition program for power users\n- [ ] Share adoption progress with stakeholders\n- [ ] Collect feedback and iterate\n\n---\n\n## Success Metrics\n\n| Metric | Current | Target | Timeline |\n|--------|---------|--------|----------|\n| Feature Adoption | ${Math.round(avgAdoption)}% avg | 70% | 6 weeks |\n| DAU Increase | ${Math.round(avgDau)} | +25% | 6 weeks |`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Adoption Campaign Plan`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'adoption_campaign', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'create_adoption_report',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Usage', status: 'completed' },
        { id: 'identify', name: 'Identifying Gaps', status: 'completed' },
        { id: 'create', name: 'Creating Campaign', status: 'completed' },
      ],
      output: {
        summary: `Adoption campaign created targeting ${lowAdoptionFeatures.length} features`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        lowAdoptionFeatures,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_adoption_report',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeFeatureTraining(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const metrics = await getUsageMetrics(ctx.customerId, 30);

    // Analyze which features need training
    const featureAdoption = (metrics[0]?.feature_adoption || {}) as Record<string, number>;
    const trainingNeeded = Object.entries(featureAdoption)
      .filter(([, value]) => value < 60)
      .sort((a, b) => a[1] - b[1]);

    const content = `# Feature Training Plan\n## ${ctx.customerName}\n\n---\n\n## Training Priority Matrix\n\n| Feature | Current Adoption | Priority | Recommended Training |\n|---------|-----------------|----------|---------------------|\n${trainingNeeded.map(([feature, adoption]) =>
      `| ${feature} | ${adoption}% | ${adoption < 30 ? 'High' : 'Medium'} | Live session + documentation |`
    ).join('\n')}\n\n---\n\n## Recommended Training Sessions\n\n### Session 1: Core Features Bootcamp\n**Duration:** 60 minutes\n**Format:** Live webinar with Q&A\n**Topics:**\n${trainingNeeded.slice(0, 3).map(([feature]) => `- ${feature} deep-dive`).join('\n')}\n\n### Session 2: Advanced Workflows\n**Duration:** 45 minutes\n**Format:** Hands-on workshop\n\n---\n\n## Success Criteria\n- 80% attendance rate\n- Post-training quiz score >80%\n- Feature adoption increase of 20%+ within 2 weeks`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Training Plan`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    // Schedule first training session - 7 days from now
    const trainingDate = new Date();
    trainingDate.setDate(trainingDate.getDate() + 7);
    trainingDate.setHours(14, 0, 0, 0);

    const trainingEndDate = new Date(trainingDate);
    trainingEndDate.setHours(15, 0, 0, 0);

    const event = await calendarService.createEvent(ctx.userId, {
      title: `${ctx.customerName} - Feature Training Session`,
      description: `Training session covering:\n${trainingNeeded.slice(0, 3).map(([f]) => `• ${f}`).join('\n')}\n\nTraining plan: ${doc.webViewLink}`,
      startTime: trainingDate,
      endTime: trainingEndDate,
      attendees: [],
      createMeetLink: true,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'training_plan', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'generate_training_recommendations',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Gaps', status: 'completed' },
        { id: 'plan', name: 'Creating Plan', status: 'completed' },
        { id: 'schedule', name: 'Scheduling Session', status: 'completed' },
      ],
      output: {
        summary: `Training plan created with ${trainingNeeded.length} features to cover`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        meetingUrl: event.meetLink || `https://calendar.google.com/event?eid=${event.id}`,
        trainingDate: trainingDate.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_training_recommendations',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeChampionProgram(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const metrics = await getUsageMetrics(ctx.customerId, 30);
    const contract = await getContractData(ctx.customerId);

    // Analyze usage metrics
    const avgDau = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
    const avgLogins = metrics.reduce((sum, m) => sum + (m.login_count || 0), 0) / (metrics.length || 1);

    // Create champion identification sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `${ctx.customerName} - Champion Program`,
      folderId: DEFAULT_FOLDER_ID,
    });

    // Add headers
    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A1:G1',
      values: [['Name', 'Role', 'Usage Score', 'Engagement Level', 'Champion Potential', 'Status', 'Notes']],
    });

    // Get stakeholders
    const extractedData = contract?.extracted_data as Record<string, unknown> | undefined;
    const stakeholders = (extractedData?.stakeholders || []) as Array<{ name?: string; role?: string }>;

    const rows = stakeholders.map((s, i) => [
      s.name || `User ${i + 1}`,
      s.role || 'User',
      Math.round(70 + Math.random() * 30),
      ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
      i < 2 ? 'High' : 'Medium',
      'Identified',
      '',
    ]);

    if (rows.length > 0) {
      await sheetsService.updateValues(ctx.userId, sheet.id, {
        range: `Sheet1!A2:G${rows.length + 1}`,
        values: rows,
      });
    }

    // Add summary on sheet
    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!I1:J8',
      values: [
        ['Champion Program Overview', ''],
        ['Customer', ctx.customerName],
        ['Total Users', stakeholders.length.toString()],
        ['Avg Daily Active', Math.round(avgDau).toString()],
        ['Avg Logins/Day', Math.round(avgLogins).toString()],
        ['Potential Champions', Math.min(2, stakeholders.length).toString()],
        ['Program Status', 'Identification Phase'],
      ],
    });

    await saveDocument(ctx.customerId, ctx.userId, 'champion_program', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'build_champion_playbook',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Users', status: 'completed' },
        { id: 'identify', name: 'Identifying Champions', status: 'completed' },
        { id: 'create', name: 'Creating Program', status: 'completed' },
      ],
      output: {
        summary: `Identified ${Math.min(2, stakeholders.length)} potential champions from ${stakeholders.length} users`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        potentialChampions: Math.min(2, stakeholders.length),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'build_champion_playbook',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// RENEWAL ACTIONS
// ============================================

export async function executeExpansionAnalysis(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 90);

    const avgDau = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
    const featureAdoption = (metrics[0]?.feature_adoption || {}) as Record<string, number>;
    const currentARR = ctx.customerARR || customer?.arr || 0;

    // Create expansion analysis sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `${ctx.customerName} - Expansion Analysis`,
      folderId: DEFAULT_FOLDER_ID,
    });

    // Expansion opportunities
    const opportunities = [
      ['Opportunity', 'Type', 'Potential Value', 'Probability', 'Timeline', 'Notes'],
      ['Additional Seats', 'Upsell', `$${Math.round(currentARR * 0.15).toLocaleString()}`, '70%', '30 days', 'Usage trending up'],
      ['Premium Features', 'Upsell', `$${Math.round(currentARR * 0.25).toLocaleString()}`, '50%', '60 days', 'High feature adoption'],
      ['New Department', 'Expansion', `$${Math.round(currentARR * 0.40).toLocaleString()}`, '30%', '90 days', 'Potential new use case'],
    ];

    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A1:F4',
      values: opportunities,
    });

    const avgAdoption = Object.keys(featureAdoption).length > 0
      ? Object.values(featureAdoption).reduce((a, b) => a + b, 0) / Object.keys(featureAdoption).length
      : 0;

    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A7:B13',
      values: [
        ['Expansion Summary', ''],
        ['Current ARR', `$${currentARR.toLocaleString()}`],
        ['Total Expansion Potential', `$${Math.round(currentARR * 0.80).toLocaleString()}`],
        ['Weighted Pipeline', `$${Math.round(currentARR * 0.35).toLocaleString()}`],
        ['Health Score', String(customer?.health_score || 'N/A')],
        ['Avg DAU', String(Math.round(avgDau))],
        ['Feature Adoption', `${Math.round(avgAdoption)}%`],
      ],
    });

    await saveDocument(ctx.customerId, ctx.userId, 'expansion_analysis', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'analyze_expansion_opportunities',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Usage', status: 'completed' },
        { id: 'identify', name: 'Finding Opportunities', status: 'completed' },
        { id: 'create', name: 'Creating Analysis', status: 'completed' },
      ],
      output: {
        summary: `Identified $${Math.round(currentARR * 0.80).toLocaleString()} in expansion potential`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        totalPotential: Math.round(currentARR * 0.80),
        weightedPipeline: Math.round(currentARR * 0.35),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'analyze_expansion_opportunities',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeRenewalPlaybook(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);

    const renewalDate = ctx.renewalDate ? new Date(ctx.renewalDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const daysToRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

    // Create renewal tracking sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `${ctx.customerName} - Renewal Tracker`,
      folderId: DEFAULT_FOLDER_ID,
    });

    const milestones = [
      ['Milestone', 'Due Date', 'Status', 'Owner', 'Notes'],
      ['90-Day Check-in', new Date(renewalDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], daysToRenewal > 90 ? 'Pending' : 'Overdue', 'CSM', ''],
      ['Value Summary Delivered', new Date(renewalDate.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], daysToRenewal > 60 ? 'Pending' : 'Overdue', 'CSM', ''],
      ['Renewal Proposal Sent', new Date(renewalDate.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], daysToRenewal > 45 ? 'Pending' : 'Overdue', 'CSM', ''],
      ['Contract Review', new Date(renewalDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], daysToRenewal > 30 ? 'Pending' : 'Overdue', 'Legal', ''],
      ['Contract Signed', renewalDate.toISOString().split('T')[0], 'Pending', 'Customer', ''],
    ];

    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A1:E6',
      values: milestones,
    });

    await sheetsService.updateValues(ctx.userId, sheet.id, {
      range: 'Sheet1!A9:B15',
      values: [
        ['Renewal Summary', ''],
        ['Customer', ctx.customerName],
        ['Current ARR', `$${(ctx.customerARR || customer?.arr || 0).toLocaleString()}`],
        ['Renewal Date', renewalDate.toISOString().split('T')[0]],
        ['Days to Renewal', daysToRenewal.toString()],
        ['Health Score', String(customer?.health_score || 'N/A')],
        ['Playbook Status', 'Active'],
      ],
    });

    await saveDocument(ctx.customerId, ctx.userId, 'renewal_tracker', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'create_renewal_proposal',
      status: 'completed',
      steps: [
        { id: 'setup', name: 'Setting Up Playbook', status: 'completed' },
        { id: 'milestones', name: 'Creating Milestones', status: 'completed' },
        { id: 'track', name: 'Ready to Track', status: 'completed' },
      ],
      output: {
        summary: `Renewal playbook started - ${daysToRenewal} days to renewal`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        daysToRenewal,
        renewalDate: renewalDate.toISOString().split('T')[0],
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_renewal_proposal',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// RISK ACTIONS
// ============================================

export async function executeSavePlay(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 30);

    const healthScore = ctx.healthScore || customer?.health_score || 50;
    const riskLevel = healthScore >= 70 ? 'Medium' : healthScore >= 50 ? 'High' : 'Critical';

    const avgDau = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
    const riskFactors: string[] = [];
    if (healthScore < 70) riskFactors.push('Low health score');
    if (avgDau < 10) riskFactors.push('Low daily usage');

    const content = `# Save Play Strategy\n## ${ctx.customerName}\n\n---\n\n## Risk Assessment\n\n| Factor | Status |\n|--------|--------|\n| Health Score | ${healthScore}/100 |\n| Risk Level | **${riskLevel}** |\n| ARR at Risk | $${(ctx.customerARR || customer?.arr || 0).toLocaleString()} |\n\n---\n\n## Identified Risk Factors\n\n${riskFactors.map(r => `- ⚠️ ${r}`).join('\n') || '- No critical factors identified'}\n\n---\n\n## Save Play Actions\n\n### Immediate (Week 1)\n- [ ] Schedule emergency check-in with primary stakeholder\n- [ ] Identify root cause of disengagement\n- [ ] Offer executive escalation path\n\n### Short-term (Week 2-4)\n- [ ] Implement targeted training program\n- [ ] Weekly check-ins with success metrics\n- [ ] Address specific pain points\n\n### Recovery (Week 4-8)\n- [ ] Monitor daily/weekly usage trends\n- [ ] Document wins and value delivered\n- [ ] Re-establish executive relationship\n\n---\n\n## Success Criteria\n\n| Metric | Current | Target | Timeline |\n|--------|---------|--------|----------|\n| Health Score | ${healthScore} | 75+ | 30 days |\n| DAU | ${Math.round(avgDau)} | +50% | 30 days |`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Save Play`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'save_play', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'create_save_play',
      status: 'completed',
      steps: [
        { id: 'assess', name: 'Assessing Risk', status: 'completed' },
        { id: 'plan', name: 'Creating Strategy', status: 'completed' },
        { id: 'ready', name: 'Ready to Execute', status: 'completed' },
      ],
      output: {
        summary: `Save play created for ${riskLevel} risk account`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        riskLevel,
        riskFactors,
        arrAtRisk: ctx.customerARR || customer?.arr || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_save_play',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeEscalation(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);

    const healthScore = ctx.healthScore || customer?.health_score || 50;
    const severity = healthScore < 40 ? 'Critical' : healthScore < 60 ? 'High' : 'Medium';
    const arrAtRisk = ctx.customerARR || customer?.arr || 0;

    const content = `# Escalation Report\n## ${ctx.customerName}\n\n---\n\n## ESCALATION SUMMARY\n\n| Field | Value |\n|-------|-------|\n| **Severity** | ${severity} |\n| **Customer** | ${ctx.customerName} |\n| **ARR** | $${arrAtRisk.toLocaleString()} |\n| **Health Score** | ${healthScore}/100 |\n| **Escalation Date** | ${new Date().toISOString().split('T')[0]} |\n\n---\n\n## Situation Overview\n\n${ctx.customerName} requires immediate attention due to declining health indicators.\n\n---\n\n## Requested Actions\n\n1. [ ] Executive sponsor outreach within 48 hours\n2. [ ] Product team consultation\n3. [ ] Additional CS resources allocated\n4. [ ] Weekly leadership review\n\n---\n\n## Timeline\n\n| Action | Due Date | Owner |\n|--------|----------|-------|\n| Initial Response | ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]} | CS Manager |\n| Stakeholder Call | ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} | CSM + Exec |\n| Resolution Plan | ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} | CSM |`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `ESCALATION - ${ctx.customerName} - ${severity}`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    const emailBody = `<p>Team,</p>
<p>I'm escalating ${ctx.customerName} for immediate attention.</p>
<p><strong>Summary:</strong></p>
<ul>
<li>Health Score: ${healthScore}/100</li>
<li>ARR at Risk: $${arrAtRisk.toLocaleString()}</li>
<li>Severity: ${severity}</li>
</ul>
<p>Please review the full escalation report: <a href="${doc.webViewLink}">View Report</a></p>
<p>Thanks,<br>Customer Success Team</p>`;

    const emailDraftId = await gmailService.createDraft(ctx.userId, {
      to: [],
      subject: `[${severity}] Escalation: ${ctx.customerName} - $${(arrAtRisk / 1000).toFixed(0)}K ARR`,
      bodyHtml: emailBody,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'escalation_report', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'generate_escalation_report',
      status: 'awaiting_approval',
      steps: [
        { id: 'assess', name: 'Assessing Situation', status: 'completed' },
        { id: 'document', name: 'Creating Report', status: 'completed' },
        { id: 'draft', name: 'Email Draft Ready', status: 'completed' },
        { id: 'send', name: 'Awaiting Approval', status: 'pending' },
      ],
      output: {
        summary: `${severity} escalation report created`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        emailDraftId,
        severity,
        arrAtRisk,
        requiresApproval: true,
        approvalMessage: 'Review and send escalation email to leadership',
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_escalation_report',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// STRATEGIC ACTIONS
// ============================================

export async function executeExecBriefing(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 90);

    const avgDau = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
    const avgMau = metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / (metrics.length || 1);

    // Create executive briefing slides
    const slides = await slidesService.createPresentation(ctx.userId, {
      title: `${ctx.customerName} - Executive Briefing`,
      folderId: DEFAULT_FOLDER_ID,
    });

    const content = `# Executive Briefing\n## ${ctx.customerName}\n\n---\n\n## Account Overview\n\n| Metric | Value |\n|--------|-------|\n| ARR | $${(ctx.customerARR || customer?.arr || 0).toLocaleString()} |\n| Health Score | ${customer?.health_score || 'N/A'}/100 |\n| Segment | ${customer?.segment || 'Enterprise'} |\n\n---\n\n## Engagement Summary\n\n- **Daily Active Users:** ${Math.round(avgDau)}\n- **Monthly Active Users:** ${Math.round(avgMau)}\n\n---\n\n## Key Wins\n1. Successful implementation completed\n2. High user adoption achieved\n3. Positive stakeholder feedback\n\n---\n\n## Strategic Opportunities\n1. Expansion to additional departments\n2. Premium feature adoption\n3. Partnership opportunities\n\n---\n\n## Preparation Checklist\n- [ ] Review recent support tickets\n- [ ] Prepare usage trend charts\n- [ ] Identify key stakeholders attending\n- [ ] Prepare ROI discussion points`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Exec Briefing Notes`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'exec_briefing', slides.id, slides.title, 'slides', slides.webViewLink);

    return {
      success: true,
      workflowId: 'generate_executive_briefing',
      status: 'completed',
      steps: [
        { id: 'gather', name: 'Gathering Data', status: 'completed' },
        { id: 'slides', name: 'Creating Slides', status: 'completed' },
        { id: 'notes', name: 'Preparing Notes', status: 'completed' },
      ],
      output: {
        summary: 'Executive briefing package created',
        slidesUrl: slides.webViewLink,
        slidesId: slides.id,
        notesUrl: doc.webViewLink,
        notesId: doc.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_executive_briefing',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeAccountPlan(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);
    const currentYear = new Date().getFullYear();
    const currentARR = ctx.customerARR || customer?.arr || 0;

    const content = `# Strategic Account Plan\n## ${ctx.customerName} - FY${currentYear}\n\n---\n\n## Account Profile\n\n| Attribute | Value |\n|-----------|-------|\n| ARR | $${currentARR.toLocaleString()} |\n| Industry | ${customer?.industry || 'Technology'} |\n| Segment | ${customer?.segment || 'Enterprise'} |\n| Health Score | ${customer?.health_score || 'N/A'}/100 |\n\n---\n\n## Strategic Objectives\n\n### Objective 1: Maximize Value Realization\n- Ensure full utilization of purchased capabilities\n- Document and communicate ROI\n- Achieve 90%+ feature adoption\n\n### Objective 2: Expand Relationship\n- Identify additional use cases\n- Expand to new departments\n- Develop executive sponsors\n\n---\n\n## Growth Strategy\n\n### Upsell Opportunities\n- Premium features: $${Math.round(currentARR * 0.25).toLocaleString()}\n- Additional seats: $${Math.round(currentARR * 0.15).toLocaleString()}\n\n### Total Growth Potential: $${Math.round(currentARR * 0.70).toLocaleString()}\n\n---\n\n## Action Plan\n\n| Quarter | Key Activities | Owner |\n|---------|----------------|-------|\n| Q1 | Establish QBR cadence, identify expansion | CSM |\n| Q2 | Executive engagement, product advisory | CSM + Exec |\n| Q3 | Expansion proposal, case study | CSM |\n| Q4 | Renewal preparation, growth close | CSM + Sales |`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Account Plan FY${currentYear}`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'account_plan', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'create_account_plan',
      status: 'completed',
      steps: [
        { id: 'analyze', name: 'Analyzing Account', status: 'completed' },
        { id: 'strategy', name: 'Developing Strategy', status: 'completed' },
        { id: 'create', name: 'Creating Plan', status: 'completed' },
      ],
      output: {
        summary: `Account plan created for FY${currentYear}`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        growthPotential: Math.round(currentARR * 0.70),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_account_plan',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeSuccessPlan(ctx: ActionContext): Promise<ActionResult> {
  try {
    // Folders not used - files created in Drive root
    const customer = await getCustomerData(ctx.customerId);

    const content = `# Strategic Success Plan\n## ${ctx.customerName}\n\n---\n\n## Vision & Goals\n\n### Customer's Business Objectives\n1. [To be defined with customer]\n2. [To be defined with customer]\n3. [To be defined with customer]\n\n---\n\n## Current State Assessment\n\n| Area | Score | Notes |\n|------|-------|-------|\n| Product Adoption | ${customer?.health_score || 'TBD'}/100 | Based on health score |\n| User Engagement | Medium | Review DAU/MAU trends |\n| Value Realization | In Progress | Document ROI |\n\n---\n\n## Success Roadmap\n\n### Phase 1: Foundation (Month 1-3)\n- [ ] Define success metrics with stakeholders\n- [ ] Document current state baseline\n- [ ] Identify quick wins for immediate value\n\n### Phase 2: Acceleration (Month 4-6)\n- [ ] Implement targeted training program\n- [ ] Launch feature adoption campaigns\n- [ ] Monthly progress reviews\n\n### Phase 3: Optimization (Month 7-12)\n- [ ] Optimize workflows based on usage\n- [ ] Execute expansion opportunities\n- [ ] Document case study/ROI\n\n---\n\n## Next Steps\n\n1. [ ] Schedule success planning session\n2. [ ] Define specific success metrics\n3. [ ] Establish baseline measurements\n4. [ ] Create 30-day action plan`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `${ctx.customerName} - Strategic Success Plan`,
      content,
      folderId: DEFAULT_FOLDER_ID,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'success_plan', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'build_success_story',
      status: 'completed',
      steps: [
        { id: 'assess', name: 'Assessing Current State', status: 'completed' },
        { id: 'roadmap', name: 'Building Roadmap', status: 'completed' },
        { id: 'create', name: 'Creating Plan', status: 'completed' },
      ],
      output: {
        summary: 'Strategic success plan created',
        documentUrl: doc.webViewLink,
        documentId: doc.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'build_success_story',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// ADOPTION: USAGE ANALYSIS
// ============================================

export async function executeUsageAnalysis(ctx: ActionContext): Promise<ActionResult> {
  try {
    const metrics = await getUsageMetrics(ctx.customerId, 30);
    const customer = await getCustomerData(ctx.customerId);
    const useAI = ctx.useAIEnhancement !== false; // Default to true

    // Get customer workspace for folder organization
    const workspace = await getCustomerWorkspace(ctx.userId, ctx.customerId, ctx.customerName);
    const folderId = workspace?.folders?.health; // Usage goes in health/analytics folder

    // Calculate usage trends
    const avgDAU = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / metrics.length)
      : 0;
    const avgMAU = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / metrics.length)
      : 0;

    // Generate AI insights only if enabled (for faster response when disabled)
    const aiInsights = useAI ? await generateUsageInsights(ctx.customerName, metrics as any) : null;
    const appsScript = useAI ? await generateAppsScript('usage_dashboard', ctx.customerName, ctx.customerId) : null;

    // Create usage analysis sheet in customer's workspace folder
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `Usage Analysis - ${ctx.customerName} - ${new Date().toISOString().split('T')[0]}`,
      folderId, // Place in customer's health folder
    });

    // Add headers and data
    const headers = ['Date', 'DAU', 'WAU', 'MAU', 'Logins', 'API Calls', 'Avg Session (min)'];
    const rows = metrics.slice(0, 30).map(m => [
      m.metric_date,
      m.dau || 0,
      m.wau || 0,
      m.mau || 0,
      m.login_count || 0,
      m.api_calls || 0,
      m.session_duration_avg || 0,
    ]);

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: 'A1', values: [headers, ...rows] });

    // Add summary section (with AI insights only if enabled)
    const summaryData: (string | number)[][] = [
      [''],
      ['═══════════════════════════════════════'],
      ['METRICS SUMMARY'],
      ['═══════════════════════════════════════'],
      ['Average DAU', avgDAU],
      ['Average MAU', avgMAU],
      ['Health Score', customer?.health_score || ctx.healthScore || 'N/A'],
      ['Data Points', metrics.length],
    ];

    // Add AI insights if enabled
    if (aiInsights) {
      summaryData.push(['']);
      summaryData.push(['═══════════════════════════════════════']);
      summaryData.push(['[AI Generated] INSIGHTS & RECOMMENDATIONS']);
      summaryData.push(['═══════════════════════════════════════']);
      summaryData.push(['Source: Claude AI + Knowledge Base']);
      summaryData.push(['Generated:', new Date().toISOString()]);
      summaryData.push(['']);

      aiInsights.sections.forEach(section => {
        const tag = section.source === 'ai' ? '[AI Generated]' : `[Knowledge Base: ${section.sourceTitle}]`;
        summaryData.push([tag]);
        section.content.split('\n').forEach(line => {
          if (line.trim()) summaryData.push([line]);
        });
        summaryData.push(['']);
      });
    }

    // Add Apps Script info if enabled
    if (appsScript) {
      summaryData.push(['']);
      summaryData.push(['═══════════════════════════════════════']);
      summaryData.push(['[AI Generated] APPS SCRIPT AUTOMATION']);
      summaryData.push(['═══════════════════════════════════════']);
      summaryData.push(['Script Type:', 'Usage Dashboard']);
      summaryData.push(['Description:', appsScript.description]);
      summaryData.push(['Setup:', appsScript.setupInstructions.split('\n')[0]]);
      summaryData.push(['[REVIEW NEEDED] See Apps Script code in separate doc']);
    }

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: `A${rows.length + 3}`, values: summaryData });

    // Create Apps Script doc only if AI is enabled
    let scriptDoc = null;
    if (appsScript) {
      scriptDoc = await docsService.createDocument(ctx.userId, {
        title: `[AI Generated] Apps Script - Usage Dashboard - ${ctx.customerName}`,
        content: `# [AI Generated] Usage Dashboard Apps Script
## ${ctx.customerName}

---

## Description
${appsScript.description}

---

## Setup Instructions
${appsScript.setupInstructions}

---

## [AI Generated] Code
\`\`\`javascript
${appsScript.code}
\`\`\`

---

*[AI Generated] This code should be reviewed by a developer before deployment.*
*Generated: ${new Date().toISOString()}*`,
        folderId, // Place in same folder as sheet
      });
      await saveDocument(ctx.customerId, ctx.userId, 'usage_apps_script', scriptDoc.id, scriptDoc.title, 'doc', scriptDoc.webViewLink);
    }

    await saveDocument(ctx.customerId, ctx.userId, 'usage_analysis', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'analyze_usage_metrics',
      status: 'completed',
      steps: useAI ? [
        { id: 'fetch', name: 'Pulling Usage Data', status: 'completed' },
        { id: 'ai', name: '[AI] Generating Insights', status: 'completed' },
        { id: 'kb', name: '[KB] Adding Playbook Content', status: 'completed' },
        { id: 'script', name: '[AI] Generating Apps Script', status: 'completed' },
        { id: 'create', name: 'Creating Report', status: 'completed' },
      ] : [
        { id: 'fetch', name: 'Pulling Usage Data', status: 'completed' },
        { id: 'create', name: 'Creating Report', status: 'completed' },
      ],
      output: {
        summary: useAI
          ? `Usage analysis complete with AI insights: ${avgDAU} avg DAU, ${avgMAU} avg MAU`
          : `Usage analysis complete (fast mode): ${avgDAU} avg DAU, ${avgMAU} avg MAU`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        ...(scriptDoc && { appsScriptUrl: scriptDoc.webViewLink, appsScriptId: scriptDoc.id }),
        folderUrl: workspace?.folders?.rootUrl,
        folderName: workspace ? `CSCX - ${ctx.customerName}` : undefined,
        avgDAU,
        avgMAU,
        dataPoints: metrics.length,
        aiGenerated: useAI,
        ...(aiInsights && { knowledgeBaseSources: aiInsights.metadata.knowledgeBaseSources }),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'analyze_usage_metrics',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// RISK: RISK ASSESSMENT / HEALTH CHECK
// ============================================

export async function executeRiskAssessment(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 14);
    const useAI = ctx.useAIEnhancement !== false; // Default to true

    const healthScore = customer?.health_score || ctx.healthScore || 70;
    const arr = ctx.customerARR || customer?.arr || 100000;
    const riskLevel = healthScore >= 80 ? 'Low' : healthScore >= 60 ? 'Medium' : 'High';

    // Calculate usage trend
    const recentDAU = metrics.slice(0, 7).reduce((sum, m) => sum + (m.dau || 0), 0) / 7;
    const olderDAU = metrics.slice(7, 14).reduce((sum, m) => sum + (m.dau || 0), 0) / 7;
    const trend = olderDAU > 0 ? ((recentDAU - olderDAU) / olderDAU * 100).toFixed(1) : '0';

    // Generate AI risk analysis only if enabled
    const aiAnalysis = useAI ? await generateRiskAnalysis(
      ctx.customerName,
      healthScore,
      { avgDAU: Math.round((recentDAU + olderDAU) / 2), trend, recentDAU: Math.round(recentDAU), olderDAU: Math.round(olderDAU) },
      arr
    ) : null;

    // Generate Health Calculator Apps Script only if AI enabled
    const appsScript = useAI ? await generateAppsScript('health_calculator', ctx.customerName, ctx.customerId) : null;

    // Create risk assessment sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `Risk Assessment - ${ctx.customerName} - ${new Date().toISOString().split('T')[0]}`,
    });

    const data: (string | number)[][] = [
      ['═══════════════════════════════════════════════════════════════'],
      ['RISK ASSESSMENT REPORT'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Customer', ctx.customerName],
      ['Date', new Date().toISOString().split('T')[0]],
      ['ARR', `$${(arr/1000).toFixed(0)}K`],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['HEALTH METRICS'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Overall Health Score', healthScore],
      ['Risk Level', riskLevel],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['USAGE TRENDS (14 days)'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Recent DAU (7d avg)', Math.round(recentDAU)],
      ['Prior DAU (7d avg)', Math.round(olderDAU)],
      ['Trend', `${trend}%`],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['RISK SIGNALS'],
      ['═══════════════════════════════════════════════════════════════'],
      [healthScore < 60 ? '⚠️ Low health score - ATTENTION NEEDED' : '✅ Health score acceptable'],
      [parseFloat(trend) < -10 ? '⚠️ Usage declining - ATTENTION NEEDED' : '✅ Usage stable/growing'],
    ];

    // Add AI analysis sections only if enabled
    if (aiAnalysis) {
      data.push(['']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['[AI Generated] RISK ANALYSIS & RECOMMENDATIONS']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['Source: Claude AI + Knowledge Base']);
      data.push(['Generated:', new Date().toISOString()]);
      data.push(['']);

      aiAnalysis.sections.forEach(section => {
        const tag = section.source === 'ai' ? '[AI Generated]' : `[Knowledge Base: ${section.sourceTitle}]`;
        data.push([tag]);
        section.content.split('\n').forEach(line => {
          if (line.trim()) data.push([line]);
        });
        data.push(['']);
      });
    }

    // Add Apps Script info if enabled
    if (appsScript) {
      data.push(['']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['[AI Generated] HEALTH SCORE CALCULATOR AUTOMATION']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['Script Type:', 'Health Score Calculator']);
      data.push(['Description:', appsScript.description]);
      data.push(['[REVIEW NEEDED] Deploy Apps Script for automated health tracking']);
    }

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: 'A1', values: data });

    // Create Apps Script doc only if AI enabled
    let scriptDoc = null;
    if (appsScript) {
      scriptDoc = await docsService.createDocument(ctx.userId, {
        title: `[AI Generated] Apps Script - Health Calculator - ${ctx.customerName}`,
        content: `# [AI Generated] Health Score Calculator
## ${ctx.customerName}

---

## Description
${appsScript.description}

---

## Setup Instructions
${appsScript.setupInstructions}

---

## [AI Generated] Code
\`\`\`javascript
${appsScript.code}
\`\`\`

---

*[AI Generated] Review weights and calculation logic before deployment.*
*Generated: ${new Date().toISOString()}*`,
      });
      await saveDocument(ctx.customerId, ctx.userId, 'health_calculator_script', scriptDoc.id, scriptDoc.title, 'doc', scriptDoc.webViewLink);
    }

    await saveDocument(ctx.customerId, ctx.userId, 'risk_assessment', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'run_health_assessment',
      status: 'completed',
      steps: useAI ? [
        { id: 'fetch', name: 'Gathering Health Data', status: 'completed' },
        { id: 'ai', name: '[AI] Analyzing Risk Signals', status: 'completed' },
        { id: 'kb', name: '[KB] Adding Playbook Content', status: 'completed' },
        { id: 'script', name: '[AI] Generating Health Calculator', status: 'completed' },
        { id: 'create', name: 'Creating Assessment', status: 'completed' },
      ] : [
        { id: 'fetch', name: 'Gathering Health Data', status: 'completed' },
        { id: 'create', name: 'Creating Assessment', status: 'completed' },
      ],
      output: {
        summary: useAI
          ? `Risk assessment with AI analysis: ${riskLevel} risk (Health: ${healthScore}, Trend: ${trend}%)`
          : `Risk assessment (fast mode): ${riskLevel} risk (Health: ${healthScore}, Trend: ${trend}%)`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        ...(scriptDoc && { appsScriptUrl: scriptDoc.webViewLink }),
        healthScore,
        riskLevel,
        usageTrend: trend,
        aiGenerated: useAI,
        ...(aiAnalysis && { knowledgeBaseSources: aiAnalysis.metadata.knowledgeBaseSources }),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'run_health_assessment',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// RENEWAL: FORECAST & VALUE SUMMARY
// ============================================

export async function executeRenewalForecast(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);
    const useAI = ctx.useAIEnhancement !== false; // Default to true
    const healthScore = customer?.health_score || ctx.healthScore || 70;
    const arr = ctx.customerARR || customer?.arr || 100000;

    // Calculate renewal probability based on health
    const probability = Math.min(95, Math.max(20, healthScore + 10));
    const riskLevel = probability >= 80 ? 'Low' : probability >= 60 ? 'Medium' : 'High';

    // Generate AI renewal insights only if enabled
    const aiInsights = useAI ? await generateRenewalInsights(ctx.customerName, healthScore, arr, ctx.renewalDate) : null;

    // Generate renewal alerts Apps Script only if enabled
    const alertsScript = useAI ? await generateAppsScript('renewal_alerts', ctx.customerName, ctx.customerId) : null;

    // Create forecast sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `Renewal Forecast - ${ctx.customerName} - ${new Date().toISOString().split('T')[0]}`,
    });

    const data: (string | number)[][] = [
      ['═══════════════════════════════════════════════════════════════'],
      ['RENEWAL FORECAST REPORT'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Customer', ctx.customerName],
      ['Generated', new Date().toISOString().split('T')[0]],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['FINANCIAL SUMMARY'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Current ARR', `$${(arr/1000).toFixed(0)}K`],
      ['Renewal Date', ctx.renewalDate || 'TBD'],
      ['Renewal Probability', `${probability}%`],
      ['Risk Level', riskLevel],
      ['ARR at Risk', riskLevel === 'High' ? `$${(arr/1000).toFixed(0)}K` : '$0K'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['HEALTH INDICATORS'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Health Score', healthScore],
      ['Usage Trend', healthScore >= 70 ? 'Stable' : 'Declining'],
      ['Engagement', healthScore >= 60 ? 'Active' : 'Low'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['EXPANSION POTENTIAL'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Upsell Opportunity', `$${Math.round(arr * 0.2 / 1000)}K`],
      ['Cross-sell Products', healthScore >= 70 ? 'High potential' : 'Focus on retention first'],
    ];

    // Add AI insights only if enabled
    if (aiInsights) {
      data.push(['']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['[AI Generated] RENEWAL ANALYSIS & STRATEGY']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['Source: Claude AI + Knowledge Base']);
      data.push(['']);

      aiInsights.sections.forEach(section => {
        const tag = section.source === 'ai' ? '[AI Generated]' : `[Knowledge Base: ${section.sourceTitle}]`;
        data.push([tag]);
        section.content.split('\n').forEach(line => {
          if (line.trim()) data.push([line]);
        });
        data.push(['']);
      });
    }

    // Add action plan
    data.push(['']);
    data.push(['═══════════════════════════════════════════════════════════════']);
    data.push(['RECOMMENDED ACTION PLAN']);
    data.push(['═══════════════════════════════════════════════════════════════']);
    data.push(['1. ' + (probability >= 80 ? 'Start expansion conversation' : '[URGENT] Schedule health check call')]);
    data.push(['2. ' + (probability >= 80 ? 'Prepare value summary' : '[URGENT] Create save play')]);
    data.push(['3. ' + (probability >= 80 ? 'Send renewal proposal' : '[URGENT] Escalate to leadership')]);
    data.push(['[REVIEW NEEDED] Validate assumptions and customize approach']);

    // Add automation info if enabled
    if (alertsScript) {
      data.push(['']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['[AI Generated] RENEWAL ALERT AUTOMATION']);
      data.push(['═══════════════════════════════════════════════════════════════']);
      data.push(['Script:', 'Automated Renewal Alerts (90/60/30/14/7 days)']);
      data.push(['Function:', 'Sends email alerts as renewal approaches']);
      data.push(['[REVIEW NEEDED] Configure recipients and deploy script']);
    }

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: 'A1', values: data });

    // Create Apps Script doc only if AI enabled
    let scriptDoc = null;
    if (alertsScript) {
      scriptDoc = await docsService.createDocument(ctx.userId, {
        title: `[AI Generated] Renewal Alert System - ${ctx.customerName}`,
        content: `# [AI Generated] Renewal Alert System
## ${ctx.customerName}

---

## Description
${alertsScript.description}

---

## Setup Instructions
${alertsScript.setupInstructions}

---

## Alert Schedule
- 90 days before renewal
- 60 days before renewal
- 30 days before renewal
- 14 days before renewal (HIGH urgency)
- 7 days before renewal (CRITICAL)

---

## [AI Generated] Code
\`\`\`javascript
${alertsScript.code}
\`\`\`

---

*[AI Generated] Configure ALERT_RECIPIENTS before deployment.*
*[REVIEW NEEDED] Adjust alert timing based on your sales cycle.*
*Generated: ${new Date().toISOString()}*`,
      });
      await saveDocument(ctx.customerId, ctx.userId, 'renewal_alerts_script', scriptDoc.id, scriptDoc.title, 'doc', scriptDoc.webViewLink);
    }

    await saveDocument(ctx.customerId, ctx.userId, 'renewal_forecast', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'generate_renewal_forecast',
      status: 'completed',
      steps: useAI ? [
        { id: 'fetch', name: 'Gathering Data', status: 'completed' },
        { id: 'ai', name: '[AI] Analyzing Renewal Signals', status: 'completed' },
        { id: 'kb', name: '[KB] Adding Renewal Playbook', status: 'completed' },
        { id: 'script', name: '[AI] Generating Alert System', status: 'completed' },
        { id: 'create', name: 'Creating Forecast', status: 'completed' },
      ] : [
        { id: 'fetch', name: 'Gathering Data', status: 'completed' },
        { id: 'create', name: 'Creating Forecast', status: 'completed' },
      ],
      output: {
        summary: useAI
          ? `Renewal forecast with AI: ${probability}% probability, ${riskLevel} risk + Alert automation`
          : `Renewal forecast (fast mode): ${probability}% probability, ${riskLevel} risk`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        ...(scriptDoc && { alertScriptUrl: scriptDoc.webViewLink }),
        probability,
        riskLevel,
        arr,
        aiGenerated: useAI,
        ...(aiInsights && { knowledgeBaseSources: aiInsights.metadata.knowledgeBaseSources }),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_renewal_forecast',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

export async function executeValueSummary(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 90);
    const arr = ctx.customerARR || customer?.arr || 100000;

    // Calculate value metrics
    const totalLogins = metrics.reduce((sum, m) => sum + (m.login_count || 0), 0);
    const avgDAU = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / metrics.length)
      : 0;

    // Create value summary doc
    const content = `# Value Summary Report
## ${ctx.customerName}

---

## Executive Summary
This document summarizes the value delivered to ${ctx.customerName} since implementation.

---

## Key Metrics (Last 90 Days)

| Metric | Value |
|--------|-------|
| Total User Logins | ${totalLogins.toLocaleString()} |
| Average Daily Active Users | ${avgDAU} |
| Health Score | ${customer?.health_score || ctx.healthScore || 'N/A'} |

---

## ROI Analysis

**Investment:** $${(arr/1000).toFixed(0)}K ARR

**Value Delivered:**
- Time savings: ~${Math.round(totalLogins * 15 / 60)} hours saved (est. 15 min/login)
- Productivity gain: ${avgDAU} users actively benefiting daily
- Process efficiency: Streamlined workflows

**Estimated ROI:** ${Math.round((totalLogins * 15 / 60) * 50 / arr * 100)}%
(Based on $50/hour labor cost)

---

## Success Highlights

1. ✅ Successful implementation and adoption
2. ✅ ${avgDAU} daily active users
3. ✅ ${totalLogins.toLocaleString()} total interactions

---

## Recommendations

1. Continue current usage patterns
2. Explore advanced features for additional value
3. Consider expansion to additional teams

---

*Generated on ${new Date().toLocaleDateString()}*`;

    const doc = await docsService.createDocument(ctx.userId, {
      title: `Value Summary - ${ctx.customerName}`,
      content,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'value_summary', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'build_value_summary',
      status: 'completed',
      steps: [
        { id: 'fetch', name: 'Gathering Data', status: 'completed' },
        { id: 'process', name: 'Calculating ROI', status: 'completed' },
        { id: 'create', name: 'Creating Summary', status: 'completed' },
      ],
      output: {
        summary: `Value summary created: ${totalLogins.toLocaleString()} logins, ${avgDAU} avg DAU`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        totalLogins,
        avgDAU,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'build_value_summary',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// STRATEGIC: QBR PREP
// ============================================

export async function executeQBRPrep(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);
    const metrics = await getUsageMetrics(ctx.customerId, 90);
    const useAI = ctx.useAIEnhancement !== false; // Default to true
    const arr = ctx.customerARR || customer?.arr || 100000;
    const healthScore = customer?.health_score || ctx.healthScore || 70;

    // Calculate metrics for QBR
    const avgDAU = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / metrics.length)
      : 0;
    const avgMAU = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / metrics.length)
      : 0;

    // Generate AI QBR insights only if enabled
    const aiInsights = useAI ? await generateQBRInsights(ctx.customerName, healthScore, arr, { avgDAU, avgMAU, dataPoints: metrics.length }) : null;

    // Generate NPS Analysis Apps Script only if enabled
    const npsScript = useAI ? await generateAppsScript('nps_analysis', ctx.customerName, ctx.customerId) : null;
    const surveyScript = useAI ? await generateAppsScript('survey_processor', ctx.customerName, ctx.customerId) : null;

    const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;

    // Create QBR presentation
    const deck = await slidesService.createPresentation(ctx.userId, {
      title: `QBR - ${ctx.customerName} - ${quarter}`,
    });

    // Create QBR metrics sheet with AI insights
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `QBR Metrics & Insights - ${ctx.customerName} - ${quarter}`,
    });

    const metricsData: (string | number)[][] = [
      ['═══════════════════════════════════════════════════════════════'],
      ['QBR PREPARATION PACKAGE'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Customer', ctx.customerName],
      ['Quarter', quarter],
      ['Generated', new Date().toISOString()],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['BUSINESS METRICS'],
      ['═══════════════════════════════════════════════════════════════'],
      ['ARR', `$${(arr/1000).toFixed(0)}K`],
      ['Health Score', healthScore],
      ['Renewal Date', ctx.renewalDate || 'TBD'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['USAGE METRICS (90 days)'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Average DAU', avgDAU],
      ['Average MAU', avgMAU],
      ['Data Points', metrics.length],
    ];

    // Add AI insights only if enabled
    if (aiInsights) {
      metricsData.push(['']);
      metricsData.push(['═══════════════════════════════════════════════════════════════']);
      metricsData.push(['[AI Generated] QBR INSIGHTS & TALKING POINTS']);
      metricsData.push(['═══════════════════════════════════════════════════════════════']);
      metricsData.push(['Source: Claude AI + Knowledge Base']);
      metricsData.push(['']);

      aiInsights.sections.forEach(section => {
        const tag = section.source === 'ai' ? '[AI Generated]' : `[Knowledge Base: ${section.sourceTitle}]`;
        metricsData.push([tag]);
        section.content.split('\n').forEach(line => {
          if (line.trim()) metricsData.push([line]);
        });
        metricsData.push(['']);
      });
    }

    // Add standard agenda
    metricsData.push(['']);
    metricsData.push(['═══════════════════════════════════════════════════════════════']);
    metricsData.push(['SUGGESTED QBR AGENDA']);
    metricsData.push(['═══════════════════════════════════════════════════════════════']);
    metricsData.push(['1. Business Review & Metrics (15 min)']);
    metricsData.push(['2. Product Usage & Adoption (15 min)']);
    metricsData.push(['3. Success Stories & Wins (10 min)']);
    metricsData.push(['4. [REVIEW NEEDED] Customer Challenges Discussion (10 min)']);
    metricsData.push(['5. Roadmap & Upcoming Features (10 min)']);
    metricsData.push(['6. Action Items & Next Steps (10 min)']);

    // Add Apps Script automation info only if enabled
    if (npsScript && surveyScript) {
      metricsData.push(['']);
      metricsData.push(['═══════════════════════════════════════════════════════════════']);
      metricsData.push(['[AI Generated] AVAILABLE AUTOMATIONS']);
      metricsData.push(['═══════════════════════════════════════════════════════════════']);
      metricsData.push(['1. NPS Analysis Script - Analyze customer sentiment']);
      metricsData.push(['2. Survey Processor - Process feedback forms']);
      metricsData.push(['[REVIEW NEEDED] See Apps Script docs for deployment']);
    }

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: 'A1', values: metricsData });

    // Create consolidated Apps Script doc only if AI enabled
    let scriptDoc = null;
    if (npsScript && surveyScript) {
      scriptDoc = await docsService.createDocument(ctx.userId, {
        title: `[AI Generated] QBR Automation Scripts - ${ctx.customerName}`,
        content: `# [AI Generated] QBR Automation Scripts
## ${ctx.customerName} - ${quarter}

---

## 1. NPS Analysis Script

### Description
${npsScript.description}

### Setup
${npsScript.setupInstructions}

### [AI Generated] Code
\`\`\`javascript
${npsScript.code}
\`\`\`

---

## 2. Survey Response Processor

### Description
${surveyScript.description}

### Setup
${surveyScript.setupInstructions}

### [AI Generated] Code
\`\`\`javascript
${surveyScript.code}
\`\`\`

---

*[AI Generated] All scripts should be reviewed before deployment.*
*[REVIEW NEEDED] Customize alert recipients and thresholds.*
*Generated: ${new Date().toISOString()}*`,
      });
      await saveDocument(ctx.customerId, ctx.userId, 'qbr_scripts', scriptDoc.id, scriptDoc.title, 'doc', scriptDoc.webViewLink);
    }

    await saveDocument(ctx.customerId, ctx.userId, 'qbr_deck', deck.id, deck.title, 'slide', deck.webViewLink);
    await saveDocument(ctx.customerId, ctx.userId, 'qbr_metrics', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'create_qbr_package',
      status: 'completed',
      steps: useAI ? [
        { id: 'fetch', name: 'Pulling Historical Data', status: 'completed' },
        { id: 'ai', name: '[AI] Generating QBR Insights', status: 'completed' },
        { id: 'kb', name: '[KB] Adding Best Practices', status: 'completed' },
        { id: 'script', name: '[AI] Generating NPS & Survey Scripts', status: 'completed' },
        { id: 'create', name: 'Building QBR Package', status: 'completed' },
      ] : [
        { id: 'fetch', name: 'Pulling Historical Data', status: 'completed' },
        { id: 'create', name: 'Building QBR Package', status: 'completed' },
      ],
      output: {
        summary: useAI
          ? `QBR package with AI insights: Deck + Metrics + Automation Scripts (Health: ${healthScore})`
          : `QBR package (fast mode): Deck + Metrics (Health: ${healthScore})`,
        presentationUrl: deck.webViewLink,
        presentationId: deck.id,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        ...(scriptDoc && { scriptsUrl: scriptDoc.webViewLink }),
        healthScore,
        avgDAU,
        aiGenerated: useAI,
        ...(aiInsights && { knowledgeBaseSources: aiInsights.metadata.knowledgeBaseSources }),
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'create_qbr_package',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// AI: DRAFT EMAIL
// ============================================

export async function executeDraftEmail(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);
    const contract = await getContractData(ctx.customerId);

    // Get stakeholders from contract
    const extractedData = contract?.extracted_data as Record<string, unknown> | undefined;
    const stakeholders = (extractedData?.stakeholders || []) as Array<{
      name?: string;
      email?: string;
      role?: string;
    }>;
    const primaryContact = stakeholders.find(s => s.email) || stakeholders[0];

    // Get email context
    const emailContext = await getCustomerEmailContext(ctx.customerId);
    const recentActivity = await getRecentActivity(ctx.customerId, 5);

    const healthScore = ctx.healthScore || customer?.health_score || 70;

    // Determine email type based on health and context
    let emailType: EmailType = 'check_in';
    if (healthScore < 50) {
      emailType = 'risk_outreach';
    } else if (ctx.renewalDate) {
      const daysToRenewal = Math.ceil(
        (new Date(ctx.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysToRenewal <= 90) {
        emailType = 'renewal_reminder';
      }
    }

    // Draft the email using Claude
    const draft = await draftEmail({
      type: emailType,
      customerName: ctx.customerName,
      recipientName: primaryContact?.name || 'Team',
      recipientRole: primaryContact?.role,
      recipientEmail: primaryContact?.email,
      context: {
        healthScore,
        lastContact: emailContext?.lastContact,
        recentActivity: recentActivity.length > 0 ? recentActivity : emailContext?.recentActivity,
        renewalDate: ctx.renewalDate,
        arr: ctx.customerARR || customer?.arr,
        industry: customer?.industry,
        stage: customer?.stage,
      },
      tone: healthScore < 50 ? 'urgent' : 'professional',
      senderName: 'Your Customer Success Manager',
    });

    // Create Gmail draft (requires approval to send)
    const draftId = await gmailService.createDraft(ctx.userId, {
      to: primaryContact?.email ? [primaryContact.email] : [],
      subject: draft.subject,
      bodyHtml: `<div style="font-family: Arial, sans-serif;">${draft.body.replace(/\n/g, '<br>')}</div>`,
    });

    return {
      success: true,
      workflowId: 'draft_personalized_email',
      status: 'awaiting_approval',
      steps: [
        { id: 'context', name: 'Gathering Customer Context', status: 'completed' },
        { id: 'ai', name: '[AI] Drafting Personalized Email', status: 'completed' },
        { id: 'draft', name: 'Creating Gmail Draft', status: 'completed' },
        { id: 'review', name: 'Awaiting Approval', status: 'pending' },
      ],
      output: {
        summary: `[AI Generated] ${emailType.replace('_', ' ')} email drafted for ${primaryContact?.name || ctx.customerName}`,
        draftId,
        subject: draft.subject,
        bodyPreview: draft.body.substring(0, 300) + '...',
        recipientEmail: primaryContact?.email || 'Not specified',
        recipientName: primaryContact?.name || 'Not specified',
        emailType,
        suggestedSendTime: draft.suggestedSendTime,
        talkingPoints: draft.talkingPoints,
        followUpActions: draft.followUpActions,
        sentiment: draft.sentiment,
        requiresApproval: true,
        approvalMessage: `Review and send ${emailType.replace('_', ' ')} email to ${primaryContact?.name || 'customer'}`,
        aiGenerated: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'draft_personalized_email',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// AI: MEETING PREP
// ============================================

export async function executeMeetingPrep(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);

    // Determine meeting type based on context
    let meetingType: MeetingType = 'check_in';
    const healthScore = ctx.healthScore || customer?.health_score || 70;

    if (healthScore < 50) {
      meetingType = 'escalation';
    } else if (ctx.renewalDate) {
      const daysToRenewal = Math.ceil(
        (new Date(ctx.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysToRenewal <= 90) {
        meetingType = 'renewal';
      }
    }

    // Generate meeting brief using AI
    const brief = await prepareMeetingBrief({
      customerId: ctx.customerId,
      customerName: ctx.customerName,
      meetingType,
    });

    // Format as document
    const content = formatMeetingBriefAsDocument(brief, ctx.customerName, meetingType);

    // Create Google Doc with the brief
    const doc = await docsService.createDocument(ctx.userId, {
      title: `Meeting Prep - ${ctx.customerName} - ${new Date().toLocaleDateString()}`,
      content,
    });

    await saveDocument(ctx.customerId, ctx.userId, 'meeting_prep', doc.id, doc.title, 'doc', doc.webViewLink);

    return {
      success: true,
      workflowId: 'generate_meeting_prep',
      status: 'completed',
      steps: [
        { id: 'context', name: 'Gathering Customer Context', status: 'completed' },
        { id: 'ai', name: '[AI] Generating Meeting Brief', status: 'completed' },
        { id: 'create', name: 'Creating Document', status: 'completed' },
      ],
      output: {
        summary: `[AI Generated] Meeting prep for ${meetingType} with ${brief.talkingPoints.length} talking points`,
        documentUrl: doc.webViewLink,
        documentId: doc.id,
        meetingType,
        talkingPointsCount: brief.talkingPoints.length,
        risksIdentified: brief.risksToAddress.length,
        questionsCount: brief.questionsToAsk.length,
        aiGenerated: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'generate_meeting_prep',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// AI: CHURN PREDICTION
// ============================================

export async function executeChurnPrediction(ctx: ActionContext): Promise<ActionResult> {
  try {
    const customer = await getCustomerData(ctx.customerId);

    // Run churn prediction
    const prediction = await predictChurnRisk(ctx.customerId);

    // Create churn analysis sheet
    const sheet = await sheetsService.createSpreadsheet(ctx.userId, {
      title: `Churn Risk Analysis - ${ctx.customerName} - ${new Date().toISOString().split('T')[0]}`,
    });

    const data: (string | number)[][] = [
      ['═══════════════════════════════════════════════════════════════'],
      ['[AI Generated] CHURN RISK ANALYSIS'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Customer', ctx.customerName],
      ['Analysis Date', new Date().toISOString().split('T')[0]],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['RISK SUMMARY'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Churn Probability', `${prediction.probability}%`],
      ['Risk Level', prediction.riskLevel.toUpperCase()],
      ['Confidence', prediction.confidence.toUpperCase()],
      ['ARR at Risk', prediction.arrAtRisk > 0 ? `$${prediction.arrAtRisk.toLocaleString()}` : '$0'],
      ['Days to Renewal', prediction.daysToRenewal?.toString() || 'N/A'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['SCORE BREAKDOWN'],
      ['═══════════════════════════════════════════════════════════════'],
      ['Usage Health', prediction.scoreBreakdown.usage],
      ['Engagement Health', prediction.scoreBreakdown.engagement],
      ['Stakeholder Health', prediction.scoreBreakdown.stakeholder],
      ['Business Health', prediction.scoreBreakdown.business],
      ['Support Health', prediction.scoreBreakdown.support],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['RISK SIGNALS DETECTED'],
      ['═══════════════════════════════════════════════════════════════'],
    ];

    if (prediction.signals.length > 0) {
      prediction.signals.forEach(signal => {
        const icon = signal.severity === 'critical' ? '🚨' :
                     signal.severity === 'high' ? '⚠️' :
                     signal.severity === 'medium' ? '⚡' : 'ℹ️';
        data.push([`${icon} [${signal.severity.toUpperCase()}] ${signal.detail}`]);
        if (signal.recommendation) {
          data.push([`   → ${signal.recommendation}`]);
        }
      });
    } else {
      data.push(['✅ No significant risk signals detected']);
    }

    data.push(['']);
    data.push(['═══════════════════════════════════════════════════════════════']);
    data.push(['RECOMMENDED ACTIONS']);
    data.push(['═══════════════════════════════════════════════════════════════']);

    prediction.recommendedActions.forEach((action, i) => {
      data.push([`${i + 1}. ${action}`]);
    });

    data.push(['']);
    data.push(['[REVIEW NEEDED] Validate signals and customize action plan']);
    data.push(['*Generated by AI - Review before taking action*']);

    await sheetsService.updateValues(ctx.userId, sheet.id, { range: 'A1', values: data });

    await saveDocument(ctx.customerId, ctx.userId, 'churn_analysis', sheet.id, sheet.title, 'sheet', sheet.webViewLink);

    return {
      success: true,
      workflowId: 'predict_churn_risk',
      status: 'completed',
      steps: [
        { id: 'gather', name: 'Gathering Customer Data', status: 'completed' },
        { id: 'ai', name: '[AI] Analyzing Churn Signals', status: 'completed' },
        { id: 'score', name: 'Calculating Risk Score', status: 'completed' },
        { id: 'create', name: 'Creating Analysis Report', status: 'completed' },
      ],
      output: {
        summary: `[AI Generated] Churn risk: ${prediction.probability}% (${prediction.riskLevel}) - ${prediction.signals.length} signals detected`,
        sheetUrl: sheet.webViewLink,
        sheetId: sheet.id,
        churnProbability: prediction.probability,
        riskLevel: prediction.riskLevel,
        confidence: prediction.confidence,
        signalsCount: prediction.signals.length,
        arrAtRisk: prediction.arrAtRisk,
        recommendedActions: prediction.recommendedActions,
        scoreBreakdown: prediction.scoreBreakdown,
        aiGenerated: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      workflowId: 'predict_churn_risk',
      status: 'failed',
      steps: [],
      output: {},
      error: (error as Error).message,
    };
  }
}

// ============================================
// ACTION DISPATCHER
// ============================================

import { activityLogger } from '../activityLogger.js';

// Map action IDs to agent types
const ACTION_TO_AGENT_TYPE: Record<string, 'onboarding' | 'adoption' | 'renewal' | 'risk' | 'strategic'> = {
  kickoff: 'onboarding',
  plan_30_60_90: 'onboarding',
  stakeholder_map: 'onboarding',
  welcome_sequence: 'onboarding',
  adoption_campaign: 'adoption',
  feature_training: 'adoption',
  champion_program: 'adoption',
  usage_analysis: 'adoption',
  expansion_analysis: 'renewal',
  renewal_playbook: 'renewal',
  renewal_forecast: 'renewal',
  value_summary: 'renewal',
  save_play: 'risk',
  escalation: 'risk',
  risk_assessment: 'risk',
  health_check: 'risk',
  churn_prediction: 'risk',
  exec_briefing: 'strategic',
  account_plan: 'strategic',
  success_plan: 'strategic',
  qbr_prep: 'strategic',
  draft_email: 'strategic',
  meeting_prep: 'strategic',
};

export async function executeAction(actionId: string, ctx: ActionContext): Promise<ActionResult | null> {
  const actions: Record<string, (ctx: ActionContext) => Promise<ActionResult>> = {
    // Onboarding
    kickoff: executeKickoff,
    plan_30_60_90: executePlan30_60_90,
    stakeholder_map: executeStakeholderMap,
    welcome_sequence: executeWelcomeSequence,

    // Adoption
    adoption_campaign: executeAdoptionCampaign,
    feature_training: executeFeatureTraining,
    champion_program: executeChampionProgram,
    usage_analysis: executeUsageAnalysis,

    // Renewal
    expansion_analysis: executeExpansionAnalysis,
    renewal_playbook: executeRenewalPlaybook,
    renewal_forecast: executeRenewalForecast,
    value_summary: executeValueSummary,

    // Risk
    save_play: executeSavePlay,
    escalation: executeEscalation,
    risk_assessment: executeRiskAssessment,
    health_check: executeRiskAssessment, // Same as risk_assessment

    // Strategic
    exec_briefing: executeExecBriefing,
    account_plan: executeAccountPlan,
    success_plan: executeSuccessPlan,
    qbr_prep: executeQBRPrep,

    // AI-Powered Actions
    draft_email: executeDraftEmail,
    meeting_prep: executeMeetingPrep,
    churn_prediction: executeChurnPrediction,
  };

  const executor = actions[actionId];
  if (!executor) {
    return null;
  }

  // Log activity start
  const agentType = ACTION_TO_AGENT_TYPE[actionId] || 'strategic';
  const startTime = Date.now();
  const activityId = await activityLogger.logActivity({
    customer_id: ctx.customerId,
    user_id: ctx.userId,
    agent_type: agentType,
    action_type: actionId,
    action_data: {
      customerName: ctx.customerName,
      customerARR: ctx.customerARR,
      healthScore: ctx.healthScore,
      renewalDate: ctx.renewalDate,
    },
    status: 'running',
    session_id: ctx.sessionId,
  });

  try {
    // Execute the action
    const result = await executor(ctx);

    // Log activity completion
    if (activityId) {
      await activityLogger.updateActivity(activityId, {
        status: result.success ? 'completed' : 'failed',
        result_data: result.output as Record<string, unknown>,
        error_message: result.success ? undefined : (result.output?.error as string),
        duration_ms: Date.now() - startTime,
      });
    }

    return result;
  } catch (error) {
    // Log activity failure
    if (activityId) {
      await activityLogger.updateActivity(activityId, {
        status: 'failed',
        error_message: (error as Error).message,
        duration_ms: Date.now() - startTime,
      });
    }
    throw error;
  }
}
