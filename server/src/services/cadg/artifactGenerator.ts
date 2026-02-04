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
};
