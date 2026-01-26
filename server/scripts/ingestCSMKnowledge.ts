/**
 * CSM Knowledge Base Ingestion Script
 * Loads GitLab's open-source CSM playbook into the pgvector knowledge base
 */

import fs from 'fs';
import path from 'path';
import { knowledgeService } from '../src/services/knowledge.js';

const KNOWLEDGE_BASE_PATH = '/Users/azizcamara/Downloads/files (2) 2/cscx_knowledge_base';

interface IngestionResult {
  file: string;
  status: 'success' | 'failed';
  documentId?: string;
  error?: string;
}

// Category mapping based on file names
const categoryMap: Record<string, string> = {
  '01_CSM_FOUNDATIONS': 'foundations',
  '05_SUCCESS_PLANNING': 'success-planning',
  '06_HEALTH_SCORING': 'health-scoring',
  '07_EBR_PLAYBOOK': 'ebr',
  '09_ONBOARDING': 'onboarding',
  '10_RISK_MANAGEMENT': 'risk-management',
  '11_GAINSIGHT_OPERATIONS': 'gainsight',
  '12_SCALE_DIGITAL': 'scale-digital',
  '13_METRICS_KPIs': 'metrics',
  '14_TEMPLATES_CHECKLISTS': 'templates',
  'playbooks': 'playbooks',
  'glossary': 'glossary',
  'health_scoring': 'health-scoring',
  'engagement_models': 'engagement',
  'metrics_kpis': 'metrics',
  'role_definitions': 'roles',
  'gainsight_operations': 'gainsight',
  '00_knowledge_base_index': 'index'
};

function getCategory(filename: string): string {
  const baseName = path.basename(filename, path.extname(filename));
  return categoryMap[baseName] || 'general';
}

function getTitleFromContent(content: string, filename: string): string {
  // Try to extract title from markdown header
  const headerMatch = content.match(/^#\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // Try JSON title
  try {
    const json = JSON.parse(content);
    if (json.title) return json.title;
    if (json.name) return json.name;
    if (json.knowledge_base?.name) return json.knowledge_base.name;
  } catch {
    // Not JSON, use filename
  }

  // Fallback to filename
  return path.basename(filename, path.extname(filename))
    .replace(/_/g, ' ')
    .replace(/^\d+\s*/, '');
}

async function ingestFile(filePath: string): Promise<IngestionResult> {
  const filename = path.basename(filePath);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const title = getTitleFromContent(content, filename);
    const category = getCategory(filename);
    const isJson = filePath.endsWith('.json');

    console.log(`📄 Ingesting: ${filename} (${category})`);

    const document = await knowledgeService.addDocument({
      title,
      content,
      layer: 'universal', // CSM best practices apply to all customers
      category,
      sourceType: 'system',
      sourceUrl: 'https://gitlab.com/gitlab-com/content-sites/handbook/-/tree/main/content/handbook/customer-success/csm',
      metadata: {
        source: 'GitLab CSM Playbook',
        fileType: isJson ? 'json' : 'markdown',
        originalFile: filename
      }
    });

    return {
      file: filename,
      status: 'success',
      documentId: document.id
    };
  } catch (error) {
    console.error(`❌ Failed to ingest ${filename}:`, error);
    return {
      file: filename,
      status: 'failed',
      error: (error as Error).message
    };
  }
}

async function main() {
  console.log('🚀 Starting CSM Knowledge Base Ingestion');
  console.log(`📂 Source: ${KNOWLEDGE_BASE_PATH}`);
  console.log('');

  const results: IngestionResult[] = [];

  // Ingest markdown files
  const markdownDir = path.join(KNOWLEDGE_BASE_PATH, 'markdown');
  if (fs.existsSync(markdownDir)) {
    const mdFiles = fs.readdirSync(markdownDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(markdownDir, f));

    console.log(`📝 Found ${mdFiles.length} markdown files`);
    for (const file of mdFiles) {
      const result = await ingestFile(file);
      results.push(result);
    }
  }

  // Ingest JSON files
  const jsonDir = path.join(KNOWLEDGE_BASE_PATH, 'json');
  if (fs.existsSync(jsonDir)) {
    const jsonFiles = fs.readdirSync(jsonDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(jsonDir, f));

    console.log(`📊 Found ${jsonFiles.length} JSON files`);
    for (const file of jsonFiles) {
      const result = await ingestFile(file);
      results.push(result);
    }
  }

  // Ingest README
  const readmePath = path.join(KNOWLEDGE_BASE_PATH, '00_README.md');
  if (fs.existsSync(readmePath)) {
    const result = await ingestFile(readmePath);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 INGESTION SUMMARY');
  console.log('='.repeat(50));

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
  }

  console.log('\n🎉 CSM Knowledge Base ingestion complete!');
  console.log('The agents now have access to GitLab CSM best practices.');
}

main().catch(console.error);
