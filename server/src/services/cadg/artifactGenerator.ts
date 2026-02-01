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
 * Generate an artifact from an approved plan
 */
export async function generate(params: {
  plan: ExecutionPlan;
  context: AggregatedContext;
  userId: string;
  customerId: string | null;
}): Promise<GeneratedArtifact> {
  const { plan, context, userId, customerId } = params;
  const startTime = Date.now();

  // Track sources used
  const sourcesUsed = extractSourcesUsed(context);

  // For QBR generation, create real Google Slides and Sheets
  if (plan.taskType === 'qbr_generation' && customerId) {
    try {
      const qbrResult = await generateQBRWithGoogleWorkspace(userId, customerId, context);

      const generationDurationMs = Date.now() - startTime;

      const artifact: GeneratedArtifact = {
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
      };

      await saveArtifact(artifact, userId, customerId);
      return artifact;
    } catch (error) {
      console.error('[artifactGenerator] Google Workspace generation failed, falling back to markdown:', error);
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

export const artifactGenerator = {
  generate,
  getArtifact,
};
