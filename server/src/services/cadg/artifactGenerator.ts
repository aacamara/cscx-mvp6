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

export const artifactGenerator = {
  generate,
  getArtifact,
  generateEmailPreview,
  generateDocumentPreview,
  generateMeetingPrepPreview,
  generateKickoffPlanPreview,
  generateMilestonePlanPreview,
};
