/**
 * Knowledge Base Seeding
 * Populates the knowledge base with CS playbooks on startup
 */

import { knowledgeService } from '../services/knowledge.js';
import { CS_PLAYBOOKS } from './cs-playbooks.js';

let seeded = false;

/**
 * Seed the knowledge base with CS playbooks
 * Only runs once per server startup
 */
export async function seedKnowledgeBase(): Promise<void> {
  if (seeded) {
    return;
  }

  console.log('📚 Checking knowledge base...');

  try {
    // Check if knowledge service is using Supabase
    if (!knowledgeService.isReady()) {
      console.log('📚 Knowledge base running in memory mode - skipping seed');
      seeded = true;
      return;
    }

    // Check if playbooks already exist
    const { total } = await knowledgeService.listDocuments({
      layer: 'universal',
      category: 'playbook'
    });

    if (total >= CS_PLAYBOOKS.length) {
      console.log(`📚 Knowledge base already seeded with ${total} documents`);
      seeded = true;
      return;
    }

    console.log(`📚 Seeding knowledge base with ${CS_PLAYBOOKS.length} playbooks...`);

    // Add each playbook to the knowledge base
    for (const playbook of CS_PLAYBOOKS) {
      try {
        await knowledgeService.addDocument({
          layer: 'universal',
          category: playbook.category,
          title: playbook.title,
          content: playbook.content,
          sourceType: 'system',
          metadata: {
            type: 'playbook',
            seededAt: new Date().toISOString()
          }
        });
        console.log(`  ✓ Added: ${playbook.title}`);
      } catch (error) {
        console.error(`  ✗ Failed to add ${playbook.title}:`, error);
      }
    }

    console.log(`📚 Knowledge base seeded with ${CS_PLAYBOOKS.length} documents`);
    seeded = true;
  } catch (error: any) {
    // Schema mismatch - database doesn't have required columns
    if (error?.code === '42703' || error?.message?.includes('does not exist')) {
      console.log('📚 Knowledge base schema needs migration - see database/migrations/004_knowledge_base_schema.sql');
      console.log('📚 Running in limited mode (playbooks not seeded)');
    } else {
      console.error('Failed to seed knowledge base:', error);
    }
    seeded = true; // Mark as seeded to avoid repeated errors
  }
}

export default seedKnowledgeBase;
