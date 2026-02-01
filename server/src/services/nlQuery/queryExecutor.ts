/**
 * Query Executor
 * PRD-211: Natural Language Account Query
 *
 * Executes database queries based on classified intent and entities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  QueryIntent,
  QueryEntities,
  QueryData,
  CustomerSummary,
  StakeholderData,
  RiskSignalData,
  UsageData,
  ActivityData,
  EmailData,
  EmailSummaryData,
} from './types.js';
import { emailService } from '../email/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Execute query based on intent and entities
 */
export async function executeQuery(
  intent: QueryIntent,
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  switch (intent) {
    case 'account_summary':
      return executeAccountSummary(entities, userId);

    case 'account_list':
      return executeAccountList(entities, userId);

    case 'metric_query':
      return executeMetricQuery(entities, userId);

    case 'stakeholder_query':
      return executeStakeholderQuery(entities, userId);

    case 'usage_query':
      return executeUsageQuery(entities, userId);

    case 'timeline_query':
      return executeTimelineQuery(entities, userId);

    case 'comparison_query':
      return executeComparisonQuery(entities, userId);

    case 'aggregation_query':
      return executeAggregationQuery(entities, userId);

    case 'email_query':
      return executeEmailQuery(entities, userId);

    case 'email_summary':
      return executeEmailSummaryQuery(entities, userId);

    default:
      throw new Error(`Unknown query intent: ${intent}`);
  }
}

/**
 * Execute account summary query
 */
async function executeAccountSummary(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountId = entities.account_ids?.[0];

  if (!accountId) {
    throw new Error('Account ID required for summary');
  }

  // Get customer data
  const { data: customer, error: customerError } = await supabase!
    .from('customers')
    .select('*')
    .eq('id', accountId)
    .single();

  if (customerError || !customer) {
    throw new Error('Customer not found');
  }

  // Get stakeholders
  const { data: stakeholders } = await supabase!
    .from('stakeholders')
    .select('*')
    .eq('customer_id', accountId)
    .order('is_primary', { ascending: false })
    .limit(10);

  // Get open risk signals
  const { data: riskSignals } = await supabase!
    .from('risk_signals')
    .select('*')
    .eq('customer_id', accountId)
    .is('resolved_at', null)
    .order('detected_at', { ascending: false })
    .limit(5);

  // Get recent activity
  const { data: recentActivity } = await supabase!
    .from('agent_activity_log')
    .select('*')
    .eq('customer_id', accountId)
    .order('started_at', { ascending: false })
    .limit(10);

  // Get latest usage metrics
  const { data: usageMetrics } = await supabase!
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', accountId)
    .order('metric_date', { ascending: false })
    .limit(1);

  // Calculate days until renewal
  const renewalDate = customer.renewal_date ? new Date(customer.renewal_date) : null;
  const daysUntilRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      arr: customer.arr || 0,
      health_score: customer.health_score || 70,
      industry: customer.industry,
      segment: customer.segment,
      stage: customer.stage || 'active',
      renewal_date: customer.renewal_date,
      days_until_renewal: daysUntilRenewal,
      csm_name: customer.csm_name,
    },
    stakeholders: (stakeholders || []).map(transformStakeholder),
    risk_signals: (riskSignals || []).map(transformRiskSignal),
    recent_activity: (recentActivity || []).map(transformActivity),
    usage: usageMetrics?.[0] ? transformUsage(usageMetrics[0]) : undefined,
  };
}

/**
 * Execute account list query
 */
async function executeAccountList(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  let query = supabase!.from('customers').select('*');

  // Apply filters
  if (entities.filters) {
    const filters = entities.filters;

    if (filters.industry?.length) {
      query = query.in('industry', filters.industry);
    }

    if (filters.segment?.length) {
      query = query.in('segment', filters.segment);
    }

    if (filters.status?.length) {
      query = query.in('stage', filters.status);
    }

    if (typeof filters.health_score_min === 'number') {
      query = query.gte('health_score', filters.health_score_min);
    }

    if (typeof filters.health_score_max === 'number') {
      query = query.lte('health_score', filters.health_score_max);
    }

    if (typeof filters.arr_min === 'number') {
      query = query.gte('arr', filters.arr_min);
    }

    if (typeof filters.arr_max === 'number') {
      query = query.lte('arr', filters.arr_max);
    }
  }

  // Apply sorting
  const sortBy = entities.sort_by || 'health_score';
  const sortOrder = entities.sort_order || 'asc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Apply limit
  const limit = entities.limit || 20;
  query = query.limit(limit);

  const { data: customers, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  return {
    customers: (customers || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      arr: c.arr || 0,
      health_score: c.health_score || 70,
      industry: c.industry,
      segment: c.segment,
      stage: c.stage || 'active',
      renewal_date: c.renewal_date,
    })),
  };
}

/**
 * Execute metric query
 */
async function executeMetricQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountId = entities.account_ids?.[0];

  if (!accountId) {
    throw new Error('Account ID required for metric query');
  }

  const { data: customer, error } = await supabase!
    .from('customers')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !customer) {
    throw new Error('Customer not found');
  }

  const metrics: Record<string, number | string> = {};
  const requestedMetrics = entities.metrics || ['health_score', 'arr'];

  for (const metric of requestedMetrics) {
    switch (metric.toLowerCase()) {
      case 'health_score':
      case 'health':
        metrics.health_score = customer.health_score || 70;
        break;
      case 'arr':
      case 'revenue':
        metrics.arr = customer.arr || 0;
        break;
      case 'renewal_date':
      case 'renewal':
        metrics.renewal_date = customer.renewal_date || 'Not set';
        break;
      case 'industry':
        metrics.industry = customer.industry || 'Unknown';
        break;
      case 'stage':
      case 'status':
        metrics.stage = customer.stage || 'active';
        break;
    }
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      arr: customer.arr || 0,
      health_score: customer.health_score || 70,
      industry: customer.industry,
      segment: customer.segment,
      stage: customer.stage || 'active',
      renewal_date: customer.renewal_date,
    },
    metrics,
  };
}

/**
 * Execute stakeholder query
 */
async function executeStakeholderQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountId = entities.account_ids?.[0];

  if (!accountId) {
    throw new Error('Account ID required for stakeholder query');
  }

  const { data: stakeholders, error } = await supabase!
    .from('stakeholders')
    .select('*')
    .eq('customer_id', accountId)
    .order('is_primary', { ascending: false });

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Get customer name for context
  const { data: customer } = await supabase!
    .from('customers')
    .select('id, name')
    .eq('id', accountId)
    .single();

  return {
    customer: customer ? {
      id: customer.id,
      name: customer.name,
      arr: 0,
      health_score: 0,
      stage: '',
    } : undefined,
    stakeholders: (stakeholders || []).map(transformStakeholder),
  };
}

/**
 * Execute usage query
 */
async function executeUsageQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountId = entities.account_ids?.[0];

  if (!accountId) {
    throw new Error('Account ID required for usage query');
  }

  // Get usage metrics history
  const { data: usageHistory, error } = await supabase!
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', accountId)
    .order('metric_date', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Get customer for context
  const { data: customer } = await supabase!
    .from('customers')
    .select('id, name, health_score')
    .eq('id', accountId)
    .single();

  const latestUsage = usageHistory?.[0];

  return {
    customer: customer ? {
      id: customer.id,
      name: customer.name,
      arr: 0,
      health_score: customer.health_score || 70,
      stage: '',
    } : undefined,
    usage: latestUsage ? transformUsage(latestUsage) : {
      dau: 0,
      wau: 0,
      mau: 0,
      adoption_score: 0,
      usage_trend: 'stable',
    },
    metrics: latestUsage ? {
      dau: latestUsage.dau,
      wau: latestUsage.wau,
      mau: latestUsage.mau,
      adoption_score: latestUsage.adoption_score,
      login_count: latestUsage.login_count,
    } : undefined,
  };
}

/**
 * Execute timeline query
 */
async function executeTimelineQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountId = entities.account_ids?.[0];

  if (!accountId) {
    throw new Error('Account ID required for timeline query');
  }

  // Build date filter
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (entities.date_range) {
    startDate = entities.date_range.start;
    endDate = entities.date_range.end;
  } else {
    // Default to last 30 days
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    now.setDate(now.getDate() - 30);
    startDate = now.toISOString().split('T')[0];
  }

  let query = supabase!
    .from('agent_activity_log')
    .select('*')
    .eq('customer_id', accountId)
    .order('started_at', { ascending: false })
    .limit(50);

  if (startDate) {
    query = query.gte('started_at', startDate);
  }
  if (endDate) {
    query = query.lte('started_at', endDate + 'T23:59:59Z');
  }

  const { data: activities, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Get customer for context
  const { data: customer } = await supabase!
    .from('customers')
    .select('id, name')
    .eq('id', accountId)
    .single();

  return {
    customer: customer ? {
      id: customer.id,
      name: customer.name,
      arr: 0,
      health_score: 0,
      stage: '',
    } : undefined,
    recent_activity: (activities || []).map(transformActivity),
  };
}

/**
 * Execute comparison query
 */
async function executeComparisonQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  const accountIds = entities.account_ids || [];

  if (accountIds.length < 2) {
    throw new Error('At least two accounts required for comparison');
  }

  const { data: customers, error } = await supabase!
    .from('customers')
    .select('*')
    .in('id', accountIds);

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Get usage metrics for comparison
  const { data: usageMetrics } = await supabase!
    .from('usage_metrics')
    .select('customer_id, dau, wau, mau, adoption_score')
    .in('customer_id', accountIds)
    .order('metric_date', { ascending: false });

  // Group usage by customer (latest only)
  const usageByCustomer = new Map<string, any>();
  for (const usage of usageMetrics || []) {
    if (!usageByCustomer.has(usage.customer_id)) {
      usageByCustomer.set(usage.customer_id, usage);
    }
  }

  const accounts = (customers || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    arr: c.arr || 0,
    health_score: c.health_score || 70,
    industry: c.industry,
    segment: c.segment,
    stage: c.stage || 'active',
    renewal_date: c.renewal_date,
  }));

  const metrics: Record<string, Record<string, number>> = {};
  for (const account of accounts) {
    const usage = usageByCustomer.get(account.id);
    metrics[account.name] = {
      health_score: account.health_score,
      arr: account.arr,
      dau: usage?.dau || 0,
      mau: usage?.mau || 0,
      adoption_score: usage?.adoption_score || 0,
    };
  }

  return {
    comparison: {
      accounts,
      metrics,
    },
  };
}

/**
 * Execute aggregation query
 */
async function executeAggregationQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  // Build filter query
  let query = supabase!.from('customers').select('*');

  if (entities.filters) {
    const filters = entities.filters;

    if (filters.industry?.length) {
      query = query.in('industry', filters.industry);
    }

    if (filters.segment?.length) {
      query = query.in('segment', filters.segment);
    }

    if (filters.status?.length) {
      query = query.in('stage', filters.status);
    }

    if (typeof filters.health_score_max === 'number') {
      query = query.lte('health_score', filters.health_score_max);
    }
  }

  const { data: customers, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  const customerList = customers || [];

  // Calculate aggregations
  const aggregations: Record<string, number> = {
    total_accounts: customerList.length,
    total_arr: customerList.reduce((sum: number, c: any) => sum + (c.arr || 0), 0),
    average_health_score: customerList.length > 0
      ? Math.round(customerList.reduce((sum: number, c: any) => sum + (c.health_score || 0), 0) / customerList.length)
      : 0,
    at_risk_count: customerList.filter((c: any) => (c.health_score || 0) < 60).length,
    healthy_count: customerList.filter((c: any) => (c.health_score || 0) >= 80).length,
  };

  // Add renewal info if requested
  const now = new Date();
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const renewingCustomers = customerList.filter((c: any) => {
    if (!c.renewal_date) return false;
    const renewalDate = new Date(c.renewal_date);
    return renewalDate >= now && renewalDate <= next90Days;
  });

  aggregations.renewing_next_90_days = renewingCustomers.length;
  aggregations.arr_renewing_next_90_days = renewingCustomers.reduce(
    (sum: number, c: any) => sum + (c.arr || 0),
    0
  );

  return {
    customers: customerList.slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      arr: c.arr || 0,
      health_score: c.health_score || 70,
      industry: c.industry,
      segment: c.segment,
      stage: c.stage || 'active',
      renewal_date: c.renewal_date,
    })),
    aggregations,
  };
}

// Transform functions
function transformStakeholder(s: any): StakeholderData {
  return {
    id: s.id,
    name: s.name,
    role: s.role || 'Unknown',
    email: s.email,
    phone: s.phone,
    is_primary: s.is_primary || false,
    sentiment: s.sentiment,
    linkedin_url: s.linkedin_url,
  };
}

function transformRiskSignal(r: any): RiskSignalData {
  return {
    id: r.id,
    signal_type: r.signal_type,
    severity: r.severity || 'medium',
    description: r.description || '',
    detected_at: r.detected_at,
    resolved_at: r.resolved_at,
  };
}

function transformActivity(a: any): ActivityData {
  return {
    id: a.id,
    type: a.action_type || 'activity',
    title: formatActivityTitle(a.action_type, a.agent_type),
    description: a.result_data?.summary || a.action_data?.description,
    date: a.started_at,
    user: a.agent_type ? `${a.agent_type} Agent` : 'System',
  };
}

function transformUsage(u: any): UsageData {
  return {
    dau: u.dau || 0,
    wau: u.wau || 0,
    mau: u.mau || 0,
    adoption_score: u.adoption_score || 0,
    usage_trend: u.usage_trend || 'stable',
    feature_adoption: u.feature_adoption,
    login_count: u.login_count,
  };
}

function formatActivityTitle(actionType: string, agentType?: string): string {
  const titles: Record<string, string> = {
    send_email: 'Email Sent',
    draft_email: 'Email Drafted',
    schedule_meeting: 'Meeting Scheduled',
    book_meeting: 'Meeting Booked',
    create_task: 'Task Created',
    health_check: 'Health Check',
    qbr_prep: 'QBR Preparation',
    risk_assessment: 'Risk Assessment',
  };

  return titles[actionType] || actionType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Activity';
}

// ==================== Email Query Handlers ====================

/**
 * Execute email search query
 */
async function executeEmailQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Build query
  let query = supabase
    .from('emails')
    .select('id, subject, from_email, from_name, to_emails, date, snippet, is_read, is_important, customer_id')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  // Apply filters
  if (entities.email_sender) {
    query = query.or(`from_email.ilike.%${entities.email_sender}%,from_name.ilike.%${entities.email_sender}%`);
  }

  if (entities.email_subject || entities.email_keywords?.length) {
    const searchTerms = [entities.email_subject, ...(entities.email_keywords || [])].filter(Boolean);
    if (searchTerms.length > 0) {
      const searchPattern = searchTerms.map(t => `subject.ilike.%${t}%`).join(',');
      query = query.or(searchPattern);
    }
  }

  if (entities.unread_only) {
    query = query.eq('is_read', false);
  }

  if (entities.important_only) {
    query = query.eq('is_important', true);
  }

  if (entities.date_range?.start) {
    query = query.gte('date', entities.date_range.start);
  }

  if (entities.date_range?.end) {
    query = query.lte('date', entities.date_range.end);
  }

  // Apply customer filter if account specified
  if (entities.account_ids?.length) {
    query = query.in('customer_id', entities.account_ids);
  }

  const limit = entities.limit || 20;
  query = query.limit(limit);

  const { data: emails, error } = await query as { data: any[] | null; error: any };

  if (error) {
    throw new Error(`Email query failed: ${error.message}`);
  }

  // Get customer names for linked emails
  const customerIds = [...new Set((emails || []).filter(e => e.customer_id).map(e => e.customer_id))];
  let customerMap: Record<string, string> = {};

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds) as { data: Array<{ id: string; name: string }> | null };

    customerMap = (customers || []).reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {} as Record<string, string>);
  }

  return {
    emails: (emails || []).map(e => transformEmail(e, customerMap)),
  };
}

/**
 * Execute email summary query
 */
async function executeEmailSummaryQuery(
  entities: QueryEntities,
  userId: string
): Promise<QueryData> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // First, fetch the emails like email_query
  const emailData = await executeEmailQuery(entities, userId);
  const emails = emailData.emails || [];

  if (emails.length === 0) {
    return {
      emails: [],
      email_summary: {
        summary: 'No emails found matching your query.',
        key_points: [],
        action_items: [],
        mentioned_customers: [],
        sentiment: 'neutral',
        email_count: 0,
      },
    };
  }

  // Use the email summarization service
  const emailIds = emails.map(e => e.id);

  // Fetch full email content for summarization
  const { data: fullEmails, error } = await supabase
    .from('emails')
    .select('*')
    .in('id', emailIds) as { data: any[] | null; error: any };

  if (error || !fullEmails?.length) {
    return {
      emails,
      email_summary: {
        summary: `Found ${emails.length} email(s) but unable to generate summary.`,
        key_points: [],
        action_items: [],
        mentioned_customers: [],
        sentiment: 'neutral',
        email_count: emails.length,
      },
    };
  }

  // Import Anthropic for summarization
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const { config } = await import('../../config/index.js');

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  // Build email content for summarization
  const emailContent = fullEmails
    .map((email, idx) => {
      const date = new Date(email.date).toLocaleString();
      return `--- Email ${idx + 1} ---
From: ${email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
Date: ${date}
Subject: ${email.subject || '(No Subject)'}

${email.body_text || '(No content)'}`;
    })
    .join('\n\n');

  const prompt = `Summarize these ${fullEmails.length} email(s) for a Customer Success manager:

${emailContent}

Return JSON:
{
  "summary": "2-3 sentence overview",
  "key_points": ["point 1", "point 2"],
  "action_items": [{"description": "action", "owner": "name or null", "urgency": "high|medium|low"}],
  "mentioned_customers": [{"name": "company name", "mentions": 1}],
  "sentiment": "positive|neutral|negative|mixed"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        emails,
        email_summary: {
          summary: parsed.summary || 'Unable to generate summary.',
          key_points: parsed.key_points || [],
          action_items: parsed.action_items || [],
          mentioned_customers: parsed.mentioned_customers || [],
          sentiment: parsed.sentiment || 'neutral',
          email_count: emails.length,
        },
      };
    }
  } catch (err) {
    console.error('[QueryExecutor] Email summary failed:', err);
  }

  return {
    emails,
    email_summary: {
      summary: `Summary of ${emails.length} email(s): Please review the emails above.`,
      key_points: [],
      action_items: [],
      mentioned_customers: [],
      sentiment: 'neutral',
      email_count: emails.length,
    },
  };
}

/**
 * Transform database email to EmailData
 */
function transformEmail(e: any, customerMap: Record<string, string>): EmailData {
  return {
    id: e.id,
    subject: e.subject || '(No Subject)',
    from_email: e.from_email,
    from_name: e.from_name,
    to_emails: e.to_emails || [],
    date: e.date,
    snippet: e.snippet,
    is_read: e.is_read ?? true,
    is_important: e.is_important ?? false,
    customer_id: e.customer_id,
    customer_name: e.customer_id ? customerMap[e.customer_id] : undefined,
  };
}

export { supabase };
