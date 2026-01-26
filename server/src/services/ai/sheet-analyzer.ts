/**
 * AI Sheet Analyzer Service
 * Claude-powered analysis of Google Sheets data
 * Alternative to AppScript for data analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { sheetsService } from '../google/sheets.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Analysis types supported
export type AnalysisType =
  | 'health_score'
  | 'renewal_risk'
  | 'usage_trends'
  | 'qbr_prep'
  | 'nps_analysis'
  | 'weekly_digest'
  | 'adoption_metrics'
  | 'churn_prediction'
  | 'custom';

export interface AnalysisRequest {
  userId: string;
  spreadsheetId: string;
  sheetName?: string;
  analysisType: AnalysisType;
  customPrompt?: string;
  options?: {
    includeRecommendations?: boolean;
    includeTrends?: boolean;
    includeAlerts?: boolean;
    timeRange?: 'week' | 'month' | 'quarter' | 'year';
  };
}

export interface AnalysisResult {
  success: boolean;
  analysisType: AnalysisType;
  summary: string;
  insights: AnalysisInsight[];
  recommendations: string[];
  alerts: AnalysisAlert[];
  metrics: Record<string, number | string>;
  rawAnalysis?: string;
  generatedAt: Date;
  dataPoints: number;
}

export interface AnalysisInsight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

export interface AnalysisAlert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedItems?: string[];
  recommendedAction?: string;
}

// Analysis prompts for each type
const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  health_score: `Analyze this customer health score data and provide:
1. Overall portfolio health assessment
2. Distribution of health scores (A/B/C/D/F grades)
3. Customers at risk (score < 70)
4. Top performing customers
5. Key factors driving low scores
6. Specific recommendations for improving at-risk customers
7. Trends if historical data is available`,

  renewal_risk: `Analyze this renewal data and provide:
1. Renewals coming up in next 30/60/90 days
2. At-risk renewals (based on health score, engagement, or other signals)
3. Total ARR at risk
4. Recommended actions for each at-risk renewal
5. Expansion opportunities among healthy renewals
6. Prioritized action list for CSM team`,

  usage_trends: `Analyze this usage/engagement data and provide:
1. Overall usage trends (increasing, stable, declining)
2. DAU/WAU/MAU ratios and what they indicate
3. Customers with declining usage (churn risk)
4. Customers with growing usage (expansion opportunity)
5. Feature adoption patterns
6. Recommendations for improving engagement
7. Specific customers needing immediate attention`,

  qbr_prep: `Prepare a QBR analysis based on this data:
1. Executive summary of customer performance
2. Key metrics and KPIs achieved
3. Usage and adoption statistics
4. Support ticket trends
5. Value delivered vs. expected outcomes
6. Risks and concerns to address
7. Expansion and upsell opportunities
8. Recommended discussion points
9. Action items for next quarter`,

  nps_analysis: `Analyze this NPS survey data and provide:
1. Overall NPS score and breakdown (Promoters/Passives/Detractors)
2. Trend over time if available
3. Common themes in feedback
4. Detractors requiring immediate follow-up
5. Promoters to engage for testimonials/referrals
6. Specific improvements suggested by customers
7. Correlation with other metrics (usage, health score)`,

  weekly_digest: `Create a weekly CSM digest from this data:
1. Portfolio health snapshot
2. Key wins this week
3. Accounts needing attention
4. Upcoming renewals
5. Open support escalations
6. Scheduled meetings and follow-ups
7. Priority actions for next week
8. Team performance metrics`,

  adoption_metrics: `Analyze feature adoption and provide:
1. Overall adoption rate by feature
2. Customers with low adoption (training needed)
3. Power users and champions
4. Features with poor adoption (product feedback)
5. Adoption trends over time
6. Recommendations for improving adoption
7. Training priorities`,

  churn_prediction: `Analyze for churn risk indicators:
1. Customers showing churn signals
2. Risk factors identified (low usage, declining health, support issues)
3. Time-based churn probability
4. ARR at risk
5. Recommended save plays for each at-risk customer
6. Early warning indicators to monitor
7. Success stories of saved accounts (if available)`,

  custom: `Analyze this data based on the user's specific request.`,
};

class SheetAnalyzerService {
  /**
   * Fetch data from Google Sheet
   */
  private async fetchSheetData(
    userId: string,
    spreadsheetId: string,
    sheetName?: string
  ): Promise<{ headers: string[]; rows: any[][]; sheetName: string }> {
    try {
      // Get spreadsheet metadata to find sheet names
      const metadata = await sheetsService.getSpreadsheet(userId, spreadsheetId);
      const sheets = metadata.sheets || [];

      // Use provided sheet name or first sheet
      // Note: sheets array contains SheetTab objects with `title` property directly
      const targetSheet = sheetName
        ? sheets.find((s: any) => s.title === sheetName)
        : sheets[0];

      const actualSheetName = targetSheet?.title || 'Sheet1';

      // Fetch all data from the sheet
      const range = `${actualSheetName}!A1:ZZ1000`;
      const sheetData = await sheetsService.getValues(userId, spreadsheetId, range);

      if (!sheetData || !sheetData.values || sheetData.values.length === 0) {
        return { headers: [], rows: [], sheetName: actualSheetName };
      }

      const headers = sheetData.values[0] as string[];
      const rows = sheetData.values.slice(1);

      return { headers, rows, sheetName: actualSheetName };
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      const errorMessage = (error as Error).message;

      // Provide helpful error messages based on common issues
      if (errorMessage.includes('No Google connection') || errorMessage.includes('token')) {
        throw new Error('Google Workspace not connected. Please connect your Google account first.');
      }
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        throw new Error('Spreadsheet not found. Please check the spreadsheet ID or URL, and ensure you have access to the file.');
      }
      if (errorMessage.includes('permission') || errorMessage.includes('403')) {
        throw new Error('Permission denied. Please ensure you have access to this spreadsheet.');
      }

      throw new Error(`Failed to fetch sheet data: ${errorMessage}`);
    }
  }

  /**
   * Format sheet data for Claude analysis
   */
  private formatDataForAnalysis(
    headers: string[],
    rows: any[][],
    maxRows: number = 500
  ): string {
    // Limit rows for context window
    const limitedRows = rows.slice(0, maxRows);

    // Create markdown table
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of limitedRows) {
      const cells = headers.map((_, i) => {
        const val = row[i];
        if (val === null || val === undefined) return '';
        return String(val).substring(0, 100); // Truncate long values
      });
      table += '| ' + cells.join(' | ') + ' |\n';
    }

    return table;
  }

  /**
   * Run AI analysis on sheet data
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const { userId, spreadsheetId, sheetName, analysisType, customPrompt, options } = request;

    // Fetch sheet data
    const { headers, rows, sheetName: actualSheetName } = await this.fetchSheetData(
      userId,
      spreadsheetId,
      sheetName
    );

    if (rows.length === 0) {
      return {
        success: false,
        analysisType,
        summary: 'No data found in the sheet to analyze.',
        insights: [],
        recommendations: ['Add data to the sheet and try again.'],
        alerts: [],
        metrics: {},
        generatedAt: new Date(),
        dataPoints: 0,
      };
    }

    // Format data for analysis
    const formattedData = this.formatDataForAnalysis(headers, rows);

    // Build the analysis prompt
    const basePrompt = analysisType === 'custom' && customPrompt
      ? customPrompt
      : ANALYSIS_PROMPTS[analysisType];

    const systemPrompt = `You are an expert Customer Success analyst. Analyze the provided data and give actionable insights.

Your response MUST be valid JSON with this structure:
{
  "summary": "2-3 sentence executive summary",
  "insights": [
    {"title": "Insight title", "description": "Details", "impact": "high|medium|low", "category": "category name"}
  ],
  "recommendations": ["Actionable recommendation 1", "Recommendation 2"],
  "alerts": [
    {"severity": "critical|warning|info", "title": "Alert title", "description": "Details", "affectedItems": ["item1"], "recommendedAction": "What to do"}
  ],
  "metrics": {"metric_name": value, "another_metric": "string value"}
}

Be specific and actionable. Reference actual customer names and data points from the sheet.`;

    const userPrompt = `${basePrompt}

**Sheet: ${actualSheetName}**
**Data Points: ${rows.length} rows**

${formattedData}

${options?.includeRecommendations !== false ? 'Include specific, actionable recommendations.' : ''}
${options?.includeTrends ? 'Analyze trends over time if the data supports it.' : ''}
${options?.includeAlerts !== false ? 'Flag any critical issues or alerts.' : ''}

Respond with valid JSON only, no markdown code blocks.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Extract text response
      const textContent = response.content.find(c => c.type === 'text');
      const rawAnalysis = textContent?.text || '';

      // Parse JSON response
      let parsed: any;
      try {
        // Clean up response if it has markdown code blocks
        const cleanedResponse = rawAnalysis
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        parsed = JSON.parse(cleanedResponse);
      } catch (parseError) {
        // If parsing fails, create structured response from raw text
        console.warn('Failed to parse AI response as JSON, using raw text');
        parsed = {
          summary: rawAnalysis.substring(0, 500),
          insights: [],
          recommendations: [],
          alerts: [],
          metrics: {},
        };
      }

      return {
        success: true,
        analysisType,
        summary: parsed.summary || 'Analysis complete.',
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        alerts: parsed.alerts || [],
        metrics: parsed.metrics || {},
        rawAnalysis,
        generatedAt: new Date(),
        dataPoints: rows.length,
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      return {
        success: false,
        analysisType,
        summary: `Analysis failed: ${(error as Error).message}`,
        insights: [],
        recommendations: [],
        alerts: [
          {
            severity: 'critical',
            title: 'Analysis Failed',
            description: (error as Error).message,
            recommendedAction: 'Check your API keys and try again.',
          },
        ],
        metrics: {},
        generatedAt: new Date(),
        dataPoints: rows.length,
      };
    }
  }

  /**
   * Get available analysis types with descriptions
   */
  getAnalysisTypes(): { id: AnalysisType; name: string; description: string; icon: string }[] {
    return [
      {
        id: 'health_score',
        name: 'Health Score Analysis',
        description: 'Analyze customer health scores, identify at-risk accounts, and get improvement recommendations',
        icon: '💚',
      },
      {
        id: 'renewal_risk',
        name: 'Renewal Risk Analysis',
        description: 'Identify upcoming renewals, assess risk levels, and prioritize save plays',
        icon: '📅',
      },
      {
        id: 'usage_trends',
        name: 'Usage Trend Analysis',
        description: 'Analyze product usage patterns, identify declining engagement, and spot expansion opportunities',
        icon: '📈',
      },
      {
        id: 'qbr_prep',
        name: 'QBR Preparation',
        description: 'Generate comprehensive QBR insights, talking points, and value summaries',
        icon: '📊',
      },
      {
        id: 'nps_analysis',
        name: 'NPS Analysis',
        description: 'Analyze NPS scores, identify themes, and prioritize follow-ups',
        icon: '⭐',
      },
      {
        id: 'weekly_digest',
        name: 'Weekly Digest',
        description: 'Generate a weekly summary of portfolio health, priorities, and action items',
        icon: '📋',
      },
      {
        id: 'adoption_metrics',
        name: 'Adoption Analysis',
        description: 'Analyze feature adoption rates, identify training needs, and spot power users',
        icon: '🎯',
      },
      {
        id: 'churn_prediction',
        name: 'Churn Prediction',
        description: 'Identify churn risk signals, predict at-risk customers, and recommend save plays',
        icon: '⚠️',
      },
      {
        id: 'custom',
        name: 'Custom Analysis',
        description: 'Run a custom analysis with your own prompt',
        icon: '🔮',
      },
    ];
  }
}

// Singleton instance
export const sheetAnalyzer = new SheetAnalyzerService();
