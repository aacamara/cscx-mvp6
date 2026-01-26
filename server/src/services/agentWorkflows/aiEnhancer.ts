/**
 * AI Enhancer Service
 *
 * Enhances agent outputs with:
 * 1. Knowledge base content (tagged with source)
 * 2. AI-generated insights (tagged as AI Generated)
 * 3. Advanced Apps Script code for analytics
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

// ============================================
// KNOWLEDGE BASE SEARCH
// ============================================

interface PlaybookResult {
  id: string;
  title: string;
  content: string;
  category: string;
  relevanceScore: number;
}

export async function searchKnowledgeBase(
  query: string,
  category?: string,
  limit: number = 3
): Promise<PlaybookResult[]> {
  if (!supabase) return [];

  try {
    let queryBuilder = supabase
      .from('csm_playbooks')
      .select('id, title, content, category')
      .textSearch('content', query.split(' ').join(' | '))
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder;

    if (error || !data) return [];

    return data.map((p, i) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      relevanceScore: 1 - (i * 0.1), // Simple scoring based on order
    }));
  } catch {
    return [];
  }
}

// ============================================
// AI CONTENT GENERATION
// ============================================

interface AIGenerationOptions {
  context: {
    customerName: string;
    customerARR?: number;
    healthScore?: number;
    renewalDate?: string;
    usageMetrics?: Record<string, unknown>;
    stakeholders?: Array<{ name: string; role: string }>;
  };
  knowledgeBase?: PlaybookResult[];
  outputFormat: 'markdown' | 'json' | 'text';
}

export interface TaggedContent {
  content: string;
  source: 'ai' | 'knowledge_base';
  sourceTitle?: string;
  confidence?: number;
}

export interface EnhancedOutput {
  sections: TaggedContent[];
  rawContent: string;
  metadata: {
    aiGenerated: boolean;
    knowledgeBaseSources: string[];
    generatedAt: string;
  };
}

export async function generateAIInsights(
  prompt: string,
  options: AIGenerationOptions
): Promise<EnhancedOutput> {
  const sections: TaggedContent[] = [];
  const knowledgeBaseSources: string[] = [];

  // Add knowledge base content if available
  if (options.knowledgeBase && options.knowledgeBase.length > 0) {
    for (const kb of options.knowledgeBase) {
      sections.push({
        content: `## [Knowledge Base: ${kb.title}]\n\n${kb.content.substring(0, 500)}...`,
        source: 'knowledge_base',
        sourceTitle: kb.title,
        confidence: kb.relevanceScore,
      });
      knowledgeBaseSources.push(kb.title);
    }
  }

  // Generate AI insights if anthropic is available
  if (anthropic) {
    try {
      const systemPrompt = `You are a Customer Success AI assistant helping CSMs with account management.
Your outputs will be reviewed and modified by human CSMs, so:
1. Be specific and actionable
2. Base recommendations on the provided data
3. Highlight areas that need human judgment with [REVIEW NEEDED]
4. Keep insights concise but comprehensive

Customer Context:
- Name: ${options.context.customerName}
- ARR: ${options.context.customerARR ? `$${(options.context.customerARR/1000).toFixed(0)}K` : 'Unknown'}
- Health Score: ${options.context.healthScore || 'Unknown'}
- Renewal Date: ${options.context.renewalDate || 'Unknown'}`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const aiContent = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      sections.push({
        content: `## [AI Generated Analysis]\n\n${aiContent}`,
        source: 'ai',
        confidence: 0.85,
      });
    } catch (error) {
      console.error('AI generation error:', error);
      sections.push({
        content: `## [AI Generated Analysis]\n\n*AI analysis unavailable. Please review manually.*`,
        source: 'ai',
        confidence: 0,
      });
    }
  } else {
    // Fallback without AI
    sections.push({
      content: `## [AI Generated Analysis]\n\n*AI not configured. Configure ANTHROPIC_API_KEY for AI-powered insights.*`,
      source: 'ai',
      confidence: 0,
    });
  }

  const rawContent = sections.map(s => s.content).join('\n\n---\n\n');

  return {
    sections,
    rawContent,
    metadata: {
      aiGenerated: true,
      knowledgeBaseSources,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// RISK ANALYSIS AI
// ============================================

export async function generateRiskAnalysis(
  customerName: string,
  healthScore: number,
  usageMetrics: { avgDAU: number; trend: string; recentDAU: number; olderDAU: number },
  arr: number
): Promise<EnhancedOutput> {
  // Search knowledge base for risk-related playbooks
  const playbooks = await searchKnowledgeBase('risk churn prevention save play', 'risk', 3);

  const prompt = `Analyze the following customer risk signals and provide recommendations:

Customer: ${customerName}
ARR: $${(arr/1000).toFixed(0)}K
Health Score: ${healthScore}/100
Usage Trend: ${usageMetrics.trend}% (Recent: ${usageMetrics.recentDAU} DAU, Prior: ${usageMetrics.olderDAU} DAU)

Provide:
1. Risk Level Assessment (Critical/High/Medium/Low) with justification
2. Top 3 Risk Signals detected
3. Recommended Actions (prioritized)
4. Escalation recommendation (Yes/No with reasoning)
5. 30-day save play outline if needed

Mark any recommendations that need human judgment with [REVIEW NEEDED].`;

  return generateAIInsights(prompt, {
    context: { customerName, customerARR: arr, healthScore },
    knowledgeBase: playbooks,
    outputFormat: 'markdown',
  });
}

// ============================================
// QBR PREP AI
// ============================================

export async function generateQBRInsights(
  customerName: string,
  healthScore: number,
  arr: number,
  usageMetrics: { avgDAU: number; avgMAU: number; dataPoints: number }
): Promise<EnhancedOutput> {
  const playbooks = await searchKnowledgeBase('QBR quarterly business review executive', 'strategic', 3);

  const prompt = `Generate QBR preparation insights for:

Customer: ${customerName}
ARR: $${(arr/1000).toFixed(0)}K
Health Score: ${healthScore}/100
Usage (90 days): ${usageMetrics.avgDAU} avg DAU, ${usageMetrics.avgMAU} avg MAU

Provide:
1. Executive Summary (2-3 sentences for C-level)
2. Key Wins to Highlight (3-5 items)
3. Challenges to Address (be honest but constructive)
4. Expansion Opportunities to discuss
5. Strategic Recommendations for next quarter
6. Suggested Discussion Questions for the customer

Mark sections needing CSM input with [REVIEW NEEDED].`;

  return generateAIInsights(prompt, {
    context: { customerName, customerARR: arr, healthScore },
    knowledgeBase: playbooks,
    outputFormat: 'markdown',
  });
}

// ============================================
// RENEWAL FORECAST AI
// ============================================

export async function generateRenewalInsights(
  customerName: string,
  healthScore: number,
  arr: number,
  renewalDate?: string
): Promise<EnhancedOutput> {
  const playbooks = await searchKnowledgeBase('renewal forecast expansion upsell', 'renewal', 3);

  const prompt = `Generate renewal forecast analysis for:

Customer: ${customerName}
ARR: $${(arr/1000).toFixed(0)}K
Health Score: ${healthScore}/100
Renewal Date: ${renewalDate || 'TBD'}

Provide:
1. Renewal Probability Assessment (percentage with confidence level)
2. Key Factors Affecting Renewal (positive and negative)
3. Expansion Potential (estimate dollar amount and products)
4. Risk Mitigation Actions if probability < 80%
5. Negotiation Strategy recommendations
6. Timeline and Milestones to renewal

Include [REVIEW NEEDED] for assumptions that need validation.`;

  return generateAIInsights(prompt, {
    context: { customerName, customerARR: arr, healthScore, renewalDate },
    knowledgeBase: playbooks,
    outputFormat: 'markdown',
  });
}

// ============================================
// USAGE ANALYSIS AI
// ============================================

export async function generateUsageInsights(
  customerName: string,
  metrics: Array<{
    metric_date: string;
    dau: number;
    mau: number;
    login_count: number;
    api_calls: number;
    feature_adoption?: Record<string, number>;
  }>
): Promise<EnhancedOutput> {
  const playbooks = await searchKnowledgeBase('usage adoption engagement metrics', 'adoption', 3);

  // Calculate summary stats
  const avgDAU = metrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (metrics.length || 1);
  const avgMAU = metrics.reduce((sum, m) => sum + (m.mau || 0), 0) / (metrics.length || 1);
  const totalLogins = metrics.reduce((sum, m) => sum + (m.login_count || 0), 0);

  // Calculate trend
  const recentMetrics = metrics.slice(0, Math.floor(metrics.length / 2));
  const olderMetrics = metrics.slice(Math.floor(metrics.length / 2));
  const recentAvg = recentMetrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (recentMetrics.length || 1);
  const olderAvg = olderMetrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (olderMetrics.length || 1);
  const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) : '0';

  const prompt = `Analyze usage patterns and provide insights:

Customer: ${customerName}
Period: ${metrics.length} days of data
Average DAU: ${Math.round(avgDAU)}
Average MAU: ${Math.round(avgMAU)}
Total Logins: ${totalLogins}
Usage Trend: ${trend}%

Provide:
1. Usage Health Assessment (Healthy/Warning/Critical)
2. Key Usage Patterns identified
3. Feature Adoption gaps (if any)
4. User Engagement recommendations
5. Churn Risk indicators from usage data
6. Suggested interventions if usage is declining

Mark insights needing validation with [REVIEW NEEDED].`;

  return generateAIInsights(prompt, {
    context: { customerName, usageMetrics: { avgDAU, avgMAU, trend } },
    knowledgeBase: playbooks,
    outputFormat: 'markdown',
  });
}

// ============================================
// APPS SCRIPT GENERATION
// ============================================

export interface AppsScriptOutput {
  code: string;
  description: string;
  setupInstructions: string;
  triggers?: string[];
}

export async function generateAppsScript(
  scriptType: 'nps_analysis' | 'usage_dashboard' | 'health_calculator' | 'survey_processor' | 'renewal_alerts',
  customerName: string,
  customerId: string
): Promise<AppsScriptOutput> {
  const scripts: Record<string, AppsScriptOutput> = {
    nps_analysis: {
      code: `/**
 * [AI Generated] NPS Analysis Script
 * Customer: ${customerName}
 * Generated: ${new Date().toISOString()}
 *
 * This script analyzes NPS survey responses and generates insights.
 * CSM Review Points marked with // [REVIEW NEEDED]
 */

// Configuration - [REVIEW NEEDED] Update these values
const CONFIG = {
  CUSTOMER_ID: '${customerId}',
  CUSTOMER_NAME: '${customerName}',
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty('SUPABASE_URL'),
  SUPABASE_KEY: PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY'),
  NPS_SHEET_NAME: 'NPS Responses',
  ANALYSIS_SHEET_NAME: 'NPS Analysis'
};

/**
 * Main function to analyze NPS responses
 */
function analyzeNPSResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const npsSheet = ss.getSheetByName(CONFIG.NPS_SHEET_NAME);
  const analysisSheet = ss.getSheetByName(CONFIG.ANALYSIS_SHEET_NAME) || ss.insertSheet(CONFIG.ANALYSIS_SHEET_NAME);

  if (!npsSheet) {
    SpreadsheetApp.getUi().alert('NPS Responses sheet not found!');
    return;
  }

  const data = npsSheet.getDataRange().getValues();
  const headers = data[0];
  const responses = data.slice(1);

  // Calculate NPS metrics
  const scores = responses.map(row => parseInt(row[headers.indexOf('Score')]) || 0);
  const promoters = scores.filter(s => s >= 9).length;
  const passives = scores.filter(s => s >= 7 && s < 9).length;
  const detractors = scores.filter(s => s < 7).length;
  const total = scores.length;

  const npsScore = total > 0
    ? Math.round(((promoters - detractors) / total) * 100)
    : 0;

  // Generate analysis
  analysisSheet.clear();
  const analysisData = [
    ['[AI Generated] NPS Analysis Report'],
    ['Customer', CONFIG.CUSTOMER_NAME],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['OVERALL METRICS'],
    ['NPS Score', npsScore],
    ['Total Responses', total],
    ['Promoters (9-10)', promoters, (promoters/total*100).toFixed(1) + '%'],
    ['Passives (7-8)', passives, (passives/total*100).toFixed(1) + '%'],
    ['Detractors (0-6)', detractors, (detractors/total*100).toFixed(1) + '%'],
    [''],
    ['[AI Generated] INSIGHTS'],
    ['Health Indicator', npsScore >= 50 ? 'Healthy' : npsScore >= 0 ? 'Warning' : 'Critical'],
    ['Trend', '[REVIEW NEEDED] Compare with previous period'],
    [''],
    ['[AI Generated] RECOMMENDED ACTIONS'],
    [npsScore < 0 ? '1. URGENT: Schedule detractor recovery calls' : '1. Thank promoters and request referrals'],
    [detractors > 0 ? '2. Analyze detractor feedback for patterns' : '2. Maintain current engagement'],
    ['3. [REVIEW NEEDED] Review individual comments for themes'],
    [''],
    ['DETRACTOR FOLLOW-UP LIST'],
    ['Name', 'Score', 'Date', 'Status']
  ];

  // Add detractor details
  responses.forEach(row => {
    const score = parseInt(row[headers.indexOf('Score')]) || 0;
    if (score < 7) {
      analysisData.push([
        row[headers.indexOf('Name')] || 'Anonymous',
        score,
        row[headers.indexOf('Date')] || '',
        '[REVIEW NEEDED] Needs follow-up'
      ]);
    }
  });

  analysisSheet.getRange(1, 1, analysisData.length, 4).setValues(analysisData);

  // Format headers
  analysisSheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  analysisSheet.getRange('A5').setFontWeight('bold');
  analysisSheet.getRange('A12').setFontWeight('bold');
  analysisSheet.getRange('A16').setFontWeight('bold');

  // Save to database if configured
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) {
    saveToDatabase(npsScore, promoters, passives, detractors);
  }

  SpreadsheetApp.getUi().alert('NPS Analysis complete! Check the "' + CONFIG.ANALYSIS_SHEET_NAME + '" sheet.');
}

/**
 * Save NPS data to Supabase database
 */
function saveToDatabase(npsScore, promoters, passives, detractors) {
  const payload = {
    customer_id: CONFIG.CUSTOMER_ID,
    nps_score: npsScore,
    promoters: promoters,
    passives: passives,
    detractors: detractors,
    analyzed_at: new Date().toISOString()
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY
    },
    payload: JSON.stringify(payload)
  };

  try {
    UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/nps_scores', options);
    Logger.log('NPS data saved to database');
  } catch (e) {
    Logger.log('Failed to save to database: ' + e.message);
  }
}

/**
 * Create menu on spreadsheet open
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NPS Analysis')
    .addItem('Analyze Responses', 'analyzeNPSResponses')
    .addItem('Send Detractor Alerts', 'sendDetractorAlerts')
    .addToUi();
}

/**
 * Send email alerts for new detractors
 * [REVIEW NEEDED] Configure alert recipients
 */
function sendDetractorAlerts() {
  // Implementation for email alerts
  SpreadsheetApp.getUi().alert('[REVIEW NEEDED] Configure alert recipients in script.');
}
`,
      description: 'Analyzes NPS survey responses, calculates scores, identifies detractors, and saves insights to database.',
      setupInstructions: `1. Create a sheet named "NPS Responses" with columns: Name, Email, Score, Date, Comments
2. Go to Extensions > Apps Script
3. Paste this code
4. Set Script Properties: SUPABASE_URL, SUPABASE_KEY
5. Run onOpen() to create menu
6. Use menu "NPS Analysis > Analyze Responses"`,
      triggers: ['onOpen', 'analyzeNPSResponses'],
    },

    usage_dashboard: {
      code: `/**
 * [AI Generated] Usage Dashboard Script
 * Customer: ${customerName}
 * Generated: ${new Date().toISOString()}
 */

const CONFIG = {
  CUSTOMER_ID: '${customerId}',
  CUSTOMER_NAME: '${customerName}',
  API_ENDPOINT: PropertiesService.getScriptProperties().getProperty('API_ENDPOINT')
};

/**
 * Fetch and display usage metrics
 */
function refreshUsageDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashboard = ss.getSheetByName('Usage Dashboard');
  if (!dashboard) {
    dashboard = ss.insertSheet('Usage Dashboard');
  }

  // [AI Generated] Fetch metrics from API
  const metrics = fetchUsageMetrics();

  // Build dashboard
  const data = [
    ['[AI Generated] Usage Dashboard - ' + CONFIG.CUSTOMER_NAME],
    ['Last Updated', new Date().toLocaleString()],
    [''],
    ['KEY METRICS (30 Days)'],
    ['Average DAU', metrics.avgDAU || 0],
    ['Average WAU', metrics.avgWAU || 0],
    ['Average MAU', metrics.avgMAU || 0],
    ['Total Logins', metrics.totalLogins || 0],
    [''],
    ['[AI Generated] HEALTH INDICATORS'],
    ['Usage Health', metrics.avgDAU > 10 ? 'Healthy' : 'Needs Attention'],
    ['Trend', metrics.trend || 'Stable'],
    ['Risk Level', metrics.avgDAU < 5 ? 'High' : metrics.avgDAU < 10 ? 'Medium' : 'Low'],
    [''],
    ['[AI Generated] RECOMMENDATIONS'],
    ['[REVIEW NEEDED] Review trend and take action if declining'],
  ];

  dashboard.clear();
  dashboard.getRange(1, 1, data.length, 2).setValues(data);
  dashboard.getRange('A1').setFontWeight('bold').setFontSize(14);
}

function fetchUsageMetrics() {
  // [REVIEW NEEDED] Implement API call to your metrics endpoint
  return {
    avgDAU: 25,
    avgWAU: 100,
    avgMAU: 300,
    totalLogins: 1500,
    trend: 'Stable'
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Usage Dashboard')
    .addItem('Refresh Dashboard', 'refreshUsageDashboard')
    .addToUi();
}
`,
      description: 'Creates a usage metrics dashboard with health indicators and AI-generated recommendations.',
      setupInstructions: `1. Go to Extensions > Apps Script
2. Paste this code
3. Configure API_ENDPOINT in Script Properties
4. Run onOpen() to create menu`,
      triggers: ['onOpen', 'refreshUsageDashboard'],
    },

    health_calculator: {
      code: `/**
 * [AI Generated] Health Score Calculator
 * Customer: ${customerName}
 * Generated: ${new Date().toISOString()}
 *
 * Calculates composite health score from multiple signals.
 * Weights are configurable - [REVIEW NEEDED] adjust for your business.
 */

const CONFIG = {
  CUSTOMER_ID: '${customerId}',
  CUSTOMER_NAME: '${customerName}',
  // [REVIEW NEEDED] Adjust weights based on your business priorities
  WEIGHTS: {
    usage: 0.30,      // 30% - Product usage metrics
    engagement: 0.25, // 25% - Meeting/email engagement
    support: 0.20,    // 20% - Support ticket trends
    nps: 0.15,        // 15% - NPS/sentiment scores
    payment: 0.10     // 10% - Payment/billing health
  }
};

/**
 * Calculate composite health score
 */
function calculateHealthScore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let healthSheet = ss.getSheetByName('Health Score');
  if (!healthSheet) {
    healthSheet = ss.insertSheet('Health Score');
  }

  // Gather component scores
  const usageScore = calculateUsageScore();
  const engagementScore = calculateEngagementScore();
  const supportScore = calculateSupportScore();
  const npsScore = calculateNPSScore();
  const paymentScore = calculatePaymentScore();

  // Calculate weighted composite
  const compositeScore = Math.round(
    usageScore * CONFIG.WEIGHTS.usage +
    engagementScore * CONFIG.WEIGHTS.engagement +
    supportScore * CONFIG.WEIGHTS.support +
    npsScore * CONFIG.WEIGHTS.nps +
    paymentScore * CONFIG.WEIGHTS.payment
  );

  // Determine health color
  const healthColor = compositeScore >= 80 ? 'Green' :
                      compositeScore >= 60 ? 'Yellow' : 'Red';

  // [AI Generated] Risk assessment
  const riskLevel = compositeScore >= 80 ? 'Low' :
                    compositeScore >= 60 ? 'Medium' : 'High';

  const data = [
    ['[AI Generated] Health Score Report'],
    ['Customer', CONFIG.CUSTOMER_NAME],
    ['Calculated', new Date().toLocaleString()],
    [''],
    ['COMPOSITE HEALTH SCORE', compositeScore],
    ['Health Color', healthColor],
    ['Risk Level', riskLevel],
    [''],
    ['COMPONENT SCORES', 'Score', 'Weight', 'Weighted'],
    ['Usage', usageScore, CONFIG.WEIGHTS.usage * 100 + '%', Math.round(usageScore * CONFIG.WEIGHTS.usage)],
    ['Engagement', engagementScore, CONFIG.WEIGHTS.engagement * 100 + '%', Math.round(engagementScore * CONFIG.WEIGHTS.engagement)],
    ['Support', supportScore, CONFIG.WEIGHTS.support * 100 + '%', Math.round(supportScore * CONFIG.WEIGHTS.support)],
    ['NPS/Sentiment', npsScore, CONFIG.WEIGHTS.nps * 100 + '%', Math.round(npsScore * CONFIG.WEIGHTS.nps)],
    ['Payment', paymentScore, CONFIG.WEIGHTS.payment * 100 + '%', Math.round(paymentScore * CONFIG.WEIGHTS.payment)],
    [''],
    ['[AI Generated] INSIGHTS'],
    [compositeScore < 60 ? 'ALERT: Customer at risk - immediate action needed' : 'Customer health is stable'],
    ['Lowest component: ' + getLowestComponent(usageScore, engagementScore, supportScore, npsScore, paymentScore)],
    ['[REVIEW NEEDED] Validate scores and take action on low components'],
  ];

  healthSheet.clear();
  healthSheet.getRange(1, 1, data.length, 4).setValues(data);

  // Color the health score cell
  const colorMap = { 'Green': '#00ff00', 'Yellow': '#ffff00', 'Red': '#ff0000' };
  healthSheet.getRange('B6').setBackground(colorMap[healthColor]);

  // Save to database
  saveHealthScore(compositeScore, healthColor, {
    usage: usageScore,
    engagement: engagementScore,
    support: supportScore,
    nps: npsScore,
    payment: paymentScore
  });

  return compositeScore;
}

// [REVIEW NEEDED] Implement these based on your data sources
function calculateUsageScore() { return 75; }
function calculateEngagementScore() { return 80; }
function calculateSupportScore() { return 85; }
function calculateNPSScore() { return 70; }
function calculatePaymentScore() { return 100; }

function getLowestComponent(usage, engagement, support, nps, payment) {
  const scores = { Usage: usage, Engagement: engagement, Support: support, NPS: nps, Payment: payment };
  return Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];
}

function saveHealthScore(score, color, components) {
  Logger.log('Health score saved: ' + score + ' (' + color + ')');
  // [REVIEW NEEDED] Add database save logic
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Health Score')
    .addItem('Calculate Health Score', 'calculateHealthScore')
    .addToUi();
}
`,
      description: 'Calculates composite health scores from usage, engagement, support, NPS, and payment signals.',
      setupInstructions: `1. Create data sheets for each component (Usage, Support Tickets, etc.)
2. Go to Extensions > Apps Script
3. Paste and customize the calculate* functions
4. Adjust WEIGHTS in CONFIG based on your priorities
5. Run calculateHealthScore() from menu`,
      triggers: ['onOpen', 'calculateHealthScore'],
    },

    survey_processor: {
      code: `/**
 * [AI Generated] Survey Response Processor
 * Customer: ${customerName}
 * Generated: ${new Date().toISOString()}
 *
 * Processes survey responses from Google Forms and generates insights.
 */

const CONFIG = {
  CUSTOMER_ID: '${customerId}',
  CUSTOMER_NAME: '${customerName}',
  FORM_RESPONSES_SHEET: 'Form Responses 1',
  ANALYSIS_SHEET: 'Survey Analysis'
};

/**
 * Process survey responses and generate insights
 */
function processSurveyResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responsesSheet = ss.getSheetByName(CONFIG.FORM_RESPONSES_SHEET);

  if (!responsesSheet) {
    SpreadsheetApp.getUi().alert('Form responses sheet not found!');
    return;
  }

  const data = responsesSheet.getDataRange().getValues();
  const headers = data[0];
  const responses = data.slice(1);

  // Analyze responses
  const analysis = analyzeResponses(headers, responses);

  // Create analysis sheet
  let analysisSheet = ss.getSheetByName(CONFIG.ANALYSIS_SHEET);
  if (!analysisSheet) {
    analysisSheet = ss.insertSheet(CONFIG.ANALYSIS_SHEET);
  }

  const output = [
    ['[AI Generated] Survey Analysis Report'],
    ['Customer', CONFIG.CUSTOMER_NAME],
    ['Total Responses', responses.length],
    ['Analysis Date', new Date().toLocaleString()],
    [''],
    ['RESPONSE SUMMARY'],
    ...analysis.summary,
    [''],
    ['[AI Generated] KEY THEMES'],
    ...analysis.themes.map(t => [t]),
    [''],
    ['[AI Generated] SENTIMENT ANALYSIS'],
    ['Overall Sentiment', analysis.sentiment],
    ['Positive Responses', analysis.sentimentBreakdown.positive + '%'],
    ['Neutral Responses', analysis.sentimentBreakdown.neutral + '%'],
    ['Negative Responses', analysis.sentimentBreakdown.negative + '%'],
    [''],
    ['[AI Generated] RECOMMENDED ACTIONS'],
    ...analysis.recommendations.map(r => [r]),
    [''],
    ['[REVIEW NEEDED] Manual Review Items'],
    ['- Review free-text responses for nuance'],
    ['- Validate AI-identified themes'],
    ['- Prioritize actions based on business context'],
  ];

  analysisSheet.clear();
  analysisSheet.getRange(1, 1, output.length, 2).setValues(output);

  SpreadsheetApp.getUi().alert('Survey analysis complete!');
}

function analyzeResponses(headers, responses) {
  // [AI Generated] Basic analysis logic
  const numericColumns = [];
  const textColumns = [];

  headers.forEach((h, i) => {
    if (i === 0) return; // Skip timestamp
    const values = responses.map(r => r[i]);
    const isNumeric = values.every(v => !isNaN(v) && v !== '');
    if (isNumeric) {
      numericColumns.push({ name: h, index: i, values: values.map(Number) });
    } else {
      textColumns.push({ name: h, index: i, values });
    }
  });

  // Generate summary
  const summary = numericColumns.map(col => {
    const avg = col.values.reduce((a, b) => a + b, 0) / col.values.length;
    return [col.name, 'Avg: ' + avg.toFixed(1)];
  });

  // [AI Generated] Theme extraction (simplified)
  const allText = textColumns.flatMap(c => c.values).join(' ').toLowerCase();
  const themes = [];
  if (allText.includes('easy') || allText.includes('simple')) themes.push('Ease of use mentioned positively');
  if (allText.includes('difficult') || allText.includes('confus')) themes.push('[ALERT] Difficulty/confusion mentioned');
  if (allText.includes('support') || allText.includes('help')) themes.push('Support experience mentioned');
  if (allText.includes('feature') || allText.includes('add')) themes.push('Feature requests present');
  if (themes.length === 0) themes.push('[REVIEW NEEDED] No clear themes - manual review suggested');

  // [AI Generated] Sentiment (simplified)
  const positiveWords = ['great', 'excellent', 'love', 'amazing', 'helpful', 'easy'];
  const negativeWords = ['bad', 'poor', 'difficult', 'frustrat', 'confus', 'slow'];

  let positive = 0, negative = 0, neutral = 0;
  responses.forEach(r => {
    const text = r.join(' ').toLowerCase();
    const posCount = positiveWords.filter(w => text.includes(w)).length;
    const negCount = negativeWords.filter(w => text.includes(w)).length;
    if (posCount > negCount) positive++;
    else if (negCount > posCount) negative++;
    else neutral++;
  });

  const total = responses.length || 1;

  return {
    summary,
    themes,
    sentiment: positive > negative ? 'Positive' : negative > positive ? 'Negative' : 'Neutral',
    sentimentBreakdown: {
      positive: Math.round(positive / total * 100),
      neutral: Math.round(neutral / total * 100),
      negative: Math.round(negative / total * 100)
    },
    recommendations: [
      positive > negative ? '1. Share positive feedback with team' : '1. Address negative feedback urgently',
      themes.some(t => t.includes('feature')) ? '2. Review feature requests with product team' : '2. Continue current product direction',
      '3. [REVIEW NEEDED] Schedule follow-up with key respondents'
    ]
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Survey Analysis')
    .addItem('Process Responses', 'processSurveyResponses')
    .addToUi();
}
`,
      description: 'Processes Google Form survey responses, extracts themes, analyzes sentiment, and generates recommendations.',
      setupInstructions: `1. Link your Google Form to this spreadsheet
2. Go to Extensions > Apps Script
3. Paste this code
4. Run processSurveyResponses() after collecting responses
5. Review the Analysis sheet for insights`,
      triggers: ['onOpen', 'processSurveyResponses'],
    },

    renewal_alerts: {
      code: `/**
 * [AI Generated] Renewal Alert System
 * Customer: ${customerName}
 * Generated: ${new Date().toISOString()}
 *
 * Monitors renewal dates and sends automated alerts.
 */

const CONFIG = {
  CUSTOMER_ID: '${customerId}',
  CUSTOMER_NAME: '${customerName}',
  RENEWALS_SHEET: 'Renewals',
  // [REVIEW NEEDED] Configure alert recipients
  ALERT_RECIPIENTS: ['csm@company.com'],
  // Days before renewal to send alerts
  ALERT_DAYS: [90, 60, 30, 14, 7]
};

/**
 * Check renewals and send alerts
 */
function checkRenewalsAndAlert() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const renewalsSheet = ss.getSheetByName(CONFIG.RENEWALS_SHEET);

  if (!renewalsSheet) {
    Logger.log('Renewals sheet not found');
    return;
  }

  const data = renewalsSheet.getDataRange().getValues();
  const headers = data[0];
  const renewals = data.slice(1);

  const today = new Date();
  const alerts = [];

  renewals.forEach((row, index) => {
    const customerName = row[headers.indexOf('Customer')];
    const renewalDate = new Date(row[headers.indexOf('Renewal Date')]);
    const arr = row[headers.indexOf('ARR')] || 0;
    const healthScore = row[headers.indexOf('Health Score')] || 'N/A';

    const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

    // Check if we should alert
    if (CONFIG.ALERT_DAYS.includes(daysUntilRenewal)) {
      alerts.push({
        customer: customerName,
        renewalDate: renewalDate.toLocaleDateString(),
        daysUntil: daysUntilRenewal,
        arr: arr,
        healthScore: healthScore,
        urgency: daysUntilRenewal <= 14 ? 'HIGH' : daysUntilRenewal <= 30 ? 'MEDIUM' : 'LOW'
      });
    }
  });

  if (alerts.length > 0) {
    sendAlertEmail(alerts);
    logAlerts(alerts);
  }

  Logger.log('Checked ' + renewals.length + ' renewals, sent ' + alerts.length + ' alerts');
}

/**
 * Send alert email
 */
function sendAlertEmail(alerts) {
  const subject = '[AI Generated] Renewal Alerts - ' + alerts.length + ' renewals need attention';

  let body = '<h2>[AI Generated] Renewal Alert Summary</h2>';
  body += '<p>The following renewals need attention:</p>';
  body += '<table border="1" style="border-collapse: collapse;">';
  body += '<tr><th>Customer</th><th>Renewal Date</th><th>Days Until</th><th>ARR</th><th>Health</th><th>Urgency</th></tr>';

  alerts.forEach(a => {
    const urgencyColor = a.urgency === 'HIGH' ? '#ff0000' : a.urgency === 'MEDIUM' ? '#ffaa00' : '#00aa00';
    body += '<tr>';
    body += '<td>' + a.customer + '</td>';
    body += '<td>' + a.renewalDate + '</td>';
    body += '<td>' + a.daysUntil + '</td>';
    body += '<td>$' + (a.arr / 1000).toFixed(0) + 'K</td>';
    body += '<td>' + a.healthScore + '</td>';
    body += '<td style="background-color:' + urgencyColor + ';color:white;">' + a.urgency + '</td>';
    body += '</tr>';
  });

  body += '</table>';
  body += '<br><p>[AI Generated] Recommended Actions:</p><ul>';

  alerts.filter(a => a.urgency === 'HIGH').forEach(a => {
    body += '<li><strong>' + a.customer + '</strong>: Immediate outreach required - ' + a.daysUntil + ' days remaining</li>';
  });

  body += '</ul>';
  body += '<p style="color:gray;">[REVIEW NEEDED] Validate health scores and prioritize outreach</p>';

  CONFIG.ALERT_RECIPIENTS.forEach(recipient => {
    GmailApp.sendEmail(recipient, subject, '', { htmlBody: body });
  });
}

function logAlerts(alerts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('Alert Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Alert Log');
    logSheet.appendRow(['Timestamp', 'Customer', 'Days Until Renewal', 'Urgency', 'Alert Sent']);
  }

  alerts.forEach(a => {
    logSheet.appendRow([new Date(), a.customer, a.daysUntil, a.urgency, 'Yes']);
  });
}

/**
 * Set up daily trigger
 */
function setupDailyTrigger() {
  // Remove existing triggers
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkRenewalsAndAlert') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Create new daily trigger at 9 AM
  ScriptApp.newTrigger('checkRenewalsAndAlert')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert('Daily renewal check scheduled for 9 AM');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Renewal Alerts')
    .addItem('Check Now', 'checkRenewalsAndAlert')
    .addItem('Setup Daily Alert', 'setupDailyTrigger')
    .addToUi();
}
`,
      description: 'Monitors renewal dates and sends automated email alerts at 90/60/30/14/7 days before renewal.',
      setupInstructions: `1. Create a "Renewals" sheet with columns: Customer, Renewal Date, ARR, Health Score
2. Go to Extensions > Apps Script
3. Paste this code
4. Update ALERT_RECIPIENTS in CONFIG
5. Run setupDailyTrigger() to enable automated alerts`,
      triggers: ['onOpen', 'checkRenewalsAndAlert', 'setupDailyTrigger'],
    },
  };

  return scripts[scriptType] || scripts.nps_analysis;
}

// ============================================
// EXPORT HELPERS
// ============================================

export function formatEnhancedOutput(enhanced: EnhancedOutput): string {
  let output = '';

  enhanced.sections.forEach(section => {
    output += section.content + '\n\n';
  });

  output += '\n---\n';
  output += `*Generated: ${enhanced.metadata.generatedAt}*\n`;
  if (enhanced.metadata.knowledgeBaseSources.length > 0) {
    output += `*Knowledge Base Sources: ${enhanced.metadata.knowledgeBaseSources.join(', ')}*\n`;
  }
  output += '*AI-generated content should be reviewed by CSM before use.*\n';

  return output;
}
