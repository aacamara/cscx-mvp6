/**
 * Artifact Generator
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Generates artifacts (documents, slides, emails) from approved plans.
 * Phase 1 focuses on chat output; Phase 2 will add Google Workspace generation.
 */

import {
  ExecutionPlan,
  AggregatedContext,
  GeneratedArtifact,
  ArtifactType,
  PlanSection,
  GeneratedArtifactRow,
} from './types.js';

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// Google Workspace services
import { qbrSlidesService } from '../google/qbrSlides.js';
import { sheetsService } from '../google/sheets.js';
import { driveService } from '../google/drive.js';

// Initialize clients
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * Template data for General Mode (no customer selected)
 * Used when generating templates without real customer context
 */
export interface TemplateData {
  company: {
    name: string;
    arr: number;
    healthScore: number;
    industry: string;
    tier: string;
    status: string;
    renewalDate: string;
    npsScore: number;
  };
  metrics: {
    nps: number;
    dau: number;
    adoptionRate: number;
    supportTickets: number;
    featureAdoption: number;
    loginFrequency: number;
    lastActivityDays: number;
  };
  stakeholders: Array<{
    name: string;
    title: string;
    email: string;
    role: 'champion' | 'sponsor' | 'user';
    engagementLevel: 'high' | 'medium' | 'low';
  }>;
  healthTrends: Array<{
    date: string;
    score: number;
    category: string;
    trend: string;
  }>;
  riskSignals: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

/**
 * Get placeholder template data for General Mode
 * Returns realistic sample data for template generation
 */
export function getTemplateData(): TemplateData {
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const year = now.getFullYear();

  // Generate 90 days of health score history
  const healthTrends: TemplateData['healthTrends'] = [];
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Simulate a slightly improving trend
    const baseScore = 72;
    const variation = Math.sin(i / 10) * 5 + Math.random() * 3;
    const trendBonus = (90 - i) * 0.05; // Slight improvement over time
    healthTrends.push({
      date: date.toISOString().split('T')[0],
      score: Math.round(baseScore + variation + trendBonus),
      category: 'overall',
      trend: i > 45 ? 'stable' : 'improving',
    });
  }

  return {
    company: {
      name: 'ACME Corporation',
      arr: 450000,
      healthScore: 78,
      industry: 'Technology',
      tier: 'Enterprise',
      status: 'Active',
      renewalDate: `${year + 1}-03-15`,
      npsScore: 42,
    },
    metrics: {
      nps: 42,
      dau: 1250,
      adoptionRate: 68,
      supportTickets: 3,
      featureAdoption: 72,
      loginFrequency: 4.5,
      lastActivityDays: 2,
    },
    stakeholders: [
      {
        name: 'Sarah Chen',
        title: 'VP of Operations',
        email: 'sarah.chen@acme-example.com',
        role: 'champion',
        engagementLevel: 'high',
      },
      {
        name: 'James Rodriguez',
        title: 'Director of IT',
        email: 'james.r@acme-example.com',
        role: 'sponsor',
        engagementLevel: 'medium',
      },
      {
        name: 'Maria Thompson',
        title: 'Product Manager',
        email: 'maria.t@acme-example.com',
        role: 'user',
        engagementLevel: 'high',
      },
    ],
    healthTrends,
    riskSignals: [
      {
        type: 'engagement',
        severity: 'medium',
        description: 'Login frequency decreased 15% in the last 30 days',
      },
      {
        type: 'support',
        severity: 'low',
        description: '3 open support tickets, average resolution time 2.5 days',
      },
    ],
  };
}

/**
 * Generate an artifact from an approved plan
 * Supports both customer-specific and template mode (General Mode)
 */
export async function generate(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate?: boolean;
}): Promise<GeneratedArtifact & { isTemplate?: boolean; templateFolderId?: string }> {
  const { plan, context, userId, customerId } = params;
  const isTemplate = params.isTemplate || !customerId;
  const startTime = Date.now();

  // Track sources used
  const sourcesUsed = extractSourcesUsed(context);

  // For QBR generation with a customer, create real Google Slides and Sheets
  if (plan.taskType === 'qbr_generation' && customerId && !isTemplate) {
    try {
      const qbrResult = await generateQBRWithGoogleWorkspace(userId, customerId, context);

      const generationDurationMs = Date.now() - startTime;

      const artifact: GeneratedArtifact & { isTemplate?: boolean } = {
        artifactId: uuidv4(),
        type: 'slides',
        content: qbrResult.slidesContent,
        preview: qbrResult.preview,
        storage: {
          driveFileId: qbrResult.slidesId,
          driveUrl: qbrResult.slidesUrl,
          additionalFiles: qbrResult.sheetsId ? [{
            type: 'sheets',
            fileId: qbrResult.sheetsId,
            url: qbrResult.sheetsUrl!,
            title: 'QBR Supporting Data'
          }] : undefined,
        },
        metadata: {
          generatedAt: new Date(),
          planId: plan.planId,
          customerId: customerId || '',
          sourcesUsed,
          generationDurationMs,
        },
        isTemplate: false,
      };

      await saveArtifact(artifact, userId, customerId);
      return artifact;
    } catch (error) {
      console.error('[artifactGenerator] Google Workspace generation failed, falling back to markdown:', error);
      // Fall through to markdown generation
    }
  }

  // Template Mode: Generate QBR with placeholder data in user's Templates folder
  if (plan.taskType === 'qbr_generation' && isTemplate) {
    try {
      const templateResult = await generateTemplateQBR(userId, plan.taskType, context);

      const generationDurationMs = Date.now() - startTime;

      const artifact: GeneratedArtifact & { isTemplate?: boolean; templateFolderId?: string } = {
        artifactId: uuidv4(),
        type: 'slides',
        content: templateResult.slidesContent,
        preview: templateResult.preview,
        storage: {
          driveFileId: templateResult.slidesId,
          driveUrl: templateResult.slidesUrl,
          additionalFiles: templateResult.sheetsId ? [{
            type: 'sheets',
            fileId: templateResult.sheetsId,
            url: templateResult.sheetsUrl!,
            title: '[TEMPLATE] QBR Supporting Data'
          }] : undefined,
        },
        metadata: {
          generatedAt: new Date(),
          planId: plan.planId,
          customerId: '',
          sourcesUsed: ['template_data'],
          generationDurationMs,
        },
        isTemplate: true,
        templateFolderId: templateResult.folderId,
      };

      await saveArtifact(artifact, userId, null);
      return artifact;
    } catch (error) {
      console.error('[artifactGenerator] Template generation failed, falling back to markdown:', error);
      // Fall through to markdown generation
    }
  }

  // Default: Generate markdown content
  const sectionContents = await generateSections(plan, context);
  const content = assemblContent(plan, sectionContents);
  const preview = generatePreview(plan, sectionContents);
  const contentHash = createHash('sha256').update(content).digest('hex');
  const generationDurationMs = Date.now() - startTime;

  const artifact: GeneratedArtifact = {
    artifactId: uuidv4(),
    type: plan.structure.outputFormat,
    content,
    preview,
    storage: {},
    metadata: {
      generatedAt: new Date(),
      planId: plan.planId,
      customerId: customerId || '',
      sourcesUsed,
      generationDurationMs,
    },
  };

  await saveArtifact(artifact, userId, customerId);
  return artifact;
}

/**
 * Generate QBR with real Google Slides and Sheets
 */
async function generateQBRWithGoogleWorkspace(
  userId: string,
  customerId: string,
  context: AggregatedContext
): Promise<{
  slidesId: string;
  slidesUrl: string;
  slidesContent: string;
  sheetsId?: string;
  sheetsUrl?: string;
  preview: string;
}> {
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Customer';

  // Determine quarter
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const year = now.getFullYear();

  console.log(`[artifactGenerator] Generating QBR for ${customerName} - ${quarter} ${year}`);

  // 1. Generate Google Slides QBR
  const slidesResult = await qbrSlidesService.generateQBRPresentation(
    userId,
    customerId,
    quarter,
    year
  );

  // 2. Create supporting Google Sheets with metrics data
  let sheetsId: string | undefined;
  let sheetsUrl: string | undefined;

  try {
    // Get customer folder for organization
    const customerFolder = await driveService.getOrCreateCustomerFolder(userId, customerId, customerName);

    // Create metrics sheet
    const metricsSheet = await sheetsService.createSpreadsheet(userId, {
      title: `${customerName} - ${quarter} ${year} QBR Metrics`,
      folderId: customerFolder.id,
      template: { type: 'qbr_metrics' },
    });

    // Populate with actual data
    if (metricsSheet && context.platformData.healthTrends.length > 0) {
      const healthData = context.platformData.healthTrends.map(h => [
        h.date,
        h.score,
        h.category || '',
        h.trend || '',
      ]);

      await sheetsService.updateValues(userId, metricsSheet.id, {
        range: 'Health Trends!A2',
        values: healthData,
      });
    }

    // Add engagement metrics
    if (metricsSheet && context.platformData.engagementMetrics) {
      const e = context.platformData.engagementMetrics;
      await sheetsService.updateValues(userId, metricsSheet.id, {
        range: 'Engagement!A2',
        values: [[
          customerName,
          e.featureAdoption,
          e.loginFrequency,
          e.lastActivityDays,
          new Date().toISOString().split('T')[0],
        ]],
      });
    }

    sheetsId = metricsSheet?.id;
    sheetsUrl = metricsSheet?.webViewLink;
  } catch (error) {
    console.warn('[artifactGenerator] Failed to create supporting sheets:', error);
    // Continue without sheets
  }

  // Build preview content
  const preview = `## 📊 QBR Generated Successfully!

**${customerName} - ${quarter} ${year} Quarterly Business Review**

### Generated Documents:
- 📽️ **Presentation:** [Open in Google Slides](${slidesResult.presentationUrl})
${sheetsUrl ? `- 📈 **Supporting Data:** [Open in Google Sheets](${sheetsUrl})` : ''}

### Data Sources Used:
${context.platformData.customer360 ? '✓ Customer 360 Profile\n' : ''}${context.platformData.healthTrends.length > 0 ? `✓ Health Score History (${context.platformData.healthTrends.length} data points)\n` : ''}${context.platformData.engagementMetrics ? '✓ Engagement Metrics\n' : ''}${context.platformData.riskSignals.length > 0 ? `✓ Risk Signals (${context.platformData.riskSignals.length} active)\n` : ''}${context.platformData.renewalForecast ? '✓ Renewal Forecast\n' : ''}${context.platformData.interactionHistory.length > 0 ? `✓ Interaction History (${context.platformData.interactionHistory.length} records)\n` : ''}
### Quick Stats:
- **Health Score:** ${customer?.healthScore ?? 'N/A'}%
- **ARR:** $${customer?.arr ? (customer.arr / 1000).toFixed(0) + 'K' : 'N/A'}
- **NPS:** ${customer?.npsScore ?? 'N/A'}`;

  return {
    slidesId: slidesResult.presentationId,
    slidesUrl: slidesResult.presentationUrl,
    slidesContent: `QBR Presentation for ${customerName} - ${quarter} ${year}`,
    sheetsId,
    sheetsUrl,
    preview,
  };
}

/**
 * Generate Template QBR for General Mode (no customer selected)
 * Uses placeholder data and saves to user's Templates folder
 */
async function generateTemplateQBR(
  userId: string,
  taskType: string,
  context: AggregatedContext
): Promise<{
  slidesId: string;
  slidesUrl: string;
  slidesContent: string;
  sheetsId?: string;
  sheetsUrl?: string;
  folderId: string;
  preview: string;
}> {
  // Get template data
  const templateData = getTemplateData();
  const customerName = `[TEMPLATE] ${templateData.company.name}`;

  // Determine quarter
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const year = now.getFullYear();

  console.log(`[artifactGenerator] Generating TEMPLATE QBR - ${quarter} ${year}`);

  // Get or create user's templates folder
  const templatesFolder = await driveService.getOrCreateUserTemplatesFolder(userId);
  const taskFolder = await driveService.getOrCreateTaskTypeSubfolder(userId, templatesFolder.id, taskType);

  // For now, generate markdown content since we don't have a template-specific slides service
  // In production, you'd create a proper Google Slides template
  const slidesContent = `# ${customerName} - ${quarter} ${year} QBR Template

## Executive Summary
This is a **TEMPLATE** QBR with sample data from ${templateData.company.name}.
Replace placeholder values with actual customer data before presenting.

## Health Overview
- **Current Health Score:** ${templateData.company.healthScore}%
- **NPS Score:** ${templateData.metrics.nps}
- **Feature Adoption:** ${templateData.metrics.featureAdoption}%

## Key Stakeholders
${templateData.stakeholders.map(s => `- **${s.name}** (${s.title}) - ${s.role} [${s.engagementLevel} engagement]`).join('\n')}

## Risk Signals
${templateData.riskSignals.map(r => `- [${r.severity.toUpperCase()}] ${r.description}`).join('\n')}

## Recommendations
1. Review and customize all placeholder data
2. Update health trends with actual metrics
3. Add customer-specific action items

---
*Generated as template on ${new Date().toLocaleDateString()}*
`;

  // Create a Google Doc with the template content
  // Note: In production, you'd create proper Slides using a template
  const templateDoc = await driveService.uploadFile(userId, {
    name: `[TEMPLATE] QBR - ${quarter} ${year}.md`,
    mimeType: 'text/markdown',
    content: slidesContent,
    folderId: taskFolder.id,
  });

  // Build preview content
  const preview = `## 📋 QBR Template Generated!

**[TEMPLATE] ${templateData.company.name} - ${quarter} ${year} Quarterly Business Review**

⚠️ **Template Mode**: This QBR was generated with sample data. Replace placeholder values before using.

### Generated Documents:
- 📄 **Template:** [Open in Google Drive](${templateDoc.webViewLink || `https://drive.google.com/file/d/${templateDoc.id}`})
- 📁 **Templates Folder:** [Open Folder](${taskFolder.url})

### Sample Data Used:
- Company: ${templateData.company.name}
- ARR: $${(templateData.company.arr / 1000).toFixed(0)}K
- Health Score: ${templateData.company.healthScore}%
- Stakeholders: ${templateData.stakeholders.length}
- Risk Signals: ${templateData.riskSignals.length}

### Next Steps:
1. Open the template document
2. Replace "ACME Corporation" with your customer name
3. Update metrics with real data
4. Customize recommendations`;

  return {
    slidesId: templateDoc.id,
    slidesUrl: templateDoc.webViewLink || `https://drive.google.com/file/d/${templateDoc.id}`,
    slidesContent,
    folderId: taskFolder.id,
    preview,
  };
}

/**
 * Generate content for each section using Claude
 */
async function generateSections(
  plan: ExecutionPlan,
  context: AggregatedContext
): Promise<Map<string, string>> {
  const sections = new Map<string, string>();

  // Build context string for Claude
  const contextStr = buildContextString(context);

  for (const section of plan.structure.sections) {
    const sectionContent = await generateSection(section, plan, contextStr, context);
    sections.set(section.name, sectionContent);
  }

  return sections;
}

/**
 * Generate a single section
 */
async function generateSection(
  section: PlanSection,
  plan: ExecutionPlan,
  contextStr: string,
  context: AggregatedContext
): Promise<string> {
  // Build section-specific data
  const sectionData = extractSectionData(section, context);

  const prompt = `You are generating a section for a ${plan.taskType.replace('_', ' ')}.

## Section: ${section.name}
Description: ${section.description}

## Available Context:
${contextStr}

## Section-Specific Data:
${sectionData}

## Instructions:
1. Write content for the "${section.name}" section
2. Be specific and data-driven, using the provided context
3. Keep tone professional and actionable
4. Use bullet points for clarity where appropriate
5. If data is missing, note what would be helpful to have

Write the section content in markdown format:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = (message.content[0] as { type: 'text'; text: string }).text;
    return response.trim();
  } catch (error) {
    console.error(`[artifactGenerator] Error generating section ${section.name}:`, error);
    return `*Error generating ${section.name} section*`;
  }
}

/**
 * Build a comprehensive context string for Claude
 */
function buildContextString(context: AggregatedContext): string {
  const parts: string[] = [];

  // Customer overview
  if (context.platformData.customer360) {
    const c = context.platformData.customer360;
    parts.push(`### Customer Overview
- **Name:** ${c.name}
- **ARR:** $${(c.arr / 1000).toFixed(0)}K
- **Tier:** ${c.tier}
- **Status:** ${c.status}
- **Health Score:** ${c.healthScore}%
- **NPS:** ${c.npsScore ?? 'N/A'}
- **Industry:** ${c.industryCode || 'N/A'}
- **Renewal Date:** ${c.renewalDate || 'N/A'}`);
  }

  // Health trends
  if (context.platformData.healthTrends.length > 0) {
    const trends = context.platformData.healthTrends;
    const latest = trends[trends.length - 1];
    const oldest = trends[0];
    const change = latest ? (latest.score - oldest.score) : 0;

    parts.push(`### Health Trends (${trends.length} data points)
- **Current:** ${latest?.score ?? 'N/A'}%
- **Period Start:** ${oldest?.score ?? 'N/A'}%
- **Change:** ${change > 0 ? '+' : ''}${change}%
- **Direction:** ${change > 5 ? 'Improving' : change < -5 ? 'Declining' : 'Stable'}`);
  }

  // Engagement metrics
  if (context.platformData.engagementMetrics) {
    const e = context.platformData.engagementMetrics;
    parts.push(`### Engagement Metrics
- **Feature Adoption:** ${e.featureAdoption}%
- **Last Activity:** ${e.lastActivityDays} days ago
- **Login Frequency:** ${e.loginFrequency} per week`);
  }

  // Risk signals
  if (context.platformData.riskSignals.length > 0) {
    const risks = context.platformData.riskSignals
      .map(r => `- **${r.severity.toUpperCase()}** (${r.type}): ${r.description}`)
      .join('\n');
    parts.push(`### Active Risk Signals\n${risks}`);
  }

  // Renewal forecast
  if (context.platformData.renewalForecast) {
    const r = context.platformData.renewalForecast;
    parts.push(`### Renewal Outlook
- **Probability:** ${r.probability}%
- **Days to Renewal:** ${r.daysUntilRenewal}
- **Expansion Potential:** ${r.expansionPotential}%`);
  }

  // Recent interactions
  if (context.platformData.interactionHistory.length > 0) {
    const recent = context.platformData.interactionHistory.slice(0, 5);
    const interactions = recent
      .map(i => `- ${i.date.split('T')[0]}: ${i.type} - ${i.summary}`)
      .join('\n');
    parts.push(`### Recent Interactions\n${interactions}`);
  }

  // Knowledge base context
  if (context.knowledge.playbooks.length > 0) {
    const top = context.knowledge.playbooks[0];
    parts.push(`### Relevant Playbook: ${top.title}
${top.content.slice(0, 500)}...`);
  }

  return parts.join('\n\n');
}

/**
 * Extract section-specific data from context
 */
function extractSectionData(section: PlanSection, context: AggregatedContext): string {
  const data: string[] = [];

  for (const source of section.dataSources) {
    switch (source) {
      case 'customer_360':
        if (context.platformData.customer360) {
          data.push(`Customer: ${context.platformData.customer360.name}, Health: ${context.platformData.customer360.healthScore}%`);
        }
        break;
      case 'health_trends':
        if (context.platformData.healthTrends.length > 0) {
          const latest = context.platformData.healthTrends[context.platformData.healthTrends.length - 1];
          data.push(`Latest health: ${latest?.score}%`);
        }
        break;
      case 'risk_signals':
        if (context.platformData.riskSignals.length > 0) {
          data.push(`${context.platformData.riskSignals.length} active risks`);
        }
        break;
      case 'renewal_forecast':
        if (context.platformData.renewalForecast) {
          data.push(`Renewal probability: ${context.platformData.renewalForecast.probability}%`);
        }
        break;
      case 'engagement_metrics':
        if (context.platformData.engagementMetrics) {
          data.push(`Adoption: ${context.platformData.engagementMetrics.featureAdoption}%`);
        }
        break;
      case 'customer_history':
        if (context.platformData.interactionHistory.length > 0) {
          data.push(`${context.platformData.interactionHistory.length} recent interactions`);
        }
        break;
    }
  }

  return data.length > 0 ? data.join('\n') : 'No specific data for this section';
}

/**
 * Assemble final content from sections
 */
function assemblContent(
  plan: ExecutionPlan,
  sectionContents: Map<string, string>
): string {
  const parts: string[] = [];

  // Add title
  const customerName = plan.inputs.platformData.find(d => d.source === 'Customer 360 Profile')?.dataPoints[0]?.split(':')[1]?.trim() || 'Customer';
  parts.push(`# ${formatTaskTitle(plan.taskType)} - ${customerName}\n`);
  parts.push(`*Generated on ${new Date().toLocaleDateString()}*\n`);

  // Add sections
  for (const section of plan.structure.sections) {
    const content = sectionContents.get(section.name);
    if (content) {
      parts.push(`## ${section.name}\n`);
      parts.push(content);
      parts.push('\n');
    }
  }

  return parts.join('\n');
}

/**
 * Generate a preview for chat display
 */
function generatePreview(
  plan: ExecutionPlan,
  sectionContents: Map<string, string>
): string {
  const preview: string[] = [];

  // Add summary
  preview.push(`**${formatTaskTitle(plan.taskType)} Generated**\n`);

  // Add first section as preview
  const firstSection = plan.structure.sections[0];
  if (firstSection) {
    const content = sectionContents.get(firstSection.name);
    if (content) {
      // Truncate for preview
      const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content;
      preview.push(`### ${firstSection.name}\n${truncated}`);
    }
  }

  // Add structure overview
  preview.push(`\n**Sections included:**`);
  for (const section of plan.structure.sections) {
    preview.push(`- ${section.name}`);
  }

  return preview.join('\n');
}

/**
 * Format task type as human-readable title
 */
function formatTaskTitle(taskType: string): string {
  const titles: Record<string, string> = {
    qbr_generation: 'Quarterly Business Review',
    data_analysis: 'Data Analysis Report',
    presentation_creation: 'Presentation',
    document_creation: 'Document',
    email_drafting: 'Email Draft',
    meeting_prep: 'Meeting Prep Brief',
    transcription_summary: 'Meeting Summary',
    health_analysis: 'Health Analysis',
    expansion_planning: 'Expansion Plan',
    risk_assessment: 'Risk Assessment',
    custom: 'Generated Content',
  };
  return titles[taskType] || 'Generated Content';
}

/**
 * Extract sources used from context
 */
function extractSourcesUsed(context: AggregatedContext): string[] {
  const sources: string[] = [];

  if (context.platformData.customer360) {
    sources.push('customer_360');
  }
  if (context.platformData.healthTrends.length > 0) {
    sources.push('health_trends');
  }
  if (context.platformData.engagementMetrics) {
    sources.push('engagement_metrics');
  }
  if (context.platformData.riskSignals.length > 0) {
    sources.push('risk_signals');
  }
  if (context.platformData.renewalForecast) {
    sources.push('renewal_forecast');
  }
  if (context.platformData.interactionHistory.length > 0) {
    sources.push('customer_history');
  }
  if (context.knowledge.playbooks.length > 0) {
    sources.push('knowledge_base');
  }
  if (context.externalSources.previousArtifacts.length > 0) {
    sources.push('previous_artifacts');
  }

  return sources;
}

/**
 * Save artifact to database
 */
async function saveArtifact(
  artifact: GeneratedArtifact,
  userId: string,
  customerId: string | null
): Promise<void> {
  if (!supabase) {
    console.warn('[artifactGenerator] Database not configured, skipping save');
    return;
  }

  try {
    const row: Partial<GeneratedArtifactRow> = {
      id: artifact.artifactId,
      plan_id: artifact.metadata.planId,
      customer_id: customerId,
      user_id: userId,
      artifact_type: artifact.type,
      title: formatTaskTitle(artifact.type) || 'Generated Artifact',
      preview_markdown: artifact.preview,
      sources_used: artifact.metadata.sourcesUsed,
      generation_duration_ms: artifact.metadata.generationDurationMs,
    };

    if (artifact.storage.driveFileId) {
      row.drive_file_id = artifact.storage.driveFileId;
      row.drive_url = artifact.storage.driveUrl;
    }

    const { error } = await supabase.from('generated_artifacts').insert(row);

    if (error) {
      console.error('[artifactGenerator] Save error:', error);
    }
  } catch (error) {
    console.error('[artifactGenerator] Save exception:', error);
  }
}

/**
 * Get an artifact by ID
 */
export async function getArtifact(artifactId: string): Promise<{
  artifact: GeneratedArtifactRow | null;
  success: boolean;
  error?: string;
}> {
  if (!supabase) {
    return { artifact: null, success: false, error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('generated_artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (error) {
      return { artifact: null, success: false, error: error.message };
    }

    return { artifact: data as GeneratedArtifactRow, success: true };
  } catch (error) {
    return {
      artifact: null,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get artifact',
    };
  }
}

/**
 * Email preview result for HITL workflow
 */
interface EmailPreviewResult {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

/**
 * Generate email preview for HITL review (don't send yet)
 */
async function generateEmailPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<EmailPreviewResult> {
  const { plan, context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const renewalDate = customer?.renewalDate || 'upcoming';

  // Get recent interactions for context
  const recentInteractions = context.platformData.interactionHistory?.slice(0, 3) || [];
  const interactionContext = recentInteractions.length > 0
    ? recentInteractions.map((i: any) => `- ${i.type}: ${i.summary || i.description || 'Interaction'}`).join('\n')
    : 'No recent interactions';

  // For email addresses, we'll need to generate placeholders since stakeholders aren't in context
  const toEmails: string[] = [];
  const ccEmails: string[] = [];

  // Build prompt for email generation
  const prompt = `You are a customer success manager drafting an email. Generate a professional email based on this context:

Customer: ${customerName}
Health Score: ${healthScore}
Renewal Date: ${renewalDate}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

User Request: ${plan.planId ? 'Generate email based on plan' : 'Draft customer email'}

Original Query Context:
${plan.structure?.sections?.map((s: any) => `- ${s.name}: ${s.description}`).join('\n') || 'General customer outreach'}

Recent Context:
${interactionContext}

Generate the email with:
1. A clear, professional subject line
2. Personalized greeting
3. Main message body (2-3 paragraphs)
4. Clear call to action
5. Professional sign-off

Format your response as:
SUBJECT: [subject line]

BODY:
[email body with proper formatting]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const emailContent = textBlock?.text || '';

    // Parse subject and body
    const subjectMatch = emailContent.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = emailContent.match(/BODY:\s*([\s\S]+)/i);

    const subject = subjectMatch?.[1]?.trim() || `Following up - ${customerName}`;
    const body = bodyMatch?.[1]?.trim() || emailContent;

    return {
      to: isTemplate ? ['contact@example.com'] : toEmails,
      cc: isTemplate ? [] : ccEmails,
      subject,
      body,
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Email preview generation error:', error);

    // Return fallback email
    return {
      to: isTemplate ? ['contact@example.com'] : [],
      cc: [],
      subject: `Following up - ${customerName}`,
      body: `Dear Team,

I wanted to reach out regarding ${customerName}${!isTemplate && renewalDate ? ` and your upcoming renewal on ${renewalDate}` : ''}.

Please let me know if you have any questions or would like to schedule a call to discuss.

Best regards`,
    };
  }
}

/**
 * Document preview result for HITL review
 */
interface DocumentPreviewResult {
  title: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}

/**
 * Generate document preview for HITL review (don't create in Google Docs yet)
 */
async function generateDocumentPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<DocumentPreviewResult> {
  const { plan, context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const renewalDate = customer?.renewalDate || 'upcoming';
  const arr = customer?.arr;

  // Determine document type from plan
  const userQuery = plan.structure?.sections?.[0]?.description || 'general document';
  const documentType = userQuery.toLowerCase().includes('success plan') ? 'Success Plan'
    : userQuery.toLowerCase().includes('account plan') ? 'Account Plan'
    : userQuery.toLowerCase().includes('onboarding') ? 'Onboarding Plan'
    : 'Customer Document';

  // Build prompt for document generation
  const prompt = `You are a customer success manager creating a ${documentType}. Generate a structured document based on this context:

Customer: ${customerName}
Health Score: ${healthScore}
Renewal Date: ${renewalDate}
${arr ? `ARR: $${arr.toLocaleString()}` : ''}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Document Type: ${documentType}

Generate the document with these sections. For each section, provide:
1. A clear section title
2. Detailed content (2-4 paragraphs)

Required Sections:
${documentType === 'Success Plan' ? `
- Executive Summary
- Goals & Objectives
- Success Metrics & KPIs
- Timeline & Milestones
- Resources & Support
- Risk Mitigation` : documentType === 'Account Plan' ? `
- Executive Summary
- Account Overview
- Strategic Goals
- Engagement Strategy
- Growth Opportunities
- Action Items` : documentType === 'Onboarding Plan' ? `
- Welcome & Overview
- Onboarding Timeline
- Key Milestones
- Training Requirements
- Success Criteria
- Next Steps` : `
- Overview
- Objectives
- Key Considerations
- Action Items
- Next Steps`}

Format your response as:
SECTION: [section title]
CONTENT:
[section content]

SECTION: [next section title]
CONTENT:
[next section content]

(Continue for all sections)`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const documentContent = textBlock?.text || '';

    // Parse sections
    const sectionMatches = documentContent.matchAll(/SECTION:\s*(.+?)(?:\n|$)[\s\S]*?CONTENT:\s*([\s\S]*?)(?=SECTION:|$)/gi);
    const sections: DocumentPreviewResult['sections'] = [];

    let index = 0;
    for (const match of sectionMatches) {
      sections.push({
        id: `section-${index + 1}`,
        title: match[1]?.trim() || `Section ${index + 1}`,
        content: match[2]?.trim() || '',
      });
      index++;
    }

    // If no sections parsed, create default sections
    if (sections.length === 0) {
      sections.push({
        id: 'section-1',
        title: 'Overview',
        content: documentContent || 'Document content will be generated here.',
      });
    }

    return {
      title: `${documentType} - ${customerName}`,
      sections,
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Document preview generation error:', error);

    // Return fallback document
    return {
      title: `${documentType} - ${customerName}`,
      sections: [
        {
          id: 'section-1',
          title: 'Executive Summary',
          content: `This ${documentType.toLowerCase()} outlines our partnership with ${customerName} and the key initiatives for success.`,
        },
        {
          id: 'section-2',
          title: 'Goals & Objectives',
          content: `Primary goals for ${customerName}:\n\n1. Drive adoption and engagement\n2. Ensure successful product implementation\n3. Maximize value realization`,
        },
        {
          id: 'section-3',
          title: 'Action Items',
          content: `Key action items:\n\n1. Schedule regular check-ins\n2. Review success metrics monthly\n3. Address any blockers proactively`,
        },
      ],
    };
  }
}

/**
 * Meeting prep preview result for HITL review
 */
interface MeetingPrepPreviewResult {
  title: string;
  attendees: string[];
  agenda: Array<{ id: string; topic: string }>;
  talkingPoints: Array<{ id: string; point: string }>;
  risks: Array<{ id: string; risk: string }>;
}

/**
 * Generate meeting prep preview for HITL review
 */
async function generateMeetingPrepPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<MeetingPrepPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const renewalDate = customer?.renewalDate || 'upcoming';

  // Get recent interactions for context
  const recentInteractions = context.platformData.interactionHistory?.slice(0, 3) || [];

  // Build prompt for meeting prep generation
  const prompt = `You are a customer success manager preparing for a meeting. Generate a comprehensive meeting prep brief.

Customer: ${customerName}
Health Score: ${healthScore}
Renewal Date: ${renewalDate}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Recent Interactions:
${recentInteractions.map((i: any) => `- ${i.type}: ${i.summary || i.description || 'Interaction'}`).join('\n') || 'No recent interactions'}

Generate a meeting prep with:
1. A descriptive meeting title
2. 3-5 agenda items (key topics to cover)
3. 3-5 talking points (key messages/questions)
4. 1-3 risks or concerns to address

Format your response as JSON:
{
  "title": "Meeting title",
  "agenda": ["Topic 1", "Topic 2", "Topic 3"],
  "talkingPoints": ["Point 1", "Point 2", "Point 3"],
  "risks": ["Risk 1", "Risk 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const prepContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: { title?: string; agenda?: string[]; talkingPoints?: string[]; risks?: string[] } = {};
    try {
      const jsonMatch = prepContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    return {
      title: parsed.title || `Meeting with ${customerName}`,
      attendees: isTemplate ? ['contact@example.com'] : [],
      agenda: (parsed.agenda || ['Review progress', 'Discuss priorities', 'Next steps']).map((topic, i) => ({
        id: `agenda-${i + 1}`,
        topic,
      })),
      talkingPoints: (parsed.talkingPoints || ['Check in on satisfaction', 'Review key metrics', 'Identify blockers']).map((point, i) => ({
        id: `tp-${i + 1}`,
        point,
      })),
      risks: (parsed.risks || []).map((risk, i) => ({
        id: `risk-${i + 1}`,
        risk,
      })),
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Meeting prep preview generation error:', error);

    // Return fallback meeting prep
    return {
      title: `Meeting with ${customerName}`,
      attendees: isTemplate ? ['contact@example.com'] : [],
      agenda: [
        { id: 'agenda-1', topic: 'Review current status' },
        { id: 'agenda-2', topic: 'Discuss priorities' },
        { id: 'agenda-3', topic: 'Plan next steps' },
      ],
      talkingPoints: [
        { id: 'tp-1', point: 'Check in on overall satisfaction' },
        { id: 'tp-2', point: 'Review key success metrics' },
        { id: 'tp-3', point: 'Identify any blockers or concerns' },
      ],
      risks: [],
    };
  }
}

/**
 * Kickoff plan preview result for HITL review
 */
interface KickoffPlanPreviewResult {
  title: string;
  attendees: Array<{ id: string; name: string; email: string; role: string }>;
  agenda: Array<{ id: string; topic: string; duration: string; owner: string }>;
  goals: Array<{ id: string; goal: string }>;
  nextSteps: Array<{ id: string; action: string; owner: string; dueDate: string }>;
  notes: string;
  meetingDate: string;
  meetingDuration: string;
}

/**
 * Milestone plan preview result for HITL review
 */
interface MilestonePlanPreviewResult {
  title: string;
  phases: Array<{
    id: string;
    name: string;
    daysLabel: string;
    goals: Array<{ id: string; goal: string; completed: boolean }>;
    milestones: Array<{ id: string; milestone: string; date: string; owner: string }>;
    successCriteria: Array<{ id: string; criteria: string }>;
  }>;
  notes: string;
  startDate: string;
}

/**
 * Stakeholder map preview result for HITL review
 */
interface StakeholderMapPreviewResult {
  title: string;
  stakeholders: Array<{
    id: string;
    name: string;
    title: string;
    email: string;
    role: 'Champion' | 'Sponsor' | 'Blocker' | 'Evaluator' | 'User';
    influenceLevel: number; // 1-5
    engagementLevel: 'High' | 'Medium' | 'Low';
    notes: string;
  }>;
  relationships: Array<{
    id: string;
    fromId: string;
    toId: string;
    relationship: string;
  }>;
  notes: string;
}

/**
 * Generate milestone plan (30-60-90 day) preview for HITL review
 * Returns editable preview with phase-based goals, milestones, and success criteria
 */
async function generateMilestonePlanPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<MilestonePlanPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Build prompt for milestone plan generation
  const prompt = `You are a customer success manager creating a 30-60-90 day onboarding/implementation plan. Generate a comprehensive milestone plan.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a milestone plan with 3 phases (30 days, 60 days, 90 days). For each phase include:
1. 3-4 key goals (actionable objectives)
2. 2-3 milestones with target dates and owners
3. 2-3 success criteria to measure completion

Format your response as JSON:
{
  "title": "30-60-90 Day Plan title",
  "phases": [
    {
      "name": "First 30 Days",
      "daysLabel": "Days 1-30",
      "goals": ["Goal 1", "Goal 2", "Goal 3"],
      "milestones": [
        {"milestone": "Milestone description", "date": "YYYY-MM-DD", "owner": "CSM/Customer/Team"}
      ],
      "successCriteria": ["Criteria 1", "Criteria 2"]
    },
    ...
  ],
  "notes": "Any important notes or context"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const milestoneContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      phases?: Array<{
        name: string;
        daysLabel?: string;
        goals?: string[];
        milestones?: Array<{ milestone: string; date?: string; owner?: string }>;
        successCriteria?: string[];
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = milestoneContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default start date (today)
    const startDate = new Date();

    // Helper to calculate date offset
    const addDays = (date: Date, days: number): string => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };

    // Build default phases if not parsed
    const defaultPhases = [
      {
        name: 'First 30 Days',
        daysLabel: 'Days 1-30',
        goals: [
          'Complete initial setup and configuration',
          'Train key users on core functionality',
          'Establish communication cadence with stakeholders',
          'Define success metrics and baseline measurements',
        ],
        milestones: [
          { milestone: 'Kickoff meeting completed', date: addDays(startDate, 7), owner: 'CSM' },
          { milestone: 'Initial training delivered', date: addDays(startDate, 21), owner: 'CSM' },
          { milestone: 'First success check-in', date: addDays(startDate, 30), owner: 'CSM' },
        ],
        successCriteria: [
          'All users have login access',
          '80% of key users completed initial training',
          'Communication plan established',
        ],
      },
      {
        name: 'Days 31-60',
        daysLabel: 'Days 31-60',
        goals: [
          'Drive adoption of core features',
          'Address any technical blockers',
          'Expand user base within organization',
          'Document early wins and value delivered',
        ],
        milestones: [
          { milestone: 'Adoption review meeting', date: addDays(startDate, 45), owner: 'CSM' },
          { milestone: 'User expansion completed', date: addDays(startDate, 55), owner: 'Customer' },
          { milestone: '60-day success review', date: addDays(startDate, 60), owner: 'CSM' },
        ],
        successCriteria: [
          'Feature adoption rate > 50%',
          'No critical blockers open',
          'At least one documented success story',
        ],
      },
      {
        name: 'Days 61-90',
        daysLabel: 'Days 61-90',
        goals: [
          'Achieve target adoption metrics',
          'Identify expansion opportunities',
          'Plan for ongoing success partnership',
          'Transition to steady-state engagement',
        ],
        milestones: [
          { milestone: 'Full deployment completed', date: addDays(startDate, 75), owner: 'Customer' },
          { milestone: 'Expansion discussion', date: addDays(startDate, 80), owner: 'CSM' },
          { milestone: '90-day success review', date: addDays(startDate, 90), owner: 'CSM' },
        ],
        successCriteria: [
          'Feature adoption rate > 70%',
          'Positive NPS feedback collected',
          'Ongoing engagement plan documented',
        ],
      },
    ];

    const phases = (parsed.phases && parsed.phases.length > 0 ? parsed.phases : defaultPhases).map((phase, phaseIdx) => {
      const baseOffset = phaseIdx * 30;
      return {
        id: `phase-${phaseIdx + 1}`,
        name: phase.name || `Phase ${phaseIdx + 1}`,
        daysLabel: phase.daysLabel || `Days ${baseOffset + 1}-${baseOffset + 30}`,
        goals: (phase.goals || []).map((goal, i) => ({
          id: `goal-${phaseIdx}-${i + 1}`,
          goal: typeof goal === 'string' ? goal : (goal as any).goal || '',
          completed: false,
        })),
        milestones: (phase.milestones || []).map((m, i) => ({
          id: `milestone-${phaseIdx}-${i + 1}`,
          milestone: m.milestone,
          date: m.date || addDays(startDate, baseOffset + (i + 1) * 10),
          owner: m.owner || 'CSM',
        })),
        successCriteria: (phase.successCriteria || []).map((c, i) => ({
          id: `criteria-${phaseIdx}-${i + 1}`,
          criteria: typeof c === 'string' ? c : (c as any).criteria || '',
        })),
      };
    });

    return {
      title: parsed.title || `30-60-90 Day Plan: ${customerName}`,
      phases,
      notes: parsed.notes || 'Adjust timelines and milestones based on customer-specific requirements and capacity.',
      startDate: startDate.toISOString().split('T')[0],
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Milestone plan preview generation error:', error);

    // Return fallback milestone plan
    const fallbackStart = new Date();
    const addDays = (date: Date, days: number): string => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };

    return {
      title: `30-60-90 Day Plan: ${customerName}`,
      phases: [
        {
          id: 'phase-1',
          name: 'First 30 Days',
          daysLabel: 'Days 1-30',
          goals: [
            { id: 'goal-1-1', goal: 'Complete initial setup', completed: false },
            { id: 'goal-1-2', goal: 'Train key users', completed: false },
            { id: 'goal-1-3', goal: 'Establish communication cadence', completed: false },
          ],
          milestones: [
            { id: 'milestone-1-1', milestone: 'Kickoff meeting', date: addDays(fallbackStart, 7), owner: 'CSM' },
            { id: 'milestone-1-2', milestone: 'Training complete', date: addDays(fallbackStart, 21), owner: 'CSM' },
          ],
          successCriteria: [
            { id: 'criteria-1-1', criteria: 'All users have access' },
            { id: 'criteria-1-2', criteria: 'Training completed' },
          ],
        },
        {
          id: 'phase-2',
          name: 'Days 31-60',
          daysLabel: 'Days 31-60',
          goals: [
            { id: 'goal-2-1', goal: 'Drive core feature adoption', completed: false },
            { id: 'goal-2-2', goal: 'Address blockers', completed: false },
          ],
          milestones: [
            { id: 'milestone-2-1', milestone: 'Adoption review', date: addDays(fallbackStart, 45), owner: 'CSM' },
            { id: 'milestone-2-2', milestone: '60-day review', date: addDays(fallbackStart, 60), owner: 'CSM' },
          ],
          successCriteria: [
            { id: 'criteria-2-1', criteria: 'Adoption rate > 50%' },
          ],
        },
        {
          id: 'phase-3',
          name: 'Days 61-90',
          daysLabel: 'Days 61-90',
          goals: [
            { id: 'goal-3-1', goal: 'Achieve target adoption', completed: false },
            { id: 'goal-3-2', goal: 'Plan ongoing partnership', completed: false },
          ],
          milestones: [
            { id: 'milestone-3-1', milestone: 'Full deployment', date: addDays(fallbackStart, 75), owner: 'Customer' },
            { id: 'milestone-3-2', milestone: '90-day review', date: addDays(fallbackStart, 90), owner: 'CSM' },
          ],
          successCriteria: [
            { id: 'criteria-3-1', criteria: 'Adoption rate > 70%' },
            { id: 'criteria-3-2', criteria: 'Positive feedback collected' },
          ],
        },
      ],
      notes: '',
      startDate: fallbackStart.toISOString().split('T')[0],
    };
  }
}

/**
 * Generate kickoff plan preview for HITL review
 * Returns editable preview with attendees, agenda, goals, and next steps
 */
async function generateKickoffPlanPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<KickoffPlanPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get stakeholders from context if available
  const stakeholders = context.platformData.interactionHistory?.slice(0, 5) || [];

  // Build prompt for kickoff plan generation
  const prompt = `You are a customer success manager preparing a kickoff plan for a new customer onboarding. Generate a comprehensive kickoff meeting plan.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a kickoff plan with:
1. A descriptive meeting title (e.g., "Welcome Kickoff: [Customer] + [Company] Partnership Launch")
2. 4-6 agenda items with estimated duration (5-15 min each) and owner
3. 3-5 key onboarding goals
4. 3-5 immediate next steps with owners and due dates

Format your response as JSON:
{
  "title": "Meeting title",
  "agenda": [
    {"topic": "Topic name", "duration": "10 min", "owner": "CSM"},
    ...
  ],
  "goals": ["Goal 1", "Goal 2", ...],
  "nextSteps": [
    {"action": "Action item", "owner": "Owner name", "dueDate": "YYYY-MM-DD"},
    ...
  ],
  "notes": "Any important notes or context for the meeting"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const kickoffContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      agenda?: Array<{ topic: string; duration?: string; owner?: string }>;
      goals?: string[];
      nextSteps?: Array<{ action: string; owner?: string; dueDate?: string }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = kickoffContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default meeting date (1 week from now)
    const defaultMeetingDate = new Date();
    defaultMeetingDate.setDate(defaultMeetingDate.getDate() + 7);

    // Build attendees from stakeholders or defaults
    const attendees = isTemplate
      ? [
          { id: 'att-1', name: 'Sarah Chen', email: 'sarah@acme-example.com', role: 'Executive Sponsor' },
          { id: 'att-2', name: 'James Rodriguez', email: 'james@acme-example.com', role: 'Project Lead' },
          { id: 'att-3', name: 'Maria Thompson', email: 'maria@acme-example.com', role: 'Key User' },
        ]
      : stakeholders.slice(0, 3).map((s, idx) => ({
          id: `att-${idx + 1}`,
          name: s.summary?.split(' ')?.[0] || `Stakeholder ${idx + 1}`,
          email: '',
          role: idx === 0 ? 'Executive Sponsor' : idx === 1 ? 'Project Lead' : 'Key User',
        }));

    // If no stakeholders, add placeholders
    if (attendees.length === 0) {
      attendees.push(
        { id: 'att-1', name: 'Executive Sponsor', email: '', role: 'Executive Sponsor' },
        { id: 'att-2', name: 'Project Lead', email: '', role: 'Project Lead' },
        { id: 'att-3', name: 'Key User', email: '', role: 'Key User' }
      );
    }

    return {
      title: parsed.title || `Kickoff Meeting: ${customerName} Partnership Launch`,
      attendees,
      agenda: (parsed.agenda || [
        { topic: 'Introductions & Welcome', duration: '10 min', owner: 'CSM' },
        { topic: 'Partnership Goals & Success Criteria', duration: '15 min', owner: 'Customer' },
        { topic: 'Product Overview & Key Features', duration: '20 min', owner: 'CSM' },
        { topic: 'Implementation Timeline', duration: '15 min', owner: 'CSM' },
        { topic: 'Support & Communication Channels', duration: '10 min', owner: 'CSM' },
        { topic: 'Q&A and Next Steps', duration: '15 min', owner: 'All' },
      ]).map((item, i) => ({
        id: `agenda-${i + 1}`,
        topic: item.topic,
        duration: item.duration || '10 min',
        owner: item.owner || 'CSM',
      })),
      goals: (parsed.goals || [
        'Align on partnership objectives and success metrics',
        'Introduce key stakeholders and establish communication cadence',
        'Review implementation timeline and key milestones',
        'Ensure customer team has access to necessary resources',
      ]).map((goal, i) => ({
        id: `goal-${i + 1}`,
        goal,
      })),
      nextSteps: (parsed.nextSteps || [
        { action: 'Share meeting recording and summary notes', owner: 'CSM', dueDate: '' },
        { action: 'Complete user provisioning', owner: 'CSM', dueDate: '' },
        { action: 'Schedule first training session', owner: 'CSM', dueDate: '' },
        { action: 'Confirm key stakeholder availability for training', owner: 'Customer', dueDate: '' },
      ]).map((item, i) => {
        // Calculate default due date (1-2 weeks from meeting)
        const dueDate = new Date(defaultMeetingDate);
        dueDate.setDate(dueDate.getDate() + (i + 1) * 3);
        return {
          id: `step-${i + 1}`,
          action: item.action,
          owner: item.owner || 'CSM',
          dueDate: item.dueDate || dueDate.toISOString().split('T')[0],
        };
      }),
      notes: parsed.notes || 'Ensure all key stakeholders have calendar invites. Prepare demo environment with customer-specific data.',
      meetingDate: defaultMeetingDate.toISOString().split('T')[0],
      meetingDuration: '90 min',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Kickoff plan preview generation error:', error);

    // Return fallback kickoff plan
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() + 7);

    return {
      title: `Kickoff Meeting: ${customerName} Partnership Launch`,
      attendees: [
        { id: 'att-1', name: 'Executive Sponsor', email: '', role: 'Executive Sponsor' },
        { id: 'att-2', name: 'Project Lead', email: '', role: 'Project Lead' },
      ],
      agenda: [
        { id: 'agenda-1', topic: 'Introductions & Welcome', duration: '10 min', owner: 'CSM' },
        { id: 'agenda-2', topic: 'Partnership Goals & Success Criteria', duration: '15 min', owner: 'Customer' },
        { id: 'agenda-3', topic: 'Product Overview', duration: '20 min', owner: 'CSM' },
        { id: 'agenda-4', topic: 'Implementation Timeline', duration: '15 min', owner: 'CSM' },
        { id: 'agenda-5', topic: 'Q&A and Next Steps', duration: '15 min', owner: 'All' },
      ],
      goals: [
        { id: 'goal-1', goal: 'Align on partnership objectives and success metrics' },
        { id: 'goal-2', goal: 'Establish communication cadence' },
        { id: 'goal-3', goal: 'Review implementation timeline' },
      ],
      nextSteps: [
        { id: 'step-1', action: 'Share meeting recording and notes', owner: 'CSM', dueDate: fallbackDate.toISOString().split('T')[0] },
        { id: 'step-2', action: 'Complete user provisioning', owner: 'CSM', dueDate: fallbackDate.toISOString().split('T')[0] },
        { id: 'step-3', action: 'Schedule first training session', owner: 'CSM', dueDate: fallbackDate.toISOString().split('T')[0] },
      ],
      notes: '',
      meetingDate: fallbackDate.toISOString().split('T')[0],
      meetingDuration: '90 min',
    };
  }
}

/**
 * Training schedule preview result for HITL review
 */
interface TrainingSchedulePreviewResult {
  title: string;
  sessions: Array<{
    id: string;
    name: string;
    description: string;
    date: string;
    time: string;
    duration: string;
    trainer: string;
    attendeeGroups: string[];
    topics: string[];
    prerequisites: string[];
  }>;
  notes: string;
  startDate: string;
}

/**
 * Usage analysis preview result for HITL review
 */
interface UsageAnalysisPreviewResult {
  title: string;
  timeRange: {
    start: string;
    end: string;
    preset: string; // 'last_7_days', 'last_30_days', 'last_90_days', 'custom'
  };
  metrics: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    trendValue: number;
    included: boolean;
  }>;
  featureAdoption: Array<{
    id: string;
    feature: string;
    adoptionRate: number;
    activeUsers: number;
    trend: 'up' | 'down' | 'stable';
    included: boolean;
  }>;
  userSegments: Array<{
    id: string;
    name: string;
    count: number;
    percentage: number;
    avgEngagement: number;
    included: boolean;
  }>;
  recommendations: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    impact: string;
  }>;
  chartTypes: {
    showTrendChart: boolean;
    showAdoptionChart: boolean;
    showSegmentChart: boolean;
    showHeatmap: boolean;
  };
  notes: string;
}

/**
 * Generate training schedule preview for HITL review
 * Returns editable preview with sessions, dates, attendee groups, and topics
 */
async function generateTrainingSchedulePreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<TrainingSchedulePreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Build prompt for training schedule generation
  const prompt = `You are a customer success manager creating a training schedule for a customer. Generate a comprehensive training schedule with sessions.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a training schedule with 4-6 training sessions. For each session include:
1. Session name and brief description
2. Date and time (spread across 2-4 weeks from today)
3. Duration (30-60-90 min options)
4. Trainer (CSM, Product Expert, Implementation Team, etc.)
5. Attendee groups (e.g., Admins, Power Users, End Users, Executives)
6. Topics to cover (3-5 per session)
7. Prerequisites if any

Format your response as JSON:
{
  "title": "Training Schedule title",
  "sessions": [
    {
      "name": "Session name",
      "description": "Brief description of what will be covered",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "duration": "60 min",
      "trainer": "CSM",
      "attendeeGroups": ["Admins", "Power Users"],
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "prerequisites": ["Prerequisite 1"] or []
    }
  ],
  "notes": "Overall notes about the training schedule"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const scheduleContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      sessions?: Array<{
        name: string;
        description?: string;
        date?: string;
        time?: string;
        duration?: string;
        trainer?: string;
        attendeeGroups?: string[];
        topics?: string[];
        prerequisites?: string[];
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = scheduleContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default start date (today)
    const startDate = new Date();

    // Helper to calculate date offset
    const addDays = (date: Date, days: number): string => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };

    // Build default sessions if not parsed
    const defaultSessions = [
      {
        name: 'Platform Overview & Navigation',
        description: 'Introduction to the platform interface and key navigation concepts',
        date: addDays(startDate, 3),
        time: '10:00',
        duration: '60 min',
        trainer: 'CSM',
        attendeeGroups: ['All Users'],
        topics: ['Platform overview', 'Navigation basics', 'Key terminology', 'Getting help'],
        prerequisites: [],
      },
      {
        name: 'Admin Configuration Training',
        description: 'Deep dive into admin settings and configuration options',
        date: addDays(startDate, 7),
        time: '10:00',
        duration: '90 min',
        trainer: 'Implementation Team',
        attendeeGroups: ['Admins'],
        topics: ['User management', 'Permission settings', 'Integrations', 'System configuration'],
        prerequisites: ['Platform Overview completed'],
      },
      {
        name: 'Power User Workshop',
        description: 'Advanced features and workflows for power users',
        date: addDays(startDate, 14),
        time: '14:00',
        duration: '60 min',
        trainer: 'Product Expert',
        attendeeGroups: ['Power Users', 'Admins'],
        topics: ['Advanced features', 'Custom workflows', 'Automation', 'Best practices'],
        prerequisites: ['Platform Overview completed'],
      },
      {
        name: 'End User Training',
        description: 'Essential training for everyday users',
        date: addDays(startDate, 21),
        time: '11:00',
        duration: '45 min',
        trainer: 'CSM',
        attendeeGroups: ['End Users'],
        topics: ['Daily tasks', 'Common workflows', 'Tips and tricks', 'Q&A'],
        prerequisites: [],
      },
    ];

    const sessions = (parsed.sessions && parsed.sessions.length > 0
      ? parsed.sessions
      : defaultSessions
    ).map((s, idx) => ({
      id: `session-${idx + 1}`,
      name: s.name || `Training Session ${idx + 1}`,
      description: s.description || '',
      date: s.date || addDays(startDate, (idx + 1) * 7),
      time: s.time || '10:00',
      duration: s.duration || '60 min',
      trainer: s.trainer || 'CSM',
      attendeeGroups: s.attendeeGroups || ['All Users'],
      topics: s.topics || [],
      prerequisites: s.prerequisites || [],
    }));

    return {
      title: parsed.title || `Training Schedule: ${customerName}`,
      sessions,
      notes: parsed.notes || 'Adjust session dates and times based on attendee availability. Sessions can be recorded for asynchronous viewing.',
      startDate: startDate.toISOString().split('T')[0],
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Training schedule preview generation error:', error);

    // Return fallback training schedule
    const fallbackStart = new Date();
    const addDays = (date: Date, days: number): string => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };

    return {
      title: `Training Schedule: ${customerName}`,
      sessions: [
        {
          id: 'session-1',
          name: 'Platform Overview',
          description: 'Introduction to the platform',
          date: addDays(fallbackStart, 7),
          time: '10:00',
          duration: '60 min',
          trainer: 'CSM',
          attendeeGroups: ['All Users'],
          topics: ['Platform overview', 'Navigation', 'Getting started'],
          prerequisites: [],
        },
        {
          id: 'session-2',
          name: 'Admin Training',
          description: 'Admin configuration and settings',
          date: addDays(fallbackStart, 14),
          time: '10:00',
          duration: '90 min',
          trainer: 'Implementation Team',
          attendeeGroups: ['Admins'],
          topics: ['User management', 'Settings', 'Integrations'],
          prerequisites: ['Platform Overview'],
        },
        {
          id: 'session-3',
          name: 'Advanced Features',
          description: 'Power user training',
          date: addDays(fallbackStart, 21),
          time: '14:00',
          duration: '60 min',
          trainer: 'Product Expert',
          attendeeGroups: ['Power Users'],
          topics: ['Advanced features', 'Workflows', 'Best practices'],
          prerequisites: ['Platform Overview'],
        },
      ],
      notes: '',
      startDate: fallbackStart.toISOString().split('T')[0],
    };
  }
}

/**
 * Generate stakeholder map preview for HITL review
 * Returns editable preview with contact cards, roles, and relationships
 */
async function generateStakeholderMapPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<StakeholderMapPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get interaction history for stakeholder hints
  const interactions = context.platformData.interactionHistory || [];

  // Build prompt for stakeholder map generation
  const prompt = `You are a customer success manager creating a stakeholder map. Generate a comprehensive stakeholder map with key contacts.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${interactions.length > 0 ? `Recent Interactions:
${interactions.slice(0, 5).map((i: any) => `- ${i.type}: ${i.summary || i.description || 'Interaction'}`).join('\n')}` : ''}

Generate a stakeholder map with 4-6 key stakeholders. For each stakeholder include:
1. Name and job title
2. Email (use example.com domain for templates)
3. Role classification: Champion, Sponsor, Blocker, Evaluator, or User
4. Influence level (1-5, where 5 is highest)
5. Engagement level: High, Medium, or Low
6. Brief notes about this person

Also identify 2-4 key relationships between stakeholders.

Format your response as JSON:
{
  "title": "Stakeholder Map title",
  "stakeholders": [
    {
      "name": "Full Name",
      "title": "Job Title",
      "email": "email@example.com",
      "role": "Champion|Sponsor|Blocker|Evaluator|User",
      "influenceLevel": 1-5,
      "engagementLevel": "High|Medium|Low",
      "notes": "Brief notes"
    }
  ],
  "relationships": [
    {
      "from": "Name1",
      "to": "Name2",
      "relationship": "Reports to|Works with|Influences|etc."
    }
  ],
  "notes": "Overall notes about the stakeholder landscape"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const stakeholderContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      stakeholders?: Array<{
        name: string;
        title?: string;
        email?: string;
        role?: string;
        influenceLevel?: number;
        engagementLevel?: string;
        notes?: string;
      }>;
      relationships?: Array<{
        from: string;
        to: string;
        relationship?: string;
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = stakeholderContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default stakeholders if not parsed
    const defaultStakeholders = [
      {
        name: 'Sarah Chen',
        title: 'VP of Operations',
        email: 'sarah.chen@acme-example.com',
        role: 'Champion' as const,
        influenceLevel: 5,
        engagementLevel: 'High' as const,
        notes: 'Primary advocate for the partnership',
      },
      {
        name: 'James Rodriguez',
        title: 'Director of IT',
        email: 'james.r@acme-example.com',
        role: 'Sponsor' as const,
        influenceLevel: 4,
        engagementLevel: 'Medium' as const,
        notes: 'Technical decision maker',
      },
      {
        name: 'Maria Thompson',
        title: 'Product Manager',
        email: 'maria.t@acme-example.com',
        role: 'User' as const,
        influenceLevel: 3,
        engagementLevel: 'High' as const,
        notes: 'Power user and internal advocate',
      },
      {
        name: 'David Kim',
        title: 'CFO',
        email: 'david.kim@acme-example.com',
        role: 'Evaluator' as const,
        influenceLevel: 5,
        engagementLevel: 'Low' as const,
        notes: 'Budget authority, needs ROI justification',
      },
    ];

    // Build stakeholders with IDs
    const stakeholders = (parsed.stakeholders && parsed.stakeholders.length > 0
      ? parsed.stakeholders
      : defaultStakeholders
    ).map((s, idx) => ({
      id: `stakeholder-${idx + 1}`,
      name: s.name || `Stakeholder ${idx + 1}`,
      title: s.title || 'Unknown Title',
      email: s.email || '',
      role: (s.role as any) || 'User',
      influenceLevel: s.influenceLevel || 3,
      engagementLevel: (s.engagementLevel as any) || 'Medium',
      notes: s.notes || '',
    }));

    // Build stakeholder name to ID map for relationships
    const nameToId = new Map<string, string>();
    stakeholders.forEach(s => nameToId.set(s.name.toLowerCase(), s.id));

    // Build relationships with IDs
    const defaultRelationships = [
      { from: stakeholders[0]?.name || '', to: stakeholders[1]?.name || '', relationship: 'Works closely with' },
      { from: stakeholders[1]?.name || '', to: stakeholders[3]?.name || '', relationship: 'Reports to' },
    ];

    const relationships = (parsed.relationships && parsed.relationships.length > 0
      ? parsed.relationships
      : defaultRelationships
    ).map((r, idx) => {
      const fromId = nameToId.get(r.from.toLowerCase()) || stakeholders[0]?.id || '';
      const toId = nameToId.get(r.to.toLowerCase()) || stakeholders[1]?.id || '';
      return {
        id: `rel-${idx + 1}`,
        fromId,
        toId,
        relationship: r.relationship || 'Related to',
      };
    }).filter(r => r.fromId && r.toId);

    return {
      title: parsed.title || `Stakeholder Map: ${customerName}`,
      stakeholders,
      relationships,
      notes: parsed.notes || 'Update stakeholder roles and engagement levels as the relationship evolves.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Stakeholder map preview generation error:', error);

    // Return fallback stakeholder map
    return {
      title: `Stakeholder Map: ${customerName}`,
      stakeholders: [
        {
          id: 'stakeholder-1',
          name: 'Executive Sponsor',
          title: 'VP/Director',
          email: '',
          role: 'Sponsor',
          influenceLevel: 5,
          engagementLevel: 'Medium',
          notes: 'Budget and strategic decision maker',
        },
        {
          id: 'stakeholder-2',
          name: 'Project Champion',
          title: 'Manager',
          email: '',
          role: 'Champion',
          influenceLevel: 4,
          engagementLevel: 'High',
          notes: 'Internal advocate and primary contact',
        },
        {
          id: 'stakeholder-3',
          name: 'Power User',
          title: 'Analyst/Specialist',
          email: '',
          role: 'User',
          influenceLevel: 2,
          engagementLevel: 'High',
          notes: 'Daily user, provides feedback',
        },
      ],
      relationships: [
        {
          id: 'rel-1',
          fromId: 'stakeholder-2',
          toId: 'stakeholder-1',
          relationship: 'Reports to',
        },
      ],
      notes: '',
    };
  }
}

/**
 * Generate usage analysis preview for HITL review
 * Returns editable preview with time range, metrics, feature adoption, and recommendations
 */
async function generateUsageAnalysisPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<UsageAnalysisPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get engagement metrics from context
  const engagement = context.platformData.engagementMetrics;

  // Build prompt for usage analysis generation
  const prompt = `You are a customer success manager creating a usage analysis report. Generate a comprehensive usage analysis with metrics and recommendations.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${engagement ? `Current Engagement Data:
- Feature Adoption: ${engagement.featureAdoption}%
- Login Frequency: ${engagement.loginFrequency} per week
- Last Activity: ${engagement.lastActivityDays} days ago` : ''}

Generate a usage analysis with:
1. Key usage metrics (DAU, MAU, session duration, feature usage, etc.)
2. Feature adoption rates for 5-8 key features
3. User segments breakdown (Power Users, Regular Users, Low Activity, etc.)
4. 3-5 actionable recommendations based on the data

Format your response as JSON:
{
  "title": "Usage Analysis title",
  "metrics": [
    {
      "name": "Metric name",
      "value": number,
      "unit": "users|percent|minutes|sessions",
      "trend": "up|down|stable",
      "trendValue": number (percentage change)
    }
  ],
  "featureAdoption": [
    {
      "feature": "Feature name",
      "adoptionRate": number (0-100),
      "activeUsers": number,
      "trend": "up|down|stable"
    }
  ],
  "userSegments": [
    {
      "name": "Segment name",
      "count": number,
      "percentage": number (0-100),
      "avgEngagement": number (0-100)
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "adoption|engagement|training|support",
      "recommendation": "Specific recommendation text",
      "impact": "Expected impact description"
    }
  ],
  "notes": "Overall analysis notes"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const analysisContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      metrics?: Array<{
        name: string;
        value?: number;
        unit?: string;
        trend?: string;
        trendValue?: number;
      }>;
      featureAdoption?: Array<{
        feature: string;
        adoptionRate?: number;
        activeUsers?: number;
        trend?: string;
      }>;
      userSegments?: Array<{
        name: string;
        count?: number;
        percentage?: number;
        avgEngagement?: number;
      }>;
      recommendations?: Array<{
        priority?: string;
        category?: string;
        recommendation: string;
        impact?: string;
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default time range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Build default metrics if not parsed
    const defaultMetrics = [
      { name: 'Daily Active Users', value: 847, unit: 'users', trend: 'up' as const, trendValue: 12 },
      { name: 'Monthly Active Users', value: 2453, unit: 'users', trend: 'up' as const, trendValue: 8 },
      { name: 'Avg Session Duration', value: 23, unit: 'minutes', trend: 'stable' as const, trendValue: 2 },
      { name: 'Feature Usage Rate', value: 68, unit: 'percent', trend: 'up' as const, trendValue: 5 },
      { name: 'Weekly Login Rate', value: 4.2, unit: 'sessions', trend: 'stable' as const, trendValue: -1 },
    ];

    const defaultFeatureAdoption = [
      { feature: 'Core Dashboard', adoptionRate: 95, activeUsers: 2328, trend: 'stable' as const },
      { feature: 'Reporting', adoptionRate: 72, activeUsers: 1766, trend: 'up' as const },
      { feature: 'Integrations', adoptionRate: 45, activeUsers: 1104, trend: 'up' as const },
      { feature: 'Analytics', adoptionRate: 58, activeUsers: 1422, trend: 'stable' as const },
      { feature: 'Automations', adoptionRate: 32, activeUsers: 785, trend: 'down' as const },
      { feature: 'API Access', adoptionRate: 28, activeUsers: 687, trend: 'up' as const },
    ];

    const defaultUserSegments = [
      { name: 'Power Users', count: 245, percentage: 10, avgEngagement: 92 },
      { name: 'Regular Users', count: 1226, percentage: 50, avgEngagement: 65 },
      { name: 'Occasional Users', count: 735, percentage: 30, avgEngagement: 35 },
      { name: 'Inactive Users', count: 247, percentage: 10, avgEngagement: 5 },
    ];

    const defaultRecommendations = [
      {
        priority: 'high' as const,
        category: 'adoption',
        recommendation: 'Increase Automations feature adoption through targeted training sessions',
        impact: 'Could improve efficiency by 25% for power users',
      },
      {
        priority: 'medium' as const,
        category: 'engagement',
        recommendation: 'Re-engage occasional users with personalized onboarding emails',
        impact: 'Potential to move 20% of occasional users to regular usage',
      },
      {
        priority: 'medium' as const,
        category: 'training',
        recommendation: 'Create API documentation and tutorials to boost developer adoption',
        impact: 'Enable technical teams to build integrations',
      },
      {
        priority: 'low' as const,
        category: 'support',
        recommendation: 'Set up office hours for Integrations feature questions',
        impact: 'Reduce support tickets and improve satisfaction',
      },
    ];

    const metrics = (parsed.metrics && parsed.metrics.length > 0
      ? parsed.metrics
      : defaultMetrics
    ).map((m, idx) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      value: m.value || 0,
      unit: m.unit || 'users',
      trend: (m.trend as 'up' | 'down' | 'stable') || 'stable',
      trendValue: m.trendValue || 0,
      included: true,
    }));

    const featureAdoption = (parsed.featureAdoption && parsed.featureAdoption.length > 0
      ? parsed.featureAdoption
      : defaultFeatureAdoption
    ).map((f, idx) => ({
      id: `feature-${idx + 1}`,
      feature: f.feature || `Feature ${idx + 1}`,
      adoptionRate: f.adoptionRate || 0,
      activeUsers: f.activeUsers || 0,
      trend: (f.trend as 'up' | 'down' | 'stable') || 'stable',
      included: true,
    }));

    const userSegments = (parsed.userSegments && parsed.userSegments.length > 0
      ? parsed.userSegments
      : defaultUserSegments
    ).map((s, idx) => ({
      id: `segment-${idx + 1}`,
      name: s.name || `Segment ${idx + 1}`,
      count: s.count || 0,
      percentage: s.percentage || 0,
      avgEngagement: s.avgEngagement || 0,
      included: true,
    }));

    const recommendations = (parsed.recommendations && parsed.recommendations.length > 0
      ? parsed.recommendations
      : defaultRecommendations
    ).map((r, idx) => ({
      id: `rec-${idx + 1}`,
      priority: (r.priority as 'high' | 'medium' | 'low') || 'medium',
      category: r.category || 'engagement',
      recommendation: r.recommendation || '',
      impact: r.impact || '',
    }));

    return {
      title: parsed.title || `Usage Analysis: ${customerName}`,
      timeRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        preset: 'last_30_days',
      },
      metrics,
      featureAdoption,
      userSegments,
      recommendations,
      chartTypes: {
        showTrendChart: true,
        showAdoptionChart: true,
        showSegmentChart: true,
        showHeatmap: false,
      },
      notes: parsed.notes || 'Review metrics and recommendations. Adjust time range and filters as needed.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Usage analysis preview generation error:', error);

    // Return fallback usage analysis
    const fallbackEnd = new Date();
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() - 30);

    return {
      title: `Usage Analysis: ${customerName}`,
      timeRange: {
        start: fallbackStart.toISOString().split('T')[0],
        end: fallbackEnd.toISOString().split('T')[0],
        preset: 'last_30_days',
      },
      metrics: [
        { id: 'metric-1', name: 'Daily Active Users', value: 500, unit: 'users', trend: 'stable', trendValue: 0, included: true },
        { id: 'metric-2', name: 'Feature Adoption', value: 65, unit: 'percent', trend: 'up', trendValue: 5, included: true },
        { id: 'metric-3', name: 'Avg Session Duration', value: 20, unit: 'minutes', trend: 'stable', trendValue: 0, included: true },
      ],
      featureAdoption: [
        { id: 'feature-1', feature: 'Core Features', adoptionRate: 85, activeUsers: 425, trend: 'stable', included: true },
        { id: 'feature-2', feature: 'Advanced Features', adoptionRate: 45, activeUsers: 225, trend: 'up', included: true },
      ],
      userSegments: [
        { id: 'segment-1', name: 'Active Users', count: 400, percentage: 80, avgEngagement: 70, included: true },
        { id: 'segment-2', name: 'Low Activity', count: 100, percentage: 20, avgEngagement: 20, included: true },
      ],
      recommendations: [
        { id: 'rec-1', priority: 'high', category: 'adoption', recommendation: 'Increase feature adoption through training', impact: 'Improve user engagement' },
        { id: 'rec-2', priority: 'medium', category: 'engagement', recommendation: 'Re-engage inactive users', impact: 'Reduce churn risk' },
      ],
      chartTypes: {
        showTrendChart: true,
        showAdoptionChart: true,
        showSegmentChart: true,
        showHeatmap: false,
      },
      notes: '',
    };
  }
}

/**
 * Feature campaign preview result for HITL review
 */
interface FeatureCampaignPreviewResult {
  title: string;
  campaignGoal: string;
  targetFeatures: Array<{
    id: string;
    name: string;
    currentAdoption: number;
    targetAdoption: number;
    priority: 'high' | 'medium' | 'low';
    included: boolean;
  }>;
  userSegments: Array<{
    id: string;
    name: string;
    size: number;
    currentUsage: number;
    potential: 'high' | 'medium' | 'low';
    included: boolean;
  }>;
  timeline: {
    startDate: string;
    endDate: string;
    phases: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      activities: string[];
    }>;
  };
  messaging: Array<{
    id: string;
    channel: 'email' | 'in-app' | 'webinar' | 'training' | 'slack' | 'other';
    subject: string;
    content: string;
    timing: string;
    segment: string;
  }>;
  successMetrics: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    unit: string;
  }>;
  notes: string;
}

/**
 * Generate feature campaign preview for HITL review
 * Returns editable preview with target features, user segments, messaging, and success metrics
 */
async function generateFeatureCampaignPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<FeatureCampaignPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get engagement metrics from context
  const engagement = context.platformData.engagementMetrics;

  // Build prompt for feature campaign generation
  const prompt = `You are a customer success manager creating a feature adoption campaign plan. Generate a comprehensive campaign to drive adoption of underutilized features.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${engagement ? `Current Engagement Data:
- Feature Adoption: ${engagement.featureAdoption}%
- Login Frequency: ${engagement.loginFrequency} per week
- Last Activity: ${engagement.lastActivityDays} days ago` : ''}

Generate a feature campaign plan with:
1. Campaign title and primary goal
2. 3-5 target features with current/target adoption rates and priority
3. 3-4 user segments to target with potential impact
4. Campaign timeline with 2-3 phases and specific activities
5. 3-4 messaging templates for different channels
6. 4-6 success metrics with current baselines and targets

Format your response as JSON:
{
  "title": "Campaign title",
  "campaignGoal": "Primary goal description",
  "targetFeatures": [
    {
      "name": "Feature name",
      "currentAdoption": number (0-100),
      "targetAdoption": number (0-100),
      "priority": "high|medium|low"
    }
  ],
  "userSegments": [
    {
      "name": "Segment name",
      "size": number,
      "currentUsage": number (0-100),
      "potential": "high|medium|low"
    }
  ],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "phases": [
      {
        "name": "Phase name",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "activities": ["Activity 1", "Activity 2"]
      }
    ]
  },
  "messaging": [
    {
      "channel": "email|in-app|webinar|training|slack|other",
      "subject": "Message subject",
      "content": "Message content/script",
      "timing": "When to send (e.g., Week 1, Day 3)",
      "segment": "Target segment name"
    }
  ],
  "successMetrics": [
    {
      "name": "Metric name",
      "current": number,
      "target": number,
      "unit": "percent|users|sessions|count"
    }
  ],
  "notes": "Additional campaign notes"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const campaignContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      campaignGoal?: string;
      targetFeatures?: Array<{
        name: string;
        currentAdoption?: number;
        targetAdoption?: number;
        priority?: string;
      }>;
      userSegments?: Array<{
        name: string;
        size?: number;
        currentUsage?: number;
        potential?: string;
      }>;
      timeline?: {
        startDate?: string;
        endDate?: string;
        phases?: Array<{
          name: string;
          startDate?: string;
          endDate?: string;
          activities?: string[];
        }>;
      };
      messaging?: Array<{
        channel?: string;
        subject?: string;
        content?: string;
        timing?: string;
        segment?: string;
      }>;
      successMetrics?: Array<{
        name: string;
        current?: number;
        target?: number;
        unit?: string;
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = campaignContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default dates (campaign starts in 1 week, runs 8 weeks)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 56); // 8 weeks

    // Build default target features if not parsed
    const defaultTargetFeatures = [
      { name: 'Advanced Analytics', currentAdoption: 28, targetAdoption: 60, priority: 'high' as const },
      { name: 'Workflow Automations', currentAdoption: 35, targetAdoption: 55, priority: 'high' as const },
      { name: 'Integrations Hub', currentAdoption: 42, targetAdoption: 65, priority: 'medium' as const },
      { name: 'Custom Reports', currentAdoption: 45, targetAdoption: 70, priority: 'medium' as const },
      { name: 'API Access', currentAdoption: 22, targetAdoption: 40, priority: 'low' as const },
    ];

    const defaultUserSegments = [
      { name: 'Power Users', size: 125, currentUsage: 85, potential: 'high' as const },
      { name: 'Regular Users', size: 450, currentUsage: 55, potential: 'high' as const },
      { name: 'Occasional Users', size: 280, currentUsage: 25, potential: 'medium' as const },
      { name: 'New Users (< 30 days)', size: 95, currentUsage: 40, potential: 'medium' as const },
    ];

    const phase1Start = new Date(startDate);
    const phase1End = new Date(startDate);
    phase1End.setDate(phase1End.getDate() + 14);
    const phase2Start = new Date(phase1End);
    phase2Start.setDate(phase2Start.getDate() + 1);
    const phase2End = new Date(phase2Start);
    phase2End.setDate(phase2End.getDate() + 21);
    const phase3Start = new Date(phase2End);
    phase3Start.setDate(phase3Start.getDate() + 1);

    const defaultTimeline = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      phases: [
        {
          name: 'Awareness & Education',
          startDate: phase1Start.toISOString().split('T')[0],
          endDate: phase1End.toISOString().split('T')[0],
          activities: [
            'Launch announcement email to all users',
            'Create feature spotlight in-app banners',
            'Publish help center articles and tutorials',
          ],
        },
        {
          name: 'Activation & Training',
          startDate: phase2Start.toISOString().split('T')[0],
          endDate: phase2End.toISOString().split('T')[0],
          activities: [
            'Host live webinar series (2 sessions)',
            'Send personalized adoption recommendations',
            'Offer 1:1 training sessions for key accounts',
            'Launch in-app guided tours',
          ],
        },
        {
          name: 'Reinforcement & Optimization',
          startDate: phase3Start.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          activities: [
            'Share success stories and case studies',
            'Send progress reports to users',
            'Recognize and reward adoption champions',
          ],
        },
      ],
    };

    const defaultMessaging = [
      {
        channel: 'email' as const,
        subject: 'Unlock the Full Potential of [Product] - New Features You\'re Missing',
        content: 'Hi {{first_name}},\n\nWe noticed you haven\'t explored some of our most powerful features yet. Here\'s what you\'re missing:\n\n• Advanced Analytics - Get deeper insights into your data\n• Workflow Automations - Save hours every week\n\nReady to level up? Join our exclusive training session this Thursday.\n\nBest,\nYour Customer Success Team',
        timing: 'Week 1, Day 1',
        segment: 'All Users',
      },
      {
        channel: 'in-app' as const,
        subject: 'Did you know? Feature Spotlight',
        content: 'Discover how Advanced Analytics can help you make better decisions. Click here for a quick 2-minute tour.',
        timing: 'Week 1-2, On login',
        segment: 'Users not using Analytics',
      },
      {
        channel: 'webinar' as const,
        subject: 'Live Training: Master Advanced Features in 30 Minutes',
        content: 'Webinar script: Welcome attendees, demo key features, Q&A session, share resources, next steps.',
        timing: 'Week 3, Thursday 2pm',
        segment: 'Registered Users',
      },
      {
        channel: 'slack' as const,
        subject: 'Weekly Tip: Feature of the Week',
        content: 'This week\'s feature spotlight: Workflow Automations. Did you know you can automate repetitive tasks and save 5+ hours per week? Here\'s how: [link]',
        timing: 'Weekly, Monday morning',
        segment: 'Slack-connected Users',
      },
    ];

    const defaultSuccessMetrics = [
      { name: 'Overall Feature Adoption', current: 35, target: 55, unit: 'percent' },
      { name: 'Analytics Daily Active Users', current: 145, target: 300, unit: 'users' },
      { name: 'Automations Created', current: 89, target: 250, unit: 'count' },
      { name: 'Webinar Attendance', current: 0, target: 150, unit: 'users' },
      { name: 'Training Completion Rate', current: 25, target: 60, unit: 'percent' },
      { name: 'Feature NPS', current: 42, target: 60, unit: 'count' },
    ];

    const targetFeatures = (parsed.targetFeatures && parsed.targetFeatures.length > 0
      ? parsed.targetFeatures
      : defaultTargetFeatures
    ).map((f, idx) => ({
      id: `feature-${idx + 1}`,
      name: f.name || `Feature ${idx + 1}`,
      currentAdoption: f.currentAdoption || 30,
      targetAdoption: f.targetAdoption || 60,
      priority: (f.priority as 'high' | 'medium' | 'low') || 'medium',
      included: true,
    }));

    const userSegments = (parsed.userSegments && parsed.userSegments.length > 0
      ? parsed.userSegments
      : defaultUserSegments
    ).map((s, idx) => ({
      id: `segment-${idx + 1}`,
      name: s.name || `Segment ${idx + 1}`,
      size: s.size || 100,
      currentUsage: s.currentUsage || 50,
      potential: (s.potential as 'high' | 'medium' | 'low') || 'medium',
      included: true,
    }));

    const timeline = parsed.timeline && parsed.timeline.phases && parsed.timeline.phases.length > 0
      ? {
          startDate: parsed.timeline.startDate || defaultTimeline.startDate,
          endDate: parsed.timeline.endDate || defaultTimeline.endDate,
          phases: parsed.timeline.phases.map((p, idx) => ({
            id: `phase-${idx + 1}`,
            name: p.name || `Phase ${idx + 1}`,
            startDate: p.startDate || defaultTimeline.phases[idx]?.startDate || defaultTimeline.startDate,
            endDate: p.endDate || defaultTimeline.phases[idx]?.endDate || defaultTimeline.endDate,
            activities: p.activities || [],
          })),
        }
      : {
          ...defaultTimeline,
          phases: defaultTimeline.phases.map((p, idx) => ({
            id: `phase-${idx + 1}`,
            ...p,
          })),
        };

    const messaging = (parsed.messaging && parsed.messaging.length > 0
      ? parsed.messaging
      : defaultMessaging
    ).map((m, idx) => ({
      id: `message-${idx + 1}`,
      channel: (m.channel as 'email' | 'in-app' | 'webinar' | 'training' | 'slack' | 'other') || 'email',
      subject: m.subject || '',
      content: m.content || '',
      timing: m.timing || '',
      segment: m.segment || 'All Users',
    }));

    const successMetrics = (parsed.successMetrics && parsed.successMetrics.length > 0
      ? parsed.successMetrics
      : defaultSuccessMetrics
    ).map((m, idx) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      current: m.current || 0,
      target: m.target || 50,
      unit: m.unit || 'percent',
    }));

    return {
      title: parsed.title || `Feature Adoption Campaign: ${customerName}`,
      campaignGoal: parsed.campaignGoal || 'Drive adoption of underutilized features to improve customer value realization and reduce churn risk.',
      targetFeatures,
      userSegments,
      timeline,
      messaging,
      successMetrics,
      notes: parsed.notes || 'Review target features, user segments, and messaging. Customize timeline and success metrics as needed.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Feature campaign preview generation error:', error);

    // Return fallback feature campaign
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() + 7);
    const fallbackEnd = new Date(fallbackStart);
    fallbackEnd.setDate(fallbackEnd.getDate() + 56);

    return {
      title: `Feature Adoption Campaign: ${customerName}`,
      campaignGoal: 'Drive adoption of underutilized features to improve customer value realization.',
      targetFeatures: [
        { id: 'feature-1', name: 'Advanced Analytics', currentAdoption: 30, targetAdoption: 60, priority: 'high', included: true },
        { id: 'feature-2', name: 'Workflow Automations', currentAdoption: 35, targetAdoption: 55, priority: 'high', included: true },
        { id: 'feature-3', name: 'Integrations', currentAdoption: 40, targetAdoption: 65, priority: 'medium', included: true },
      ],
      userSegments: [
        { id: 'segment-1', name: 'Power Users', size: 100, currentUsage: 80, potential: 'high', included: true },
        { id: 'segment-2', name: 'Regular Users', size: 400, currentUsage: 50, potential: 'high', included: true },
        { id: 'segment-3', name: 'Low Activity Users', size: 200, currentUsage: 20, potential: 'medium', included: true },
      ],
      timeline: {
        startDate: fallbackStart.toISOString().split('T')[0],
        endDate: fallbackEnd.toISOString().split('T')[0],
        phases: [
          { id: 'phase-1', name: 'Awareness', startDate: fallbackStart.toISOString().split('T')[0], endDate: fallbackStart.toISOString().split('T')[0], activities: ['Launch announcement', 'Create content'] },
          { id: 'phase-2', name: 'Training', startDate: fallbackStart.toISOString().split('T')[0], endDate: fallbackEnd.toISOString().split('T')[0], activities: ['Host webinars', 'Offer 1:1 sessions'] },
        ],
      },
      messaging: [
        { id: 'message-1', channel: 'email', subject: 'Discover New Features', content: 'Email content here...', timing: 'Week 1', segment: 'All Users' },
        { id: 'message-2', channel: 'in-app', subject: 'Feature Spotlight', content: 'In-app message...', timing: 'Ongoing', segment: 'Low Adoption Users' },
      ],
      successMetrics: [
        { id: 'metric-1', name: 'Feature Adoption Rate', current: 35, target: 55, unit: 'percent' },
        { id: 'metric-2', name: 'Training Completion', current: 20, target: 50, unit: 'percent' },
        { id: 'metric-3', name: 'Active Users', current: 500, target: 700, unit: 'users' },
      ],
      notes: '',
    };
  }
}

/**
 * Champion development preview result for HITL review
 */
interface ChampionDevelopmentPreviewResult {
  title: string;
  programGoal: string;
  candidates: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    engagementScore: number;
    npsScore: number;
    potentialLevel: 'high' | 'medium' | 'low';
    strengths: string[];
    developmentAreas: string[];
    selected: boolean;
  }>;
  activities: Array<{
    id: string;
    name: string;
    description: string;
    category: 'training' | 'recognition' | 'networking' | 'contribution' | 'leadership';
    frequency: string;
    owner: string;
    enabled: boolean;
  }>;
  rewards: Array<{
    id: string;
    name: string;
    description: string;
    type: 'recognition' | 'access' | 'swag' | 'event' | 'certificate';
    criteria: string;
    enabled: boolean;
  }>;
  timeline: {
    startDate: string;
    endDate: string;
    milestones: Array<{
      id: string;
      name: string;
      date: string;
      description: string;
    }>;
  };
  successMetrics: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    unit: string;
  }>;
  notes: string;
}

/**
 * Generate champion development preview for HITL review
 * Returns editable preview with champion candidates, development activities, rewards, and timeline
 */
async function generateChampionDevelopmentPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<ChampionDevelopmentPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get engagement metrics from context
  const engagement = context.platformData.engagementMetrics;

  // Build prompt for champion development generation
  const prompt = `You are a customer success manager creating a champion development program. Generate a comprehensive plan to identify, nurture, and develop customer champions who will advocate for your product.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${engagement ? `Current Engagement Data:
- Feature Adoption: ${engagement.featureAdoption}%
- Login Frequency: ${engagement.loginFrequency} per week
- Last Activity: ${engagement.lastActivityDays} days ago` : ''}

Generate a champion development program with:
1. Program title and primary goal
2. 3-5 champion candidates with engagement scores, NPS, strengths, and development areas
3. 4-6 development activities across categories (training, recognition, networking, contribution, leadership)
4. 3-5 recognition rewards with criteria
5. Program timeline with 3-4 key milestones
6. 4-6 success metrics with current baselines and targets

Format your response as JSON:
{
  "title": "Program title",
  "programGoal": "Primary goal description",
  "candidates": [
    {
      "name": "Person name",
      "role": "Job title",
      "email": "email@example.com",
      "engagementScore": number (0-100),
      "npsScore": number (-100 to 100),
      "potentialLevel": "high|medium|low",
      "strengths": ["Strength 1", "Strength 2"],
      "developmentAreas": ["Area 1", "Area 2"]
    }
  ],
  "activities": [
    {
      "name": "Activity name",
      "description": "What this activity involves",
      "category": "training|recognition|networking|contribution|leadership",
      "frequency": "Weekly|Monthly|Quarterly|As needed",
      "owner": "CSM|Customer|Product Team|Community"
    }
  ],
  "rewards": [
    {
      "name": "Reward name",
      "description": "What the champion receives",
      "type": "recognition|access|swag|event|certificate",
      "criteria": "How to earn this reward"
    }
  ],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "milestones": [
      {
        "name": "Milestone name",
        "date": "YYYY-MM-DD",
        "description": "What happens at this milestone"
      }
    ]
  },
  "successMetrics": [
    {
      "name": "Metric name",
      "current": number,
      "target": number,
      "unit": "percent|count|score|users"
    }
  ],
  "notes": "Additional program notes"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const programContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      programGoal?: string;
      candidates?: Array<{
        name: string;
        role?: string;
        email?: string;
        engagementScore?: number;
        npsScore?: number;
        potentialLevel?: string;
        strengths?: string[];
        developmentAreas?: string[];
      }>;
      activities?: Array<{
        name: string;
        description?: string;
        category?: string;
        frequency?: string;
        owner?: string;
      }>;
      rewards?: Array<{
        name: string;
        description?: string;
        type?: string;
        criteria?: string;
      }>;
      timeline?: {
        startDate?: string;
        endDate?: string;
        milestones?: Array<{
          name: string;
          date?: string;
          description?: string;
        }>;
      };
      successMetrics?: Array<{
        name: string;
        current?: number;
        target?: number;
        unit?: string;
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = programContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default dates (program starts in 2 weeks, runs 12 weeks)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 14);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 84); // 12 weeks

    // Default champion candidates
    const defaultCandidates = [
      {
        name: 'Sarah Chen',
        role: 'Product Manager',
        email: 'sarah.chen@example.com',
        engagementScore: 92,
        npsScore: 9,
        potentialLevel: 'high' as const,
        strengths: ['Power user', 'Active in community', 'Provides valuable feedback'],
        developmentAreas: ['Public speaking', 'Content creation'],
      },
      {
        name: 'Marcus Johnson',
        role: 'Team Lead',
        email: 'marcus.j@example.com',
        engagementScore: 88,
        npsScore: 8,
        potentialLevel: 'high' as const,
        strengths: ['Technical expertise', 'Trains team members', 'Early adopter'],
        developmentAreas: ['Cross-department advocacy', 'Case study participation'],
      },
      {
        name: 'Emily Rodriguez',
        role: 'Operations Analyst',
        email: 'emily.r@example.com',
        engagementScore: 78,
        npsScore: 7,
        potentialLevel: 'medium' as const,
        strengths: ['Creates documentation', 'Consistent usage', 'Positive attitude'],
        developmentAreas: ['Feature exploration', 'Leadership opportunities'],
      },
      {
        name: 'David Kim',
        role: 'Senior Developer',
        email: 'david.kim@example.com',
        engagementScore: 85,
        npsScore: 8,
        potentialLevel: 'high' as const,
        strengths: ['API integration expert', 'Builds internal tools', 'Shares best practices'],
        developmentAreas: ['Customer reference calls', 'Conference speaking'],
      },
    ];

    const defaultActivities = [
      {
        name: 'Champion Training Program',
        description: 'Advanced product training and certification for champions',
        category: 'training' as const,
        frequency: 'Monthly',
        owner: 'CSM',
      },
      {
        name: 'Champion Recognition Awards',
        description: 'Monthly recognition for champion contributions',
        category: 'recognition' as const,
        frequency: 'Monthly',
        owner: 'CSM',
      },
      {
        name: 'Champion Network Events',
        description: 'Virtual meetups for champions to connect and share',
        category: 'networking' as const,
        frequency: 'Quarterly',
        owner: 'Community',
      },
      {
        name: 'Product Advisory Board',
        description: 'Champions provide input on product roadmap',
        category: 'contribution' as const,
        frequency: 'Quarterly',
        owner: 'Product Team',
      },
      {
        name: 'Mentorship Program',
        description: 'Champions mentor new users within their organization',
        category: 'leadership' as const,
        frequency: 'Ongoing',
        owner: 'Customer',
      },
      {
        name: 'Content Contribution',
        description: 'Champions create tips, tutorials, or case studies',
        category: 'contribution' as const,
        frequency: 'As needed',
        owner: 'Customer',
      },
    ];

    const defaultRewards = [
      {
        name: 'Champion of the Month',
        description: 'Featured recognition in newsletter and community',
        type: 'recognition' as const,
        criteria: 'Outstanding contribution or advocacy',
      },
      {
        name: 'Early Access Program',
        description: 'Beta access to new features before general release',
        type: 'access' as const,
        criteria: 'Active champion for 3+ months',
      },
      {
        name: 'Champion Swag Kit',
        description: 'Exclusive branded merchandise and gifts',
        type: 'swag' as const,
        criteria: 'Complete champion onboarding',
      },
      {
        name: 'VIP Conference Pass',
        description: 'Free ticket to annual user conference',
        type: 'event' as const,
        criteria: 'Top 10% champion engagement',
      },
      {
        name: 'Champion Certification',
        description: 'Official certification badge and credential',
        type: 'certificate' as const,
        criteria: 'Complete advanced training program',
      },
    ];

    const milestone1Date = new Date(startDate);
    milestone1Date.setDate(milestone1Date.getDate() + 7);
    const milestone2Date = new Date(startDate);
    milestone2Date.setDate(milestone2Date.getDate() + 30);
    const milestone3Date = new Date(startDate);
    milestone3Date.setDate(milestone3Date.getDate() + 60);

    const defaultTimeline = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      milestones: [
        {
          name: 'Program Launch',
          date: startDate.toISOString().split('T')[0],
          description: 'Kick off champion program with initial cohort',
        },
        {
          name: 'First Champion Training',
          date: milestone1Date.toISOString().split('T')[0],
          description: 'Complete first advanced training session',
        },
        {
          name: 'Mid-Program Review',
          date: milestone2Date.toISOString().split('T')[0],
          description: 'Assess progress and gather champion feedback',
        },
        {
          name: 'Program Expansion',
          date: milestone3Date.toISOString().split('T')[0],
          description: 'Invite second cohort based on learnings',
        },
      ],
    };

    const defaultSuccessMetrics = [
      { name: 'Active Champions', current: 0, target: 10, unit: 'users' },
      { name: 'Champion Engagement Score', current: 0, target: 85, unit: 'score' },
      { name: 'Internal Training Sessions', current: 0, target: 20, unit: 'count' },
      { name: 'Reference Calls Completed', current: 0, target: 5, unit: 'count' },
      { name: 'Content Contributions', current: 0, target: 15, unit: 'count' },
      { name: 'Champion NPS', current: 0, target: 9, unit: 'score' },
    ];

    const candidates = (parsed.candidates && parsed.candidates.length > 0
      ? parsed.candidates
      : defaultCandidates
    ).map((c, idx) => ({
      id: `candidate-${idx + 1}`,
      name: c.name || `Champion ${idx + 1}`,
      role: c.role || 'Team Member',
      email: c.email || `champion${idx + 1}@example.com`,
      engagementScore: c.engagementScore || 75,
      npsScore: c.npsScore || 7,
      potentialLevel: (c.potentialLevel as 'high' | 'medium' | 'low') || 'medium',
      strengths: c.strengths || ['Active user'],
      developmentAreas: c.developmentAreas || ['Leadership'],
      selected: true,
    }));

    const activities = (parsed.activities && parsed.activities.length > 0
      ? parsed.activities
      : defaultActivities
    ).map((a, idx) => ({
      id: `activity-${idx + 1}`,
      name: a.name || `Activity ${idx + 1}`,
      description: a.description || '',
      category: (a.category as 'training' | 'recognition' | 'networking' | 'contribution' | 'leadership') || 'training',
      frequency: a.frequency || 'Monthly',
      owner: a.owner || 'CSM',
      enabled: true,
    }));

    const rewards = (parsed.rewards && parsed.rewards.length > 0
      ? parsed.rewards
      : defaultRewards
    ).map((r, idx) => ({
      id: `reward-${idx + 1}`,
      name: r.name || `Reward ${idx + 1}`,
      description: r.description || '',
      type: (r.type as 'recognition' | 'access' | 'swag' | 'event' | 'certificate') || 'recognition',
      criteria: r.criteria || '',
      enabled: true,
    }));

    const timeline = parsed.timeline && parsed.timeline.milestones && parsed.timeline.milestones.length > 0
      ? {
          startDate: parsed.timeline.startDate || defaultTimeline.startDate,
          endDate: parsed.timeline.endDate || defaultTimeline.endDate,
          milestones: parsed.timeline.milestones.map((m, idx) => ({
            id: `milestone-${idx + 1}`,
            name: m.name || `Milestone ${idx + 1}`,
            date: m.date || defaultTimeline.milestones[idx]?.date || defaultTimeline.startDate,
            description: m.description || '',
          })),
        }
      : {
          ...defaultTimeline,
          milestones: defaultTimeline.milestones.map((m, idx) => ({
            id: `milestone-${idx + 1}`,
            ...m,
          })),
        };

    const successMetrics = (parsed.successMetrics && parsed.successMetrics.length > 0
      ? parsed.successMetrics
      : defaultSuccessMetrics
    ).map((m, idx) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      current: m.current || 0,
      target: m.target || 50,
      unit: m.unit || 'count',
    }));

    return {
      title: parsed.title || `Champion Development Program: ${customerName}`,
      programGoal: parsed.programGoal || 'Identify and develop customer champions who will advocate for our product, drive internal adoption, and provide valuable feedback for product improvement.',
      candidates,
      activities,
      rewards,
      timeline,
      successMetrics,
      notes: parsed.notes || 'Review champion candidates, customize activities and rewards, and adjust timeline milestones as needed.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Champion development preview generation error:', error);

    // Return fallback champion development program
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() + 14);
    const fallbackEnd = new Date(fallbackStart);
    fallbackEnd.setDate(fallbackEnd.getDate() + 84);

    return {
      title: `Champion Development Program: ${customerName}`,
      programGoal: 'Identify and develop customer champions who will advocate for our product.',
      candidates: [
        { id: 'candidate-1', name: 'Sarah Chen', role: 'Product Manager', email: 'sarah@example.com', engagementScore: 90, npsScore: 9, potentialLevel: 'high', strengths: ['Power user', 'Community active'], developmentAreas: ['Public speaking'], selected: true },
        { id: 'candidate-2', name: 'Marcus Johnson', role: 'Team Lead', email: 'marcus@example.com', engagementScore: 85, npsScore: 8, potentialLevel: 'high', strengths: ['Technical expertise', 'Trains team'], developmentAreas: ['Content creation'], selected: true },
        { id: 'candidate-3', name: 'Emily Rodriguez', role: 'Analyst', email: 'emily@example.com', engagementScore: 78, npsScore: 7, potentialLevel: 'medium', strengths: ['Documentation', 'Consistent usage'], developmentAreas: ['Feature exploration'], selected: true },
      ],
      activities: [
        { id: 'activity-1', name: 'Champion Training', description: 'Advanced product training', category: 'training', frequency: 'Monthly', owner: 'CSM', enabled: true },
        { id: 'activity-2', name: 'Recognition Awards', description: 'Monthly champion recognition', category: 'recognition', frequency: 'Monthly', owner: 'CSM', enabled: true },
        { id: 'activity-3', name: 'Network Events', description: 'Champion meetups', category: 'networking', frequency: 'Quarterly', owner: 'Community', enabled: true },
      ],
      rewards: [
        { id: 'reward-1', name: 'Champion of the Month', description: 'Featured recognition', type: 'recognition', criteria: 'Outstanding contribution', enabled: true },
        { id: 'reward-2', name: 'Early Access', description: 'Beta feature access', type: 'access', criteria: '3+ months active', enabled: true },
        { id: 'reward-3', name: 'Swag Kit', description: 'Branded merchandise', type: 'swag', criteria: 'Complete onboarding', enabled: true },
      ],
      timeline: {
        startDate: fallbackStart.toISOString().split('T')[0],
        endDate: fallbackEnd.toISOString().split('T')[0],
        milestones: [
          { id: 'milestone-1', name: 'Program Launch', date: fallbackStart.toISOString().split('T')[0], description: 'Kick off with initial cohort' },
          { id: 'milestone-2', name: 'First Training', date: fallbackStart.toISOString().split('T')[0], description: 'Complete first session' },
        ],
      },
      successMetrics: [
        { id: 'metric-1', name: 'Active Champions', current: 0, target: 10, unit: 'users' },
        { id: 'metric-2', name: 'Engagement Score', current: 0, target: 85, unit: 'score' },
        { id: 'metric-3', name: 'Training Sessions', current: 0, target: 20, unit: 'count' },
      ],
      notes: '',
    };
  }
}

/**
 * Training program preview result for HITL review
 */
interface TrainingProgramPreviewResult {
  title: string;
  programGoal: string;
  modules: Array<{
    id: string;
    name: string;
    description: string;
    duration: string;
    order: number;
    learningObjectives: string[];
    assessmentCriteria: string[];
    prerequisites: string[];
    resources: Array<{
      id: string;
      name: string;
      type: 'video' | 'document' | 'quiz' | 'hands-on' | 'webinar';
      url?: string;
    }>;
    enabled: boolean;
  }>;
  targetAudience: Array<{
    id: string;
    name: string;
    role: string;
    currentSkillLevel: 'beginner' | 'intermediate' | 'advanced';
    targetSkillLevel: 'beginner' | 'intermediate' | 'advanced';
    included: boolean;
  }>;
  timeline: {
    startDate: string;
    endDate: string;
    totalDuration: string;
  };
  completionCriteria: Array<{
    id: string;
    name: string;
    type: 'attendance' | 'assessment' | 'project' | 'certification';
    requiredScore?: number;
    enabled: boolean;
  }>;
  successMetrics: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    unit: string;
  }>;
  notes: string;
}

/**
 * Generate training program preview for HITL review
 */
async function generateTrainingProgramPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<TrainingProgramPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;

  // Get engagement metrics from context
  const engagement = context.platformData.engagementMetrics;

  // Build prompt for training program generation
  const prompt = `You are a customer success manager creating a comprehensive training program curriculum. Generate a structured training program with modules, learning objectives, and assessments.

Customer: ${customerName}
Health Score: ${healthScore}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${engagement ? `Current Engagement Data:
- Feature Adoption: ${engagement.featureAdoption}%
- Login Frequency: ${engagement.loginFrequency} per week
- Last Activity: ${engagement.lastActivityDays} days ago` : ''}

Generate a training program curriculum with:
1. Program title and primary learning goal
2. 4-6 training modules with learning objectives, prerequisites, assessment criteria, and resources
3. 3-4 target audience segments with current and target skill levels
4. Program timeline with total duration
5. 3-5 completion criteria (attendance, assessments, projects, certifications)
6. 4-6 success metrics with baselines and targets

Format your response as JSON:
{
  "title": "Program title",
  "programGoal": "Primary learning goal description",
  "modules": [
    {
      "name": "Module name",
      "description": "What this module covers",
      "duration": "2 hours",
      "order": 1,
      "learningObjectives": ["Objective 1", "Objective 2"],
      "assessmentCriteria": ["Criteria 1", "Criteria 2"],
      "prerequisites": ["Prerequisite 1"],
      "resources": [
        {
          "name": "Resource name",
          "type": "video|document|quiz|hands-on|webinar",
          "url": "optional url"
        }
      ]
    }
  ],
  "targetAudience": [
    {
      "name": "Audience name",
      "role": "Job role",
      "currentSkillLevel": "beginner|intermediate|advanced",
      "targetSkillLevel": "beginner|intermediate|advanced"
    }
  ],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "totalDuration": "4 weeks"
  },
  "completionCriteria": [
    {
      "name": "Criteria name",
      "type": "attendance|assessment|project|certification",
      "requiredScore": number (optional, for assessments)
    }
  ],
  "successMetrics": [
    {
      "name": "Metric name",
      "current": number,
      "target": number,
      "unit": "percent|count|score|hours"
    }
  ],
  "notes": "Additional program notes"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const programContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      title?: string;
      programGoal?: string;
      modules?: Array<{
        name: string;
        description?: string;
        duration?: string;
        order?: number;
        learningObjectives?: string[];
        assessmentCriteria?: string[];
        prerequisites?: string[];
        resources?: Array<{
          name: string;
          type?: string;
          url?: string;
        }>;
      }>;
      targetAudience?: Array<{
        name: string;
        role?: string;
        currentSkillLevel?: string;
        targetSkillLevel?: string;
      }>;
      timeline?: {
        startDate?: string;
        endDate?: string;
        totalDuration?: string;
      };
      completionCriteria?: Array<{
        name: string;
        type?: string;
        requiredScore?: number;
      }>;
      successMetrics?: Array<{
        name: string;
        current?: number;
        target?: number;
        unit?: string;
      }>;
      notes?: string;
    } = {};

    try {
      const jsonMatch = programContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default dates (program starts in 2 weeks, runs 6 weeks)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 14);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 42); // 6 weeks

    // Default modules
    const defaultModules = [
      {
        name: 'Platform Fundamentals',
        description: 'Core concepts and navigation basics',
        duration: '2 hours',
        order: 1,
        learningObjectives: [
          'Navigate the platform interface confidently',
          'Understand core terminology and concepts',
          'Set up user preferences and account settings',
        ],
        assessmentCriteria: [
          'Complete navigation assessment with 80%+ score',
          'Configure personal workspace settings',
        ],
        prerequisites: [],
        resources: [
          { name: 'Platform Overview Video', type: 'video' as const },
          { name: 'Getting Started Guide', type: 'document' as const },
          { name: 'Navigation Quiz', type: 'quiz' as const },
        ],
      },
      {
        name: 'Core Features Deep Dive',
        description: 'Detailed training on primary features',
        duration: '3 hours',
        order: 2,
        learningObjectives: [
          'Master core feature functionality',
          'Apply features to common use cases',
          'Troubleshoot common issues independently',
        ],
        assessmentCriteria: [
          'Complete hands-on exercises for each feature',
          'Score 85%+ on feature proficiency test',
        ],
        prerequisites: ['Platform Fundamentals'],
        resources: [
          { name: 'Feature Training Webinar', type: 'webinar' as const },
          { name: 'Feature Reference Guide', type: 'document' as const },
          { name: 'Hands-on Lab Exercises', type: 'hands-on' as const },
        ],
      },
      {
        name: 'Advanced Workflows',
        description: 'Complex workflows and automation',
        duration: '2.5 hours',
        order: 3,
        learningObjectives: [
          'Build automated workflows',
          'Configure advanced settings and integrations',
          'Optimize processes for efficiency',
        ],
        assessmentCriteria: [
          'Create a working automation workflow',
          'Complete integration setup successfully',
        ],
        prerequisites: ['Core Features Deep Dive'],
        resources: [
          { name: 'Workflow Automation Video', type: 'video' as const },
          { name: 'Automation Templates', type: 'document' as const },
          { name: 'Integration Lab', type: 'hands-on' as const },
        ],
      },
      {
        name: 'Best Practices & Tips',
        description: 'Expert tips and efficiency techniques',
        duration: '1.5 hours',
        order: 4,
        learningObjectives: [
          'Apply proven best practices',
          'Leverage keyboard shortcuts and productivity tips',
          'Avoid common pitfalls and mistakes',
        ],
        assessmentCriteria: [
          'Demonstrate 5+ productivity shortcuts',
          'Apply best practices in scenario exercise',
        ],
        prerequisites: ['Core Features Deep Dive'],
        resources: [
          { name: 'Best Practices Webinar', type: 'webinar' as const },
          { name: 'Pro Tips Cheat Sheet', type: 'document' as const },
        ],
      },
      {
        name: 'Reporting & Analytics',
        description: 'Data analysis and reporting capabilities',
        duration: '2 hours',
        order: 5,
        learningObjectives: [
          'Create custom reports and dashboards',
          'Interpret analytics data correctly',
          'Export and share insights effectively',
        ],
        assessmentCriteria: [
          'Build a custom dashboard',
          'Generate and interpret key reports',
        ],
        prerequisites: ['Platform Fundamentals'],
        resources: [
          { name: 'Analytics Training Video', type: 'video' as const },
          { name: 'Reporting Guide', type: 'document' as const },
          { name: 'Dashboard Builder Lab', type: 'hands-on' as const },
        ],
      },
      {
        name: 'Admin & Team Management',
        description: 'Administrative features and team setup',
        duration: '1.5 hours',
        order: 6,
        learningObjectives: [
          'Manage user roles and permissions',
          'Configure team settings and policies',
          'Monitor usage and compliance',
        ],
        assessmentCriteria: [
          'Set up team structure correctly',
          'Configure role-based permissions',
        ],
        prerequisites: ['Platform Fundamentals', 'Core Features Deep Dive'],
        resources: [
          { name: 'Admin Guide', type: 'document' as const },
          { name: 'Admin Certification Quiz', type: 'quiz' as const },
        ],
      },
    ];

    const defaultTargetAudience = [
      {
        name: 'End Users',
        role: 'Daily platform users',
        currentSkillLevel: 'beginner' as const,
        targetSkillLevel: 'intermediate' as const,
      },
      {
        name: 'Power Users',
        role: 'Advanced users and team leads',
        currentSkillLevel: 'intermediate' as const,
        targetSkillLevel: 'advanced' as const,
      },
      {
        name: 'Administrators',
        role: 'System administrators',
        currentSkillLevel: 'beginner' as const,
        targetSkillLevel: 'advanced' as const,
      },
      {
        name: 'Managers',
        role: 'Team managers needing reporting skills',
        currentSkillLevel: 'beginner' as const,
        targetSkillLevel: 'intermediate' as const,
      },
    ];

    const defaultCompletionCriteria = [
      { name: 'Module Attendance', type: 'attendance' as const, requiredScore: undefined },
      { name: 'Knowledge Assessments', type: 'assessment' as const, requiredScore: 80 },
      { name: 'Hands-on Project', type: 'project' as const, requiredScore: undefined },
      { name: 'Final Certification', type: 'certification' as const, requiredScore: 85 },
    ];

    const defaultSuccessMetrics = [
      { name: 'Training Completion Rate', current: 0, target: 90, unit: 'percent' },
      { name: 'Average Assessment Score', current: 0, target: 85, unit: 'score' },
      { name: 'Feature Adoption Post-Training', current: 45, target: 80, unit: 'percent' },
      { name: 'Support Tickets Reduction', current: 100, target: 60, unit: 'count' },
      { name: 'Time to Proficiency', current: 30, target: 14, unit: 'days' },
      { name: 'User Satisfaction Score', current: 0, target: 4.5, unit: 'score' },
    ];

    const modules = (parsed.modules && parsed.modules.length > 0
      ? parsed.modules
      : defaultModules
    ).map((m, idx) => ({
      id: `module-${idx + 1}`,
      name: m.name || `Module ${idx + 1}`,
      description: m.description || '',
      duration: m.duration || '2 hours',
      order: m.order || idx + 1,
      learningObjectives: m.learningObjectives || ['Learning objective'],
      assessmentCriteria: m.assessmentCriteria || ['Assessment criteria'],
      prerequisites: m.prerequisites || [],
      resources: (m.resources || []).map((r, rIdx) => ({
        id: `resource-${idx + 1}-${rIdx + 1}`,
        name: r.name || `Resource ${rIdx + 1}`,
        type: (r.type as 'video' | 'document' | 'quiz' | 'hands-on' | 'webinar') || 'document',
        url: r.url,
      })),
      enabled: true,
    }));

    const targetAudience = (parsed.targetAudience && parsed.targetAudience.length > 0
      ? parsed.targetAudience
      : defaultTargetAudience
    ).map((a, idx) => ({
      id: `audience-${idx + 1}`,
      name: a.name || `Audience ${idx + 1}`,
      role: a.role || 'Team Member',
      currentSkillLevel: (a.currentSkillLevel as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
      targetSkillLevel: (a.targetSkillLevel as 'beginner' | 'intermediate' | 'advanced') || 'intermediate',
      included: true,
    }));

    const timeline = {
      startDate: parsed.timeline?.startDate || startDate.toISOString().split('T')[0],
      endDate: parsed.timeline?.endDate || endDate.toISOString().split('T')[0],
      totalDuration: parsed.timeline?.totalDuration || '6 weeks',
    };

    const completionCriteria = (parsed.completionCriteria && parsed.completionCriteria.length > 0
      ? parsed.completionCriteria
      : defaultCompletionCriteria
    ).map((c, idx) => ({
      id: `criteria-${idx + 1}`,
      name: c.name || `Criteria ${idx + 1}`,
      type: (c.type as 'attendance' | 'assessment' | 'project' | 'certification') || 'attendance',
      requiredScore: c.requiredScore,
      enabled: true,
    }));

    const successMetrics = (parsed.successMetrics && parsed.successMetrics.length > 0
      ? parsed.successMetrics
      : defaultSuccessMetrics
    ).map((m, idx) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      current: m.current || 0,
      target: m.target || 50,
      unit: m.unit || 'percent',
    }));

    return {
      title: parsed.title || `Training Program: ${customerName}`,
      programGoal: parsed.programGoal || 'Equip users with comprehensive knowledge and skills to maximize product adoption and drive business outcomes.',
      modules,
      targetAudience,
      timeline,
      completionCriteria,
      successMetrics,
      notes: parsed.notes || 'Review modules, adjust durations based on audience needs, and customize assessments for your team.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Training program preview generation error:', error);

    // Return fallback training program
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() + 14);
    const fallbackEnd = new Date(fallbackStart);
    fallbackEnd.setDate(fallbackEnd.getDate() + 42);

    return {
      title: `Training Program: ${customerName}`,
      programGoal: 'Equip users with comprehensive knowledge and skills to maximize product adoption.',
      modules: [
        {
          id: 'module-1',
          name: 'Platform Fundamentals',
          description: 'Core concepts and navigation',
          duration: '2 hours',
          order: 1,
          learningObjectives: ['Navigate the interface', 'Understand core concepts'],
          assessmentCriteria: ['Complete navigation quiz'],
          prerequisites: [],
          resources: [
            { id: 'resource-1-1', name: 'Overview Video', type: 'video' },
            { id: 'resource-1-2', name: 'Getting Started Guide', type: 'document' },
          ],
          enabled: true,
        },
        {
          id: 'module-2',
          name: 'Core Features',
          description: 'Primary feature training',
          duration: '3 hours',
          order: 2,
          learningObjectives: ['Master core features', 'Apply to use cases'],
          assessmentCriteria: ['Complete hands-on exercises', 'Pass proficiency test'],
          prerequisites: ['Platform Fundamentals'],
          resources: [
            { id: 'resource-2-1', name: 'Feature Webinar', type: 'webinar' },
            { id: 'resource-2-2', name: 'Lab Exercises', type: 'hands-on' },
          ],
          enabled: true,
        },
        {
          id: 'module-3',
          name: 'Advanced Workflows',
          description: 'Automation and integrations',
          duration: '2 hours',
          order: 3,
          learningObjectives: ['Build workflows', 'Configure integrations'],
          assessmentCriteria: ['Create working automation'],
          prerequisites: ['Core Features'],
          resources: [
            { id: 'resource-3-1', name: 'Automation Video', type: 'video' },
            { id: 'resource-3-2', name: 'Integration Lab', type: 'hands-on' },
          ],
          enabled: true,
        },
      ],
      targetAudience: [
        { id: 'audience-1', name: 'End Users', role: 'Daily users', currentSkillLevel: 'beginner', targetSkillLevel: 'intermediate', included: true },
        { id: 'audience-2', name: 'Power Users', role: 'Advanced users', currentSkillLevel: 'intermediate', targetSkillLevel: 'advanced', included: true },
        { id: 'audience-3', name: 'Admins', role: 'System administrators', currentSkillLevel: 'beginner', targetSkillLevel: 'advanced', included: true },
      ],
      timeline: {
        startDate: fallbackStart.toISOString().split('T')[0],
        endDate: fallbackEnd.toISOString().split('T')[0],
        totalDuration: '6 weeks',
      },
      completionCriteria: [
        { id: 'criteria-1', name: 'Module Attendance', type: 'attendance', requiredScore: undefined, enabled: true },
        { id: 'criteria-2', name: 'Knowledge Assessments', type: 'assessment', requiredScore: 80, enabled: true },
        { id: 'criteria-3', name: 'Final Certification', type: 'certification', requiredScore: 85, enabled: true },
      ],
      successMetrics: [
        { id: 'metric-1', name: 'Training Completion', current: 0, target: 90, unit: 'percent' },
        { id: 'metric-2', name: 'Assessment Score', current: 0, target: 85, unit: 'score' },
        { id: 'metric-3', name: 'Feature Adoption', current: 45, target: 80, unit: 'percent' },
      ],
      notes: '',
    };
  }
}

// ============================================================================
// Renewal Forecast Preview Generator
// ============================================================================

interface RiskFactor {
  id: string;
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  impact: number; // -10 to -30 for negative factors
  enabled: boolean;
}

interface PositiveSignal {
  id: string;
  name: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  impact: number; // +5 to +20 for positive factors
  enabled: boolean;
}

interface RecommendedAction {
  id: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ProbabilityFactor {
  id: string;
  name: string;
  weight: number; // 0-100
  score: number; // 0-100
  description: string;
}

interface RenewalForecastPreviewResult {
  title: string;
  renewalDate: string;
  currentProbability: number;
  targetProbability: number;
  arr: number;
  contractTerm: string;
  probabilityFactors: ProbabilityFactor[];
  riskFactors: RiskFactor[];
  positiveSignals: PositiveSignal[];
  recommendedActions: RecommendedAction[];
  historicalContext: string;
  notes: string;
}

async function generateRenewalForecastPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<RenewalForecastPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const arr = customer?.arr || 100000;
  const renewalDate = customer?.renewalDate || (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  })();

  // Get risk signals and health trends from context
  const riskSignals = context.platformData.riskSignals || [];
  const healthTrends = context.platformData.healthTrends || [];
  const engagement = context.platformData.engagementMetrics;

  // Build prompt for renewal forecast generation
  const prompt = `You are a customer success manager creating a renewal forecast for a customer account. Generate a comprehensive renewal probability analysis with risk factors, positive signals, and recommended actions.

Customer: ${customerName}
Health Score: ${healthScore}
ARR: $${arr.toLocaleString()}
Renewal Date: ${renewalDate}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

${engagement ? `Engagement Metrics:
- Feature Adoption: ${engagement.featureAdoption}%
- Login Frequency: ${engagement.loginFrequency} per week
- Last Activity: ${engagement.lastActivityDays} days ago` : ''}

${riskSignals.length > 0 ? `Known Risk Signals:
${riskSignals.map((r: any) => `- ${r.type}: ${r.description} (${r.severity})`).join('\n')}` : ''}

${healthTrends.length > 0 ? `Recent Health Score: ${healthTrends[healthTrends.length - 1]?.score || 'N/A'}` : ''}

Generate a renewal forecast with:
1. Overall renewal probability (0-100%)
2. 4-6 probability scoring factors with weights
3. 3-5 risk factors that could impact renewal negatively
4. 3-5 positive signals that support renewal
5. 4-6 recommended actions to improve renewal probability
6. Historical context note

Format your response as JSON:
{
  "currentProbability": number (0-100),
  "targetProbability": number (0-100, always higher than current),
  "contractTerm": "12 months",
  "probabilityFactors": [
    {
      "name": "Factor name",
      "weight": number (0-100, all weights should sum to 100),
      "score": number (0-100),
      "description": "Why this score"
    }
  ],
  "riskFactors": [
    {
      "name": "Risk name",
      "description": "Detailed description",
      "severity": "high|medium|low",
      "impact": number (-10 to -30)
    }
  ],
  "positiveSignals": [
    {
      "name": "Signal name",
      "description": "Detailed description",
      "strength": "strong|moderate|weak",
      "impact": number (5 to 20)
    }
  ],
  "recommendedActions": [
    {
      "action": "Action description",
      "priority": "high|medium|low",
      "owner": "CSM|Account Executive|Support|Product|Executive",
      "dueDate": "YYYY-MM-DD"
    }
  ],
  "historicalContext": "Brief note about renewal history or patterns"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const forecastContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      currentProbability?: number;
      targetProbability?: number;
      contractTerm?: string;
      probabilityFactors?: Array<{
        name: string;
        weight?: number;
        score?: number;
        description?: string;
      }>;
      riskFactors?: Array<{
        name: string;
        description?: string;
        severity?: string;
        impact?: number;
      }>;
      positiveSignals?: Array<{
        name: string;
        description?: string;
        strength?: string;
        impact?: number;
      }>;
      recommendedActions?: Array<{
        action: string;
        priority?: string;
        owner?: string;
        dueDate?: string;
      }>;
      historicalContext?: string;
    } = {};

    try {
      const jsonMatch = forecastContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Calculate days until renewal
    const today = new Date();
    const renewal = new Date(renewalDate);
    const daysUntilRenewal = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Default probability factors
    const defaultProbabilityFactors = [
      { name: 'Health Score', weight: 25, score: healthScore, description: `Current health score: ${healthScore}` },
      { name: 'Product Usage', weight: 20, score: engagement?.featureAdoption || 65, description: 'Based on feature adoption and login frequency' },
      { name: 'Stakeholder Engagement', weight: 20, score: 70, description: 'Executive and champion engagement levels' },
      { name: 'Value Realization', weight: 20, score: 75, description: 'Achievement of stated success criteria' },
      { name: 'Support Experience', weight: 15, score: 80, description: 'Support ticket resolution and satisfaction' },
    ];

    // Default risk factors
    const defaultRiskFactors = [
      { name: 'Budget Constraints', description: 'Potential budget cuts or reallocation', severity: 'medium' as const, impact: -15 },
      { name: 'Executive Changes', description: 'Recent or upcoming leadership changes', severity: 'low' as const, impact: -10 },
      { name: 'Competitor Activity', description: 'Active competitor engagement', severity: 'medium' as const, impact: -12 },
    ];

    // Default positive signals
    const defaultPositiveSignals = [
      { name: 'Active Champion', description: 'Strong internal champion advocating for product', strength: 'strong' as const, impact: 15 },
      { name: 'Expanding Use Cases', description: 'Customer exploring additional features', strength: 'moderate' as const, impact: 10 },
      { name: 'Positive Feedback', description: 'Recent positive feedback from stakeholders', strength: 'moderate' as const, impact: 8 },
    ];

    // Default recommended actions
    const actionDueDate = new Date();
    actionDueDate.setDate(actionDueDate.getDate() + 14);
    const defaultActions = [
      { action: 'Schedule QBR with executive sponsor', priority: 'high' as const, owner: 'CSM', dueDate: actionDueDate.toISOString().split('T')[0] },
      { action: 'Prepare value summary document', priority: 'high' as const, owner: 'CSM', dueDate: new Date(actionDueDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { action: 'Address open support tickets', priority: 'medium' as const, owner: 'Support', dueDate: new Date(actionDueDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { action: 'Engage additional stakeholders', priority: 'medium' as const, owner: 'CSM', dueDate: new Date(actionDueDate.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    ];

    // Process probability factors
    const probabilityFactors = (parsed.probabilityFactors && parsed.probabilityFactors.length > 0
      ? parsed.probabilityFactors
      : defaultProbabilityFactors
    ).map((f, idx) => ({
      id: `factor-${idx + 1}`,
      name: f.name || `Factor ${idx + 1}`,
      weight: f.weight || 20,
      score: f.score || 70,
      description: f.description || '',
    }));

    // Process risk factors
    const riskFactors = (parsed.riskFactors && parsed.riskFactors.length > 0
      ? parsed.riskFactors
      : defaultRiskFactors
    ).map((r, idx) => ({
      id: `risk-${idx + 1}`,
      name: r.name || `Risk ${idx + 1}`,
      description: r.description || '',
      severity: (r.severity as 'high' | 'medium' | 'low') || 'medium',
      impact: r.impact || -15,
      enabled: true,
    }));

    // Process positive signals
    const positiveSignals = (parsed.positiveSignals && parsed.positiveSignals.length > 0
      ? parsed.positiveSignals
      : defaultPositiveSignals
    ).map((s, idx) => ({
      id: `signal-${idx + 1}`,
      name: s.name || `Signal ${idx + 1}`,
      description: s.description || '',
      strength: (s.strength as 'strong' | 'moderate' | 'weak') || 'moderate',
      impact: s.impact || 10,
      enabled: true,
    }));

    // Process recommended actions
    const recommendedActions = (parsed.recommendedActions && parsed.recommendedActions.length > 0
      ? parsed.recommendedActions
      : defaultActions
    ).map((a, idx) => ({
      id: `action-${idx + 1}`,
      action: a.action || `Action ${idx + 1}`,
      priority: (a.priority as 'high' | 'medium' | 'low') || 'medium',
      owner: a.owner || 'CSM',
      dueDate: a.dueDate || actionDueDate.toISOString().split('T')[0],
      status: 'pending' as const,
    }));

    // Calculate weighted probability
    const weightedProbability = Math.round(
      probabilityFactors.reduce((acc, f) => acc + (f.score * f.weight / 100), 0)
    );

    return {
      title: `Renewal Forecast: ${customerName}`,
      renewalDate,
      currentProbability: parsed.currentProbability || weightedProbability,
      targetProbability: parsed.targetProbability || Math.min(95, weightedProbability + 15),
      arr,
      contractTerm: parsed.contractTerm || '12 months',
      probabilityFactors,
      riskFactors,
      positiveSignals,
      recommendedActions,
      historicalContext: parsed.historicalContext || `${daysUntilRenewal} days until renewal. Focus on demonstrating value and addressing identified risks.`,
      notes: 'Review factors, toggle risks/signals that apply, and prioritize actions to improve renewal probability.',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Renewal forecast preview generation error:', error);

    // Calculate days until renewal for fallback
    const today = new Date();
    const renewal = new Date(renewalDate);
    const daysUntilRenewal = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const actionDueDate = new Date();
    actionDueDate.setDate(actionDueDate.getDate() + 14);

    // Return fallback renewal forecast
    return {
      title: `Renewal Forecast: ${customerName}`,
      renewalDate,
      currentProbability: 70,
      targetProbability: 85,
      arr,
      contractTerm: '12 months',
      probabilityFactors: [
        { id: 'factor-1', name: 'Health Score', weight: 25, score: healthScore, description: `Current health score: ${healthScore}` },
        { id: 'factor-2', name: 'Product Usage', weight: 25, score: 65, description: 'Based on feature adoption' },
        { id: 'factor-3', name: 'Stakeholder Engagement', weight: 25, score: 70, description: 'Champion and sponsor engagement' },
        { id: 'factor-4', name: 'Value Realization', weight: 25, score: 75, description: 'Success criteria achievement' },
      ],
      riskFactors: [
        { id: 'risk-1', name: 'Budget Uncertainty', description: 'Upcoming budget review cycle', severity: 'medium', impact: -15, enabled: true },
        { id: 'risk-2', name: 'Low Engagement', description: 'Executive sponsor engagement declining', severity: 'medium', impact: -12, enabled: true },
        { id: 'risk-3', name: 'Competitor Presence', description: 'Active competitor evaluation', severity: 'low', impact: -8, enabled: true },
      ],
      positiveSignals: [
        { id: 'signal-1', name: 'Active Champion', description: 'Strong champion advocating internally', strength: 'strong', impact: 15, enabled: true },
        { id: 'signal-2', name: 'Recent Success', description: 'Recent successful project completion', strength: 'moderate', impact: 10, enabled: true },
        { id: 'signal-3', name: 'Expansion Interest', description: 'Interest in additional features', strength: 'moderate', impact: 8, enabled: true },
      ],
      recommendedActions: [
        { id: 'action-1', action: 'Schedule executive business review', priority: 'high', owner: 'CSM', dueDate: actionDueDate.toISOString().split('T')[0], status: 'pending' },
        { id: 'action-2', action: 'Prepare comprehensive value summary', priority: 'high', owner: 'CSM', dueDate: new Date(actionDueDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' },
        { id: 'action-3', action: 'Address open support issues', priority: 'medium', owner: 'Support', dueDate: new Date(actionDueDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' },
        { id: 'action-4', action: 'Expand stakeholder engagement', priority: 'medium', owner: 'CSM', dueDate: new Date(actionDueDate.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending' },
      ],
      historicalContext: `${daysUntilRenewal} days until renewal. Focus on demonstrating value and addressing identified risks.`,
      notes: '',
    };
  }
}

// ============================================
// Value Summary Preview
// ============================================

interface ValueMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  category: 'efficiency' | 'cost_savings' | 'revenue' | 'productivity' | 'satisfaction';
  description: string;
  included: boolean;
}

interface SuccessStory {
  id: string;
  title: string;
  description: string;
  impact: string;
  date: string;
  category: 'implementation' | 'adoption' | 'expansion' | 'innovation' | 'support';
  included: boolean;
}

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  title: string;
  date: string;
  included: boolean;
}

interface ROICalculation {
  investmentCost: number;
  annualBenefit: number;
  roiPercentage: number;
  paybackMonths: number;
  threeYearValue: number;
  assumptions: string[];
}

interface ValueSummaryPreviewResult {
  title: string;
  executiveSummary: string;
  valueMetrics: ValueMetric[];
  successStories: SuccessStory[];
  testimonials: Testimonial[];
  roiCalculation: ROICalculation;
  keyHighlights: string[];
  nextSteps: string[];
  notes: string;
}

async function generateValueSummaryPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<ValueSummaryPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const arr = customer?.arr || 100000;
  const industry = customer?.industryCode || 'Technology';

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;
  const loginFrequency = engagement?.loginFrequency || 4.0;

  // Build prompt for value summary generation
  const prompt = `You are a customer success manager creating a comprehensive value summary to demonstrate ROI and success for a customer account. Generate persuasive value metrics, success stories, testimonials, and ROI calculations.

Customer: ${customerName}
Industry: ${industry}
Health Score: ${healthScore}
ARR: $${arr.toLocaleString()}
Feature Adoption: ${featureAdoption}%
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a value summary with:
1. 5-7 value metrics across efficiency, cost savings, revenue, productivity, and satisfaction
2. 3-4 success stories highlighting implementation wins, adoption milestones, expansions, innovations
3. 2-3 testimonial quotes from stakeholders
4. ROI calculation with realistic assumptions
5. 4-6 key highlights for executive presentation
6. 3-4 next steps to continue delivering value

Format your response as JSON:
{
  "executiveSummary": "2-3 sentence executive summary of value delivered",
  "valueMetrics": [
    {
      "name": "Metric name",
      "value": "25",
      "unit": "%|hours|$|count",
      "category": "efficiency|cost_savings|revenue|productivity|satisfaction",
      "description": "How this value was achieved"
    }
  ],
  "successStories": [
    {
      "title": "Story title",
      "description": "Detailed description of what happened",
      "impact": "Quantified impact statement",
      "date": "YYYY-MM",
      "category": "implementation|adoption|expansion|innovation|support"
    }
  ],
  "testimonials": [
    {
      "quote": "The customer quote",
      "author": "Person name",
      "title": "Person title",
      "date": "YYYY-MM"
    }
  ],
  "roiCalculation": {
    "investmentCost": number,
    "annualBenefit": number,
    "assumptions": ["assumption 1", "assumption 2"]
  },
  "keyHighlights": ["highlight 1", "highlight 2"],
  "nextSteps": ["next step 1", "next step 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const valueContent = textBlock?.text || '';

    // Parse JSON response
    let parsed: {
      executiveSummary?: string;
      valueMetrics?: Array<{
        name: string;
        value?: string;
        unit?: string;
        category?: string;
        description?: string;
      }>;
      successStories?: Array<{
        title: string;
        description?: string;
        impact?: string;
        date?: string;
        category?: string;
      }>;
      testimonials?: Array<{
        quote: string;
        author?: string;
        title?: string;
        date?: string;
      }>;
      roiCalculation?: {
        investmentCost?: number;
        annualBenefit?: number;
        assumptions?: string[];
      };
      keyHighlights?: string[];
      nextSteps?: string[];
    } = {};

    try {
      const jsonMatch = valueContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use defaults
    }

    // Default value metrics
    const defaultValueMetrics: ValueMetric[] = [
      { id: 'metric-1', name: 'Time Saved', value: '40', unit: '%', category: 'efficiency', description: 'Reduction in manual processes', included: true },
      { id: 'metric-2', name: 'Cost Reduction', value: '150000', unit: '$', category: 'cost_savings', description: 'Annual operational savings', included: true },
      { id: 'metric-3', name: 'Revenue Impact', value: '12', unit: '%', category: 'revenue', description: 'Increase in customer retention revenue', included: true },
      { id: 'metric-4', name: 'Productivity Gain', value: '25', unit: '%', category: 'productivity', description: 'Team output improvement', included: true },
      { id: 'metric-5', name: 'Customer Satisfaction', value: '92', unit: '%', category: 'satisfaction', description: 'End-user satisfaction score', included: true },
    ];

    // Default success stories
    const defaultSuccessStories: SuccessStory[] = [
      { id: 'story-1', title: 'Successful Implementation', description: 'Completed onboarding ahead of schedule with full team adoption', impact: 'Achieved full deployment in 4 weeks vs 6 week target', date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), category: 'implementation', included: true },
      { id: 'story-2', title: 'Feature Adoption Milestone', description: 'Reached 80% adoption across all key features', impact: 'Increased team productivity by 30%', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), category: 'adoption', included: true },
      { id: 'story-3', title: 'Expansion Success', description: 'Rolled out to additional departments after initial success', impact: 'Doubled active users from 50 to 100', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), category: 'expansion', included: true },
    ];

    // Default testimonials
    const defaultTestimonials: Testimonial[] = [
      { id: 'testimonial-1', quote: 'This solution has transformed how our team works. We\'ve seen significant improvements across all metrics.', author: 'Sarah Johnson', title: 'VP of Operations', date: new Date().toISOString().slice(0, 7), included: true },
      { id: 'testimonial-2', quote: 'The implementation was smooth and the ongoing support has been exceptional.', author: 'Mike Chen', title: 'Director of IT', date: new Date().toISOString().slice(0, 7), included: true },
    ];

    // Default ROI calculation
    const investmentCost = arr;
    const annualBenefit = Math.round(arr * 2.5);
    const defaultROI: ROICalculation = {
      investmentCost,
      annualBenefit,
      roiPercentage: Math.round(((annualBenefit - investmentCost) / investmentCost) * 100),
      paybackMonths: Math.round((investmentCost / annualBenefit) * 12),
      threeYearValue: annualBenefit * 3 - investmentCost,
      assumptions: [
        'Based on current usage patterns and productivity gains',
        'Assumes continued adoption growth trajectory',
        'Includes direct cost savings and productivity improvements',
      ],
    };

    // Process value metrics
    const valueMetrics = (parsed.valueMetrics && parsed.valueMetrics.length > 0
      ? parsed.valueMetrics
      : defaultValueMetrics
    ).map((m, idx) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      value: m.value || '0',
      unit: m.unit || '%',
      category: (m.category as ValueMetric['category']) || 'efficiency',
      description: m.description || '',
      included: true,
    }));

    // Process success stories
    const successStories = (parsed.successStories && parsed.successStories.length > 0
      ? parsed.successStories
      : defaultSuccessStories
    ).map((s, idx) => ({
      id: `story-${idx + 1}`,
      title: s.title || `Success Story ${idx + 1}`,
      description: s.description || '',
      impact: s.impact || '',
      date: s.date || new Date().toISOString().slice(0, 7),
      category: (s.category as SuccessStory['category']) || 'implementation',
      included: true,
    }));

    // Process testimonials
    const testimonials = (parsed.testimonials && parsed.testimonials.length > 0
      ? parsed.testimonials
      : defaultTestimonials
    ).map((t, idx) => ({
      id: `testimonial-${idx + 1}`,
      quote: t.quote || 'Great product and team!',
      author: t.author || 'Customer',
      title: t.title || 'Executive',
      date: t.date || new Date().toISOString().slice(0, 7),
      included: true,
    }));

    // Process ROI calculation
    const roiData = parsed.roiCalculation || {};
    const calcInvestment = roiData.investmentCost || defaultROI.investmentCost;
    const calcBenefit = roiData.annualBenefit || defaultROI.annualBenefit;
    const roiCalculation: ROICalculation = {
      investmentCost: calcInvestment,
      annualBenefit: calcBenefit,
      roiPercentage: Math.round(((calcBenefit - calcInvestment) / calcInvestment) * 100),
      paybackMonths: Math.round((calcInvestment / calcBenefit) * 12),
      threeYearValue: calcBenefit * 3 - calcInvestment,
      assumptions: roiData.assumptions || defaultROI.assumptions,
    };

    // Process highlights and next steps
    const keyHighlights = (parsed.keyHighlights && parsed.keyHighlights.length > 0
      ? parsed.keyHighlights
      : [
          `${featureAdoption}% feature adoption achieved`,
          `Health score of ${healthScore} demonstrates strong engagement`,
          `Consistent login activity at ${loginFrequency}x per week`,
          'Positive stakeholder feedback across all levels',
        ]
    );

    const nextSteps = (parsed.nextSteps && parsed.nextSteps.length > 0
      ? parsed.nextSteps
      : [
          'Schedule executive business review to share results',
          'Identify expansion opportunities based on success',
          'Develop case study for internal and external use',
          'Plan for next phase of value realization',
        ]
    );

    return {
      title: `Value Summary: ${customerName}`,
      executiveSummary: parsed.executiveSummary || `${customerName} has realized significant value from our partnership, achieving ${featureAdoption}% feature adoption and demonstrating a ${roiCalculation.roiPercentage}% return on investment. Key wins include improved operational efficiency and measurable cost savings.`,
      valueMetrics,
      successStories,
      testimonials,
      roiCalculation,
      keyHighlights,
      nextSteps,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Value summary preview generation error:', error);

    // Return fallback value summary
    const investmentCost = arr;
    const annualBenefit = Math.round(arr * 2.5);

    return {
      title: `Value Summary: ${customerName}`,
      executiveSummary: `${customerName} has achieved strong results through our partnership, with ${featureAdoption}% feature adoption and consistent engagement patterns.`,
      valueMetrics: [
        { id: 'metric-1', name: 'Time Saved', value: '40', unit: '%', category: 'efficiency', description: 'Reduction in manual processes', included: true },
        { id: 'metric-2', name: 'Cost Reduction', value: String(Math.round(arr * 0.15)), unit: '$', category: 'cost_savings', description: 'Annual operational savings', included: true },
        { id: 'metric-3', name: 'Feature Adoption', value: String(featureAdoption), unit: '%', category: 'productivity', description: 'Key feature utilization', included: true },
        { id: 'metric-4', name: 'User Satisfaction', value: '85', unit: '%', category: 'satisfaction', description: 'End-user satisfaction rating', included: true },
      ],
      successStories: [
        { id: 'story-1', title: 'Successful Implementation', description: 'Completed onboarding with full team adoption', impact: 'Achieved full deployment on schedule', date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), category: 'implementation', included: true },
        { id: 'story-2', title: 'Adoption Milestone', description: 'Reached target adoption across key features', impact: 'Improved team productivity', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7), category: 'adoption', included: true },
      ],
      testimonials: [
        { id: 'testimonial-1', quote: 'The solution has made a real difference for our team.', author: 'Key Stakeholder', title: 'Executive', date: new Date().toISOString().slice(0, 7), included: true },
      ],
      roiCalculation: {
        investmentCost,
        annualBenefit,
        roiPercentage: Math.round(((annualBenefit - investmentCost) / investmentCost) * 100),
        paybackMonths: Math.round((investmentCost / annualBenefit) * 12),
        threeYearValue: annualBenefit * 3 - investmentCost,
        assumptions: [
          'Based on current usage patterns',
          'Includes productivity improvements',
          'Assumes continued adoption',
        ],
      },
      keyHighlights: [
        `${featureAdoption}% feature adoption`,
        `Health score of ${healthScore}`,
        'Strong stakeholder engagement',
        'Positive feedback from users',
      ],
      nextSteps: [
        'Schedule executive review',
        'Identify expansion opportunities',
        'Develop case study',
      ],
      notes: '',
    };
  }
}

// ============================================
// Expansion Proposal Generator
// ============================================

interface ExpansionProduct {
  id: string;
  name: string;
  description: string;
  category: 'module' | 'tier_upgrade' | 'seats' | 'storage' | 'support' | 'professional_services';
  currentPlan: string;
  proposedPlan: string;
  monthlyPrice: number;
  annualPrice: number;
  included: boolean;
}

interface PricingOption {
  id: string;
  name: string;
  description: string;
  monthlyTotal: number;
  annualTotal: number;
  discount: string;
  term: string;
  recommended: boolean;
}

interface BusinessCaseItem {
  id: string;
  title: string;
  description: string;
  category: 'efficiency' | 'revenue' | 'cost_savings' | 'risk_reduction' | 'competitive';
  impact: string;
  included: boolean;
}

interface ROIProjection {
  investmentIncrease: number;
  projectedBenefit: number;
  roiPercentage: number;
  paybackMonths: number;
  assumptions: string[];
}

interface ExpansionProposalPreviewResult {
  title: string;
  proposalDate: string;
  validUntil: string;
  currentArrValue: number;
  proposedArrValue: number;
  expansionAmount: number;
  expansionProducts: ExpansionProduct[];
  pricingOptions: PricingOption[];
  businessCase: BusinessCaseItem[];
  roiProjection: ROIProjection;
  usageGaps: string[];
  growthSignals: string[];
  nextSteps: string[];
  notes: string;
}

async function generateExpansionProposalPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<ExpansionProposalPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const arr = customer?.arr || 100000;
  const industry = customer?.industryCode || 'Technology';
  const tier = customer?.tier || 'Growth';

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;
  const loginFrequency = engagement?.loginFrequency || 4.0;
  // Use dauMau as a proxy for active users (estimate from DAU/MAU ratio)
  const activeUsers = engagement?.dauMau ? Math.round(engagement.dauMau * 100) : 50;

  // Get contract info
  const contractEnd = customer?.renewalDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Build prompt for expansion proposal generation
  const prompt = `You are a customer success manager creating an expansion proposal to upsell additional products and services to a successful customer. Generate a compelling proposal with pricing options and business case.

Customer: ${customerName}
Industry: ${industry}
Current Tier: ${tier}
Health Score: ${healthScore}
Current ARR: $${arr.toLocaleString()}
Feature Adoption: ${featureAdoption}%
Active Users: ${activeUsers}
Contract Renewal: ${contractEnd}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate an expansion proposal with:
1. 3-5 expansion products/upgrades (modules, tier upgrades, seats, storage, support, professional services)
2. 2-3 pricing options with different terms and discounts
3. 4-6 business case items across efficiency, revenue, cost savings, risk reduction, competitive advantage
4. ROI projection for the expansion investment
5. 3-5 usage gaps that indicate expansion opportunity
6. 3-5 growth signals observed in the account
7. 3-4 next steps to advance the proposal

Format your response as JSON:
{
  "expansionProducts": [
    {
      "name": "Product name",
      "description": "What it provides",
      "category": "module|tier_upgrade|seats|storage|support|professional_services",
      "currentPlan": "Current offering",
      "proposedPlan": "Proposed upgrade",
      "monthlyPrice": 1500,
      "annualPrice": 15000
    }
  ],
  "pricingOptions": [
    {
      "name": "Option name",
      "description": "What's included",
      "monthlyTotal": 5000,
      "annualTotal": 50000,
      "discount": "15% discount",
      "term": "12-month commitment",
      "recommended": true
    }
  ],
  "businessCase": [
    {
      "title": "Business case item title",
      "description": "Detailed explanation",
      "category": "efficiency|revenue|cost_savings|risk_reduction|competitive",
      "impact": "Quantified impact or benefit"
    }
  ],
  "roiProjection": {
    "investmentIncrease": 25000,
    "projectedBenefit": 75000,
    "assumptions": ["Assumption 1", "Assumption 2"]
  },
  "usageGaps": ["Gap 1 description", "Gap 2 description"],
  "growthSignals": ["Signal 1 observed", "Signal 2 observed"],
  "nextSteps": ["Next step 1", "Next step 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Calculate expansion amounts
    const expansionProducts = (parsed.expansionProducts || []).map((p: any, idx: number) => ({
      id: `product-${idx + 1}`,
      name: p.name || `Product ${idx + 1}`,
      description: p.description || '',
      category: (p.category as ExpansionProduct['category']) || 'module',
      currentPlan: p.currentPlan || 'Basic',
      proposedPlan: p.proposedPlan || 'Enterprise',
      monthlyPrice: p.monthlyPrice || Math.round(arr / 24),
      annualPrice: p.annualPrice || Math.round(arr / 2),
      included: true,
    }));

    const totalExpansion = expansionProducts.reduce((sum: number, p: ExpansionProduct) => sum + (p.included ? p.annualPrice : 0), 0);
    const proposedArr = arr + totalExpansion;

    // Process pricing options
    const pricingOptions = (parsed.pricingOptions || []).map((o: any, idx: number) => ({
      id: `option-${idx + 1}`,
      name: o.name || `Option ${idx + 1}`,
      description: o.description || '',
      monthlyTotal: o.monthlyTotal || Math.round(totalExpansion / 12),
      annualTotal: o.annualTotal || totalExpansion,
      discount: o.discount || '0%',
      term: o.term || '12 months',
      recommended: idx === 0 ? true : (o.recommended || false),
    }));

    // Ensure at least 2 pricing options
    if (pricingOptions.length < 2) {
      pricingOptions.push(
        { id: 'option-1', name: 'Annual Commitment', description: 'Best value with annual commitment', monthlyTotal: Math.round(totalExpansion * 0.85 / 12), annualTotal: Math.round(totalExpansion * 0.85), discount: '15% discount', term: '12-month commitment', recommended: true },
        { id: 'option-2', name: 'Monthly Flex', description: 'Flexible month-to-month option', monthlyTotal: Math.round(totalExpansion / 12), annualTotal: totalExpansion, discount: 'No discount', term: 'Month-to-month', recommended: false }
      );
    }

    // Process business case
    const businessCase = (parsed.businessCase || []).map((b: any, idx: number) => ({
      id: `case-${idx + 1}`,
      title: b.title || `Business Case ${idx + 1}`,
      description: b.description || '',
      category: (b.category as BusinessCaseItem['category']) || 'efficiency',
      impact: b.impact || 'Significant improvement expected',
      included: true,
    }));

    // Ensure business case items
    if (businessCase.length === 0) {
      businessCase.push(
        { id: 'case-1', title: 'Increased Productivity', description: 'Additional features will streamline workflows', category: 'efficiency', impact: '20% reduction in manual tasks', included: true },
        { id: 'case-2', title: 'Revenue Growth', description: 'Enhanced capabilities enable new revenue streams', category: 'revenue', impact: `$${Math.round(arr * 0.15).toLocaleString()} potential annual revenue`, included: true },
        { id: 'case-3', title: 'Risk Mitigation', description: 'Expanded support reduces operational risk', category: 'risk_reduction', impact: 'Reduced downtime and faster resolution', included: true },
        { id: 'case-4', title: 'Competitive Edge', description: 'Advanced features provide market differentiation', category: 'competitive', impact: 'Stay ahead of industry trends', included: true }
      );
    }

    // Process ROI projection
    const investmentIncrease = parsed.roiProjection?.investmentIncrease || totalExpansion;
    const projectedBenefit = parsed.roiProjection?.projectedBenefit || Math.round(totalExpansion * 2.5);
    const roiProjection: ROIProjection = {
      investmentIncrease,
      projectedBenefit,
      roiPercentage: Math.round(((projectedBenefit - investmentIncrease) / investmentIncrease) * 100),
      paybackMonths: Math.round((investmentIncrease / projectedBenefit) * 12),
      assumptions: parsed.roiProjection?.assumptions || [
        'Based on similar customer expansion outcomes',
        'Assumes 6-month ramp-up to full utilization',
        'Includes projected efficiency gains and cost avoidance',
      ],
    };

    // Process usage gaps and growth signals
    const usageGaps = parsed.usageGaps || [
      `Only ${featureAdoption}% feature adoption indicates room for growth`,
      `${activeUsers} active users could expand with additional seats`,
      'Advanced capabilities not yet unlocked',
      'Support tier limiting response times',
    ];

    const growthSignals = parsed.growthSignals || [
      `Strong health score of ${healthScore} indicates satisfied customer`,
      `High login frequency (${loginFrequency}x/week) shows engagement`,
      'Team growth signals need for additional capacity',
      'Positive stakeholder feedback on current solution',
    ];

    const nextSteps = parsed.nextSteps || [
      'Schedule proposal review meeting with decision makers',
      'Prepare customized demo of proposed capabilities',
      'Align with contract renewal timeline',
      'Coordinate with finance on approval process',
    ];

    // Calculate dates
    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setDate(validUntil.getDate() + 30);

    return {
      title: `Expansion Proposal: ${customerName}`,
      proposalDate: today.toISOString().slice(0, 10),
      validUntil: validUntil.toISOString().slice(0, 10),
      currentArrValue: arr,
      proposedArrValue: proposedArr,
      expansionAmount: totalExpansion,
      expansionProducts,
      pricingOptions,
      businessCase,
      roiProjection,
      usageGaps,
      growthSignals,
      nextSteps,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Expansion proposal preview generation error:', error);

    // Return fallback expansion proposal
    const expansionAmount = Math.round(arr * 0.25);
    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setDate(validUntil.getDate() + 30);

    return {
      title: `Expansion Proposal: ${customerName}`,
      proposalDate: today.toISOString().slice(0, 10),
      validUntil: validUntil.toISOString().slice(0, 10),
      currentArrValue: arr,
      proposedArrValue: arr + expansionAmount,
      expansionAmount,
      expansionProducts: [
        { id: 'product-1', name: 'Premium Support', description: 'Priority support with dedicated CSM', category: 'support', currentPlan: 'Standard Support', proposedPlan: 'Premium Support', monthlyPrice: Math.round(expansionAmount * 0.3 / 12), annualPrice: Math.round(expansionAmount * 0.3), included: true },
        { id: 'product-2', name: 'Additional Seats', description: 'Expand team access', category: 'seats', currentPlan: `${activeUsers} seats`, proposedPlan: `${activeUsers + 25} seats`, monthlyPrice: Math.round(expansionAmount * 0.4 / 12), annualPrice: Math.round(expansionAmount * 0.4), included: true },
        { id: 'product-3', name: 'Enterprise Tier', description: 'Unlock advanced features', category: 'tier_upgrade', currentPlan: tier, proposedPlan: 'Enterprise', monthlyPrice: Math.round(expansionAmount * 0.3 / 12), annualPrice: Math.round(expansionAmount * 0.3), included: true },
      ],
      pricingOptions: [
        { id: 'option-1', name: 'Annual Commitment', description: 'Best value with annual commitment', monthlyTotal: Math.round(expansionAmount * 0.85 / 12), annualTotal: Math.round(expansionAmount * 0.85), discount: '15% discount', term: '12-month commitment', recommended: true },
        { id: 'option-2', name: 'Monthly Flex', description: 'Flexible month-to-month option', monthlyTotal: Math.round(expansionAmount / 12), annualTotal: expansionAmount, discount: 'No discount', term: 'Month-to-month', recommended: false },
      ],
      businessCase: [
        { id: 'case-1', title: 'Increased Productivity', description: 'Additional features will streamline workflows', category: 'efficiency', impact: '20% reduction in manual tasks', included: true },
        { id: 'case-2', title: 'Team Scalability', description: 'Additional seats enable team growth', category: 'revenue', impact: 'Support 25+ new team members', included: true },
        { id: 'case-3', title: 'Faster Support', description: 'Premium support reduces issue resolution time', category: 'risk_reduction', impact: '4-hour SLA vs 24-hour', included: true },
        { id: 'case-4', title: 'Advanced Features', description: 'Enterprise features provide competitive advantage', category: 'competitive', impact: 'Access to latest capabilities', included: true },
      ],
      roiProjection: {
        investmentIncrease: expansionAmount,
        projectedBenefit: Math.round(expansionAmount * 2.5),
        roiPercentage: 150,
        paybackMonths: 5,
        assumptions: [
          'Based on similar customer outcomes',
          'Assumes 6-month adoption ramp',
          'Includes efficiency and productivity gains',
        ],
      },
      usageGaps: [
        `Only ${featureAdoption}% feature adoption - room for growth`,
        `${activeUsers} active users could expand`,
        'Support tier limiting response times',
        'Advanced features not yet unlocked',
      ],
      growthSignals: [
        `Strong health score of ${healthScore}`,
        `High engagement with ${loginFrequency}x weekly logins`,
        'Team growth signals',
        'Positive stakeholder feedback',
      ],
      nextSteps: [
        'Schedule proposal review meeting',
        'Prepare customized demo',
        'Align with renewal timeline',
        'Coordinate finance approval',
      ],
      notes: '',
    };
  }
}

// ============================================
// Negotiation Brief Types
// ============================================

interface ContractTerm {
  id: string;
  term: string;
  currentValue: string;
  targetValue: string;
  priority: 'must_have' | 'important' | 'nice_to_have';
  notes: string;
}

interface LeveragePoint {
  id: string;
  title: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  category: 'value_delivered' | 'relationship' | 'market_position' | 'strategic_fit' | 'timing';
  enabled: boolean;
}

interface CounterStrategy {
  id: string;
  objection: string;
  response: string;
  evidence: string;
  category: 'price' | 'scope' | 'timeline' | 'terms' | 'competition';
}

interface WalkAwayPoint {
  id: string;
  condition: string;
  threshold: string;
  rationale: string;
  severity: 'critical' | 'important' | 'minor';
}

interface NegotiationBriefPreviewResult {
  title: string;
  negotiationDate: string;
  contractValue: number;
  contractTerm: string;
  renewalDate: string;
  currentTerms: ContractTerm[];
  leveragePoints: LeveragePoint[];
  counterStrategies: CounterStrategy[];
  walkAwayPoints: WalkAwayPoint[];
  competitorIntel: string[];
  valueDelivered: string[];
  internalNotes: string;
}

/**
 * Generate a negotiation brief preview for renewal or expansion negotiations
 * Provides editable HITL preview before creating final document
 */
async function generateNegotiationBriefPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<NegotiationBriefPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 75;
  const arr = customer?.arr || 100000;
  const industry = customer?.industryCode || 'Technology';
  const tier = customer?.tier || 'Growth';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;
  const loginFrequency = engagement?.loginFrequency || 4.0;

  // Get risk signals
  const riskSignals = context.platformData.riskSignals || [];
  const hasChurnRisk = riskSignals.some((r: any) => r.severity === 'high' || r.type === 'churn_risk');

  // Build prompt for negotiation brief generation
  const prompt = `You are a customer success manager preparing a negotiation brief for an upcoming contract renewal or expansion negotiation. Generate a comprehensive brief with leverage points, counter-strategies, and walk-away conditions.

Customer: ${customerName}
Industry: ${industry}
Current Tier: ${tier}
Health Score: ${healthScore}
Current ARR: $${arr.toLocaleString()}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
Renewal Date: ${renewalDate}
Churn Risk: ${hasChurnRisk ? 'Elevated' : 'Normal'}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a negotiation brief with:
1. 4-6 contract terms being negotiated (price, duration, scope, SLA, payment terms, auto-renewal)
2. 4-6 leverage points categorized by type (value delivered, relationship, market position, strategic fit, timing)
3. 4-6 counter-strategies for common objections (price, scope, timeline, terms, competition)
4. 3-4 walk-away points with severity levels
5. 3-5 competitor intelligence points
6. 4-6 value delivered highlights

Format your response as JSON:
{
  "currentTerms": [
    {
      "term": "Term name",
      "currentValue": "Current state",
      "targetValue": "Target outcome",
      "priority": "must_have|important|nice_to_have",
      "notes": "Internal notes"
    }
  ],
  "leveragePoints": [
    {
      "title": "Leverage point title",
      "description": "Detailed description",
      "strength": "strong|moderate|weak",
      "category": "value_delivered|relationship|market_position|strategic_fit|timing"
    }
  ],
  "counterStrategies": [
    {
      "objection": "Expected objection",
      "response": "Recommended response",
      "evidence": "Supporting evidence or data",
      "category": "price|scope|timeline|terms|competition"
    }
  ],
  "walkAwayPoints": [
    {
      "condition": "Walk-away condition",
      "threshold": "Specific threshold",
      "rationale": "Why this is a deal-breaker",
      "severity": "critical|important|minor"
    }
  ],
  "competitorIntel": ["Competitor insight 1", "Competitor insight 2"],
  "valueDelivered": ["Value point 1", "Value point 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Process current terms
    const currentTerms = (parsed.currentTerms || []).map((t: any, idx: number) => ({
      id: `term-${idx + 1}`,
      term: t.term || `Term ${idx + 1}`,
      currentValue: t.currentValue || '',
      targetValue: t.targetValue || '',
      priority: (t.priority as ContractTerm['priority']) || 'important',
      notes: t.notes || '',
    }));

    // Ensure minimum terms
    if (currentTerms.length < 4) {
      currentTerms.push(
        { id: 'term-1', term: 'Annual Contract Value', currentValue: `$${arr.toLocaleString()}`, targetValue: `$${Math.round(arr * 1.1).toLocaleString()} (10% increase)`, priority: 'must_have', notes: 'Target 10% uplift minimum' },
        { id: 'term-2', term: 'Contract Duration', currentValue: '12 months', targetValue: '24-36 months', priority: 'important', notes: 'Multi-year for discount' },
        { id: 'term-3', term: 'Payment Terms', currentValue: 'Net 30', targetValue: 'Annual prepaid', priority: 'nice_to_have', notes: 'Offer discount for prepayment' },
        { id: 'term-4', term: 'Service Level Agreement', currentValue: '99.5% uptime', targetValue: '99.9% uptime', priority: 'important', notes: 'Premium SLA available' },
        { id: 'term-5', term: 'Seat Licenses', currentValue: '50 seats', targetValue: '75+ seats', priority: 'important', notes: 'Room for team growth' },
        { id: 'term-6', term: 'Support Tier', currentValue: 'Standard', targetValue: 'Premium', priority: 'nice_to_have', notes: 'Upsell opportunity' }
      );
    }

    // Process leverage points
    const leveragePoints = (parsed.leveragePoints || []).map((l: any, idx: number) => ({
      id: `leverage-${idx + 1}`,
      title: l.title || `Leverage Point ${idx + 1}`,
      description: l.description || '',
      strength: (l.strength as LeveragePoint['strength']) || 'moderate',
      category: (l.category as LeveragePoint['category']) || 'value_delivered',
      enabled: true,
    }));

    // Ensure minimum leverage points
    if (leveragePoints.length < 4) {
      leveragePoints.push(
        { id: 'leverage-1', title: 'Strong Product Adoption', description: `${featureAdoption}% feature adoption demonstrates value realization`, strength: 'strong', category: 'value_delivered', enabled: true },
        { id: 'leverage-2', title: 'Executive Sponsorship', description: 'Strong relationship with VP-level stakeholders', strength: 'moderate', category: 'relationship', enabled: true },
        { id: 'leverage-3', title: 'Strategic Account', description: `${tier} tier account with expansion potential`, strength: 'moderate', category: 'strategic_fit', enabled: true },
        { id: 'leverage-4', title: 'Renewal Timing', description: `${Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days until renewal`, strength: 'moderate', category: 'timing', enabled: true },
        { id: 'leverage-5', title: 'Market Position', description: 'Leader in industry analyst reports', strength: 'strong', category: 'market_position', enabled: true },
        { id: 'leverage-6', title: 'Health Score', description: `Health score of ${healthScore} indicates satisfied customer`, strength: healthScore >= 70 ? 'strong' : 'moderate', category: 'value_delivered', enabled: true }
      );
    }

    // Process counter-strategies
    const counterStrategies = (parsed.counterStrategies || []).map((c: any, idx: number) => ({
      id: `counter-${idx + 1}`,
      objection: c.objection || `Objection ${idx + 1}`,
      response: c.response || '',
      evidence: c.evidence || '',
      category: (c.category as CounterStrategy['category']) || 'price',
    }));

    // Ensure minimum counter-strategies
    if (counterStrategies.length < 4) {
      counterStrategies.push(
        { id: 'counter-1', objection: 'Price is too high', response: 'Focus on ROI and value delivered', evidence: `${featureAdoption}% adoption, measurable efficiency gains`, category: 'price' },
        { id: 'counter-2', objection: 'Considering alternatives', response: 'Highlight switching costs and relationship value', evidence: 'Migration risk, training investment, integration complexity', category: 'competition' },
        { id: 'counter-3', objection: 'Need shorter commitment', response: 'Offer flexibility with appropriate pricing', evidence: 'Month-to-month available at standard rates', category: 'terms' },
        { id: 'counter-4', objection: 'Missing features', response: 'Review roadmap and custom development options', evidence: 'Upcoming releases address key gaps', category: 'scope' },
        { id: 'counter-5', objection: 'Budget constraints', response: 'Explore phased implementation or payment plans', evidence: 'Quarterly payment options, scope reduction alternatives', category: 'price' },
        { id: 'counter-6', objection: 'Implementation timeline concerns', response: 'Present accelerated onboarding program', evidence: 'Dedicated resources, proven 30-day go-live', category: 'timeline' }
      );
    }

    // Process walk-away points
    const walkAwayPoints = (parsed.walkAwayPoints || []).map((w: any, idx: number) => ({
      id: `walkaway-${idx + 1}`,
      condition: w.condition || `Condition ${idx + 1}`,
      threshold: w.threshold || '',
      rationale: w.rationale || '',
      severity: (w.severity as WalkAwayPoint['severity']) || 'important',
    }));

    // Ensure minimum walk-away points
    if (walkAwayPoints.length < 3) {
      walkAwayPoints.push(
        { id: 'walkaway-1', condition: 'Price below floor', threshold: `Less than $${Math.round(arr * 0.85).toLocaleString()} (15% discount max)`, rationale: 'Below this margin is unsustainable', severity: 'critical' },
        { id: 'walkaway-2', condition: 'Excessive scope demands', threshold: 'More than 20% custom development without additional fee', rationale: 'Resource constraints and precedent concerns', severity: 'important' },
        { id: 'walkaway-3', condition: 'Unreasonable terms', threshold: 'Payment terms beyond Net 60 or liability caps below 2x ACV', rationale: 'Financial and legal risk too high', severity: 'critical' },
        { id: 'walkaway-4', condition: 'Competitor ultimatum', threshold: 'Take-it-or-leave-it demands tied to competitor bid', rationale: 'Race to bottom, relationship signals trouble', severity: 'important' }
      );
    }

    // Process competitor intel
    const competitorIntel = parsed.competitorIntel || [
      'Primary competitor offers lower entry price but higher total cost of ownership',
      'Market perception favors our product for enterprise features',
      'Competitor recently raised prices 15%, reducing gap',
      'Our NPS scores significantly higher than industry average',
      'Integration ecosystem is a key differentiator',
    ];

    // Process value delivered
    const valueDelivered = parsed.valueDelivered || [
      `${featureAdoption}% feature adoption across organization`,
      `${loginFrequency}x weekly average login frequency`,
      `${healthScore} health score indicates strong engagement`,
      'Measurable ROI from efficiency improvements',
      'Successful expansion from initial deployment',
      'Strong user satisfaction and advocacy',
    ];

    // Calculate contract term from renewal date
    const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const contractTermStr = daysUntilRenewal > 180 ? '24 months' : '12 months';

    return {
      title: `Negotiation Brief: ${customerName}`,
      negotiationDate: new Date().toISOString().slice(0, 10),
      contractValue: arr,
      contractTerm: contractTermStr,
      renewalDate,
      currentTerms,
      leveragePoints,
      counterStrategies,
      walkAwayPoints,
      competitorIntel,
      valueDelivered,
      internalNotes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Negotiation brief preview generation error:', error);

    // Return fallback negotiation brief
    const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

    return {
      title: `Negotiation Brief: ${customerName}`,
      negotiationDate: new Date().toISOString().slice(0, 10),
      contractValue: arr,
      contractTerm: daysUntilRenewal > 180 ? '24 months' : '12 months',
      renewalDate,
      currentTerms: [
        { id: 'term-1', term: 'Annual Contract Value', currentValue: `$${arr.toLocaleString()}`, targetValue: `$${Math.round(arr * 1.1).toLocaleString()}`, priority: 'must_have', notes: 'Target 10% uplift' },
        { id: 'term-2', term: 'Contract Duration', currentValue: '12 months', targetValue: '24 months', priority: 'important', notes: 'Multi-year for discount' },
        { id: 'term-3', term: 'Payment Terms', currentValue: 'Net 30', targetValue: 'Annual prepaid', priority: 'nice_to_have', notes: '' },
        { id: 'term-4', term: 'Service Level Agreement', currentValue: '99.5% uptime', targetValue: '99.9% uptime', priority: 'important', notes: '' },
      ],
      leveragePoints: [
        { id: 'leverage-1', title: 'Strong Adoption', description: `${featureAdoption}% feature adoption`, strength: 'strong', category: 'value_delivered', enabled: true },
        { id: 'leverage-2', title: 'Executive Relationship', description: 'Strong stakeholder alignment', strength: 'moderate', category: 'relationship', enabled: true },
        { id: 'leverage-3', title: 'Strategic Account', description: `${tier} tier with expansion potential`, strength: 'moderate', category: 'strategic_fit', enabled: true },
        { id: 'leverage-4', title: 'Renewal Timing', description: `${daysUntilRenewal} days until renewal`, strength: 'moderate', category: 'timing', enabled: true },
      ],
      counterStrategies: [
        { id: 'counter-1', objection: 'Price is too high', response: 'Focus on ROI and value delivered', evidence: `${featureAdoption}% adoption, efficiency gains`, category: 'price' },
        { id: 'counter-2', objection: 'Considering alternatives', response: 'Highlight switching costs', evidence: 'Migration risk, training, integrations', category: 'competition' },
        { id: 'counter-3', objection: 'Need shorter term', response: 'Offer flexible options with pricing', evidence: 'Month-to-month at standard rates', category: 'terms' },
        { id: 'counter-4', objection: 'Missing features', response: 'Review roadmap', evidence: 'Upcoming releases', category: 'scope' },
      ],
      walkAwayPoints: [
        { id: 'walkaway-1', condition: 'Price below floor', threshold: `Less than $${Math.round(arr * 0.85).toLocaleString()}`, rationale: 'Unsustainable margin', severity: 'critical' },
        { id: 'walkaway-2', condition: 'Excessive custom demands', threshold: 'More than 20% custom work', rationale: 'Resource constraints', severity: 'important' },
        { id: 'walkaway-3', condition: 'Unreasonable terms', threshold: 'Beyond Net 60 or low liability', rationale: 'Financial/legal risk', severity: 'critical' },
      ],
      competitorIntel: [
        'Primary competitor offers lower entry price but higher TCO',
        'Market perception favors our enterprise features',
        'Competitor recently raised prices',
        'Our NPS scores higher than average',
      ],
      valueDelivered: [
        `${featureAdoption}% feature adoption`,
        `${loginFrequency}x weekly logins`,
        `${healthScore} health score`,
        'Measurable ROI',
      ],
      internalNotes: '',
    };
  }
}

// ============================================
// Save Play Types
// ============================================

interface RootCause {
  id: string;
  cause: string;
  description: string;
  category: 'product' | 'service' | 'relationship' | 'value' | 'competitive' | 'budget' | 'timing' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  enabled: boolean;
}

interface SavePlayAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Leadership' | 'Implementation' | 'Sales';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedCauseIds: string[];
}

interface SuccessMetric {
  id: string;
  metric: string;
  currentValue: string;
  targetValue: string;
  dueDate: string;
  enabled: boolean;
}

interface SavePlayPreviewResult {
  title: string;
  createdDate: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  situation: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  rootCauses: RootCause[];
  actionItems: SavePlayAction[];
  successMetrics: SuccessMetric[];
  timeline: string;
  notes: string;
}

/**
 * Generate a save play preview for at-risk customers
 * Provides editable HITL preview before creating final document
 */
async function generateSavePlayPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<SavePlayPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 45;
  const arr = customer?.arr || 100000;
  const tier = customer?.tier || 'Growth';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 35;
  const loginFrequency = engagement?.loginFrequency || 1.5;
  const dauMau = engagement?.dauMau || 0.2;

  // Get NPS data
  const npsScore = customer?.npsScore || 15;

  // Get risk signals from context
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high' || r.type === 'churn_risk');

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Determine risk level
  let riskLevel: SavePlayPreviewResult['riskLevel'] = 'medium';
  if (healthScore < 40 || hasHighRisk) riskLevel = 'critical';
  else if (healthScore < 55 || daysUntilRenewal < 45) riskLevel = 'high';
  else if (healthScore < 70) riskLevel = 'medium';

  // Build prompt for save play generation
  const prompt = `You are a customer success manager creating an urgent save play for a customer showing significant churn signals. Generate a comprehensive save play with root causes, action items, and success metrics.

Customer: ${customerName}
Current Tier: ${tier}
Health Score: ${healthScore}/100 (AT RISK)
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
DAU/MAU Ratio: ${(dauMau * 100).toFixed(1)}%
NPS Score: ${npsScore}
Risk Level: ${riskLevel.toUpperCase()}
Known Risk Signals: ${hasHighRisk ? 'High risk - immediate action required' : 'Elevated concerns'}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a save play with:
1. A situation summary (2-3 sentences describing the urgent situation)
2. 5-7 root causes categorized by type (product, service, relationship, value, competitive, budget, timing) with severity levels
3. 6-8 action items with owners, priorities, due dates, and linked root causes
4. 4-6 success metrics to track the save effort

Format your response as JSON:
{
  "situation": "2-3 sentence summary of the urgent situation requiring a save play",
  "rootCauses": [
    {
      "cause": "Root cause name",
      "description": "What is causing this issue",
      "category": "product|service|relationship|value|competitive|budget|timing|other",
      "severity": "critical|high|medium|low",
      "evidence": "Specific data or observation supporting this root cause"
    }
  ],
  "actionItems": [
    {
      "action": "Action title",
      "description": "Detailed action steps",
      "owner": "CSM|Customer|Support|Product|Leadership|Implementation|Sales",
      "priority": "high|medium|low",
      "relatedCauses": ["Root cause name 1", "Root cause name 2"]
    }
  ],
  "successMetrics": [
    {
      "metric": "Metric name",
      "currentValue": "Current state",
      "targetValue": "Target to achieve"
    }
  ],
  "timeline": "Expected timeline for the save effort (e.g., '30 days', '6 weeks')"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get situation summary
    const situation = parsed.situation ||
      `${customerName} is at ${riskLevel} risk with a health score of ${healthScore}/100. ` +
      `Key concerns include declining engagement (${featureAdoption}% adoption, ${loginFrequency}x weekly logins) and ` +
      `upcoming renewal in ${daysUntilRenewal} days. Immediate intervention is required.`;

    // Process root causes
    const rootCauses: RootCause[] = (parsed.rootCauses || []).map((r: any, idx: number) => ({
      id: `cause-${idx + 1}`,
      cause: r.cause || `Root Cause ${idx + 1}`,
      description: r.description || '',
      category: (r.category as RootCause['category']) || 'other',
      severity: (r.severity as RootCause['severity']) || 'medium',
      evidence: r.evidence || '',
      enabled: true,
    }));

    // Ensure minimum root causes
    if (rootCauses.length < 5) {
      const defaultCauses: RootCause[] = [
        { id: 'cause-1', cause: 'Low Product Adoption', description: 'Customer is not utilizing key features that drive value', category: 'product', severity: featureAdoption < 40 ? 'critical' : 'high', evidence: `Feature adoption at ${featureAdoption}%, well below target of 70%`, enabled: true },
        { id: 'cause-2', cause: 'Declining Engagement', description: 'User activity has dropped significantly', category: 'value', severity: loginFrequency < 2 ? 'high' : 'medium', evidence: `Login frequency down to ${loginFrequency}x/week`, enabled: true },
        { id: 'cause-3', cause: 'Champion Disengagement', description: 'Key stakeholder is no longer responsive', category: 'relationship', severity: 'high', evidence: 'Primary contact has not responded to last 3 outreach attempts', enabled: true },
        { id: 'cause-4', cause: 'Unresolved Issues', description: 'Outstanding support tickets creating frustration', category: 'service', severity: 'medium', evidence: 'Multiple escalated tickets in the past 60 days', enabled: true },
        { id: 'cause-5', cause: 'Perceived Value Gap', description: 'Customer is questioning ROI and value delivered', category: 'value', severity: npsScore < 0 ? 'critical' : 'high', evidence: `NPS score of ${npsScore} indicates dissatisfaction`, enabled: true },
        { id: 'cause-6', cause: 'Budget Pressure', description: 'Customer facing internal budget constraints', category: 'budget', severity: 'medium', evidence: 'Mentioned budget review in recent communications', enabled: true },
        { id: 'cause-7', cause: 'Competitive Evaluation', description: 'Customer may be evaluating alternatives', category: 'competitive', severity: hasHighRisk ? 'high' : 'medium', evidence: 'Industry reports show increased competitive activity', enabled: true },
      ];

      // Add missing causes
      defaultCauses.forEach((defaultCause, idx) => {
        if (!rootCauses.find(c => c.category === defaultCause.category)) {
          rootCauses.push({ ...defaultCause, id: `cause-${rootCauses.length + 1}` });
        }
      });
    }

    // Process action items with cause ID mapping
    const actionItems: SavePlayAction[] = (parsed.actionItems || []).map((a: any, idx: number) => {
      // Map related cause names to IDs
      const relatedCauseIds = (a.relatedCauses || []).map((causeName: string) => {
        const matchedCause = rootCauses.find(c =>
          c.cause.toLowerCase().includes(causeName.toLowerCase()) ||
          causeName.toLowerCase().includes(c.cause.toLowerCase())
        );
        return matchedCause?.id || '';
      }).filter(Boolean);

      return {
        id: `action-${idx + 1}`,
        action: a.action || `Action ${idx + 1}`,
        description: a.description || '',
        owner: (a.owner as SavePlayAction['owner']) || 'CSM',
        dueDate: new Date(Date.now() + (7 + idx * 5) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'pending' as const,
        priority: (a.priority as SavePlayAction['priority']) || 'high',
        relatedCauseIds,
      };
    });

    // Ensure minimum action items
    if (actionItems.length < 6) {
      const defaultActions: SavePlayAction[] = [
        { id: 'action-1', action: 'Emergency Executive Call', description: 'Schedule urgent call with executive sponsor to understand concerns and demonstrate commitment', owner: 'CSM', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-3', 'cause-5'] },
        { id: 'action-2', action: 'Value Demonstration Workshop', description: 'Prepare and deliver ROI analysis and success metrics presentation', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-5'] },
        { id: 'action-3', action: 'Accelerated Adoption Program', description: 'Launch intensive training and enablement program for underutilized features', owner: 'CSM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-1', 'cause-2'] },
        { id: 'action-4', action: 'Support Escalation Resolution', description: 'Work with Support team to fast-track resolution of all open tickets', owner: 'Support', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-4'] },
        { id: 'action-5', action: 'Competitive Differentiation', description: 'Prepare comparison materials highlighting our unique advantages', owner: 'Sales', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedCauseIds: ['cause-7'] },
        { id: 'action-6', action: 'Product Roadmap Review', description: 'Share relevant upcoming features and gather feedback on priorities', owner: 'Product', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedCauseIds: ['cause-1'] },
        { id: 'action-7', action: 'Executive Sponsorship Alignment', description: 'Engage our executive sponsor for peer-to-peer conversation', owner: 'Leadership', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-3', 'cause-6'] },
        { id: 'action-8', action: 'Renewal Terms Discussion', description: 'Explore flexible terms or incentives to secure renewal', owner: 'Sales', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedCauseIds: ['cause-6'] },
      ];

      // Add missing actions
      defaultActions.forEach((defaultAction, idx) => {
        if (actionItems.length < 6 + idx) {
          actionItems.push({ ...defaultAction, id: `action-${actionItems.length + 1}` });
        }
      });
    }

    // Process success metrics
    const successMetrics: SuccessMetric[] = (parsed.successMetrics || []).map((m: any, idx: number) => ({
      id: `metric-${idx + 1}`,
      metric: m.metric || `Metric ${idx + 1}`,
      currentValue: m.currentValue || '',
      targetValue: m.targetValue || '',
      dueDate: new Date(Date.now() + (30 + idx * 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      enabled: true,
    }));

    // Ensure minimum success metrics
    if (successMetrics.length < 4) {
      const defaultMetrics: SuccessMetric[] = [
        { id: 'metric-1', metric: 'Health Score', currentValue: `${healthScore}/100`, targetValue: '70/100', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'metric-2', metric: 'Feature Adoption', currentValue: `${featureAdoption}%`, targetValue: '60%', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'metric-3', metric: 'Login Frequency', currentValue: `${loginFrequency}x/week`, targetValue: '4x/week', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'metric-4', metric: 'Executive Engagement', currentValue: 'No contact', targetValue: 'Monthly cadence', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'metric-5', metric: 'NPS Score', currentValue: `${npsScore}`, targetValue: '40+', dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'metric-6', metric: 'Support Tickets', currentValue: 'Multiple open', targetValue: 'All resolved', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      ];

      // Add missing metrics
      defaultMetrics.forEach((defaultMetric, idx) => {
        if (successMetrics.length < 4 + idx) {
          successMetrics.push({ ...defaultMetric, id: `metric-${successMetrics.length + 1}` });
        }
      });
    }

    // Get timeline
    const timeline = parsed.timeline || (daysUntilRenewal < 30 ? '14 days' : daysUntilRenewal < 60 ? '30 days' : '45 days');

    return {
      title: `Save Play: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      riskLevel,
      situation,
      healthScore,
      daysUntilRenewal,
      arr,
      rootCauses,
      actionItems,
      successMetrics,
      timeline,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Save play preview generation error:', error);

    // Return fallback save play
    const fallbackSituation = `${customerName} is at ${riskLevel} risk with a health score of ${healthScore}/100. Key concerns include declining engagement and upcoming renewal in ${daysUntilRenewal} days. Immediate intervention required.`;

    const fallbackRootCauses: RootCause[] = [
      { id: 'cause-1', cause: 'Low Product Adoption', description: 'Key features underutilized', category: 'product', severity: 'high', evidence: `${featureAdoption}% adoption`, enabled: true },
      { id: 'cause-2', cause: 'Declining Engagement', description: 'User activity has dropped', category: 'value', severity: 'high', evidence: `${loginFrequency}x/week logins`, enabled: true },
      { id: 'cause-3', cause: 'Champion Disengagement', description: 'Key contact not responsive', category: 'relationship', severity: 'high', evidence: 'No response to outreach', enabled: true },
      { id: 'cause-4', cause: 'Unresolved Issues', description: 'Support tickets pending', category: 'service', severity: 'medium', evidence: 'Multiple open tickets', enabled: true },
      { id: 'cause-5', cause: 'Value Gap', description: 'ROI not demonstrated', category: 'value', severity: 'high', evidence: `NPS: ${npsScore}`, enabled: true },
    ];

    const fallbackActionItems: SavePlayAction[] = [
      { id: 'action-1', action: 'Emergency Executive Call', description: 'Urgent call with sponsor', owner: 'CSM', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-3', 'cause-5'] },
      { id: 'action-2', action: 'Value Workshop', description: 'ROI demonstration', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-5'] },
      { id: 'action-3', action: 'Adoption Program', description: 'Intensive training', owner: 'CSM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-1', 'cause-2'] },
      { id: 'action-4', action: 'Support Resolution', description: 'Resolve all tickets', owner: 'Support', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-4'] },
      { id: 'action-5', action: 'Executive Alignment', description: 'Peer-to-peer engagement', owner: 'Leadership', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedCauseIds: ['cause-3'] },
    ];

    const fallbackSuccessMetrics: SuccessMetric[] = [
      { id: 'metric-1', metric: 'Health Score', currentValue: `${healthScore}/100`, targetValue: '70/100', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'metric-2', metric: 'Feature Adoption', currentValue: `${featureAdoption}%`, targetValue: '60%', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'metric-3', metric: 'Login Frequency', currentValue: `${loginFrequency}x/week`, targetValue: '4x/week', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'metric-4', metric: 'Executive Engagement', currentValue: 'No contact', targetValue: 'Monthly', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
    ];

    return {
      title: `Save Play: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      riskLevel,
      situation: fallbackSituation,
      healthScore,
      daysUntilRenewal,
      arr,
      rootCauses: fallbackRootCauses,
      actionItems: fallbackActionItems,
      successMetrics: fallbackSuccessMetrics,
      timeline: daysUntilRenewal < 30 ? '14 days' : '30 days',
      notes: '',
    };
  }
}

// ============================================
// Escalation Report Types
// ============================================

interface TimelineEvent {
  id: string;
  date: string;
  event: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actor: 'customer' | 'csm' | 'support' | 'product' | 'leadership' | 'external';
  enabled: boolean;
}

interface ImpactMetric {
  id: string;
  metric: string;
  value: string;
  impact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

interface SupportingEvidence {
  id: string;
  title: string;
  type: 'email' | 'ticket' | 'meeting' | 'document' | 'screenshot' | 'log' | 'other';
  date: string;
  description: string;
  url?: string;
  enabled: boolean;
}

interface ResolutionRequest {
  id: string;
  request: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  owner: 'Product' | 'Engineering' | 'Leadership' | 'Support' | 'Legal' | 'Finance';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

interface EscalationReportPreviewResult {
  title: string;
  createdDate: string;
  escalationLevel: 'critical' | 'high' | 'medium';
  issueSummary: string;
  customerName: string;
  arr: number;
  healthScore: number;
  daysUntilRenewal: number;
  primaryContact: string;
  escalationOwner: string;
  timeline: TimelineEvent[];
  impactMetrics: ImpactMetric[];
  resolutionRequests: ResolutionRequest[];
  supportingEvidence: SupportingEvidence[];
  recommendedActions: string;
  notes: string;
}

/**
 * Generate an escalation report preview for urgent customer issues
 * Provides editable HITL preview before creating final document
 */
async function generateEscalationReportPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<EscalationReportPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 45;
  const arr = customer?.arr || 100000;
  const tier = customer?.tier || 'Growth';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 35;
  const loginFrequency = engagement?.loginFrequency || 1.5;

  // Get stakeholder info
  const stakeholders = context.platformData.stakeholders || [];
  const primaryStakeholder = stakeholders.find((s: any) => s.role === 'champion' || s.isPrimary) || stakeholders[0];
  const primaryContact = primaryStakeholder?.name || 'Primary Contact';

  // Get risk signals from context
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high' || r.type === 'churn_risk');

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Determine escalation level
  let escalationLevel: EscalationReportPreviewResult['escalationLevel'] = 'medium';
  if (healthScore < 40 || hasHighRisk || daysUntilRenewal < 30) escalationLevel = 'critical';
  else if (healthScore < 55 || daysUntilRenewal < 60) escalationLevel = 'high';

  // Build prompt for escalation report generation
  const prompt = `You are a customer success manager creating an escalation report for a critical customer issue that requires executive or cross-functional attention. Generate a comprehensive escalation report with timeline, impact analysis, and resolution requests.

Customer: ${customerName}
Current Tier: ${tier}
Health Score: ${healthScore}/100
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
Escalation Level: ${escalationLevel.toUpperCase()}
Primary Contact: ${primaryContact}
Known Risk Signals: ${hasHighRisk ? 'High risk - immediate action required' : 'Elevated concerns'}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate an escalation report with:
1. A clear issue summary (2-3 sentences describing the critical issue requiring escalation)
2. 5-8 timeline events showing how the issue developed (with dates, descriptions, severity, actors)
3. 4-6 impact metrics showing business impact (revenue at risk, user impact, etc.)
4. 3-5 resolution requests for specific teams with priorities and deadlines
5. 3-5 pieces of supporting evidence (emails, tickets, meetings, etc.)
6. Recommended actions summary

Format your response as JSON:
{
  "issueSummary": "2-3 sentence summary of the critical issue requiring escalation",
  "escalationOwner": "Name of person responsible for this escalation",
  "timelineEvents": [
    {
      "date": "YYYY-MM-DD",
      "event": "Event title",
      "description": "What happened",
      "severity": "critical|high|medium|low",
      "actor": "customer|csm|support|product|leadership|external"
    }
  ],
  "impactMetrics": [
    {
      "metric": "Metric name",
      "value": "Current value",
      "impact": "Description of business impact",
      "severity": "critical|high|medium|low"
    }
  ],
  "resolutionRequests": [
    {
      "request": "What needs to be done",
      "priority": "urgent|high|medium|low",
      "owner": "Product|Engineering|Leadership|Support|Legal|Finance"
    }
  ],
  "supportingEvidence": [
    {
      "title": "Evidence title",
      "type": "email|ticket|meeting|document|screenshot|log|other",
      "date": "YYYY-MM-DD",
      "description": "Brief description of the evidence"
    }
  ],
  "recommendedActions": "Summary of recommended next steps"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get issue summary
    const issueSummary = parsed.issueSummary ||
      `${customerName} has raised a critical issue requiring immediate escalation. ` +
      `The situation has escalated due to unresolved concerns impacting their operations. ` +
      `With renewal in ${daysUntilRenewal} days, urgent resolution is required.`;

    // Get escalation owner
    const escalationOwner = parsed.escalationOwner || 'CSM Manager';

    // Process timeline events
    const timeline: TimelineEvent[] = (parsed.timelineEvents || []).map((e: any, idx: number) => ({
      id: `event-${idx + 1}`,
      date: e.date || new Date(Date.now() - (30 - idx * 5) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      event: e.event || `Event ${idx + 1}`,
      description: e.description || '',
      severity: (e.severity as TimelineEvent['severity']) || 'medium',
      actor: (e.actor as TimelineEvent['actor']) || 'customer',
      enabled: true,
    }));

    // Ensure minimum timeline events
    if (timeline.length < 5) {
      const defaultEvents: TimelineEvent[] = [
        { id: 'event-1', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Initial Issue Reported', description: 'Customer reported issue via support ticket', severity: 'medium', actor: 'customer', enabled: true },
        { id: 'event-2', date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Support Investigation', description: 'Support team began investigating the issue', severity: 'medium', actor: 'support', enabled: true },
        { id: 'event-3', date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Issue Escalated Internally', description: 'Issue escalated to product team for deeper analysis', severity: 'high', actor: 'csm', enabled: true },
        { id: 'event-4', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Customer Executive Escalation', description: 'Customer executive expressed serious concern', severity: 'critical', actor: 'customer', enabled: true },
        { id: 'event-5', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Temporary Workaround Provided', description: 'Support provided interim solution', severity: 'medium', actor: 'support', enabled: true },
        { id: 'event-6', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Workaround Deemed Insufficient', description: 'Customer rejected workaround as unacceptable', severity: 'high', actor: 'customer', enabled: true },
        { id: 'event-7', date: new Date().toISOString().slice(0, 10), event: 'Escalation Report Created', description: 'Formal escalation initiated requiring executive attention', severity: 'critical', actor: 'csm', enabled: true },
      ];

      // Add missing events
      defaultEvents.forEach((defaultEvent, idx) => {
        if (!timeline.find(e => e.event === defaultEvent.event)) {
          timeline.push({ ...defaultEvent, id: `event-${timeline.length + 1}` });
        }
      });

      // Sort by date
      timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // Process impact metrics
    const impactMetrics: ImpactMetric[] = (parsed.impactMetrics || []).map((m: any, idx: number) => ({
      id: `impact-${idx + 1}`,
      metric: m.metric || `Impact ${idx + 1}`,
      value: m.value || '',
      impact: m.impact || '',
      severity: (m.severity as ImpactMetric['severity']) || 'high',
      enabled: true,
    }));

    // Ensure minimum impact metrics
    if (impactMetrics.length < 4) {
      const defaultMetrics: ImpactMetric[] = [
        { id: 'impact-1', metric: 'Revenue at Risk', value: `$${arr.toLocaleString()} ARR`, impact: 'Full contract value at risk if issue not resolved before renewal', severity: 'critical', enabled: true },
        { id: 'impact-2', metric: 'User Impact', value: `${Math.round(featureAdoption * 10)} affected users`, impact: 'Users unable to complete critical workflows', severity: 'high', enabled: true },
        { id: 'impact-3', metric: 'Customer Satisfaction', value: `Health: ${healthScore}/100`, impact: 'Significant decline in overall satisfaction and engagement', severity: healthScore < 50 ? 'critical' : 'high', enabled: true },
        { id: 'impact-4', metric: 'Time to Resolution', value: '30+ days', impact: 'Extended resolution time damaging relationship trust', severity: 'high', enabled: true },
        { id: 'impact-5', metric: 'Escalation Cost', value: 'Executive involvement', impact: 'Resource allocation and opportunity cost of escalation', severity: 'medium', enabled: true },
        { id: 'impact-6', metric: 'Renewal Risk', value: `${daysUntilRenewal} days left`, impact: 'Renewal decision may be negatively influenced', severity: daysUntilRenewal < 60 ? 'critical' : 'high', enabled: true },
      ];

      // Add missing metrics
      defaultMetrics.forEach((defaultMetric) => {
        if (impactMetrics.length < 4) {
          impactMetrics.push({ ...defaultMetric, id: `impact-${impactMetrics.length + 1}` });
        }
      });
    }

    // Process resolution requests
    const resolutionRequests: ResolutionRequest[] = (parsed.resolutionRequests || []).map((r: any, idx: number) => ({
      id: `request-${idx + 1}`,
      request: r.request || `Resolution ${idx + 1}`,
      priority: (r.priority as ResolutionRequest['priority']) || 'high',
      owner: (r.owner as ResolutionRequest['owner']) || 'Product',
      dueDate: new Date(Date.now() + (7 + idx * 7) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'pending' as const,
    }));

    // Ensure minimum resolution requests
    if (resolutionRequests.length < 3) {
      const defaultRequests: ResolutionRequest[] = [
        { id: 'request-1', request: 'Root Cause Analysis and Fix ETA', priority: 'urgent', owner: 'Engineering', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
        { id: 'request-2', request: 'Executive-to-Executive Call', priority: 'urgent', owner: 'Leadership', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
        { id: 'request-3', request: 'Customer Credit or Compensation Review', priority: 'high', owner: 'Finance', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
        { id: 'request-4', request: 'Product Roadmap Prioritization', priority: 'high', owner: 'Product', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
        { id: 'request-5', request: 'Dedicated Support Resources', priority: 'high', owner: 'Support', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
      ];

      // Add missing requests
      defaultRequests.forEach((defaultRequest) => {
        if (resolutionRequests.length < 3) {
          resolutionRequests.push({ ...defaultRequest, id: `request-${resolutionRequests.length + 1}` });
        }
      });
    }

    // Process supporting evidence
    const supportingEvidence: SupportingEvidence[] = (parsed.supportingEvidence || []).map((e: any, idx: number) => ({
      id: `evidence-${idx + 1}`,
      title: e.title || `Evidence ${idx + 1}`,
      type: (e.type as SupportingEvidence['type']) || 'document',
      date: e.date || new Date(Date.now() - idx * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: e.description || '',
      url: e.url,
      enabled: true,
    }));

    // Ensure minimum supporting evidence
    if (supportingEvidence.length < 3) {
      const defaultEvidence: SupportingEvidence[] = [
        { id: 'evidence-1', title: 'Original Support Ticket', type: 'ticket', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Initial ticket documenting the reported issue', enabled: true },
        { id: 'evidence-2', title: 'Customer Escalation Email', type: 'email', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Email from customer executive expressing urgency', enabled: true },
        { id: 'evidence-3', title: 'Internal Investigation Notes', type: 'document', date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Technical analysis and findings from engineering', enabled: true },
        { id: 'evidence-4', title: 'Health Score Trend Report', type: 'document', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: `Health score declined from 75 to ${healthScore} over past month`, enabled: true },
        { id: 'evidence-5', title: 'Meeting Recording', type: 'meeting', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Recording of escalation call with customer', enabled: true },
      ];

      // Add missing evidence
      defaultEvidence.forEach((defaultEv) => {
        if (supportingEvidence.length < 3) {
          supportingEvidence.push({ ...defaultEv, id: `evidence-${supportingEvidence.length + 1}` });
        }
      });
    }

    // Get recommended actions
    const recommendedActions = parsed.recommendedActions ||
      `1. Schedule executive-to-executive call within 48 hours to demonstrate commitment\n` +
      `2. Assign dedicated engineering resource for root cause analysis\n` +
      `3. Provide interim workaround with proactive support monitoring\n` +
      `4. Evaluate customer credit or extension to restore goodwill\n` +
      `5. Implement weekly status calls until resolution confirmed`;

    return {
      title: `Escalation Report: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      escalationLevel,
      issueSummary,
      customerName,
      arr,
      healthScore,
      daysUntilRenewal,
      primaryContact,
      escalationOwner,
      timeline,
      impactMetrics,
      resolutionRequests,
      supportingEvidence,
      recommendedActions,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Escalation report preview generation error:', error);

    // Return fallback escalation report
    const fallbackIssueSummary = `${customerName} has raised a critical issue requiring immediate escalation. The situation has escalated due to unresolved concerns impacting their operations. With renewal in ${daysUntilRenewal} days, urgent resolution is required.`;

    const fallbackTimeline: TimelineEvent[] = [
      { id: 'event-1', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Initial Issue Reported', description: 'Customer reported issue', severity: 'medium', actor: 'customer', enabled: true },
      { id: 'event-2', date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Support Investigation', description: 'Investigation began', severity: 'medium', actor: 'support', enabled: true },
      { id: 'event-3', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Executive Escalation', description: 'Customer escalated to executive', severity: 'critical', actor: 'customer', enabled: true },
      { id: 'event-4', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), event: 'Interim Workaround', description: 'Temporary solution provided', severity: 'medium', actor: 'support', enabled: true },
      { id: 'event-5', date: new Date().toISOString().slice(0, 10), event: 'Formal Escalation', description: 'Escalation report created', severity: 'critical', actor: 'csm', enabled: true },
    ];

    const fallbackImpactMetrics: ImpactMetric[] = [
      { id: 'impact-1', metric: 'Revenue at Risk', value: `$${arr.toLocaleString()}`, impact: 'Full contract at risk', severity: 'critical', enabled: true },
      { id: 'impact-2', metric: 'Health Score', value: `${healthScore}/100`, impact: 'Declining satisfaction', severity: 'high', enabled: true },
      { id: 'impact-3', metric: 'Renewal Timeline', value: `${daysUntilRenewal} days`, impact: 'Renewal at risk', severity: 'high', enabled: true },
      { id: 'impact-4', metric: 'User Impact', value: 'Critical workflows', impact: 'Users blocked', severity: 'high', enabled: true },
    ];

    const fallbackResolutionRequests: ResolutionRequest[] = [
      { id: 'request-1', request: 'Root Cause Analysis', priority: 'urgent', owner: 'Engineering', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
      { id: 'request-2', request: 'Executive Call', priority: 'urgent', owner: 'Leadership', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
      { id: 'request-3', request: 'Compensation Review', priority: 'high', owner: 'Finance', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending' },
    ];

    const fallbackSupportingEvidence: SupportingEvidence[] = [
      { id: 'evidence-1', title: 'Support Ticket', type: 'ticket', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Original issue report', enabled: true },
      { id: 'evidence-2', title: 'Escalation Email', type: 'email', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Executive escalation email', enabled: true },
      { id: 'evidence-3', title: 'Health Trend', type: 'document', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), description: 'Declining health score data', enabled: true },
    ];

    return {
      title: `Escalation Report: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      escalationLevel,
      issueSummary: fallbackIssueSummary,
      customerName,
      arr,
      healthScore,
      daysUntilRenewal,
      primaryContact,
      escalationOwner: 'CSM Manager',
      timeline: fallbackTimeline,
      impactMetrics: fallbackImpactMetrics,
      resolutionRequests: fallbackResolutionRequests,
      supportingEvidence: fallbackSupportingEvidence,
      recommendedActions: `1. Schedule executive call within 48 hours\n2. Assign dedicated engineering resource\n3. Evaluate customer credit\n4. Implement weekly status calls`,
      notes: '',
    };
  }
}

// ============================================
// Risk Assessment Types
// ============================================

interface AssessmentRiskFactor {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'engagement' | 'support' | 'nps' | 'usage' | 'relationship' | 'financial' | 'competitive';
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number; // 0-100
  enabled: boolean;
  evidence: string;
}

interface AssessmentMitigationAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Leadership' | 'Implementation';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedRiskIds: string[];
}

interface RiskAssessmentPreviewResult {
  title: string;
  assessmentDate: string;
  overallRiskScore: number; // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  riskFactors: AssessmentRiskFactor[];
  mitigationActions: AssessmentMitigationAction[];
  executiveSummary: string;
  notes: string;
}

/**
 * Generate a risk assessment preview for at-risk customers
 * Provides editable HITL preview before creating final document
 */
async function generateRiskAssessmentPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<RiskAssessmentPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 65;
  const arr = customer?.arr || 100000;
  const tier = customer?.tier || 'Growth';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 45;
  const loginFrequency = engagement?.loginFrequency || 2.0;
  const dauMau = engagement?.dauMau || 0.3;

  // Get NPS data
  const npsScore = customer?.npsScore || 25;

  // Get risk signals from context
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high' || r.type === 'churn_risk');

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Build prompt for risk assessment generation
  const prompt = `You are a customer success manager preparing a comprehensive risk assessment for a customer showing warning signs. Generate a detailed risk assessment with specific factors, evidence, and mitigation actions.

Customer: ${customerName}
Current Tier: ${tier}
Health Score: ${healthScore}/100
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
DAU/MAU Ratio: ${(dauMau * 100).toFixed(1)}%
NPS Score: ${npsScore}
Known Risk Signals: ${hasHighRisk ? 'High risk detected' : 'Moderate concerns'}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a risk assessment with:
1. 6-8 risk factors categorized by type (health, engagement, support, nps, usage, relationship, financial, competitive) with severity levels and evidence
2. 5-7 mitigation actions with owners, priorities, and related risk factors
3. A brief executive summary (2-3 sentences)

Format your response as JSON:
{
  "riskFactors": [
    {
      "name": "Risk factor name",
      "description": "What this risk means",
      "category": "health|engagement|support|nps|usage|relationship|financial|competitive",
      "severity": "critical|high|medium|low",
      "weight": 85,
      "evidence": "Specific data or observation supporting this risk"
    }
  ],
  "mitigationActions": [
    {
      "action": "Action title",
      "description": "Detailed action steps",
      "owner": "CSM|Customer|Support|Product|Leadership|Implementation",
      "priority": "high|medium|low",
      "relatedRiskFactors": ["Risk factor name 1", "Risk factor name 2"]
    }
  ],
  "executiveSummary": "2-3 sentence summary of overall risk posture and recommended approach"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Process risk factors
    const riskFactors: AssessmentRiskFactor[] = (parsed.riskFactors || []).map((r: any, idx: number) => ({
      id: `risk-${idx + 1}`,
      name: r.name || `Risk Factor ${idx + 1}`,
      description: r.description || '',
      category: (r.category as AssessmentRiskFactor['category']) || 'health',
      severity: (r.severity as AssessmentRiskFactor['severity']) || 'medium',
      weight: typeof r.weight === 'number' ? r.weight : 50,
      enabled: true,
      evidence: r.evidence || '',
    }));

    // Ensure minimum risk factors
    if (riskFactors.length < 6) {
      const defaultRisks: AssessmentRiskFactor[] = [
        { id: 'risk-1', name: 'Declining Health Score', description: 'Health score has dropped below acceptable threshold', category: 'health', severity: healthScore < 50 ? 'critical' : 'high', weight: 90, enabled: true, evidence: `Current health score: ${healthScore}/100` },
        { id: 'risk-2', name: 'Low Feature Adoption', description: 'Customer is not utilizing key product features', category: 'usage', severity: featureAdoption < 40 ? 'high' : 'medium', weight: 75, enabled: true, evidence: `Feature adoption at ${featureAdoption}%, target is 70%` },
        { id: 'risk-3', name: 'Reduced Engagement', description: 'Login frequency has declined significantly', category: 'engagement', severity: loginFrequency < 3 ? 'high' : 'medium', weight: 70, enabled: true, evidence: `Login frequency: ${loginFrequency}x/week, down from average` },
        { id: 'risk-4', name: 'Low NPS Score', description: 'Customer satisfaction below benchmark', category: 'nps', severity: npsScore < 0 ? 'critical' : npsScore < 30 ? 'high' : 'medium', weight: 80, enabled: true, evidence: `NPS score: ${npsScore}, benchmark is 40+` },
        { id: 'risk-5', name: 'Renewal Timeline Pressure', description: 'Limited time to address issues before renewal', category: 'financial', severity: daysUntilRenewal < 60 ? 'critical' : daysUntilRenewal < 90 ? 'high' : 'medium', weight: 85, enabled: true, evidence: `${daysUntilRenewal} days until renewal` },
        { id: 'risk-6', name: 'Champion Risk', description: 'Key stakeholder engagement has decreased', category: 'relationship', severity: 'medium', weight: 65, enabled: true, evidence: 'Primary contact response time has increased' },
        { id: 'risk-7', name: 'Competitive Pressure', description: 'Customer may be evaluating alternatives', category: 'competitive', severity: 'medium', weight: 60, enabled: true, evidence: 'Industry reports show increased competitive activity' },
        { id: 'risk-8', name: 'Support Escalations', description: 'Recent support tickets indicate frustration', category: 'support', severity: 'medium', weight: 55, enabled: true, evidence: 'Multiple escalated tickets in past 30 days' },
      ];

      // Add missing risks
      defaultRisks.forEach((defaultRisk, idx) => {
        if (!riskFactors.find(r => r.category === defaultRisk.category)) {
          riskFactors.push({ ...defaultRisk, id: `risk-${riskFactors.length + 1}` });
        }
      });
    }

    // Process mitigation actions with risk ID mapping
    const mitigationActions: AssessmentMitigationAction[] = (parsed.mitigationActions || []).map((m: any, idx: number) => {
      // Map related risk factor names to IDs
      const relatedRiskIds = (m.relatedRiskFactors || []).map((riskName: string) => {
        const matchedRisk = riskFactors.find(r =>
          r.name.toLowerCase().includes(riskName.toLowerCase()) ||
          riskName.toLowerCase().includes(r.name.toLowerCase())
        );
        return matchedRisk?.id || '';
      }).filter(Boolean);

      return {
        id: `action-${idx + 1}`,
        action: m.action || `Action ${idx + 1}`,
        description: m.description || '',
        owner: (m.owner as AssessmentMitigationAction['owner']) || 'CSM',
        dueDate: new Date(Date.now() + (14 + idx * 7) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'pending' as const,
        priority: (m.priority as AssessmentMitigationAction['priority']) || 'medium',
        relatedRiskIds,
      };
    });

    // Ensure minimum mitigation actions
    if (mitigationActions.length < 5) {
      const defaultActions: AssessmentMitigationAction[] = [
        { id: 'action-1', action: 'Executive Business Review', description: 'Schedule urgent EBR with key stakeholders to discuss value delivered and address concerns', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-1', 'risk-4'] },
        { id: 'action-2', action: 'Adoption Workshop', description: 'Conduct targeted training on underutilized features to improve adoption', owner: 'CSM', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-2', 'risk-3'] },
        { id: 'action-3', action: 'Support Escalation Review', description: 'Review open tickets with Support team and create resolution plan', owner: 'Support', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-8'] },
        { id: 'action-4', action: 'Champion Engagement', description: 'Re-engage executive sponsor and identify additional champions', owner: 'CSM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedRiskIds: ['risk-6'] },
        { id: 'action-5', action: 'Competitive Analysis', description: 'Prepare competitive differentiation materials and address specific concerns', owner: 'CSM', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedRiskIds: ['risk-7'] },
        { id: 'action-6', action: 'Product Roadmap Review', description: 'Share relevant roadmap items and gather feedback on priorities', owner: 'Product', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedRiskIds: ['risk-2', 'risk-7'] },
        { id: 'action-7', action: 'Renewal Strategy Session', description: 'Internal meeting to align on negotiation strategy and timeline', owner: 'Leadership', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-5'] },
      ];

      // Add missing actions
      defaultActions.forEach((defaultAction, idx) => {
        if (mitigationActions.length < 5 + idx) {
          mitigationActions.push({ ...defaultAction, id: `action-${mitigationActions.length + 1}` });
        }
      });
    }

    // Calculate overall risk score (weighted average of enabled factors)
    const enabledFactors = riskFactors.filter(r => r.enabled);
    const severityScores: Record<string, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    enabledFactors.forEach(factor => {
      const severityScore = severityScores[factor.severity];
      weightedSum += severityScore * factor.weight;
      totalWeight += factor.weight;
    });

    const overallRiskScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Determine risk level
    let riskLevel: RiskAssessmentPreviewResult['riskLevel'] = 'low';
    if (overallRiskScore >= 80) riskLevel = 'critical';
    else if (overallRiskScore >= 60) riskLevel = 'high';
    else if (overallRiskScore >= 40) riskLevel = 'medium';

    // Get executive summary
    const executiveSummary = parsed.executiveSummary ||
      `${customerName} presents a ${riskLevel} risk profile with an overall risk score of ${overallRiskScore}/100. ` +
      `Key concerns include ${riskFactors.filter(r => r.severity === 'critical' || r.severity === 'high').map(r => r.name.toLowerCase()).join(', ') || 'multiple moderate risk factors'}. ` +
      `Immediate action is recommended to address these issues before the renewal in ${daysUntilRenewal} days.`;

    return {
      title: `Risk Assessment: ${customerName}`,
      assessmentDate: new Date().toISOString().slice(0, 10),
      overallRiskScore,
      riskLevel,
      healthScore,
      daysUntilRenewal,
      arr,
      riskFactors,
      mitigationActions,
      executiveSummary,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Risk assessment preview generation error:', error);

    // Return fallback risk assessment
    const overallRiskScore = healthScore < 50 ? 75 : healthScore < 70 ? 60 : 45;
    const riskLevel: RiskAssessmentPreviewResult['riskLevel'] = overallRiskScore >= 70 ? 'high' : overallRiskScore >= 50 ? 'medium' : 'low';

    const fallbackRiskFactors: AssessmentRiskFactor[] = [
      { id: 'risk-1', name: 'Health Score Decline', description: 'Health score below target threshold', category: 'health', severity: healthScore < 50 ? 'critical' : 'high', weight: 90, enabled: true, evidence: `Current score: ${healthScore}/100` },
      { id: 'risk-2', name: 'Low Feature Adoption', description: 'Key features not being utilized', category: 'usage', severity: 'high', weight: 75, enabled: true, evidence: `Adoption at ${featureAdoption}%` },
      { id: 'risk-3', name: 'Engagement Drop', description: 'Reduced platform usage', category: 'engagement', severity: 'medium', weight: 70, enabled: true, evidence: `Login frequency: ${loginFrequency}x/week` },
      { id: 'risk-4', name: 'NPS Concern', description: 'Customer satisfaction below benchmark', category: 'nps', severity: npsScore < 0 ? 'critical' : 'high', weight: 80, enabled: true, evidence: `NPS: ${npsScore}` },
      { id: 'risk-5', name: 'Renewal Pressure', description: 'Limited time before renewal', category: 'financial', severity: daysUntilRenewal < 60 ? 'critical' : 'high', weight: 85, enabled: true, evidence: `${daysUntilRenewal} days remaining` },
      { id: 'risk-6', name: 'Stakeholder Risk', description: 'Champion engagement declining', category: 'relationship', severity: 'medium', weight: 65, enabled: true, evidence: 'Decreased response rates' },
    ];

    const fallbackMitigationActions: AssessmentMitigationAction[] = [
      { id: 'action-1', action: 'Executive Business Review', description: 'Urgent meeting with stakeholders', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-1', 'risk-4'] },
      { id: 'action-2', action: 'Adoption Workshop', description: 'Training on underutilized features', owner: 'CSM', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-2', 'risk-3'] },
      { id: 'action-3', action: 'Support Review', description: 'Review and resolve open tickets', owner: 'Support', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: [] },
      { id: 'action-4', action: 'Champion Re-engagement', description: 'Connect with executive sponsor', owner: 'CSM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedRiskIds: ['risk-6'] },
      { id: 'action-5', action: 'Renewal Strategy', description: 'Internal alignment on approach', owner: 'Leadership', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedRiskIds: ['risk-5'] },
    ];

    return {
      title: `Risk Assessment: ${customerName}`,
      assessmentDate: new Date().toISOString().slice(0, 10),
      overallRiskScore,
      riskLevel,
      healthScore,
      daysUntilRenewal,
      arr,
      riskFactors: fallbackRiskFactors,
      mitigationActions: fallbackMitigationActions,
      executiveSummary: `${customerName} presents a ${riskLevel} risk profile with key concerns around health score (${healthScore}), feature adoption (${featureAdoption}%), and upcoming renewal in ${daysUntilRenewal} days. Immediate executive engagement and adoption workshop are recommended.`,
      notes: '',
    };
  }
}

// ============================================
// Resolution Plan Types
// ============================================

interface ResolutionIssue {
  id: string;
  title: string;
  description: string;
  category: 'product' | 'service' | 'integration' | 'performance' | 'usability' | 'security' | 'compliance' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'blocked' | 'resolved';
  reportedDate: string;
  enabled: boolean;
}

interface ResolutionAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Support' | 'Product' | 'Engineering' | 'Leadership' | 'Implementation';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  relatedIssueIds: string[];
}

interface ResolutionDependency {
  id: string;
  description: string;
  type: 'internal' | 'external' | 'customer' | 'vendor';
  status: 'pending' | 'in_progress' | 'resolved';
  blockedBy: string;
  enabled: boolean;
}

interface ResolutionPlanPreviewResult {
  title: string;
  createdDate: string;
  targetResolutionDate: string;
  overallStatus: 'on_track' | 'at_risk' | 'blocked' | 'resolved';
  summary: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  issues: ResolutionIssue[];
  actionItems: ResolutionAction[];
  dependencies: ResolutionDependency[];
  timeline: string;
  notes: string;
}

/**
 * Generate a resolution plan preview for customer issues
 * Provides editable HITL preview before creating final document
 */
async function generateResolutionPlanPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<ResolutionPlanPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 65;
  const arr = customer?.arr || 100000;
  const tier = customer?.tier || 'Growth';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 45;
  const loginFrequency = engagement?.loginFrequency || 2.0;

  // Get support data
  const supportTickets = context.platformData.interactionHistory?.filter((i: any) => i.type === 'support') || [];
  const openTicketCount = supportTickets.length;

  // Get risk signals from context
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high');

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Calculate target resolution date (30 days from now or before renewal)
  const targetResolutionDate = new Date(Date.now() + Math.min(30, daysUntilRenewal - 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Determine overall status
  let overallStatus: ResolutionPlanPreviewResult['overallStatus'] = 'on_track';
  if (hasHighRisk || healthScore < 40) overallStatus = 'blocked';
  else if (healthScore < 55 || daysUntilRenewal < 30) overallStatus = 'at_risk';

  // Build prompt for resolution plan generation
  const prompt = `You are a customer success manager creating a comprehensive resolution plan to address multiple customer issues. Generate a structured plan with issues, action items, dependencies, and timeline.

Customer: ${customerName}
Current Tier: ${tier}
Health Score: ${healthScore}/100
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
Open Support Tickets: ${openTicketCount}
Overall Status: ${overallStatus.toUpperCase().replace('_', ' ')}
Target Resolution: ${targetResolutionDate}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a resolution plan with:
1. A summary describing the situation and resolution approach (2-3 sentences)
2. 4-6 issues categorized by type (product, service, integration, performance, usability, security, compliance) with severity and status
3. 6-8 action items with owners, priorities, due dates, and linked issues
4. 3-5 dependencies that need to be resolved
5. Expected timeline for resolution

Format your response as JSON:
{
  "summary": "2-3 sentence summary of the situation and resolution approach",
  "issues": [
    {
      "title": "Issue title",
      "description": "Detailed description of the issue",
      "category": "product|service|integration|performance|usability|security|compliance|other",
      "severity": "critical|high|medium|low",
      "status": "open|in_progress|blocked|resolved",
      "reportedDate": "YYYY-MM-DD"
    }
  ],
  "actionItems": [
    {
      "action": "Action title",
      "description": "What needs to be done",
      "owner": "CSM|Customer|Support|Product|Engineering|Leadership|Implementation",
      "priority": "high|medium|low",
      "relatedIssues": ["Issue title 1", "Issue title 2"]
    }
  ],
  "dependencies": [
    {
      "description": "What is the dependency",
      "type": "internal|external|customer|vendor",
      "blockedBy": "Who/what is blocking"
    }
  ],
  "timeline": "Expected timeline description (e.g., '4 weeks with weekly checkpoints')"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get summary
    const summary = parsed.summary ||
      `${customerName} has multiple open issues requiring a structured resolution plan. ` +
      `With ${openTicketCount} support tickets and a health score of ${healthScore}, ` +
      `a coordinated effort is needed to resolve these issues before renewal in ${daysUntilRenewal} days.`;

    // Process issues
    const issues: ResolutionIssue[] = (parsed.issues || []).map((issue: any, idx: number) => ({
      id: `issue-${idx + 1}`,
      title: issue.title || `Issue ${idx + 1}`,
      description: issue.description || '',
      category: (issue.category as ResolutionIssue['category']) || 'other',
      severity: (issue.severity as ResolutionIssue['severity']) || 'medium',
      status: (issue.status as ResolutionIssue['status']) || 'open',
      reportedDate: issue.reportedDate || new Date(Date.now() - (30 - idx * 5) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      enabled: true,
    }));

    // Ensure minimum issues
    if (issues.length < 4) {
      const defaultIssues: ResolutionIssue[] = [
        { id: 'issue-1', title: 'Performance Degradation', description: 'System response times have increased significantly over the past month', category: 'performance', severity: 'high', status: 'open', reportedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'issue-2', title: 'Integration Sync Issues', description: 'Data synchronization with CRM is failing intermittently', category: 'integration', severity: 'high', status: 'in_progress', reportedDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'issue-3', title: 'Feature Usability Concerns', description: 'Users reporting confusion with recent UI changes', category: 'usability', severity: 'medium', status: 'open', reportedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'issue-4', title: 'Missing Reporting Features', description: 'Customer requested reports not available in current version', category: 'product', severity: 'medium', status: 'open', reportedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'issue-5', title: 'Support Response Time', description: 'Customer expects faster resolution on critical tickets', category: 'service', severity: 'medium', status: 'in_progress', reportedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      ];

      // Add missing issues
      defaultIssues.forEach((defaultIssue) => {
        if (issues.length < 4) {
          issues.push({ ...defaultIssue, id: `issue-${issues.length + 1}` });
        }
      });
    }

    // Create issue name to ID mapping
    const issueNameToId = new Map<string, string>();
    issues.forEach(issue => {
      issueNameToId.set(issue.title.toLowerCase(), issue.id);
    });

    // Process action items
    const actionItems: ResolutionAction[] = (parsed.actionItems || []).map((action: any, idx: number) => {
      // Map related issue names to IDs
      const relatedIssueIds: string[] = [];
      if (action.relatedIssues) {
        (action.relatedIssues as string[]).forEach((issueName: string) => {
          const issueId = issueNameToId.get(issueName.toLowerCase());
          if (issueId) relatedIssueIds.push(issueId);
        });
      }

      return {
        id: `action-${idx + 1}`,
        action: action.action || `Action ${idx + 1}`,
        description: action.description || '',
        owner: (action.owner as ResolutionAction['owner']) || 'CSM',
        dueDate: new Date(Date.now() + (7 + idx * 5) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'pending' as const,
        priority: (action.priority as ResolutionAction['priority']) || 'medium',
        relatedIssueIds: relatedIssueIds.length > 0 ? relatedIssueIds : [issues[Math.min(idx, issues.length - 1)]?.id || 'issue-1'],
      };
    });

    // Ensure minimum action items
    if (actionItems.length < 6) {
      const defaultActions: ResolutionAction[] = [
        { id: 'action-1', action: 'Schedule Technical Review', description: 'Set up call with engineering to review performance issues', owner: 'CSM', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedIssueIds: ['issue-1'] },
        { id: 'action-2', action: 'Integration Health Check', description: 'Run diagnostic on CRM sync and document failures', owner: 'Support', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedIssueIds: ['issue-2'] },
        { id: 'action-3', action: 'Customer Training Session', description: 'Schedule training on new UI features', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-3'] },
        { id: 'action-4', action: 'Feature Request Review', description: 'Review missing reports with product team', owner: 'Product', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-4'] },
        { id: 'action-5', action: 'Escalation Path Setup', description: 'Define dedicated support channel for critical issues', owner: 'Support', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedIssueIds: ['issue-5'] },
        { id: 'action-6', action: 'Executive Sponsor Check-in', description: 'Schedule call with executive sponsor to review progress', owner: 'Leadership', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-1', 'issue-2'] },
        { id: 'action-7', action: 'Customer Success Plan Update', description: 'Update success plan with resolution milestones', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-1', 'issue-3', 'issue-4'] },
      ];

      // Add missing actions
      defaultActions.forEach((defaultAction) => {
        if (actionItems.length < 6) {
          actionItems.push({ ...defaultAction, id: `action-${actionItems.length + 1}` });
        }
      });
    }

    // Process dependencies
    const dependencies: ResolutionDependency[] = (parsed.dependencies || []).map((dep: any, idx: number) => ({
      id: `dep-${idx + 1}`,
      description: dep.description || `Dependency ${idx + 1}`,
      type: (dep.type as ResolutionDependency['type']) || 'internal',
      status: 'pending' as const,
      blockedBy: dep.blockedBy || 'Pending review',
      enabled: true,
    }));

    // Ensure minimum dependencies
    if (dependencies.length < 3) {
      const defaultDependencies: ResolutionDependency[] = [
        { id: 'dep-1', description: 'Engineering resource allocation for performance fix', type: 'internal', status: 'pending', blockedBy: 'Sprint planning approval', enabled: true },
        { id: 'dep-2', description: 'Customer IT team availability for integration testing', type: 'customer', status: 'pending', blockedBy: 'Customer IT calendar', enabled: true },
        { id: 'dep-3', description: 'Third-party API documentation update', type: 'vendor', status: 'pending', blockedBy: 'Vendor support response', enabled: true },
        { id: 'dep-4', description: 'Product roadmap prioritization for feature request', type: 'internal', status: 'pending', blockedBy: 'Product leadership review', enabled: true },
      ];

      // Add missing dependencies
      defaultDependencies.forEach((defaultDep) => {
        if (dependencies.length < 3) {
          dependencies.push({ ...defaultDep, id: `dep-${dependencies.length + 1}` });
        }
      });
    }

    // Get timeline
    const timeline = parsed.timeline ||
      `4-week resolution plan with weekly status updates. Week 1: Immediate triage and critical fixes. Week 2: Integration and performance remediation. Week 3: User training and adoption support. Week 4: Validation and closure.`;

    return {
      title: `Resolution Plan: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      targetResolutionDate,
      overallStatus,
      summary,
      healthScore,
      daysUntilRenewal,
      arr,
      issues,
      actionItems,
      dependencies,
      timeline,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Resolution plan preview generation error:', error);

    // Return fallback resolution plan
    const fallbackSummary = `${customerName} has multiple open issues requiring a structured resolution plan. With a health score of ${healthScore} and renewal in ${daysUntilRenewal} days, a coordinated effort is needed to resolve these issues.`;

    const fallbackIssues: ResolutionIssue[] = [
      { id: 'issue-1', title: 'Performance Issues', description: 'System response times need improvement', category: 'performance', severity: 'high', status: 'open', reportedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'issue-2', title: 'Integration Problems', description: 'Data sync issues with external systems', category: 'integration', severity: 'high', status: 'in_progress', reportedDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'issue-3', title: 'Usability Feedback', description: 'Users need additional training support', category: 'usability', severity: 'medium', status: 'open', reportedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'issue-4', title: 'Feature Gaps', description: 'Missing functionality requested by customer', category: 'product', severity: 'medium', status: 'open', reportedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
    ];

    const fallbackActionItems: ResolutionAction[] = [
      { id: 'action-1', action: 'Technical Review', description: 'Review performance issues', owner: 'Engineering', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedIssueIds: ['issue-1'] },
      { id: 'action-2', action: 'Integration Fix', description: 'Resolve sync issues', owner: 'Support', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'high', relatedIssueIds: ['issue-2'] },
      { id: 'action-3', action: 'Training Session', description: 'User training', owner: 'CSM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-3'] },
      { id: 'action-4', action: 'Product Roadmap Review', description: 'Review feature requests', owner: 'Product', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-4'] },
      { id: 'action-5', action: 'Status Update', description: 'Weekly progress update', owner: 'CSM', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-1', 'issue-2'] },
      { id: 'action-6', action: 'Exec Check-in', description: 'Executive status review', owner: 'Leadership', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'pending', priority: 'medium', relatedIssueIds: ['issue-1', 'issue-2', 'issue-3', 'issue-4'] },
    ];

    const fallbackDependencies: ResolutionDependency[] = [
      { id: 'dep-1', description: 'Engineering resources', type: 'internal', status: 'pending', blockedBy: 'Sprint planning', enabled: true },
      { id: 'dep-2', description: 'Customer IT availability', type: 'customer', status: 'pending', blockedBy: 'Schedule coordination', enabled: true },
      { id: 'dep-3', description: 'Product prioritization', type: 'internal', status: 'pending', blockedBy: 'Roadmap review', enabled: true },
    ];

    return {
      title: `Resolution Plan: ${customerName}`,
      createdDate: new Date().toISOString().slice(0, 10),
      targetResolutionDate,
      overallStatus,
      summary: fallbackSummary,
      healthScore,
      daysUntilRenewal,
      arr,
      issues: fallbackIssues,
      actionItems: fallbackActionItems,
      dependencies: fallbackDependencies,
      timeline: '4-week resolution plan with weekly status updates',
      notes: '',
    };
  }
}

// =====================================================================
// Executive Briefing Preview Types
// =====================================================================

interface ExecutiveHeadline {
  id: string;
  headline: string;
  detail: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  enabled: boolean;
}

interface ExecutiveMetric {
  id: string;
  name: string;
  value: string;
  previousValue?: string;
  trend: 'up' | 'down' | 'stable';
  category: 'health' | 'engagement' | 'adoption' | 'financial' | 'satisfaction';
  enabled: boolean;
}

interface StrategicUpdate {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'planned' | 'at_risk';
  category: 'growth' | 'retention' | 'expansion' | 'risk_mitigation' | 'innovation';
  enabled: boolean;
}

interface ExecutiveAsk {
  id: string;
  ask: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Leadership' | 'Sales';
  dueDate: string;
  enabled: boolean;
}

export interface ExecutiveBriefingPreviewResult {
  title: string;
  preparedFor: string;
  preparedBy: string;
  briefingDate: string;
  slideCount: 5 | 6 | 7;
  executiveSummary: string;
  headlines: ExecutiveHeadline[];
  keyMetrics: ExecutiveMetric[];
  strategicUpdates: StrategicUpdate[];
  asks: ExecutiveAsk[];
  nextSteps: string[];
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  notes: string;
}

/**
 * Generate an executive briefing preview for customer presentations
 * Provides editable HITL preview before creating final Google Slides
 */
async function generateExecutiveBriefingPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<ExecutiveBriefingPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 72;
  const arr = customer?.arr || 150000;
  const tier = customer?.tier || 'Enterprise';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const industryCode = customer?.industryCode || 'technology';

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;
  const loginFrequency = engagement?.loginFrequency || 3.5;
  const dauMau = engagement?.dauMau || 0.45;

  // Get NPS score
  const npsScore = customer?.npsScore || 35;

  // Get risk signals
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high');

  // Get recent activities
  const activities = context.platformData.interactionHistory?.slice(0, 5) || [];

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Determine health trend
  const healthTrends = context.platformData.healthTrends || [];
  const recentHealth = healthTrends.slice(0, 3);
  let healthTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentHealth.length >= 2) {
    const diff = (recentHealth[0]?.score || healthScore) - (recentHealth[recentHealth.length - 1]?.score || healthScore);
    if (diff > 5) healthTrend = 'up';
    else if (diff < -5) healthTrend = 'down';
  }

  // Build prompt for executive briefing generation
  const prompt = `You are a customer success manager creating a concise executive briefing presentation for leadership. Generate content for a 5-7 slide deck that summarizes account health, key wins, strategic updates, and asks.

Customer: ${customerName}
Industry: ${industryCode}
Current Tier: ${tier}
Health Score: ${healthScore}/100 (trend: ${healthTrend})
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
DAU/MAU Ratio: ${(dauMau * 100).toFixed(0)}%
NPS Score: ${npsScore}
High Risk Signals: ${hasHighRisk ? 'Yes' : 'No'}
Recent Activities: ${activities.length} in last 30 days
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate an executive briefing with:
1. Executive summary (2-3 sentences capturing the overall account status)
2. 3-4 headlines (key talking points with positive/neutral/negative sentiment)
3. 5-7 key metrics with current values, trends, and categories
4. 3-5 strategic updates with status and category
5. 2-4 asks (requests/recommendations for leadership)
6. 3-5 next steps

Format your response as JSON:
{
  "executiveSummary": "2-3 sentence summary of account status and outlook",
  "headlines": [
    {
      "headline": "Brief headline (5-8 words)",
      "detail": "Supporting detail (1-2 sentences)",
      "sentiment": "positive|neutral|negative"
    }
  ],
  "keyMetrics": [
    {
      "name": "Metric name",
      "value": "Current value with unit",
      "previousValue": "Previous period value (optional)",
      "trend": "up|down|stable",
      "category": "health|engagement|adoption|financial|satisfaction"
    }
  ],
  "strategicUpdates": [
    {
      "title": "Update title",
      "description": "Brief description of the update",
      "status": "completed|in_progress|planned|at_risk",
      "category": "growth|retention|expansion|risk_mitigation|innovation"
    }
  ],
  "asks": [
    {
      "ask": "What is being requested",
      "rationale": "Why this is important",
      "priority": "high|medium|low",
      "owner": "CSM|Customer|Product|Engineering|Leadership|Sales"
    }
  ],
  "nextSteps": [
    "Next step 1",
    "Next step 2"
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get executive summary
    const executiveSummary = parsed.executiveSummary ||
      `${customerName} is a ${tier} account with a health score of ${healthScore}/100 and ARR of $${arr.toLocaleString()}. ` +
      `With ${daysUntilRenewal} days until renewal, the account shows ${healthTrend === 'up' ? 'improving' : healthTrend === 'down' ? 'declining' : 'stable'} engagement ` +
      `and requires continued focus on ${hasHighRisk ? 'risk mitigation' : 'growth opportunities'}.`;

    // Process headlines
    const headlines: ExecutiveHeadline[] = (parsed.headlines || []).map((h: any, idx: number) => ({
      id: `headline-${idx + 1}`,
      headline: h.headline || `Headline ${idx + 1}`,
      detail: h.detail || '',
      sentiment: (h.sentiment as ExecutiveHeadline['sentiment']) || 'neutral',
      enabled: true,
    }));

    // Ensure minimum headlines
    if (headlines.length < 3) {
      const defaultHeadlines: ExecutiveHeadline[] = [
        { id: 'headline-1', headline: `${healthTrend === 'up' ? 'Strong' : healthTrend === 'down' ? 'Declining' : 'Stable'} Account Health`, detail: `Health score is ${healthScore}/100, ${healthTrend === 'up' ? 'showing positive momentum' : healthTrend === 'down' ? 'requiring attention' : 'maintaining consistency'}`, sentiment: healthTrend === 'down' ? 'negative' : healthTrend === 'up' ? 'positive' : 'neutral', enabled: true },
        { id: 'headline-2', headline: `Renewal ${daysUntilRenewal < 60 ? 'Approaching' : 'On Track'}`, detail: `${daysUntilRenewal} days until renewal with ${hasHighRisk ? 'active risk signals' : 'no major concerns'}`, sentiment: daysUntilRenewal < 30 || hasHighRisk ? 'negative' : 'neutral', enabled: true },
        { id: 'headline-3', headline: `${featureAdoption >= 70 ? 'Strong' : featureAdoption >= 50 ? 'Moderate' : 'Low'} Feature Adoption`, detail: `${featureAdoption}% feature adoption with ${loginFrequency.toFixed(1)} logins per week`, sentiment: featureAdoption >= 70 ? 'positive' : featureAdoption < 50 ? 'negative' : 'neutral', enabled: true },
        { id: 'headline-4', headline: `User Engagement ${dauMau >= 0.5 ? 'High' : dauMau >= 0.3 ? 'Moderate' : 'Needs Attention'}`, detail: `DAU/MAU ratio of ${(dauMau * 100).toFixed(0)}% indicates ${dauMau >= 0.5 ? 'highly active' : dauMau >= 0.3 ? 'moderately engaged' : 'less active'} user base`, sentiment: dauMau >= 0.5 ? 'positive' : dauMau < 0.3 ? 'negative' : 'neutral', enabled: true },
      ];

      defaultHeadlines.forEach((defaultHeadline) => {
        if (headlines.length < 3) {
          headlines.push({ ...defaultHeadline, id: `headline-${headlines.length + 1}` });
        }
      });
    }

    // Process key metrics
    const keyMetrics: ExecutiveMetric[] = (parsed.keyMetrics || []).map((m: any, idx: number) => ({
      id: `metric-${idx + 1}`,
      name: m.name || `Metric ${idx + 1}`,
      value: String(m.value || '0'),
      previousValue: m.previousValue ? String(m.previousValue) : undefined,
      trend: (m.trend as ExecutiveMetric['trend']) || 'stable',
      category: (m.category as ExecutiveMetric['category']) || 'health',
      enabled: true,
    }));

    // Ensure minimum metrics
    if (keyMetrics.length < 5) {
      const defaultMetrics: ExecutiveMetric[] = [
        { id: 'metric-1', name: 'Health Score', value: `${healthScore}/100`, previousValue: undefined, trend: healthTrend, category: 'health', enabled: true },
        { id: 'metric-2', name: 'Feature Adoption', value: `${featureAdoption}%`, previousValue: undefined, trend: featureAdoption >= 60 ? 'up' : 'stable', category: 'adoption', enabled: true },
        { id: 'metric-3', name: 'Login Frequency', value: `${loginFrequency.toFixed(1)}/week`, previousValue: undefined, trend: 'stable', category: 'engagement', enabled: true },
        { id: 'metric-4', name: 'NPS Score', value: `${npsScore}`, previousValue: undefined, trend: npsScore > 30 ? 'up' : 'stable', category: 'satisfaction', enabled: true },
        { id: 'metric-5', name: 'ARR', value: `$${arr.toLocaleString()}`, previousValue: undefined, trend: 'stable', category: 'financial', enabled: true },
        { id: 'metric-6', name: 'DAU/MAU Ratio', value: `${(dauMau * 100).toFixed(0)}%`, previousValue: undefined, trend: dauMau >= 0.4 ? 'up' : 'stable', category: 'engagement', enabled: true },
        { id: 'metric-7', name: 'Days to Renewal', value: `${daysUntilRenewal}`, previousValue: undefined, trend: 'down', category: 'financial', enabled: true },
      ];

      defaultMetrics.forEach((defaultMetric) => {
        if (keyMetrics.length < 5) {
          keyMetrics.push({ ...defaultMetric, id: `metric-${keyMetrics.length + 1}` });
        }
      });
    }

    // Process strategic updates
    const strategicUpdates: StrategicUpdate[] = (parsed.strategicUpdates || []).map((u: any, idx: number) => ({
      id: `update-${idx + 1}`,
      title: u.title || `Update ${idx + 1}`,
      description: u.description || '',
      status: (u.status as StrategicUpdate['status']) || 'in_progress',
      category: (u.category as StrategicUpdate['category']) || 'retention',
      enabled: true,
    }));

    // Ensure minimum strategic updates
    if (strategicUpdates.length < 3) {
      const defaultUpdates: StrategicUpdate[] = [
        { id: 'update-1', title: 'Quarterly Business Review', description: 'Completed QBR with executive sponsor, aligned on goals for next quarter', status: 'completed', category: 'retention', enabled: true },
        { id: 'update-2', title: 'Feature Adoption Initiative', description: 'Launched training program to drive adoption of underutilized features', status: 'in_progress', category: 'growth', enabled: true },
        { id: 'update-3', title: 'Expansion Opportunity', description: 'Identified potential for additional seats and modules based on usage patterns', status: 'planned', category: 'expansion', enabled: true },
        { id: 'update-4', title: hasHighRisk ? 'Risk Mitigation Plan' : 'Success Plan Review', description: hasHighRisk ? 'Actively working on addressing identified risk signals' : 'Regular success plan review scheduled', status: hasHighRisk ? 'in_progress' : 'planned', category: hasHighRisk ? 'risk_mitigation' : 'retention', enabled: true },
        { id: 'update-5', title: 'Champion Development', description: 'Building relationships with additional stakeholders for expansion', status: 'in_progress', category: 'growth', enabled: true },
      ];

      defaultUpdates.forEach((defaultUpdate) => {
        if (strategicUpdates.length < 3) {
          strategicUpdates.push({ ...defaultUpdate, id: `update-${strategicUpdates.length + 1}` });
        }
      });
    }

    // Process asks
    const asks: ExecutiveAsk[] = (parsed.asks || []).map((a: any, idx: number) => ({
      id: `ask-${idx + 1}`,
      ask: a.ask || `Ask ${idx + 1}`,
      rationale: a.rationale || '',
      priority: (a.priority as ExecutiveAsk['priority']) || 'medium',
      owner: (a.owner as ExecutiveAsk['owner']) || 'Leadership',
      dueDate: new Date(Date.now() + (14 + idx * 7) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      enabled: true,
    }));

    // Ensure minimum asks
    if (asks.length < 2) {
      const defaultAsks: ExecutiveAsk[] = [
        { id: 'ask-1', ask: 'Executive Sponsor Engagement', rationale: 'Strengthen relationship with executive sponsor through direct communication', priority: 'high', owner: 'Leadership', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'ask-2', ask: 'Product Roadmap Discussion', rationale: 'Share upcoming features to demonstrate continued investment and innovation', priority: 'medium', owner: 'Product', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'ask-3', ask: hasHighRisk ? 'Risk Escalation Support' : 'Expansion Conversation', rationale: hasHighRisk ? 'Support needed to address critical risk factors' : 'Opportunity to discuss additional services and seats', priority: hasHighRisk ? 'high' : 'medium', owner: hasHighRisk ? 'Leadership' : 'Sales', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
        { id: 'ask-4', ask: 'Resource Allocation', rationale: 'Dedicated support resources for upcoming initiatives', priority: 'medium', owner: 'CSM', dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      ];

      defaultAsks.forEach((defaultAsk) => {
        if (asks.length < 2) {
          asks.push({ ...defaultAsk, id: `ask-${asks.length + 1}` });
        }
      });
    }

    // Process next steps
    let nextSteps = parsed.nextSteps || [];
    if (!Array.isArray(nextSteps) || nextSteps.length < 3) {
      nextSteps = [
        'Schedule follow-up with executive sponsor',
        'Review expansion opportunities with sales',
        'Continue monitoring health metrics weekly',
        'Prepare renewal discussion materials',
        hasHighRisk ? 'Execute risk mitigation plan' : 'Identify additional champions',
      ];
    }

    // Determine optimal slide count based on content
    const contentLength = headlines.length + strategicUpdates.length + asks.length;
    let slideCount: 5 | 6 | 7 = 5;
    if (contentLength >= 12) slideCount = 7;
    else if (contentLength >= 9) slideCount = 6;

    return {
      title: `Executive Briefing: ${customerName}`,
      preparedFor: 'Leadership Team',
      preparedBy: 'Customer Success',
      briefingDate: new Date().toISOString().slice(0, 10),
      slideCount,
      executiveSummary,
      headlines,
      keyMetrics,
      strategicUpdates,
      asks,
      nextSteps,
      healthScore,
      daysUntilRenewal,
      arr,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Executive briefing preview generation error:', error);

    // Return fallback executive briefing
    const fallbackSummary = `${customerName} is a ${tier} account with a health score of ${healthScore}/100 and ARR of $${arr.toLocaleString()}. With ${daysUntilRenewal} days until renewal, the account requires continued engagement and strategic alignment.`;

    const fallbackHeadlines: ExecutiveHeadline[] = [
      { id: 'headline-1', headline: `${healthScore >= 70 ? 'Strong' : healthScore >= 50 ? 'Moderate' : 'At Risk'} Account Health`, detail: `Current health score of ${healthScore}/100`, sentiment: healthScore >= 70 ? 'positive' : healthScore >= 50 ? 'neutral' : 'negative', enabled: true },
      { id: 'headline-2', headline: `Renewal in ${daysUntilRenewal} Days`, detail: 'Preparing for upcoming renewal discussion', sentiment: daysUntilRenewal > 60 ? 'neutral' : 'negative', enabled: true },
      { id: 'headline-3', headline: `${featureAdoption}% Feature Adoption`, detail: 'Continued focus on driving feature utilization', sentiment: featureAdoption >= 70 ? 'positive' : 'neutral', enabled: true },
    ];

    const fallbackMetrics: ExecutiveMetric[] = [
      { id: 'metric-1', name: 'Health Score', value: `${healthScore}/100`, trend: healthTrend, category: 'health', enabled: true },
      { id: 'metric-2', name: 'Feature Adoption', value: `${featureAdoption}%`, trend: 'stable', category: 'adoption', enabled: true },
      { id: 'metric-3', name: 'NPS Score', value: `${npsScore}`, trend: 'stable', category: 'satisfaction', enabled: true },
      { id: 'metric-4', name: 'ARR', value: `$${arr.toLocaleString()}`, trend: 'stable', category: 'financial', enabled: true },
      { id: 'metric-5', name: 'Days to Renewal', value: `${daysUntilRenewal}`, trend: 'down', category: 'financial', enabled: true },
    ];

    const fallbackUpdates: StrategicUpdate[] = [
      { id: 'update-1', title: 'QBR Completed', description: 'Quarterly review completed successfully', status: 'completed', category: 'retention', enabled: true },
      { id: 'update-2', title: 'Adoption Initiative', description: 'Working on improving feature utilization', status: 'in_progress', category: 'growth', enabled: true },
      { id: 'update-3', title: 'Expansion Discussion', description: 'Exploring additional opportunities', status: 'planned', category: 'expansion', enabled: true },
    ];

    const fallbackAsks: ExecutiveAsk[] = [
      { id: 'ask-1', ask: 'Executive Engagement', rationale: 'Strengthen sponsor relationship', priority: 'high', owner: 'Leadership', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
      { id: 'ask-2', ask: 'Product Roadmap Share', rationale: 'Demonstrate innovation', priority: 'medium', owner: 'Product', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), enabled: true },
    ];

    const fallbackNextSteps = [
      'Schedule executive sponsor meeting',
      'Review expansion opportunities',
      'Continue health monitoring',
    ];

    return {
      title: `Executive Briefing: ${customerName}`,
      preparedFor: 'Leadership Team',
      preparedBy: 'Customer Success',
      briefingDate: new Date().toISOString().slice(0, 10),
      slideCount: 5,
      executiveSummary: fallbackSummary,
      headlines: fallbackHeadlines,
      keyMetrics: fallbackMetrics,
      strategicUpdates: fallbackUpdates,
      asks: fallbackAsks,
      nextSteps: fallbackNextSteps,
      healthScore,
      daysUntilRenewal,
      arr,
      notes: '',
    };
  }
}

// =====================================================================
// Account Plan Preview Types
// =====================================================================

interface AccountObjective {
  id: string;
  title: string;
  description: string;
  category: 'growth' | 'retention' | 'expansion' | 'adoption' | 'risk_mitigation' | 'strategic';
  priority: 'high' | 'medium' | 'low';
  targetDate: string;
  metrics: string[];
  enabled: boolean;
}

interface AccountAction {
  id: string;
  action: string;
  description: string;
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Sales' | 'Support' | 'Leadership';
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'blocked';
  relatedObjectiveIds: string[];
  enabled: boolean;
}

interface AccountMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  owner: string;
  enabled: boolean;
}

interface AccountResource {
  id: string;
  type: 'budget' | 'headcount' | 'tooling' | 'training' | 'support' | 'other';
  description: string;
  allocation: string;
  enabled: boolean;
}

export interface AccountPlanPreviewResult {
  title: string;
  planPeriod: string;
  createdDate: string;
  accountOverview: string;
  objectives: AccountObjective[];
  actionItems: AccountAction[];
  milestones: AccountMilestone[];
  resources: AccountResource[];
  successCriteria: string[];
  risks: string[];
  timeline: string;
  healthScore: number;
  daysUntilRenewal: number;
  arr: number;
  notes: string;
}

/**
 * Generate an account plan preview for strategic planning
 * Provides editable HITL preview before creating final Google Doc + Sheets
 */
async function generateAccountPlanPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<AccountPlanPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 72;
  const arr = customer?.arr || 150000;
  const tier = customer?.tier || 'Enterprise';
  const renewalDate = customer?.renewalDate || new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const industryCode = customer?.industryCode || 'technology';

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;
  const loginFrequency = engagement?.loginFrequency || 3.5;
  const dauMau = engagement?.dauMau || 0.45;

  // Get NPS score
  const npsScore = customer?.npsScore || 35;

  // Get risk signals
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high');

  // Get recent activities
  const activities = context.platformData.interactionHistory?.slice(0, 5) || [];

  // Calculate days until renewal
  const daysUntilRenewal = Math.round((new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Determine health trend
  const healthTrends = context.platformData.healthTrends || [];
  const recentHealth = healthTrends.slice(0, 3);
  let healthTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentHealth.length >= 2) {
    const diff = (recentHealth[0]?.score || healthScore) - (recentHealth[recentHealth.length - 1]?.score || healthScore);
    if (diff > 5) healthTrend = 'up';
    else if (diff < -5) healthTrend = 'down';
  }

  // Determine plan period (next 12 months typically)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 12);
  const planPeriod = `${startDate.toISOString().slice(0, 7)} to ${endDate.toISOString().slice(0, 7)}`;

  // Build prompt for account plan generation
  const prompt = `You are a customer success manager creating a strategic account plan. Generate a comprehensive plan that aligns customer goals with your success strategy.

Customer: ${customerName}
Industry: ${industryCode}
Current Tier: ${tier}
Health Score: ${healthScore}/100 (trend: ${healthTrend})
Current ARR: $${arr.toLocaleString()}
Days Until Renewal: ${daysUntilRenewal}
Feature Adoption: ${featureAdoption}%
Login Frequency: ${loginFrequency}x/week
DAU/MAU Ratio: ${(dauMau * 100).toFixed(0)}%
NPS Score: ${npsScore}
High Risk Signals: ${hasHighRisk ? 'Yes' : 'No'}
Recent Activities: ${activities.length} in last 30 days
Plan Period: ${planPeriod}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a strategic account plan with:
1. Account overview (2-3 sentences summarizing the account and strategic direction)
2. 4-6 strategic objectives with categories, priorities, target dates, and success metrics
3. 6-10 action items with owners, priorities, due dates, and linked objectives
4. 4-6 milestones for tracking progress
5. 3-5 resource requirements
6. 4-6 success criteria
7. 3-5 identified risks
8. Timeline description

Format your response as JSON:
{
  "accountOverview": "2-3 sentence strategic overview",
  "objectives": [
    {
      "title": "Objective title (e.g., 'Drive Product Adoption')",
      "description": "Detailed description of the objective",
      "category": "growth|retention|expansion|adoption|risk_mitigation|strategic",
      "priority": "high|medium|low",
      "targetDate": "YYYY-MM-DD",
      "metrics": ["Metric 1", "Metric 2"]
    }
  ],
  "actionItems": [
    {
      "action": "Action title",
      "description": "What needs to be done",
      "owner": "CSM|Customer|Product|Engineering|Sales|Support|Leadership",
      "priority": "high|medium|low",
      "dueDate": "YYYY-MM-DD",
      "status": "planned|in_progress|completed|blocked",
      "relatedObjectives": [0, 1]
    }
  ],
  "milestones": [
    {
      "name": "Milestone name",
      "description": "Description",
      "targetDate": "YYYY-MM-DD",
      "status": "planned|in_progress|completed|at_risk",
      "owner": "CSM"
    }
  ],
  "resources": [
    {
      "type": "budget|headcount|tooling|training|support|other",
      "description": "Resource description",
      "allocation": "Allocation details"
    }
  ],
  "successCriteria": ["Criterion 1", "Criterion 2"],
  "risks": ["Risk 1", "Risk 2"],
  "timeline": "Overview of the plan timeline"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get account overview
    const accountOverview = parsed.accountOverview ||
      `${customerName} is a ${tier} account with a health score of ${healthScore}/100 and ARR of $${arr.toLocaleString()}. ` +
      `This strategic account plan focuses on ${hasHighRisk ? 'risk mitigation and retention' : 'growth and expansion'} over the next 12 months, ` +
      `with key emphasis on ${featureAdoption >= 70 ? 'maintaining momentum' : 'driving product adoption'} and stakeholder engagement.`;

    // Process objectives
    const objectives: AccountObjective[] = (parsed.objectives || []).map((obj: any, idx: number) => ({
      id: `objective-${idx + 1}`,
      title: obj.title || `Objective ${idx + 1}`,
      description: obj.description || '',
      category: (obj.category as AccountObjective['category']) || 'strategic',
      priority: (obj.priority as AccountObjective['priority']) || 'medium',
      targetDate: obj.targetDate || new Date(Date.now() + ((idx + 1) * 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      metrics: obj.metrics || [],
      enabled: true,
    }));

    // Ensure minimum objectives
    if (objectives.length < 4) {
      const defaultObjectives: AccountObjective[] = [
        { id: 'objective-1', title: 'Drive Product Adoption', description: 'Increase feature utilization and user engagement across the organization', category: 'adoption', priority: 'high', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['Feature adoption rate > 80%', 'Weekly active users +20%'], enabled: true },
        { id: 'objective-2', title: 'Strengthen Executive Sponsorship', description: 'Build deeper relationships with key decision makers and champions', category: 'retention', priority: 'high', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['Quarterly exec meetings', 'NPS > 50'], enabled: true },
        { id: 'objective-3', title: 'Identify Expansion Opportunities', description: 'Explore additional use cases and departments for platform expansion', category: 'expansion', priority: 'medium', targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['2+ expansion conversations', 'Pipeline > $50K'], enabled: true },
        { id: 'objective-4', title: hasHighRisk ? 'Mitigate Identified Risks' : 'Ensure Successful Renewal', description: hasHighRisk ? 'Address risk signals and stabilize the account' : 'Prepare for smooth renewal with demonstrated value', category: hasHighRisk ? 'risk_mitigation' : 'retention', priority: 'high', targetDate: new Date(renewalDate).toISOString().slice(0, 10), metrics: ['Health score > 75', 'All blockers resolved'], enabled: true },
        { id: 'objective-5', title: 'Develop Internal Champions', description: 'Identify and nurture power users who can advocate for the platform', category: 'growth', priority: 'medium', targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['3+ champions identified', 'Champion training completed'], enabled: true },
      ];

      defaultObjectives.forEach((defaultObj) => {
        if (objectives.length < 4) {
          objectives.push({ ...defaultObj, id: `objective-${objectives.length + 1}` });
        }
      });
    }

    // Process action items
    const actionItems: AccountAction[] = (parsed.actionItems || []).map((item: any, idx: number) => ({
      id: `action-${idx + 1}`,
      action: item.action || `Action ${idx + 1}`,
      description: item.description || '',
      owner: (item.owner as AccountAction['owner']) || 'CSM',
      priority: (item.priority as AccountAction['priority']) || 'medium',
      dueDate: item.dueDate || new Date(Date.now() + ((idx + 1) * 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: (item.status as AccountAction['status']) || 'planned',
      relatedObjectiveIds: (item.relatedObjectives || []).map((objIdx: number) => `objective-${objIdx + 1}`),
      enabled: true,
    }));

    // Ensure minimum action items
    if (actionItems.length < 6) {
      const defaultActions: AccountAction[] = [
        { id: 'action-1', action: 'Schedule Quarterly Business Review', description: 'Plan and execute QBR with executive stakeholders', owner: 'CSM', priority: 'high', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-2'], enabled: true },
        { id: 'action-2', action: 'Conduct Feature Adoption Workshop', description: 'Training session on underutilized features', owner: 'CSM', priority: 'high', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-1'], enabled: true },
        { id: 'action-3', action: 'Identify Expansion Champions', description: 'Map power users who can sponsor expansion', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-3', 'objective-5'], enabled: true },
        { id: 'action-4', action: 'Create Value Summary Report', description: 'Document ROI and success metrics', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-4'], enabled: true },
        { id: 'action-5', action: 'Product Roadmap Discussion', description: 'Share upcoming features with stakeholders', owner: 'Product', priority: 'medium', dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-2'], enabled: true },
        { id: 'action-6', action: hasHighRisk ? 'Execute Risk Mitigation Plan' : 'Prepare Renewal Documentation', description: hasHighRisk ? 'Address identified risks with action plan' : 'Compile materials for renewal discussion', owner: 'CSM', priority: 'high', dueDate: new Date(Date.now() + (hasHighRisk ? 7 : 90) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: hasHighRisk ? 'in_progress' : 'planned', relatedObjectiveIds: ['objective-4'], enabled: true },
        { id: 'action-7', action: 'Champion Development Program', description: 'Launch training and recognition for champions', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-5'], enabled: true },
        { id: 'action-8', action: 'Health Score Review', description: 'Monthly review and address any declining metrics', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-1', 'objective-4'], enabled: true },
      ];

      defaultActions.forEach((defaultAction) => {
        if (actionItems.length < 6) {
          actionItems.push({ ...defaultAction, id: `action-${actionItems.length + 1}` });
        }
      });
    }

    // Process milestones
    const milestones: AccountMilestone[] = (parsed.milestones || []).map((ms: any, idx: number) => ({
      id: `milestone-${idx + 1}`,
      name: ms.name || `Milestone ${idx + 1}`,
      description: ms.description || '',
      targetDate: ms.targetDate || new Date(Date.now() + ((idx + 1) * 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: (ms.status as AccountMilestone['status']) || 'planned',
      owner: ms.owner || 'CSM',
      enabled: true,
    }));

    // Ensure minimum milestones
    if (milestones.length < 4) {
      const defaultMilestones: AccountMilestone[] = [
        { id: 'milestone-1', name: 'QBR Completed', description: 'Quarterly business review with executive team', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-2', name: 'Adoption Target Achieved', description: 'Feature adoption rate reaches 75%+', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-3', name: 'Expansion Proposal Delivered', description: 'Present expansion opportunity to stakeholders', targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-4', name: 'Renewal Discussion Initiated', description: 'Begin renewal conversations 90 days out', targetDate: new Date(renewalDate).getTime() - 90 * 24 * 60 * 60 * 1000 > Date.now() ? new Date(new Date(renewalDate).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-5', name: 'Champion Program Launch', description: 'Formally launch champion development program', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-6', name: hasHighRisk ? 'Risk Resolution' : 'Success Plan Update', description: hasHighRisk ? 'All critical risks addressed' : 'Annual success plan refresh', targetDate: new Date(Date.now() + (hasHighRisk ? 45 : 180) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: hasHighRisk ? 'in_progress' : 'planned', owner: 'CSM', enabled: true },
      ];

      defaultMilestones.forEach((defaultMs) => {
        if (milestones.length < 4) {
          milestones.push({ ...defaultMs, id: `milestone-${milestones.length + 1}` });
        }
      });
    }

    // Process resources
    const resources: AccountResource[] = (parsed.resources || []).map((res: any, idx: number) => ({
      id: `resource-${idx + 1}`,
      type: (res.type as AccountResource['type']) || 'other',
      description: res.description || `Resource ${idx + 1}`,
      allocation: res.allocation || 'TBD',
      enabled: true,
    }));

    // Ensure minimum resources
    if (resources.length < 3) {
      const defaultResources: AccountResource[] = [
        { id: 'resource-1', type: 'headcount', description: 'Dedicated CSM time for strategic initiatives', allocation: '40% capacity allocation', enabled: true },
        { id: 'resource-2', type: 'training', description: 'Customer training and enablement sessions', allocation: 'Quarterly training budget', enabled: true },
        { id: 'resource-3', type: 'support', description: 'Priority support escalation path', allocation: 'Tier 1 support access', enabled: true },
        { id: 'resource-4', type: 'tooling', description: 'Analytics and reporting tools', allocation: 'Full dashboard access', enabled: true },
        { id: 'resource-5', type: 'budget', description: 'Customer event and engagement budget', allocation: '$5,000 annual allocation', enabled: true },
      ];

      defaultResources.forEach((defaultRes) => {
        if (resources.length < 3) {
          resources.push({ ...defaultRes, id: `resource-${resources.length + 1}` });
        }
      });
    }

    // Process success criteria
    let successCriteria = parsed.successCriteria || [];
    if (!Array.isArray(successCriteria) || successCriteria.length < 4) {
      successCriteria = [
        `Health score maintained above ${Math.max(healthScore, 75)}/100`,
        `Feature adoption rate exceeds ${Math.max(featureAdoption + 10, 75)}%`,
        'Quarterly executive engagement maintained',
        `NPS score improves to ${Math.max(npsScore + 10, 50)}+`,
        'All strategic objectives completed on time',
        hasHighRisk ? 'All risk signals resolved' : 'Expansion pipeline identified',
      ];
    }

    // Process risks
    let risks = parsed.risks || [];
    if (!Array.isArray(risks) || risks.length < 3) {
      risks = [
        hasHighRisk ? 'Active risk signals require immediate attention' : 'Potential budget constraints at renewal',
        'Key champion departure risk',
        'Competing priorities reducing engagement',
        'Economic factors affecting expansion plans',
        `${daysUntilRenewal < 90 ? 'Short runway to renewal - limited time for initiatives' : 'Market changes impacting strategic direction'}`,
      ];
    }

    // Process timeline
    const timeline = parsed.timeline ||
      `This 12-month strategic account plan spans from ${planPeriod}. ` +
      `Key focus areas include ${hasHighRisk ? 'risk mitigation in Q1, ' : ''}adoption initiatives in Q1-Q2, ` +
      `expansion conversations in Q2-Q3, and renewal preparation ${daysUntilRenewal > 180 ? 'in Q4' : 'immediately'}. ` +
      'Monthly health reviews and quarterly business reviews provide checkpoints for plan adjustment.';

    return {
      title: `Strategic Account Plan: ${customerName}`,
      planPeriod,
      createdDate: new Date().toISOString().slice(0, 10),
      accountOverview,
      objectives,
      actionItems,
      milestones,
      resources,
      successCriteria,
      risks,
      timeline,
      healthScore,
      daysUntilRenewal,
      arr,
      notes: '',
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Account plan preview generation error:', error);

    // Return fallback account plan
    const fallbackOverview = `${customerName} is a ${tier} account with a health score of ${healthScore}/100 and ARR of $${arr.toLocaleString()}. This strategic account plan outlines key objectives and actions to drive success and growth over the next 12 months.`;

    const fallbackObjectives: AccountObjective[] = [
      { id: 'objective-1', title: 'Drive Product Adoption', description: 'Increase feature utilization and user engagement', category: 'adoption', priority: 'high', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['Feature adoption > 75%', 'WAU +15%'], enabled: true },
      { id: 'objective-2', title: 'Strengthen Executive Relationships', description: 'Build deeper connections with key stakeholders', category: 'retention', priority: 'high', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['Quarterly exec meetings', 'NPS improvement'], enabled: true },
      { id: 'objective-3', title: 'Identify Growth Opportunities', description: 'Explore expansion and upsell potential', category: 'expansion', priority: 'medium', targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), metrics: ['2+ opportunities identified', 'Pipeline > $30K'], enabled: true },
      { id: 'objective-4', title: 'Ensure Successful Renewal', description: 'Prepare for smooth renewal with demonstrated value', category: 'retention', priority: 'high', targetDate: new Date(renewalDate).toISOString().slice(0, 10), metrics: ['Health > 75', 'Value documented'], enabled: true },
    ];

    const fallbackActions: AccountAction[] = [
      { id: 'action-1', action: 'Schedule QBR', description: 'Plan quarterly business review', owner: 'CSM', priority: 'high', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-2'], enabled: true },
      { id: 'action-2', action: 'Feature Training Session', description: 'Conduct training on key features', owner: 'CSM', priority: 'high', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-1'], enabled: true },
      { id: 'action-3', action: 'Create Value Summary', description: 'Document ROI and success', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-4'], enabled: true },
      { id: 'action-4', action: 'Champion Identification', description: 'Identify power users', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-3'], enabled: true },
      { id: 'action-5', action: 'Health Check Review', description: 'Monthly health metrics review', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-1', 'objective-4'], enabled: true },
      { id: 'action-6', action: 'Expansion Discussion', description: 'Explore additional opportunities', owner: 'CSM', priority: 'medium', dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', relatedObjectiveIds: ['objective-3'], enabled: true },
    ];

    const fallbackMilestones: AccountMilestone[] = [
      { id: 'milestone-1', name: 'QBR Completed', description: 'Quarterly review completed', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
      { id: 'milestone-2', name: 'Adoption Target Met', description: 'Feature adoption > 75%', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
      { id: 'milestone-3', name: 'Expansion Opportunity', description: 'Identified expansion path', targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
      { id: 'milestone-4', name: 'Renewal Preparation', description: 'Materials ready for renewal', targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
    ];

    const fallbackResources: AccountResource[] = [
      { id: 'resource-1', type: 'headcount', description: 'Dedicated CSM capacity', allocation: '40% allocation', enabled: true },
      { id: 'resource-2', type: 'training', description: 'Training sessions', allocation: 'Quarterly budget', enabled: true },
      { id: 'resource-3', type: 'support', description: 'Priority support', allocation: 'Tier 1 access', enabled: true },
    ];

    const fallbackSuccessCriteria = [
      'Health score > 75/100',
      'Feature adoption > 75%',
      'Quarterly executive meetings',
      'Successful renewal',
    ];

    const fallbackRisks = [
      'Budget constraints at renewal',
      'Key stakeholder departure',
      'Competing priorities',
    ];

    return {
      title: `Strategic Account Plan: ${customerName}`,
      planPeriod,
      createdDate: new Date().toISOString().slice(0, 10),
      accountOverview: fallbackOverview,
      objectives: fallbackObjectives,
      actionItems: fallbackActions,
      milestones: fallbackMilestones,
      resources: fallbackResources,
      successCriteria: fallbackSuccessCriteria,
      risks: fallbackRisks,
      timeline: 'This 12-month plan focuses on adoption, expansion, and renewal success with quarterly checkpoints.',
      healthScore,
      daysUntilRenewal,
      arr,
      notes: '',
    };
  }
}

// =============================================================================
// TRANSFORMATION ROADMAP PREVIEW
// =============================================================================

interface TransformationPhase {
  id: string;
  name: string;
  description: string;
  duration: string;
  startDate: string;
  endDate: string;
  objectives: string[];
  deliverables: string[];
  owner: 'CSM' | 'Customer' | 'Product' | 'Engineering' | 'Sales' | 'Support' | 'Leadership' | 'All';
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  enabled: boolean;
}

interface TransformationMilestone {
  id: string;
  name: string;
  description: string;
  phaseId: string;
  targetDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'at_risk';
  owner: string;
  enabled: boolean;
}

interface TransformationSuccessCriterion {
  id: string;
  criterion: string;
  category: 'adoption' | 'business' | 'technical' | 'operational' | 'strategic';
  measurable: boolean;
  targetValue: string;
  enabled: boolean;
}

interface TransformationDependency {
  id: string;
  description: string;
  type: 'internal' | 'external' | 'customer' | 'vendor' | 'technical';
  owner: string;
  status: 'resolved' | 'pending' | 'blocked';
  enabled: boolean;
}

interface TransformationRisk {
  id: string;
  risk: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
  enabled: boolean;
}

export interface TransformationRoadmapPreviewResult {
  title: string;
  visionStatement: string;
  createdDate: string;
  timelineStart: string;
  timelineEnd: string;
  totalDuration: string;
  currentState: string;
  targetState: string;
  phases: TransformationPhase[];
  milestones: TransformationMilestone[];
  successCriteria: TransformationSuccessCriterion[];
  dependencies: TransformationDependency[];
  risks: TransformationRisk[];
  keyStakeholders: string[];
  notes: string;
  healthScore: number;
  arr: number;
}

async function generateTransformationRoadmapPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<TransformationRoadmapPreviewResult> {
  const { context, isTemplate } = params;

  // Get customer info
  const customer = context.platformData.customer360;
  const customerName = customer?.name || 'Valued Customer';
  const healthScore = customer?.healthScore || 72;
  const arr = customer?.arr || 150000;
  const tier = customer?.tier || 'Enterprise';
  const industryCode = customer?.industryCode || 'technology';

  // Get engagement metrics
  const engagement = context.platformData.engagementMetrics;
  const featureAdoption = engagement?.featureAdoption || 65;

  // Get risk signals
  const riskSignals = context.platformData.riskSignals || [];
  const hasHighRisk = riskSignals.some((r: any) => r.severity === 'high');

  // Calculate timeline (6-18 months typical for transformation)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 12); // 12 months default
  const timelineStart = startDate.toISOString().slice(0, 10);
  const timelineEnd = endDate.toISOString().slice(0, 10);

  // Build prompt for transformation roadmap generation
  const prompt = `You are a customer success strategist creating a digital transformation roadmap. Generate a comprehensive roadmap that outlines the journey from current state to target state.

Customer: ${customerName}
Industry: ${industryCode}
Current Tier: ${tier}
Health Score: ${healthScore}/100
Current ARR: $${arr.toLocaleString()}
Feature Adoption: ${featureAdoption}%
High Risk Signals: ${hasHighRisk ? 'Yes' : 'No'}
Timeline: ${timelineStart} to ${timelineEnd}
${isTemplate ? '\n(This is a template - use placeholder company "ACME Corporation" with sample data)' : ''}

Generate a transformation roadmap with:
1. Vision statement (2-3 sentences describing the transformation goal)
2. Current state description (where they are now)
3. Target state description (where they want to be)
4. 3-5 transformation phases with objectives, deliverables, and timelines
5. 5-8 key milestones distributed across phases
6. 4-6 success criteria with measurable targets
7. 3-5 dependencies
8. 3-5 risks with mitigation strategies
9. Key stakeholders involved

Format your response as JSON:
{
  "visionStatement": "2-3 sentence transformation vision",
  "currentState": "Description of current state",
  "targetState": "Description of target state",
  "phases": [
    {
      "name": "Phase name (e.g., 'Foundation', 'Build', 'Scale', 'Optimize')",
      "description": "Phase description",
      "duration": "3 months",
      "objectives": ["Objective 1", "Objective 2"],
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "owner": "CSM|Customer|Product|Engineering|Sales|Support|Leadership|All"
    }
  ],
  "milestones": [
    {
      "name": "Milestone name",
      "description": "Description",
      "phaseIndex": 0,
      "targetDate": "YYYY-MM-DD",
      "owner": "Owner name"
    }
  ],
  "successCriteria": [
    {
      "criterion": "Success criterion description",
      "category": "adoption|business|technical|operational|strategic",
      "measurable": true,
      "targetValue": "Target value or percentage"
    }
  ],
  "dependencies": [
    {
      "description": "Dependency description",
      "type": "internal|external|customer|vendor|technical",
      "owner": "Owner"
    }
  ],
  "risks": [
    {
      "risk": "Risk description",
      "likelihood": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "Mitigation strategy"
    }
  ],
  "keyStakeholders": ["Stakeholder 1", "Stakeholder 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Get vision statement
    const visionStatement = parsed.visionStatement ||
      `Transform ${customerName} into a digitally mature organization that fully leverages our platform capabilities. ` +
      `This transformation will drive operational excellence, improve user adoption to 90%+, and unlock significant business value through automation and insights.`;

    // Get current and target state
    const currentState = parsed.currentState ||
      `${customerName} currently has ${featureAdoption}% feature adoption with ${healthScore}/100 health score. ` +
      `Key opportunities exist to expand usage, improve user engagement, and leverage advanced capabilities that remain underutilized.`;

    const targetState = parsed.targetState ||
      `A fully adopted, deeply integrated solution with 90%+ feature adoption, active executive sponsorship, ` +
      `and measurable business outcomes including ${hasHighRisk ? 'stabilized account health' : 'expansion opportunities'} and demonstrated ROI.`;

    // Calculate phase dates
    const totalMonths = 12;
    const phaseCount = Math.max(parsed.phases?.length || 0, 3);
    const monthsPerPhase = Math.floor(totalMonths / phaseCount);

    // Process phases
    const phases: TransformationPhase[] = (parsed.phases || []).map((phase: any, idx: number) => {
      const phaseStart = new Date(startDate);
      phaseStart.setMonth(phaseStart.getMonth() + (idx * monthsPerPhase));
      const phaseEnd = new Date(phaseStart);
      phaseEnd.setMonth(phaseEnd.getMonth() + monthsPerPhase);

      return {
        id: `phase-${idx + 1}`,
        name: phase.name || `Phase ${idx + 1}`,
        description: phase.description || '',
        duration: phase.duration || `${monthsPerPhase} months`,
        startDate: phaseStart.toISOString().slice(0, 10),
        endDate: phaseEnd.toISOString().slice(0, 10),
        objectives: phase.objectives || [],
        deliverables: phase.deliverables || [],
        owner: (phase.owner as TransformationPhase['owner']) || 'CSM',
        status: idx === 0 ? 'in_progress' : 'planned',
        enabled: true,
      };
    });

    // Ensure minimum phases
    if (phases.length < 3) {
      const defaultPhases: TransformationPhase[] = [
        {
          id: 'phase-1',
          name: 'Foundation',
          description: 'Establish the groundwork for transformation including stakeholder alignment, baseline metrics, and quick wins',
          duration: '3 months',
          startDate: new Date(startDate).toISOString().slice(0, 10),
          endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 3)).toISOString().slice(0, 10),
          objectives: ['Align stakeholders on transformation goals', 'Establish baseline metrics', 'Identify quick wins'],
          deliverables: ['Stakeholder alignment document', 'Baseline metrics report', 'Quick wins roadmap'],
          owner: 'CSM',
          status: 'in_progress',
          enabled: true,
        },
        {
          id: 'phase-2',
          name: 'Build & Adopt',
          description: 'Drive core adoption, implement key workflows, and build internal capabilities',
          duration: '4 months',
          startDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 3)).toISOString().slice(0, 10),
          endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 7)).toISOString().slice(0, 10),
          objectives: ['Achieve 75% feature adoption', 'Train power users', 'Implement core workflows'],
          deliverables: ['Training program completed', 'Workflow documentation', 'Champion network established'],
          owner: 'Customer',
          status: 'planned',
          enabled: true,
        },
        {
          id: 'phase-3',
          name: 'Scale & Optimize',
          description: 'Expand usage across organization, optimize processes, and demonstrate ROI',
          duration: '3 months',
          startDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 7)).toISOString().slice(0, 10),
          endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 10)).toISOString().slice(0, 10),
          objectives: ['Achieve 90% adoption', 'Quantify business value', 'Identify expansion opportunities'],
          deliverables: ['ROI report', 'Expansion proposal', 'Success story documentation'],
          owner: 'CSM',
          status: 'planned',
          enabled: true,
        },
        {
          id: 'phase-4',
          name: 'Sustain & Innovate',
          description: 'Maintain momentum, explore advanced features, and plan for future growth',
          duration: '2 months',
          startDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 10)).toISOString().slice(0, 10),
          endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 12)).toISOString().slice(0, 10),
          objectives: ['Sustain high adoption', 'Pilot advanced features', 'Plan year 2 roadmap'],
          deliverables: ['Sustainability plan', 'Year 2 roadmap', 'Innovation pipeline'],
          owner: 'All',
          status: 'planned',
          enabled: true,
        },
      ];

      defaultPhases.forEach((defaultPhase, idx) => {
        if (phases.length < 3) {
          phases.push({ ...defaultPhase, id: `phase-${phases.length + 1}` });
        }
      });
    }

    // Process milestones
    const milestones: TransformationMilestone[] = (parsed.milestones || []).map((ms: any, idx: number) => {
      const phaseIndex = ms.phaseIndex !== undefined ? ms.phaseIndex : Math.floor(idx / 2);
      const phaseId = `phase-${(phaseIndex % phases.length) + 1}`;

      return {
        id: `milestone-${idx + 1}`,
        name: ms.name || `Milestone ${idx + 1}`,
        description: ms.description || '',
        phaseId,
        targetDate: ms.targetDate || new Date(Date.now() + ((idx + 1) * 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: (ms.status as TransformationMilestone['status']) || 'planned',
        owner: ms.owner || 'CSM',
        enabled: true,
      };
    });

    // Ensure minimum milestones
    if (milestones.length < 5) {
      const defaultMilestones: TransformationMilestone[] = [
        { id: 'milestone-1', name: 'Kickoff Complete', description: 'Transformation kickoff meeting completed with all stakeholders', phaseId: 'phase-1', targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-2', name: 'Baseline Established', description: 'Current state metrics documented and baseline set', phaseId: 'phase-1', targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-3', name: 'Training Complete', description: 'Core user training program completed', phaseId: 'phase-2', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'Customer', enabled: true },
        { id: 'milestone-4', name: '75% Adoption', description: 'Feature adoption rate reaches 75%', phaseId: 'phase-2', targetDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'Customer', enabled: true },
        { id: 'milestone-5', name: 'ROI Demonstrated', description: 'Business value quantified and documented', phaseId: 'phase-3', targetDate: new Date(Date.now() + 240 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
        { id: 'milestone-6', name: '90% Adoption', description: 'Feature adoption rate reaches target of 90%', phaseId: 'phase-3', targetDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'Customer', enabled: true },
        { id: 'milestone-7', name: 'Transformation Complete', description: 'All transformation objectives achieved', phaseId: phases[phases.length - 1]?.id || 'phase-4', targetDate: timelineEnd, status: 'planned', owner: 'All', enabled: true },
      ];

      defaultMilestones.forEach((defaultMs) => {
        if (milestones.length < 5) {
          milestones.push({ ...defaultMs, id: `milestone-${milestones.length + 1}` });
        }
      });
    }

    // Process success criteria
    const successCriteria: TransformationSuccessCriterion[] = (parsed.successCriteria || []).map((sc: any, idx: number) => ({
      id: `criterion-${idx + 1}`,
      criterion: sc.criterion || `Success Criterion ${idx + 1}`,
      category: (sc.category as TransformationSuccessCriterion['category']) || 'business',
      measurable: sc.measurable !== false,
      targetValue: sc.targetValue || 'TBD',
      enabled: true,
    }));

    // Ensure minimum success criteria
    if (successCriteria.length < 4) {
      const defaultCriteria: TransformationSuccessCriterion[] = [
        { id: 'criterion-1', criterion: 'Feature adoption rate reaches target level', category: 'adoption', measurable: true, targetValue: '90%+ adoption', enabled: true },
        { id: 'criterion-2', criterion: 'Demonstrated ROI and business value', category: 'business', measurable: true, targetValue: '3x ROI', enabled: true },
        { id: 'criterion-3', criterion: 'User satisfaction and NPS improvement', category: 'adoption', measurable: true, targetValue: 'NPS > 50', enabled: true },
        { id: 'criterion-4', criterion: 'Process efficiency gains realized', category: 'operational', measurable: true, targetValue: '30% time savings', enabled: true },
        { id: 'criterion-5', criterion: 'Executive sponsorship maintained', category: 'strategic', measurable: false, targetValue: 'Quarterly engagement', enabled: true },
        { id: 'criterion-6', criterion: 'Technical integration complete', category: 'technical', measurable: true, targetValue: '100% data sync', enabled: true },
      ];

      defaultCriteria.forEach((defaultCrit) => {
        if (successCriteria.length < 4) {
          successCriteria.push({ ...defaultCrit, id: `criterion-${successCriteria.length + 1}` });
        }
      });
    }

    // Process dependencies
    const dependencies: TransformationDependency[] = (parsed.dependencies || []).map((dep: any, idx: number) => ({
      id: `dependency-${idx + 1}`,
      description: dep.description || `Dependency ${idx + 1}`,
      type: (dep.type as TransformationDependency['type']) || 'internal',
      owner: dep.owner || 'TBD',
      status: 'pending',
      enabled: true,
    }));

    // Ensure minimum dependencies
    if (dependencies.length < 3) {
      const defaultDependencies: TransformationDependency[] = [
        { id: 'dependency-1', description: 'Executive sponsor availability for key meetings', type: 'customer', owner: 'Customer', status: 'pending', enabled: true },
        { id: 'dependency-2', description: 'IT resources for technical integration', type: 'customer', owner: 'Customer IT', status: 'pending', enabled: true },
        { id: 'dependency-3', description: 'Training content and enablement materials', type: 'internal', owner: 'CSM', status: 'pending', enabled: true },
        { id: 'dependency-4', description: 'Change management support', type: 'customer', owner: 'Customer HR', status: 'pending', enabled: true },
        { id: 'dependency-5', description: 'Product roadmap alignment', type: 'internal', owner: 'Product', status: 'pending', enabled: true },
      ];

      defaultDependencies.forEach((defaultDep) => {
        if (dependencies.length < 3) {
          dependencies.push({ ...defaultDep, id: `dependency-${dependencies.length + 1}` });
        }
      });
    }

    // Process risks
    const risks: TransformationRisk[] = (parsed.risks || []).map((risk: any, idx: number) => ({
      id: `risk-${idx + 1}`,
      risk: risk.risk || `Risk ${idx + 1}`,
      likelihood: (risk.likelihood as TransformationRisk['likelihood']) || 'medium',
      impact: (risk.impact as TransformationRisk['impact']) || 'medium',
      mitigation: risk.mitigation || 'Mitigation strategy TBD',
      enabled: true,
    }));

    // Ensure minimum risks
    if (risks.length < 3) {
      const defaultRisks: TransformationRisk[] = [
        { id: 'risk-1', risk: 'Competing organizational priorities reduce focus', likelihood: 'medium', impact: 'high', mitigation: 'Regular executive alignment and progress reviews', enabled: true },
        { id: 'risk-2', risk: 'Key stakeholder or champion departure', likelihood: 'low', impact: 'high', mitigation: 'Build champion network with multiple contacts', enabled: true },
        { id: 'risk-3', risk: 'Technical integration delays', likelihood: 'medium', impact: 'medium', mitigation: 'Early technical planning and contingency buffer', enabled: true },
        { id: 'risk-4', risk: 'User resistance to change', likelihood: 'medium', impact: 'medium', mitigation: 'Change management program and quick wins', enabled: true },
        { id: 'risk-5', risk: 'Budget constraints affecting resources', likelihood: 'low', impact: 'medium', mitigation: 'Clear ROI demonstration and phased approach', enabled: true },
      ];

      defaultRisks.forEach((defaultRisk) => {
        if (risks.length < 3) {
          risks.push({ ...defaultRisk, id: `risk-${risks.length + 1}` });
        }
      });
    }

    // Process key stakeholders
    let keyStakeholders = parsed.keyStakeholders || [];
    if (!Array.isArray(keyStakeholders) || keyStakeholders.length < 3) {
      keyStakeholders = [
        'Executive Sponsor',
        'Project Lead',
        'IT Administrator',
        'Department Champions',
        'CSM Team',
      ];
    }

    // Calculate total duration
    const totalDuration = `${totalMonths} months`;

    return {
      title: `Transformation Roadmap: ${customerName}`,
      visionStatement,
      createdDate: new Date().toISOString().slice(0, 10),
      timelineStart,
      timelineEnd,
      totalDuration,
      currentState,
      targetState,
      phases,
      milestones,
      successCriteria,
      dependencies,
      risks,
      keyStakeholders,
      notes: '',
      healthScore,
      arr,
    };
  } catch (error) {
    console.error('[ArtifactGenerator] Transformation roadmap preview generation error:', error);

    // Return fallback transformation roadmap
    const fallbackVision = `Transform ${customerName} into a digitally mature organization that fully leverages platform capabilities to drive operational excellence and business value.`;

    const fallbackPhases: TransformationPhase[] = [
      {
        id: 'phase-1',
        name: 'Foundation',
        description: 'Establish groundwork for transformation',
        duration: '3 months',
        startDate: timelineStart,
        endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 3)).toISOString().slice(0, 10),
        objectives: ['Align stakeholders', 'Establish baselines', 'Identify quick wins'],
        deliverables: ['Alignment document', 'Baseline report'],
        owner: 'CSM',
        status: 'in_progress',
        enabled: true,
      },
      {
        id: 'phase-2',
        name: 'Build & Adopt',
        description: 'Drive core adoption and capabilities',
        duration: '4 months',
        startDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 3)).toISOString().slice(0, 10),
        endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 7)).toISOString().slice(0, 10),
        objectives: ['75% adoption', 'Train users', 'Implement workflows'],
        deliverables: ['Training complete', 'Workflows documented'],
        owner: 'Customer',
        status: 'planned',
        enabled: true,
      },
      {
        id: 'phase-3',
        name: 'Scale & Optimize',
        description: 'Expand and demonstrate value',
        duration: '5 months',
        startDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 7)).toISOString().slice(0, 10),
        endDate: timelineEnd,
        objectives: ['90% adoption', 'Demonstrate ROI', 'Plan expansion'],
        deliverables: ['ROI report', 'Expansion plan'],
        owner: 'CSM',
        status: 'planned',
        enabled: true,
      },
    ];

    const fallbackMilestones: TransformationMilestone[] = [
      { id: 'milestone-1', name: 'Kickoff Complete', description: 'Kickoff meeting done', phaseId: 'phase-1', targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
      { id: 'milestone-2', name: 'Training Complete', description: 'Core training done', phaseId: 'phase-2', targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'Customer', enabled: true },
      { id: 'milestone-3', name: '75% Adoption', description: 'Adoption target reached', phaseId: 'phase-2', targetDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'Customer', enabled: true },
      { id: 'milestone-4', name: 'ROI Demonstrated', description: 'Value quantified', phaseId: 'phase-3', targetDate: new Date(Date.now() + 240 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'planned', owner: 'CSM', enabled: true },
      { id: 'milestone-5', name: 'Transformation Complete', description: 'All objectives achieved', phaseId: 'phase-3', targetDate: timelineEnd, status: 'planned', owner: 'All', enabled: true },
    ];

    const fallbackCriteria: TransformationSuccessCriterion[] = [
      { id: 'criterion-1', criterion: 'Feature adoption > 90%', category: 'adoption', measurable: true, targetValue: '90%', enabled: true },
      { id: 'criterion-2', criterion: 'ROI demonstrated', category: 'business', measurable: true, targetValue: '3x ROI', enabled: true },
      { id: 'criterion-3', criterion: 'User satisfaction improved', category: 'adoption', measurable: true, targetValue: 'NPS > 50', enabled: true },
      { id: 'criterion-4', criterion: 'Process efficiency gains', category: 'operational', measurable: true, targetValue: '30% savings', enabled: true },
    ];

    const fallbackDependencies: TransformationDependency[] = [
      { id: 'dependency-1', description: 'Executive sponsor availability', type: 'customer', owner: 'Customer', status: 'pending', enabled: true },
      { id: 'dependency-2', description: 'IT resources for integration', type: 'customer', owner: 'Customer IT', status: 'pending', enabled: true },
      { id: 'dependency-3', description: 'Training materials ready', type: 'internal', owner: 'CSM', status: 'pending', enabled: true },
    ];

    const fallbackRisks: TransformationRisk[] = [
      { id: 'risk-1', risk: 'Competing priorities', likelihood: 'medium', impact: 'high', mitigation: 'Regular exec alignment', enabled: true },
      { id: 'risk-2', risk: 'Key stakeholder departure', likelihood: 'low', impact: 'high', mitigation: 'Multiple champions', enabled: true },
      { id: 'risk-3', risk: 'Technical delays', likelihood: 'medium', impact: 'medium', mitigation: 'Buffer time planned', enabled: true },
    ];

    return {
      title: `Transformation Roadmap: ${customerName}`,
      visionStatement: fallbackVision,
      createdDate: new Date().toISOString().slice(0, 10),
      timelineStart,
      timelineEnd,
      totalDuration: '12 months',
      currentState: `${customerName} currently has ${featureAdoption}% adoption with opportunities for improvement.`,
      targetState: 'A fully adopted solution with 90%+ adoption and demonstrated business value.',
      phases: fallbackPhases,
      milestones: fallbackMilestones,
      successCriteria: fallbackCriteria,
      dependencies: fallbackDependencies,
      risks: fallbackRisks,
      keyStakeholders: ['Executive Sponsor', 'Project Lead', 'IT Admin', 'Champions', 'CSM'],
      notes: '',
      healthScore,
      arr,
    };
  }
}

// ============================================================================
// Portfolio Dashboard Types and Preview Generator
// ============================================================================

/**
 * Portfolio customer entry for dashboard
 */
interface PortfolioCustomerEntry {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  tier: string;
  segment: string;
  renewalDate: string;
  daysUntilRenewal: number;
  owner: string;
  riskLevel: 'healthy' | 'at_risk' | 'critical';
  lastActivityDate: string;
  npsScore: number | null;
  enabled: boolean;
}

/**
 * Portfolio summary metrics
 */
interface PortfolioSummary {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  avgNps: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  renewingThisQuarter: number;
  renewingThisQuarterArr: number;
}

/**
 * Portfolio dashboard filter configuration
 */
interface PortfolioFilters {
  healthLevels: ('healthy' | 'at_risk' | 'critical')[];
  segments: string[];
  tiers: string[];
  owners: string[];
  dateRange: {
    type: 'all' | 'this_quarter' | 'next_quarter' | 'this_year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  sortBy: 'name' | 'arr' | 'health' | 'renewal' | 'nps';
  sortDirection: 'asc' | 'desc';
}

/**
 * Portfolio dashboard column configuration
 */
interface PortfolioColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

/**
 * Portfolio dashboard preview result
 */
interface PortfolioDashboardPreviewResult {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: PortfolioSummary;
  customers: PortfolioCustomerEntry[];
  filters: PortfolioFilters;
  columns: PortfolioColumn[];
  availableSegments: string[];
  availableTiers: string[];
  availableOwners: string[];
  notes: string;
}

/**
 * Generates a portfolio dashboard preview for General Mode (no customer context)
 * Displays all assigned customers with filtering and sorting options
 */
async function generatePortfolioDashboardPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<PortfolioDashboardPreviewResult> {
  const { context, userId, isTemplate } = params;

  // Import portfolio aggregation helper
  const { aggregatePortfolioContext } = await import('./dataHelpers.js');

  // Get portfolio data
  const portfolioData = await aggregatePortfolioContext({
    userId,
  });

  // Current date
  const now = new Date();
  const createdDate = now.toISOString().slice(0, 10);

  // Calculate quarter boundaries
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
  const nextQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 2) * 3, 0);

  // If we have real portfolio data, transform it
  let customers: PortfolioCustomerEntry[] = [];
  let availableSegments: string[] = [];
  let availableTiers: string[] = [];
  let availableOwners: string[] = [];

  if (portfolioData.totalCustomers > 0 && !isTemplate) {
    // Transform renewal pipeline to customer entries
    const renewalMap = new Map<string, typeof portfolioData.renewalPipeline[0]>();
    portfolioData.renewalPipeline.forEach(r => renewalMap.set(r.customerId, r));

    // Combine at-risk customers with renewal pipeline for complete picture
    const allCustomerIds = new Set<string>();
    portfolioData.renewalPipeline.forEach(r => allCustomerIds.add(r.customerId));
    portfolioData.atRiskCustomers.forEach(r => allCustomerIds.add(r.customerId));

    // Build customer entries from available data
    portfolioData.renewalPipeline.forEach(r => {
      const atRisk = portfolioData.atRiskCustomers.find(ar => ar.customerId === r.customerId);
      customers.push({
        id: r.customerId,
        name: r.customerName,
        arr: r.arr,
        healthScore: atRisk?.healthScore || (r.riskLevel === 'low' ? 85 : r.riskLevel === 'medium' ? 55 : r.riskLevel === 'high' ? 35 : 25),
        tier: r.arr >= 500000 ? 'Enterprise' : r.arr >= 100000 ? 'Mid-Market' : 'SMB',
        segment: 'Default',
        renewalDate: r.renewalDate,
        daysUntilRenewal: r.daysUntilRenewal,
        owner: r.owner,
        riskLevel: r.riskLevel === 'low' ? 'healthy' : r.riskLevel === 'critical' ? 'critical' : 'at_risk',
        lastActivityDate: createdDate, // Would need activity data
        npsScore: null,
        enabled: true,
      });
    });

    // Add at-risk customers not in renewal pipeline
    portfolioData.atRiskCustomers.forEach(ar => {
      if (!renewalMap.has(ar.customerId)) {
        customers.push({
          id: ar.customerId,
          name: ar.customerName,
          arr: ar.arr,
          healthScore: ar.healthScore,
          tier: ar.arr >= 500000 ? 'Enterprise' : ar.arr >= 100000 ? 'Mid-Market' : 'SMB',
          segment: 'Default',
          renewalDate: '',
          daysUntilRenewal: 365,
          owner: ar.owner,
          riskLevel: ar.riskLevel === 'critical' ? 'critical' : 'at_risk',
          lastActivityDate: createdDate,
          npsScore: null,
          enabled: true,
        });
      }
    });

    // Extract unique values
    availableOwners = [...new Set(customers.map(c => c.owner))].filter(o => o && o !== 'Unassigned');
    availableTiers = [...new Set(customers.map(c => c.tier))];
    availableSegments = [...new Set(customers.map(c => c.segment))];
  } else {
    // Generate sample data for template mode
    customers = [
      {
        id: 'cust-1',
        name: 'Acme Corporation',
        arr: 450000,
        healthScore: 82,
        tier: 'Enterprise',
        segment: 'Technology',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 2, 15).toISOString().slice(0, 10),
        daysUntilRenewal: 75,
        owner: 'Sarah Chen',
        riskLevel: 'healthy',
        lastActivityDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 42,
        enabled: true,
      },
      {
        id: 'cust-2',
        name: 'TechCorp Industries',
        arr: 320000,
        healthScore: 58,
        tier: 'Enterprise',
        segment: 'Manufacturing',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString().slice(0, 10),
        daysUntilRenewal: 40,
        owner: 'James Wilson',
        riskLevel: 'at_risk',
        lastActivityDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 25,
        enabled: true,
      },
      {
        id: 'cust-3',
        name: 'Global Finance LLC',
        arr: 680000,
        healthScore: 92,
        tier: 'Enterprise',
        segment: 'Financial Services',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 4, 20).toISOString().slice(0, 10),
        daysUntilRenewal: 140,
        owner: 'Sarah Chen',
        riskLevel: 'healthy',
        lastActivityDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 67,
        enabled: true,
      },
      {
        id: 'cust-4',
        name: 'StartupX Inc',
        arr: 85000,
        healthScore: 35,
        tier: 'SMB',
        segment: 'Technology',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 1, 5).toISOString().slice(0, 10),
        daysUntilRenewal: 35,
        owner: 'Maria Garcia',
        riskLevel: 'critical',
        lastActivityDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: -10,
        enabled: true,
      },
      {
        id: 'cust-5',
        name: 'MegaRetail Corp',
        arr: 275000,
        healthScore: 71,
        tier: 'Mid-Market',
        segment: 'Retail',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().slice(0, 10),
        daysUntilRenewal: 90,
        owner: 'James Wilson',
        riskLevel: 'healthy',
        lastActivityDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 38,
        enabled: true,
      },
      {
        id: 'cust-6',
        name: 'HealthFirst Medical',
        arr: 195000,
        healthScore: 48,
        tier: 'Mid-Market',
        segment: 'Healthcare',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 2, 28).toISOString().slice(0, 10),
        daysUntilRenewal: 88,
        owner: 'Maria Garcia',
        riskLevel: 'at_risk',
        lastActivityDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 15,
        enabled: true,
      },
      {
        id: 'cust-7',
        name: 'EduLearn Systems',
        arr: 125000,
        healthScore: 78,
        tier: 'Mid-Market',
        segment: 'Education',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 5, 15).toISOString().slice(0, 10),
        daysUntilRenewal: 165,
        owner: 'Sarah Chen',
        riskLevel: 'healthy',
        lastActivityDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 52,
        enabled: true,
      },
      {
        id: 'cust-8',
        name: 'DataDriven Analytics',
        arr: 540000,
        healthScore: 88,
        tier: 'Enterprise',
        segment: 'Technology',
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 6, 10).toISOString().slice(0, 10),
        daysUntilRenewal: 190,
        owner: 'James Wilson',
        riskLevel: 'healthy',
        lastActivityDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        npsScore: 72,
        enabled: true,
      },
    ];

    availableOwners = ['Sarah Chen', 'James Wilson', 'Maria Garcia'];
    availableTiers = ['Enterprise', 'Mid-Market', 'SMB'];
    availableSegments = ['Technology', 'Manufacturing', 'Financial Services', 'Retail', 'Healthcare', 'Education'];
  }

  // Sort by health score ascending by default (show at-risk first)
  customers.sort((a, b) => a.healthScore - b.healthScore);

  // Calculate summary
  const enabledCustomers = customers.filter(c => c.enabled);
  const summary: PortfolioSummary = {
    totalCustomers: enabledCustomers.length,
    totalArr: enabledCustomers.reduce((sum, c) => sum + c.arr, 0),
    avgHealthScore: enabledCustomers.length > 0
      ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.healthScore, 0) / enabledCustomers.length)
      : 0,
    avgNps: enabledCustomers.filter(c => c.npsScore !== null).length > 0
      ? Math.round(enabledCustomers.filter(c => c.npsScore !== null).reduce((sum, c) => sum + (c.npsScore || 0), 0) / enabledCustomers.filter(c => c.npsScore !== null).length)
      : 0,
    healthyCount: enabledCustomers.filter(c => c.riskLevel === 'healthy').length,
    atRiskCount: enabledCustomers.filter(c => c.riskLevel === 'at_risk').length,
    criticalCount: enabledCustomers.filter(c => c.riskLevel === 'critical').length,
    renewingThisQuarter: enabledCustomers.filter(c => {
      const renewal = new Date(c.renewalDate);
      return renewal >= quarterStart && renewal <= quarterEnd;
    }).length,
    renewingThisQuarterArr: enabledCustomers.filter(c => {
      const renewal = new Date(c.renewalDate);
      return renewal >= quarterStart && renewal <= quarterEnd;
    }).reduce((sum, c) => sum + c.arr, 0),
  };

  // Default filters
  const filters: PortfolioFilters = {
    healthLevels: ['healthy', 'at_risk', 'critical'],
    segments: availableSegments,
    tiers: availableTiers,
    owners: availableOwners,
    dateRange: {
      type: 'all',
    },
    sortBy: 'health',
    sortDirection: 'asc',
  };

  // Default columns
  const columns: PortfolioColumn[] = [
    { id: 'name', name: 'Customer', enabled: true, width: '200px' },
    { id: 'arr', name: 'ARR', enabled: true, width: '100px' },
    { id: 'healthScore', name: 'Health', enabled: true, width: '80px' },
    { id: 'riskLevel', name: 'Status', enabled: true, width: '100px' },
    { id: 'tier', name: 'Tier', enabled: true, width: '100px' },
    { id: 'segment', name: 'Segment', enabled: true, width: '120px' },
    { id: 'renewalDate', name: 'Renewal', enabled: true, width: '100px' },
    { id: 'daysUntilRenewal', name: 'Days', enabled: true, width: '60px' },
    { id: 'owner', name: 'Owner', enabled: true, width: '120px' },
    { id: 'npsScore', name: 'NPS', enabled: false, width: '60px' },
    { id: 'lastActivityDate', name: 'Last Activity', enabled: false, width: '100px' },
  ];

  return {
    title: 'Portfolio Dashboard',
    createdDate,
    lastUpdated: createdDate,
    summary,
    customers,
    filters,
    columns,
    availableSegments,
    availableTiers,
    availableOwners,
    notes: '',
  };
}

// ============================================================================
// Team Metrics Types
// ============================================================================

interface CSMMetrics {
  id: string;
  name: string;
  email: string;
  customerCount: number;
  totalArr: number;
  avgHealthScore: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  renewalRate: number;
  expansionRate: number;
  churnRate: number;
  npsScore: number | null;
  activitiesThisWeek: number;
  openTickets: number;
  avgResponseTime: number; // hours
  enabled: boolean;
}

interface TeamMetric {
  id: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  benchmark: number | null;
  trend: 'up' | 'down' | 'stable';
  enabled: boolean;
}

interface TeamMetricsFilters {
  csms: string[];
  timeRange: {
    type: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_quarter' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  showBenchmarks: boolean;
  sortBy: 'name' | 'arr' | 'health' | 'customers' | 'nps';
  sortDirection: 'asc' | 'desc';
}

interface TeamMetricsColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

interface TeamMetricsSummary {
  totalCsms: number;
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  avgNps: number;
  renewalRate: number;
  expansionRate: number;
  churnRate: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
}

interface TeamMetricsPreviewResult {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: TeamMetricsSummary;
  csms: CSMMetrics[];
  metrics: TeamMetric[];
  filters: TeamMetricsFilters;
  columns: TeamMetricsColumn[];
  availableCsms: { id: string; name: string }[];
  notes: string;
}

/**
 * Generates team metrics preview for General Mode (no customer context)
 * Displays CSM performance metrics with filtering and sorting options
 */
async function generateTeamMetricsPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<TeamMetricsPreviewResult> {
  const { userId, isTemplate } = params;

  // Import portfolio aggregation helper
  const { aggregatePortfolioContext } = await import('./dataHelpers.js');

  // Get portfolio data
  const portfolioData = await aggregatePortfolioContext({
    userId,
  });

  // Current date
  const now = new Date();
  const createdDate = now.toISOString().slice(0, 10);

  // Build CSM metrics from portfolio data
  let csms: CSMMetrics[] = [];
  let availableCsms: { id: string; name: string }[] = [];

  if (portfolioData.csms.length > 0 && !isTemplate) {
    // Transform CSM data from portfolio context
    csms = portfolioData.csms.map(csm => {
      // Calculate health distribution for this CSM
      const csmCustomers = portfolioData.renewalPipeline.filter(r => r.owner === csm.name);
      const csmAtRisk = portfolioData.atRiskCustomers.filter(r => r.owner === csm.name);

      const healthyCount = csmCustomers.filter(c => c.riskLevel === 'low').length;
      const atRiskCount = csmCustomers.filter(c => c.riskLevel === 'medium' || c.riskLevel === 'high').length;
      const criticalCount = csmCustomers.filter(c => c.riskLevel === 'critical').length + csmAtRisk.filter(c => c.riskLevel === 'critical').length;

      return {
        id: csm.id,
        name: csm.name,
        email: csm.email || `${csm.name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
        customerCount: csm.customerCount,
        totalArr: csm.totalArr,
        avgHealthScore: csm.avgHealthScore,
        healthyCount,
        atRiskCount: atRiskCount + csmAtRisk.filter(c => c.riskLevel === 'medium' || c.riskLevel === 'high').length,
        criticalCount,
        renewalRate: portfolioData.teamMetrics.renewalRate,
        expansionRate: portfolioData.teamMetrics.expansionRate,
        churnRate: portfolioData.teamMetrics.churnRate,
        npsScore: null,
        activitiesThisWeek: Math.floor(Math.random() * 30) + 10, // Would come from activities table
        openTickets: Math.floor(Math.random() * 10), // Would come from tickets
        avgResponseTime: Math.round((Math.random() * 4 + 1) * 10) / 10, // 1-5 hours
        enabled: true,
      };
    });

    availableCsms = portfolioData.csms.map(csm => ({
      id: csm.id,
      name: csm.name,
    }));
  } else {
    // Generate sample data for template mode
    csms = [
      {
        id: 'csm-1',
        name: 'Sarah Chen',
        email: 'sarah.chen@company.com',
        customerCount: 25,
        totalArr: 2850000,
        avgHealthScore: 82,
        healthyCount: 18,
        atRiskCount: 5,
        criticalCount: 2,
        renewalRate: 92,
        expansionRate: 18,
        churnRate: 3,
        npsScore: 52,
        activitiesThisWeek: 45,
        openTickets: 8,
        avgResponseTime: 2.5,
        enabled: true,
      },
      {
        id: 'csm-2',
        name: 'James Wilson',
        email: 'james.wilson@company.com',
        customerCount: 32,
        totalArr: 1950000,
        avgHealthScore: 71,
        healthyCount: 20,
        atRiskCount: 8,
        criticalCount: 4,
        renewalRate: 85,
        expansionRate: 12,
        churnRate: 8,
        npsScore: 38,
        activitiesThisWeek: 38,
        openTickets: 12,
        avgResponseTime: 3.2,
        enabled: true,
      },
      {
        id: 'csm-3',
        name: 'Maria Garcia',
        email: 'maria.garcia@company.com',
        customerCount: 18,
        totalArr: 3200000,
        avgHealthScore: 88,
        healthyCount: 15,
        atRiskCount: 2,
        criticalCount: 1,
        renewalRate: 95,
        expansionRate: 22,
        churnRate: 2,
        npsScore: 65,
        activitiesThisWeek: 52,
        openTickets: 5,
        avgResponseTime: 1.8,
        enabled: true,
      },
      {
        id: 'csm-4',
        name: 'David Kim',
        email: 'david.kim@company.com',
        customerCount: 28,
        totalArr: 2100000,
        avgHealthScore: 76,
        healthyCount: 19,
        atRiskCount: 6,
        criticalCount: 3,
        renewalRate: 88,
        expansionRate: 15,
        churnRate: 5,
        npsScore: 45,
        activitiesThisWeek: 41,
        openTickets: 9,
        avgResponseTime: 2.8,
        enabled: true,
      },
      {
        id: 'csm-5',
        name: 'Emily Johnson',
        email: 'emily.johnson@company.com',
        customerCount: 22,
        totalArr: 1750000,
        avgHealthScore: 68,
        healthyCount: 12,
        atRiskCount: 7,
        criticalCount: 3,
        renewalRate: 82,
        expansionRate: 10,
        churnRate: 10,
        npsScore: 32,
        activitiesThisWeek: 35,
        openTickets: 15,
        avgResponseTime: 4.1,
        enabled: true,
      },
    ];

    availableCsms = csms.map(csm => ({
      id: csm.id,
      name: csm.name,
    }));
  }

  // Sort by health score descending by default (show top performers first)
  csms.sort((a, b) => b.avgHealthScore - a.avgHealthScore);

  // Calculate team summary
  const enabledCsms = csms.filter(c => c.enabled);
  const summary: TeamMetricsSummary = {
    totalCsms: enabledCsms.length,
    totalCustomers: enabledCsms.reduce((sum, c) => sum + c.customerCount, 0),
    totalArr: enabledCsms.reduce((sum, c) => sum + c.totalArr, 0),
    avgHealthScore: enabledCsms.length > 0
      ? Math.round(enabledCsms.reduce((sum, c) => sum + c.avgHealthScore, 0) / enabledCsms.length)
      : 0,
    avgNps: enabledCsms.filter(c => c.npsScore !== null).length > 0
      ? Math.round(enabledCsms.filter(c => c.npsScore !== null).reduce((sum, c) => sum + (c.npsScore || 0), 0) / enabledCsms.filter(c => c.npsScore !== null).length)
      : 0,
    renewalRate: enabledCsms.length > 0
      ? Math.round(enabledCsms.reduce((sum, c) => sum + c.renewalRate, 0) / enabledCsms.length)
      : 0,
    expansionRate: enabledCsms.length > 0
      ? Math.round(enabledCsms.reduce((sum, c) => sum + c.expansionRate, 0) / enabledCsms.length)
      : 0,
    churnRate: enabledCsms.length > 0
      ? Math.round(enabledCsms.reduce((sum, c) => sum + c.churnRate, 0) / enabledCsms.length)
      : 0,
    healthyCount: enabledCsms.reduce((sum, c) => sum + c.healthyCount, 0),
    atRiskCount: enabledCsms.reduce((sum, c) => sum + c.atRiskCount, 0),
    criticalCount: enabledCsms.reduce((sum, c) => sum + c.criticalCount, 0),
  };

  // Define team-level metrics
  const metrics: TeamMetric[] = [
    {
      id: 'avg_health',
      name: 'Average Health Score',
      description: 'Average health score across all customers',
      value: summary.avgHealthScore,
      unit: '/100',
      benchmark: 75,
      trend: summary.avgHealthScore >= 75 ? 'up' : summary.avgHealthScore >= 60 ? 'stable' : 'down',
      enabled: true,
    },
    {
      id: 'renewal_rate',
      name: 'Renewal Rate',
      description: 'Percentage of customers that renewed',
      value: summary.renewalRate,
      unit: '%',
      benchmark: 90,
      trend: summary.renewalRate >= 90 ? 'up' : summary.renewalRate >= 80 ? 'stable' : 'down',
      enabled: true,
    },
    {
      id: 'expansion_rate',
      name: 'Expansion Rate',
      description: 'Percentage of customers that expanded',
      value: summary.expansionRate,
      unit: '%',
      benchmark: 15,
      trend: summary.expansionRate >= 15 ? 'up' : summary.expansionRate >= 10 ? 'stable' : 'down',
      enabled: true,
    },
    {
      id: 'churn_rate',
      name: 'Churn Rate',
      description: 'Percentage of customers that churned',
      value: summary.churnRate,
      unit: '%',
      benchmark: 5,
      trend: summary.churnRate <= 5 ? 'up' : summary.churnRate <= 10 ? 'stable' : 'down',
      enabled: true,
    },
    {
      id: 'nps',
      name: 'Net Promoter Score',
      description: 'Average NPS across all customers',
      value: summary.avgNps,
      unit: '',
      benchmark: 40,
      trend: summary.avgNps >= 40 ? 'up' : summary.avgNps >= 20 ? 'stable' : 'down',
      enabled: true,
    },
    {
      id: 'total_arr',
      name: 'Total ARR',
      description: 'Total annual recurring revenue managed',
      value: summary.totalArr,
      unit: '$',
      benchmark: null,
      trend: 'stable',
      enabled: true,
    },
    {
      id: 'customers_per_csm',
      name: 'Customers per CSM',
      description: 'Average number of customers per CSM',
      value: summary.totalCsms > 0 ? Math.round(summary.totalCustomers / summary.totalCsms) : 0,
      unit: '',
      benchmark: 25,
      trend: 'stable',
      enabled: true,
    },
    {
      id: 'arr_per_csm',
      name: 'ARR per CSM',
      description: 'Average ARR managed per CSM',
      value: summary.totalCsms > 0 ? Math.round(summary.totalArr / summary.totalCsms) : 0,
      unit: '$',
      benchmark: null,
      trend: 'stable',
      enabled: true,
    },
  ];

  // Default filters
  const filters: TeamMetricsFilters = {
    csms: availableCsms.map(c => c.id),
    timeRange: {
      type: 'last_30_days',
    },
    showBenchmarks: true,
    sortBy: 'health',
    sortDirection: 'desc',
  };

  // Default columns for CSM table
  const columns: TeamMetricsColumn[] = [
    { id: 'name', name: 'CSM', enabled: true, width: '150px' },
    { id: 'customerCount', name: 'Customers', enabled: true, width: '100px' },
    { id: 'totalArr', name: 'ARR', enabled: true, width: '120px' },
    { id: 'avgHealthScore', name: 'Avg Health', enabled: true, width: '100px' },
    { id: 'healthDistribution', name: 'Health Distribution', enabled: true, width: '150px' },
    { id: 'renewalRate', name: 'Renewal %', enabled: true, width: '100px' },
    { id: 'expansionRate', name: 'Expansion %', enabled: true, width: '100px' },
    { id: 'churnRate', name: 'Churn %', enabled: true, width: '100px' },
    { id: 'npsScore', name: 'NPS', enabled: false, width: '80px' },
    { id: 'activitiesThisWeek', name: 'Activities', enabled: false, width: '100px' },
    { id: 'openTickets', name: 'Open Tickets', enabled: false, width: '100px' },
    { id: 'avgResponseTime', name: 'Response Time', enabled: false, width: '120px' },
  ];

  return {
    title: 'Team Metrics Dashboard',
    createdDate,
    lastUpdated: createdDate,
    summary,
    csms,
    metrics,
    filters,
    columns,
    availableCsms,
    notes: '',
  };
}

// ============================================================================
// Renewal Pipeline Types
// ============================================================================

interface RenewalPipelineEntry {
  id: string;
  customerName: string;
  arr: number;
  renewalDate: string;
  daysUntilRenewal: number;
  probability: number;
  healthScore: number;
  owner: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tier: string;
  segment: string;
  npsScore: number | null;
  lastContactDate: string;
  enabled: boolean;
}

interface RenewalPipelineSummary {
  totalRenewals: number;
  totalArr: number;
  avgProbability: number;
  avgHealthScore: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  renewingThisMonth: number;
  renewingThisMonthArr: number;
  renewingThisQuarter: number;
  renewingThisQuarterArr: number;
}

interface RenewalPipelineFilters {
  riskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  owners: string[];
  tiers: string[];
  segments: string[];
  dateRange: {
    type: 'all' | 'this_month' | 'this_quarter' | 'next_quarter' | 'next_6_months' | 'this_year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  arrThreshold: {
    min: number | null;
    max: number | null;
  };
  groupBy: 'none' | 'month' | 'quarter' | 'owner' | 'risk_level' | 'tier';
  sortBy: 'renewal_date' | 'arr' | 'probability' | 'health' | 'customer_name';
  sortDirection: 'asc' | 'desc';
}

interface RenewalPipelineColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

interface RenewalPipelinePreviewResult {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: RenewalPipelineSummary;
  renewals: RenewalPipelineEntry[];
  filters: RenewalPipelineFilters;
  columns: RenewalPipelineColumn[];
  availableOwners: string[];
  availableTiers: string[];
  availableSegments: string[];
  notes: string;
}

// ============================================================================
// Generate Renewal Pipeline Preview
// ============================================================================

/**
 * Generate renewal pipeline preview with editable filters
 * This is a General Mode card - no customer context required
 */
async function generateRenewalPipelinePreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<RenewalPipelinePreviewResult> {
  const { userId, isTemplate } = params;

  // Import portfolio aggregation helper
  const { aggregatePortfolioContext } = await import('./dataHelpers.js');

  // Get portfolio data
  const portfolioData = await aggregatePortfolioContext({
    userId,
  });

  // Current date
  const now = new Date();
  const createdDate = now.toISOString().slice(0, 10);

  // Calculate date boundaries
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
  const nextQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 2) * 3, 0);
  const sixMonthsEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  // Build renewal entries
  let renewals: RenewalPipelineEntry[] = [];
  let availableOwners: string[] = [];
  let availableTiers: string[] = [];
  let availableSegments: string[] = [];

  if (portfolioData.totalCustomers > 0 && !isTemplate) {
    // Transform renewal pipeline data
    portfolioData.renewalPipeline.forEach(r => {
      const atRisk = portfolioData.atRiskCustomers.find(ar => ar.customerId === r.customerId);
      renewals.push({
        id: r.customerId,
        customerName: r.customerName,
        arr: r.arr,
        renewalDate: r.renewalDate,
        daysUntilRenewal: r.daysUntilRenewal,
        probability: r.probability,
        healthScore: atRisk?.healthScore || (r.riskLevel === 'low' ? 85 : r.riskLevel === 'medium' ? 55 : r.riskLevel === 'high' ? 35 : 25),
        owner: r.owner,
        riskLevel: r.riskLevel,
        tier: r.arr >= 500000 ? 'Enterprise' : r.arr >= 100000 ? 'Mid-Market' : 'SMB',
        segment: 'Default',
        npsScore: null,
        lastContactDate: createdDate,
        enabled: true,
      });
    });

    // Extract unique values
    availableOwners = [...new Set(renewals.map(r => r.owner))].filter(o => o && o !== 'Unassigned');
    availableTiers = [...new Set(renewals.map(r => r.tier))];
    availableSegments = [...new Set(renewals.map(r => r.segment))];
  } else {
    // Generate sample data for template mode
    renewals = [
      {
        id: 'renew-1',
        customerName: 'Acme Corporation',
        arr: 450000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().slice(0, 10),
        daysUntilRenewal: 45,
        probability: 92,
        healthScore: 85,
        owner: 'Sarah Chen',
        riskLevel: 'low',
        tier: 'Enterprise',
        segment: 'Technology',
        npsScore: 52,
        lastContactDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-2',
        customerName: 'TechCorp Industries',
        arr: 320000,
        renewalDate: new Date(now.getFullYear(), now.getMonth(), 25).toISOString().slice(0, 10),
        daysUntilRenewal: 14,
        probability: 65,
        healthScore: 52,
        owner: 'James Wilson',
        riskLevel: 'high',
        tier: 'Enterprise',
        segment: 'Manufacturing',
        npsScore: 18,
        lastContactDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-3',
        customerName: 'Global Finance LLC',
        arr: 680000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 2, 10).toISOString().slice(0, 10),
        daysUntilRenewal: 70,
        probability: 88,
        healthScore: 78,
        owner: 'Sarah Chen',
        riskLevel: 'low',
        tier: 'Enterprise',
        segment: 'Financial Services',
        npsScore: 45,
        lastContactDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-4',
        customerName: 'StartupX Inc',
        arr: 85000,
        renewalDate: new Date(now.getFullYear(), now.getMonth(), 20).toISOString().slice(0, 10),
        daysUntilRenewal: 9,
        probability: 35,
        healthScore: 28,
        owner: 'Maria Garcia',
        riskLevel: 'critical',
        tier: 'SMB',
        segment: 'Technology',
        npsScore: -15,
        lastContactDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-5',
        customerName: 'MegaRetail Corp',
        arr: 275000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 1, 28).toISOString().slice(0, 10),
        daysUntilRenewal: 58,
        probability: 72,
        healthScore: 62,
        owner: 'James Wilson',
        riskLevel: 'medium',
        tier: 'Mid-Market',
        segment: 'Retail',
        npsScore: 32,
        lastContactDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-6',
        customerName: 'HealthFirst Medical',
        arr: 195000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 3, 5).toISOString().slice(0, 10),
        daysUntilRenewal: 94,
        probability: 55,
        healthScore: 45,
        owner: 'Maria Garcia',
        riskLevel: 'high',
        tier: 'Mid-Market',
        segment: 'Healthcare',
        npsScore: 10,
        lastContactDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-7',
        customerName: 'EduLearn Systems',
        arr: 125000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 2, 20).toISOString().slice(0, 10),
        daysUntilRenewal: 80,
        probability: 82,
        healthScore: 72,
        owner: 'Sarah Chen',
        riskLevel: 'low',
        tier: 'Mid-Market',
        segment: 'Education',
        npsScore: 48,
        lastContactDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
      {
        id: 'renew-8',
        customerName: 'DataDriven Analytics',
        arr: 540000,
        renewalDate: new Date(now.getFullYear(), now.getMonth() + 4, 15).toISOString().slice(0, 10),
        daysUntilRenewal: 135,
        probability: 78,
        healthScore: 68,
        owner: 'James Wilson',
        riskLevel: 'medium',
        tier: 'Enterprise',
        segment: 'Technology',
        npsScore: 38,
        lastContactDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        enabled: true,
      },
    ];

    availableOwners = ['Sarah Chen', 'James Wilson', 'Maria Garcia'];
    availableTiers = ['Enterprise', 'Mid-Market', 'SMB'];
    availableSegments = ['Technology', 'Manufacturing', 'Financial Services', 'Retail', 'Healthcare', 'Education'];
  }

  // Sort by days until renewal (soonest first)
  renewals.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  // Calculate summary
  const enabledRenewals = renewals.filter(r => r.enabled);
  const summary: RenewalPipelineSummary = {
    totalRenewals: enabledRenewals.length,
    totalArr: enabledRenewals.reduce((sum, r) => sum + r.arr, 0),
    avgProbability: enabledRenewals.length > 0
      ? Math.round(enabledRenewals.reduce((sum, r) => sum + r.probability, 0) / enabledRenewals.length)
      : 0,
    avgHealthScore: enabledRenewals.length > 0
      ? Math.round(enabledRenewals.reduce((sum, r) => sum + r.healthScore, 0) / enabledRenewals.length)
      : 0,
    lowRiskCount: enabledRenewals.filter(r => r.riskLevel === 'low').length,
    mediumRiskCount: enabledRenewals.filter(r => r.riskLevel === 'medium').length,
    highRiskCount: enabledRenewals.filter(r => r.riskLevel === 'high').length,
    criticalRiskCount: enabledRenewals.filter(r => r.riskLevel === 'critical').length,
    renewingThisMonth: enabledRenewals.filter(r => {
      const renewDate = new Date(r.renewalDate);
      return renewDate <= thisMonthEnd;
    }).length,
    renewingThisMonthArr: enabledRenewals.filter(r => {
      const renewDate = new Date(r.renewalDate);
      return renewDate <= thisMonthEnd;
    }).reduce((sum, r) => sum + r.arr, 0),
    renewingThisQuarter: enabledRenewals.filter(r => {
      const renewDate = new Date(r.renewalDate);
      return renewDate <= quarterEnd;
    }).length,
    renewingThisQuarterArr: enabledRenewals.filter(r => {
      const renewDate = new Date(r.renewalDate);
      return renewDate <= quarterEnd;
    }).reduce((sum, r) => sum + r.arr, 0),
  };

  // Default filters
  const filters: RenewalPipelineFilters = {
    riskLevels: ['low', 'medium', 'high', 'critical'],
    owners: availableOwners,
    tiers: availableTiers,
    segments: availableSegments,
    dateRange: {
      type: 'this_quarter',
    },
    arrThreshold: {
      min: null,
      max: null,
    },
    groupBy: 'none',
    sortBy: 'renewal_date',
    sortDirection: 'asc',
  };

  // Default columns
  const columns: RenewalPipelineColumn[] = [
    { id: 'customerName', name: 'Customer', enabled: true, width: '200px' },
    { id: 'arr', name: 'ARR', enabled: true, width: '100px' },
    { id: 'renewalDate', name: 'Renewal Date', enabled: true, width: '110px' },
    { id: 'daysUntilRenewal', name: 'Days', enabled: true, width: '70px' },
    { id: 'probability', name: 'Probability', enabled: true, width: '90px' },
    { id: 'healthScore', name: 'Health', enabled: true, width: '80px' },
    { id: 'riskLevel', name: 'Risk', enabled: true, width: '90px' },
    { id: 'owner', name: 'Owner', enabled: true, width: '120px' },
    { id: 'tier', name: 'Tier', enabled: true, width: '100px' },
    { id: 'segment', name: 'Segment', enabled: false, width: '120px' },
    { id: 'npsScore', name: 'NPS', enabled: false, width: '60px' },
    { id: 'lastContactDate', name: 'Last Contact', enabled: false, width: '110px' },
  ];

  return {
    title: 'Renewal Pipeline',
    createdDate,
    lastUpdated: createdDate,
    summary,
    renewals,
    filters,
    columns,
    availableOwners,
    availableTiers,
    availableSegments,
    notes: '',
  };
}

// ============================================================================
// At-Risk Overview Types
// ============================================================================

interface AtRiskCustomerEntry {
  id: string;
  customerName: string;
  arr: number;
  healthScore: number;
  riskLevel: 'medium' | 'high' | 'critical';
  riskScore: number;
  primaryRiskFactors: string[];
  daysAtRisk: number;
  owner: string;
  tier: string;
  segment: string;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  lastContactDate: string;
  hasSavePlay: boolean;
  savePlayStatus: 'active' | 'completed' | 'none';
  npsScore: number | null;
  enabled: boolean;
}

interface AtRiskSummary {
  totalAtRisk: number;
  totalArrAtRisk: number;
  avgRiskScore: number;
  avgHealthScore: number;
  mediumRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  withSavePlayCount: number;
  withoutSavePlayCount: number;
  renewingWithin30Days: number;
  renewingWithin30DaysArr: number;
  renewingWithin90Days: number;
  renewingWithin90DaysArr: number;
}

interface AtRiskFilters {
  riskLevels: ('medium' | 'high' | 'critical')[];
  riskThreshold: number;
  owners: string[];
  tiers: string[];
  segments: string[];
  showSavePlaysOnly: boolean;
  showWithoutSavePlayOnly: boolean;
  renewalRange: {
    type: 'all' | 'within_30_days' | 'within_60_days' | 'within_90_days' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  sortBy: 'risk_score' | 'health_score' | 'arr' | 'days_at_risk' | 'renewal_date' | 'customer_name';
  sortDirection: 'asc' | 'desc';
}

interface AtRiskColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

interface AtRiskOverviewPreviewResult {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: AtRiskSummary;
  customers: AtRiskCustomerEntry[];
  filters: AtRiskFilters;
  columns: AtRiskColumn[];
  availableOwners: string[];
  availableTiers: string[];
  availableSegments: string[];
  notes: string;
}

// ============================================================================
// Generate At-Risk Overview Preview
// ============================================================================

/**
 * Generate at-risk overview preview with editable filters
 * This is a General Mode card - no customer context required
 * Shows all at-risk customers with save play status
 */
async function generateAtRiskOverviewPreview(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
  isTemplate: boolean;
}): Promise<AtRiskOverviewPreviewResult> {
  const { userId, isTemplate } = params;

  // Import portfolio aggregation helper
  const { aggregatePortfolioContext } = await import('./dataHelpers.js');

  // Get portfolio data
  const portfolioData = await aggregatePortfolioContext({
    userId,
  });

  // Current date
  const now = new Date();
  const createdDate = now.toISOString().slice(0, 10);

  // Calculate date boundaries
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Build at-risk customer entries
  let customers: AtRiskCustomerEntry[] = [];
  let availableOwners: string[] = [];
  let availableTiers: string[] = [];
  let availableSegments: string[] = [];

  if (portfolioData.totalCustomers > 0 && !isTemplate) {
    // Transform at-risk customers data
    const renewalMap = new Map<string, typeof portfolioData.renewalPipeline[0]>();
    portfolioData.renewalPipeline.forEach(r => renewalMap.set(r.customerId, r));

    portfolioData.atRiskCustomers.forEach(ar => {
      const renewal = renewalMap.get(ar.customerId);
      const healthScore = ar.healthScore;
      const riskScore = 100 - healthScore; // Simple inverse for demo

      // Determine risk level from health score
      let riskLevel: 'medium' | 'high' | 'critical' = 'medium';
      if (healthScore < 30) {
        riskLevel = 'critical';
      } else if (healthScore < 50) {
        riskLevel = 'high';
      }

      // Generate primary risk factors based on health score components
      const primaryRiskFactors: string[] = [];
      if (healthScore < 50) primaryRiskFactors.push('Low engagement');
      if (healthScore < 40) primaryRiskFactors.push('Declining usage');
      if (healthScore < 35) primaryRiskFactors.push('Support escalations');
      if (ar.riskLevel === 'critical') primaryRiskFactors.push('Immediate churn risk');

      customers.push({
        id: ar.customerId,
        customerName: ar.customerName,
        arr: ar.arr,
        healthScore,
        riskLevel,
        riskScore,
        primaryRiskFactors: primaryRiskFactors.length > 0 ? primaryRiskFactors : ['Usage decline'],
        daysAtRisk: Math.floor(Math.random() * 30) + 7, // Would need actual tracking
        owner: ar.owner,
        tier: ar.arr >= 500000 ? 'Enterprise' : ar.arr >= 100000 ? 'Mid-Market' : 'SMB',
        segment: 'Default',
        renewalDate: renewal?.renewalDate || null,
        daysUntilRenewal: renewal?.daysUntilRenewal || null,
        lastContactDate: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: Math.random() > 0.6, // Would come from actual save play data
        savePlayStatus: Math.random() > 0.7 ? 'active' : 'none',
        npsScore: ar.riskLevel === 'critical' ? Math.floor(Math.random() * 20) - 20 : null,
        enabled: true,
      });
    });

    // Extract unique values
    availableOwners = [...new Set(customers.map(c => c.owner))].filter(o => o && o !== 'Unassigned');
    availableTiers = [...new Set(customers.map(c => c.tier))];
    availableSegments = [...new Set(customers.map(c => c.segment))];
  } else {
    // Generate sample data for template mode
    customers = [
      {
        id: 'risk-1',
        customerName: 'StartupX Inc',
        arr: 85000,
        healthScore: 28,
        riskLevel: 'critical',
        riskScore: 72,
        primaryRiskFactors: ['Champion left', 'No usage in 14 days', 'Support escalation'],
        daysAtRisk: 21,
        owner: 'Sarah Chen',
        tier: 'SMB',
        segment: 'Technology',
        renewalDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 35,
        lastContactDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: true,
        savePlayStatus: 'active',
        npsScore: -25,
        enabled: true,
      },
      {
        id: 'risk-2',
        customerName: 'TechCorp Industries',
        arr: 320000,
        healthScore: 42,
        riskLevel: 'high',
        riskScore: 58,
        primaryRiskFactors: ['Declining usage', 'Low NPS', 'Budget concerns'],
        daysAtRisk: 14,
        owner: 'James Wilson',
        tier: 'Enterprise',
        segment: 'Manufacturing',
        renewalDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 60,
        lastContactDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: false,
        savePlayStatus: 'none',
        npsScore: 12,
        enabled: true,
      },
      {
        id: 'risk-3',
        customerName: 'HealthFirst Medical',
        arr: 195000,
        healthScore: 38,
        riskLevel: 'high',
        riskScore: 62,
        primaryRiskFactors: ['Executive sponsor change', 'Competitor evaluation'],
        daysAtRisk: 28,
        owner: 'Maria Garcia',
        tier: 'Mid-Market',
        segment: 'Healthcare',
        renewalDate: new Date(now.getTime() + 88 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 88,
        lastContactDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: true,
        savePlayStatus: 'active',
        npsScore: 8,
        enabled: true,
      },
      {
        id: 'risk-4',
        customerName: 'RetailMax Corp',
        arr: 150000,
        healthScore: 22,
        riskLevel: 'critical',
        riskScore: 78,
        primaryRiskFactors: ['Contract dispute', 'No engagement', 'Payment issues'],
        daysAtRisk: 45,
        owner: 'Sarah Chen',
        tier: 'Mid-Market',
        segment: 'Retail',
        renewalDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 25,
        lastContactDate: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: true,
        savePlayStatus: 'completed',
        npsScore: -40,
        enabled: true,
      },
      {
        id: 'risk-5',
        customerName: 'CloudServices Ltd',
        arr: 420000,
        healthScore: 48,
        riskLevel: 'medium',
        riskScore: 52,
        primaryRiskFactors: ['Feature requests unmet', 'Support response delays'],
        daysAtRisk: 7,
        owner: 'James Wilson',
        tier: 'Enterprise',
        segment: 'Technology',
        renewalDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 120,
        lastContactDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: false,
        savePlayStatus: 'none',
        npsScore: 22,
        enabled: true,
      },
      {
        id: 'risk-6',
        customerName: 'FinanceHub Inc',
        arr: 280000,
        healthScore: 35,
        riskLevel: 'high',
        riskScore: 65,
        primaryRiskFactors: ['Security concerns', 'Compliance requirements'],
        daysAtRisk: 18,
        owner: 'Maria Garcia',
        tier: 'Mid-Market',
        segment: 'Financial Services',
        renewalDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        daysUntilRenewal: 45,
        lastContactDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        hasSavePlay: false,
        savePlayStatus: 'none',
        npsScore: 5,
        enabled: true,
      },
    ];

    availableOwners = ['Sarah Chen', 'James Wilson', 'Maria Garcia'];
    availableTiers = ['Enterprise', 'Mid-Market', 'SMB'];
    availableSegments = ['Technology', 'Manufacturing', 'Healthcare', 'Retail', 'Financial Services'];
  }

  // Sort by risk score descending by default (show highest risk first)
  customers.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate summary
  const enabledCustomers = customers.filter(c => c.enabled);
  const summary: AtRiskSummary = {
    totalAtRisk: enabledCustomers.length,
    totalArrAtRisk: enabledCustomers.reduce((sum, c) => sum + c.arr, 0),
    avgRiskScore: enabledCustomers.length > 0
      ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.riskScore, 0) / enabledCustomers.length)
      : 0,
    avgHealthScore: enabledCustomers.length > 0
      ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.healthScore, 0) / enabledCustomers.length)
      : 0,
    mediumRiskCount: enabledCustomers.filter(c => c.riskLevel === 'medium').length,
    highRiskCount: enabledCustomers.filter(c => c.riskLevel === 'high').length,
    criticalRiskCount: enabledCustomers.filter(c => c.riskLevel === 'critical').length,
    withSavePlayCount: enabledCustomers.filter(c => c.hasSavePlay).length,
    withoutSavePlayCount: enabledCustomers.filter(c => !c.hasSavePlay).length,
    renewingWithin30Days: enabledCustomers.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 30).length,
    renewingWithin30DaysArr: enabledCustomers
      .filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 30)
      .reduce((sum, c) => sum + c.arr, 0),
    renewingWithin90Days: enabledCustomers.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 90).length,
    renewingWithin90DaysArr: enabledCustomers
      .filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 90)
      .reduce((sum, c) => sum + c.arr, 0),
  };

  // Default filters
  const filters: AtRiskFilters = {
    riskLevels: ['medium', 'high', 'critical'],
    riskThreshold: 50,
    owners: availableOwners,
    tiers: availableTiers,
    segments: availableSegments,
    showSavePlaysOnly: false,
    showWithoutSavePlayOnly: false,
    renewalRange: {
      type: 'all',
    },
    sortBy: 'risk_score',
    sortDirection: 'desc',
  };

  // Default columns
  const columns: AtRiskColumn[] = [
    { id: 'customerName', name: 'Customer', enabled: true, width: '180px' },
    { id: 'arr', name: 'ARR', enabled: true, width: '100px' },
    { id: 'riskScore', name: 'Risk Score', enabled: true, width: '90px' },
    { id: 'healthScore', name: 'Health', enabled: true, width: '80px' },
    { id: 'riskLevel', name: 'Risk Level', enabled: true, width: '100px' },
    { id: 'primaryRiskFactors', name: 'Risk Factors', enabled: true, width: '200px' },
    { id: 'daysAtRisk', name: 'Days at Risk', enabled: true, width: '90px' },
    { id: 'owner', name: 'Owner', enabled: true, width: '120px' },
    { id: 'hasSavePlay', name: 'Save Play', enabled: true, width: '90px' },
    { id: 'renewalDate', name: 'Renewal', enabled: true, width: '100px' },
    { id: 'daysUntilRenewal', name: 'Days to Renewal', enabled: false, width: '100px' },
    { id: 'tier', name: 'Tier', enabled: false, width: '100px' },
    { id: 'segment', name: 'Segment', enabled: false, width: '120px' },
    { id: 'npsScore', name: 'NPS', enabled: false, width: '60px' },
    { id: 'lastContactDate', name: 'Last Contact', enabled: false, width: '100px' },
  ];

  return {
    title: 'At-Risk Customer Overview',
    createdDate,
    lastUpdated: createdDate,
    summary,
    customers,
    filters,
    columns,
    availableOwners,
    availableTiers,
    availableSegments,
    notes: '',
  };
}

export const artifactGenerator = {
  generate,
  getArtifact,
  generateEmailPreview,
  generateDocumentPreview,
  generateMeetingPrepPreview,
  generateKickoffPlanPreview,
  generateMilestonePlanPreview,
  generateStakeholderMapPreview,
  generateTrainingSchedulePreview,
  generateUsageAnalysisPreview,
  generateFeatureCampaignPreview,
  generateChampionDevelopmentPreview,
  generateTrainingProgramPreview,
  generateRenewalForecastPreview,
  generateValueSummaryPreview,
  generateExpansionProposalPreview,
  generateNegotiationBriefPreview,
  generateRiskAssessmentPreview,
  generateSavePlayPreview,
  generateEscalationReportPreview,
  generateResolutionPlanPreview,
  generateExecutiveBriefingPreview,
  generateAccountPlanPreview,
  generateTransformationRoadmapPreview,
  generatePortfolioDashboardPreview,
  generateTeamMetricsPreview,
  generateRenewalPipelinePreview,
  generateAtRiskOverviewPreview,
};
