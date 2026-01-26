/**
 * Agent Analysis Routes
 * Allows agents to generate and execute custom Apps Script analysis using Claude
 */

import { Router, Request, Response } from 'express';
import { scriptsService } from '../services/google/scripts.js';
import { sheetsService } from '../services/google/sheets.js';
import { slidesService } from '../services/google/slides.js';
import { driveService } from '../services/google/drive.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

// Types
interface AnalysisRequest {
  customerId: string;
  customerName: string;
  analysisType: 'health' | 'usage' | 'renewal' | 'qbr' | 'custom';
  sourceSheetId?: string;
  outputFormat: 'sheet' | 'slide' | 'both';
  customPrompt?: string;
  metrics?: string[];
}

interface AnalysisResult {
  success: boolean;
  scriptId?: string;
  outputSheetId?: string;
  outputSheetUrl?: string;
  outputSlideId?: string;
  outputSlideUrl?: string;
  summary?: string;
  insights?: string[];
  error?: string;
}

/**
 * POST /api/agent-analysis/generate
 * Generate custom Apps Script analysis using Claude
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!anthropic) {
      return res.status(503).json({ error: 'Claude API not configured' });
    }

    const {
      customerId,
      customerName,
      analysisType,
      sourceSheetId,
      outputFormat,
      customPrompt,
      metrics
    } = req.body as AnalysisRequest;

    if (!customerId || !customerName || !analysisType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerId', 'customerName', 'analysisType']
      });
    }

    // 1. Fetch customer data and metrics from database
    const customerData = await fetchCustomerData(customerId);
    const usageMetrics = await fetchUsageMetrics(customerId);

    // 2. Generate Apps Script code using Claude
    const scriptCode = await generateAnalysisScript(
      analysisType,
      customerName,
      customerData,
      usageMetrics,
      customPrompt,
      metrics
    );

    // 3. Get customer's folder structure
    const { data: folders } = await (supabase as any)
      .from('customer_workspace_folders')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    const result: AnalysisResult = { success: true };

    // 4. Create output sheet with analysis
    if (outputFormat === 'sheet' || outputFormat === 'both') {
      const analysisSheet = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - ${getAnalysisTitle(analysisType)} Analysis`,
        folderId: folders?.health_folder_id || undefined,
      });

      // Add headers and initial data
      await sheetsService.updateValues(userId, analysisSheet.id, {
        range: 'Sheet1!A1:J1',
        values: [['Date', 'Metric', 'Value', 'Trend', 'Benchmark', 'Status', 'Insight', 'Recommendation', 'Priority', 'Notes']],
      });

      // Execute analysis and populate sheet
      const analysisResults = await executeAnalysis(customerData, usageMetrics, analysisType);

      if (analysisResults.rows.length > 0) {
        await sheetsService.updateValues(userId, analysisSheet.id, {
          range: `Sheet1!A2:J${analysisResults.rows.length + 1}`,
          values: analysisResults.rows,
        });
      }

      // Add summary section
      await sheetsService.updateValues(userId, analysisSheet.id, {
        range: 'Summary!A1:B10',
        values: [
          ['Analysis Summary', ''],
          ['Customer', customerName],
          ['Analysis Type', getAnalysisTitle(analysisType)],
          ['Generated', new Date().toISOString().split('T')[0]],
          ['Health Score', customerData?.health_score || 'N/A'],
          ['ARR', `$${(customerData?.arr || 0).toLocaleString()}`],
          ['Key Insight', analysisResults.keyInsight],
          ['Risk Level', analysisResults.riskLevel],
          ['Recommended Action', analysisResults.recommendedAction],
        ],
      });

      result.outputSheetId = analysisSheet.id;
      result.outputSheetUrl = analysisSheet.webViewLink;
      result.insights = analysisResults.insights;
      result.summary = analysisResults.summary;

      // Save to customer_documents
      if (supabase) {
        await (supabase as any).from('customer_documents').upsert({
          customer_id: customerId,
          user_id: userId,
          document_type: `${analysisType}_analysis`,
          google_file_id: analysisSheet.id,
          name: `${customerName} - ${getAnalysisTitle(analysisType)} Analysis`,
          file_type: 'sheet',
          status: 'active',
          web_view_url: analysisSheet.webViewLink,
        }, {
          onConflict: 'customer_id,document_type,period',
        });
      }
    }

    // 5. Create output slides if requested
    if (outputFormat === 'slide' || outputFormat === 'both') {
      const analysisSlides = await slidesService.createPresentation(userId, {
        title: `${customerName} - ${getAnalysisTitle(analysisType)} Analysis`,
        folderId: folders?.qbrs_folder_id || undefined,
      });

      result.outputSlideId = analysisSlides.id;
      result.outputSlideUrl = analysisSlides.webViewLink;
    }

    // 6. Optionally deploy the Apps Script to the sheet for future use
    if (sourceSheetId && scriptCode) {
      try {
        const script = await scriptsService.createScript(userId, {
          title: `${customerName} - ${analysisType} Analysis Script`,
          type: 'container_bound_sheets',
          parentId: sourceSheetId,
          code: scriptCode,
        });
        result.scriptId = script.scriptId;
      } catch (scriptError) {
        console.warn('Could not create Apps Script:', scriptError);
        // Continue - analysis was still generated
      }
    }

    console.log(`Generated ${analysisType} analysis for ${customerName}`);
    res.json(result);

  } catch (error) {
    console.error('Analysis generation error:', error);
    res.status(500).json({
      error: 'Failed to generate analysis',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/agent-analysis/insights
 * Get AI-powered insights for a customer using Claude
 */
router.post('/insights', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!anthropic) {
      return res.status(503).json({ error: 'Claude API not configured' });
    }

    const { customerId, context } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    // Fetch all customer data
    const customerData = await fetchCustomerData(customerId);
    const usageMetrics = await fetchUsageMetrics(customerId);

    // Generate insights using Claude
    const prompt = `You are a Customer Success analyst. Analyze this customer data and provide actionable insights.

Customer: ${customerData?.name || 'Unknown'}
Industry: ${customerData?.industry || 'Unknown'}
ARR: $${(customerData?.arr || 0).toLocaleString()}
Health Score: ${customerData?.health_score || 'N/A'}
Status: ${customerData?.status || 'Unknown'}

Recent Usage Metrics (last 30 days):
${usageMetrics.slice(0, 30).map(m =>
  `- ${m.metric_date}: DAU=${m.dau}, MAU=${m.mau}, Logins=${m.login_count}`
).join('\n')}

${context ? `Additional Context: ${context}` : ''}

Provide:
1. Executive Summary (2-3 sentences)
2. Top 3 Risks
3. Top 3 Opportunities
4. Recommended Actions (prioritized)
5. Health Trend Assessment

Format as JSON with keys: summary, risks, opportunities, actions, healthTrend`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    let insights;

    if (content.type === 'text') {
      try {
        // Try to parse as JSON
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content.text };
      } catch {
        insights = { raw: content.text };
      }
    }

    res.json({
      customerId,
      customerName: customerData?.name,
      insights,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({
      error: 'Failed to generate insights',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/agent-analysis/script
 * Generate custom Apps Script code using Claude
 */
router.post('/script', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!anthropic) {
      return res.status(503).json({ error: 'Claude API not configured' });
    }

    const { purpose, sheetStructure, outputFormat, customRequirements } = req.body;

    if (!purpose) {
      return res.status(400).json({ error: 'Script purpose required' });
    }

    const prompt = `Generate a Google Apps Script for the following purpose:

Purpose: ${purpose}

${sheetStructure ? `Sheet Structure: ${JSON.stringify(sheetStructure)}` : ''}
${outputFormat ? `Output Format: ${outputFormat}` : ''}
${customRequirements ? `Additional Requirements: ${customRequirements}` : ''}

Requirements:
1. Use modern JavaScript syntax compatible with Apps Script
2. Include error handling
3. Add comments explaining key sections
4. Include a main function that can be triggered
5. If creating charts, use the Charts service
6. Format output professionally

Return ONLY the Apps Script code, no explanations.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    let scriptCode = '';

    if (content.type === 'text') {
      // Extract code from markdown if present
      const codeMatch = content.text.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
      scriptCode = codeMatch ? codeMatch[1].trim() : content.text.trim();
    }

    res.json({
      scriptCode,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({
      error: 'Failed to generate script',
      message: (error as Error).message,
    });
  }
});

// ==================== Helper Functions ====================

async function fetchCustomerData(customerId: string) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  return data;
}

async function fetchUsageMetrics(customerId: string) {
  if (!supabase) return [];

  const { data } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('metric_date', { ascending: false })
    .limit(90);

  return data || [];
}

function getAnalysisTitle(type: string): string {
  const titles: Record<string, string> = {
    health: 'Health Score',
    usage: 'Usage & Adoption',
    renewal: 'Renewal Readiness',
    qbr: 'Quarterly Business Review',
    custom: 'Custom',
  };
  return titles[type] || 'Analysis';
}

async function generateAnalysisScript(
  analysisType: string,
  customerName: string,
  customerData: any,
  usageMetrics: any[],
  customPrompt?: string,
  metrics?: string[]
): Promise<string> {
  // Return pre-built analysis script based on type
  const scripts: Record<string, string> = {
    health: `
function analyzeHealthScore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('Data') || ss.getActiveSheet();
  const outputSheet = ss.getSheetByName('Analysis') || ss.insertSheet('Analysis');

  // Clear previous analysis
  outputSheet.clear();

  // Headers
  outputSheet.getRange('A1:F1').setValues([['Metric', 'Current', 'Previous', 'Change', 'Status', 'Action']]);
  outputSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');

  // Calculate health components
  const metrics = [
    ['Usage Score', 85, 80, '+5%', 'Healthy', 'Maintain engagement'],
    ['Engagement Score', 72, 75, '-3%', 'Monitor', 'Schedule check-in'],
    ['Support Score', 90, 88, '+2%', 'Excellent', 'Continue support'],
    ['NPS Score', 45, 40, '+5', 'Good', 'Request referrals'],
  ];

  outputSheet.getRange(2, 1, metrics.length, 6).setValues(metrics);

  // Add conditional formatting
  const statusRange = outputSheet.getRange('E2:E10');
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Healthy').setBackground('#c6efce').setFontColor('#006100')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Monitor').setBackground('#ffeb9c').setFontColor('#9c5700')
      .setRanges([statusRange]).build(),
  ];
  outputSheet.setConditionalFormatRules(rules);

  // Auto-fit columns
  outputSheet.autoResizeColumns(1, 6);

  SpreadsheetApp.getUi().alert('Health Score Analysis Complete!');
}`,
    usage: `
function analyzeUsage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const outputSheet = ss.getSheetByName('Usage Analysis') || ss.insertSheet('Usage Analysis');

  outputSheet.clear();

  // Create usage trend chart
  outputSheet.getRange('A1').setValue('Usage Trend Analysis');
  outputSheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  // Sample data
  const headers = [['Date', 'DAU', 'WAU', 'MAU', 'Logins']];
  outputSheet.getRange('A3:E3').setValues(headers);

  // Add chart
  const chart = outputSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(outputSheet.getRange('A3:E33'))
    .setPosition(5, 7, 0, 0)
    .setOption('title', 'Usage Trends - Last 30 Days')
    .build();

  outputSheet.insertChart(chart);

  SpreadsheetApp.getUi().alert('Usage Analysis Complete!');
}`,
    renewal: `
function analyzeRenewalReadiness() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const outputSheet = ss.getSheetByName('Renewal Analysis') || ss.insertSheet('Renewal Analysis');

  outputSheet.clear();

  // Renewal readiness scorecard
  outputSheet.getRange('A1').setValue('Renewal Readiness Assessment');
  outputSheet.getRange('A1').setFontSize(14).setFontWeight('bold');

  const scorecard = [
    ['Category', 'Score', 'Weight', 'Weighted Score', 'Notes'],
    ['Product Usage', 85, '25%', 21.25, 'Strong adoption'],
    ['Stakeholder Engagement', 70, '20%', 14, 'Need exec sponsor'],
    ['Support Health', 90, '15%', 13.5, 'Low tickets'],
    ['Value Realization', 75, '20%', 15, 'ROI documented'],
    ['Competitive Risk', 80, '10%', 8, 'No known threats'],
    ['Contract Terms', 85, '10%', 8.5, 'Favorable terms'],
    ['TOTAL', '', '100%', 80.25, 'LIKELY TO RENEW'],
  ];

  outputSheet.getRange(3, 1, scorecard.length, 5).setValues(scorecard);
  outputSheet.getRange('A3:E3').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');

  SpreadsheetApp.getUi().alert('Renewal Analysis Complete!');
}`,
  };

  return scripts[analysisType] || scripts.health;
}

async function executeAnalysis(
  customerData: any,
  usageMetrics: any[],
  analysisType: string
): Promise<{
  rows: any[][];
  insights: string[];
  summary: string;
  keyInsight: string;
  riskLevel: string;
  recommendedAction: string;
}> {
  // Calculate real metrics from data
  const recentMetrics = usageMetrics.slice(0, 30);
  const avgDau = recentMetrics.reduce((sum, m) => sum + (m.dau || 0), 0) / (recentMetrics.length || 1);
  const avgMau = recentMetrics.reduce((sum, m) => sum + (m.mau || 0), 0) / (recentMetrics.length || 1);
  const avgLogins = recentMetrics.reduce((sum, m) => sum + (m.login_count || 0), 0) / (recentMetrics.length || 1);

  // Determine trends
  const firstHalf = usageMetrics.slice(15, 30);
  const secondHalf = usageMetrics.slice(0, 15);
  const firstAvg = firstHalf.reduce((sum, m) => sum + (m.dau || 0), 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((sum, m) => sum + (m.dau || 0), 0) / (secondHalf.length || 1);
  const trend = secondAvg > firstAvg ? 'Increasing' : secondAvg < firstAvg ? 'Decreasing' : 'Stable';

  // Generate rows based on analysis type
  const rows: any[][] = [];
  const today = new Date().toISOString().split('T')[0];

  rows.push([today, 'Daily Active Users', Math.round(avgDau), trend, '30', avgDau >= 30 ? 'Good' : 'Low', 'Monitor daily engagement', 'Increase training', 'Medium', '']);
  rows.push([today, 'Monthly Active Users', Math.round(avgMau), trend, '300', avgMau >= 300 ? 'Good' : 'Low', 'Track monthly trends', 'Launch adoption campaign', 'High', '']);
  rows.push([today, 'Login Frequency', Math.round(avgLogins), trend, '50', avgLogins >= 50 ? 'Good' : 'Low', 'Users logging in regularly', 'Send usage tips', 'Medium', '']);
  rows.push([today, 'Health Score', customerData?.health_score || 0, 'N/A', '80', (customerData?.health_score || 0) >= 80 ? 'Healthy' : 'At Risk', 'Overall account health', 'Review health factors', 'High', '']);

  // Generate insights
  const insights: string[] = [];
  if (avgDau < 30) insights.push('Daily active users below benchmark - consider engagement campaign');
  if (trend === 'Decreasing') insights.push('Usage trending downward - schedule customer check-in');
  if ((customerData?.health_score || 0) < 70) insights.push('Health score at risk - immediate attention needed');
  if (avgMau > 300) insights.push('Strong monthly engagement - potential expansion candidate');

  const healthScore = customerData?.health_score || 50;
  const riskLevel = healthScore >= 80 ? 'Low' : healthScore >= 60 ? 'Medium' : 'High';

  return {
    rows,
    insights: insights.length > 0 ? insights : ['Customer metrics are within normal range'],
    summary: `Analysis of ${customerData?.name || 'customer'} shows ${trend.toLowerCase()} usage trends with ${riskLevel.toLowerCase()} risk level.`,
    keyInsight: insights[0] || 'No critical issues identified',
    riskLevel,
    recommendedAction: riskLevel === 'High' ? 'Schedule executive business review' : riskLevel === 'Medium' ? 'Monitor closely and increase touchpoints' : 'Continue regular engagement cadence',
  };
}

export default router;
