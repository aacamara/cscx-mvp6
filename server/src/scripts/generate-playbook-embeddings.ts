/**
 * Generate Embeddings for CSM Playbooks
 *
 * This script generates vector embeddings for all playbooks in csm_playbooks table
 * to enable semantic search functionality.
 *
 * Run with: npx tsx src/scripts/generate-playbook-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

async function generatePlaybookEmbeddings() {
  console.log('🚀 Starting playbook embedding generation...\n');

  // Validate configuration
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
  }

  if (!config.geminiApiKey) {
    console.error('❌ GEMINI_API_KEY is required for embedding generation');
    process.exit(1);
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-005' });

  try {
    // Fetch all playbooks without embeddings
    const { data: playbooks, error: fetchError } = await supabase
      .from('csm_playbooks')
      .select('id, title, content, summary, category')
      .is('embedding', null);

    if (fetchError) {
      console.error('❌ Failed to fetch playbooks:', fetchError);
      process.exit(1);
    }

    if (!playbooks || playbooks.length === 0) {
      console.log('✅ All playbooks already have embeddings!');
      return;
    }

    console.log(`📚 Found ${playbooks.length} playbooks without embeddings\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const playbook of playbooks) {
      try {
        // Create text for embedding (title + summary + truncated content)
        const textForEmbedding = [
          playbook.title,
          playbook.summary || '',
          playbook.category,
          playbook.content.substring(0, 8000) // Limit content length
        ].join('\n\n');

        console.log(`  Processing: ${playbook.title}...`);

        // Generate embedding
        const result = await embeddingModel.embedContent(textForEmbedding);
        const embedding = result.embedding.values;

        // Update playbook with embedding
        const { error: updateError } = await supabase
          .from('csm_playbooks')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', playbook.id);

        if (updateError) {
          console.error(`    ❌ Failed to update: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`    ✅ Embedded (${embedding.length} dimensions)`);
          successCount++;
        }

        // Rate limiting - avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`    ❌ Error processing ${playbook.title}:`, err);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`✅ Successfully embedded: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('========================================\n');

    if (successCount > 0) {
      console.log('🎉 Semantic search is now enabled for CSM playbooks!');
      console.log('   Agents can use search_knowledge to find relevant playbooks.\n');
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
generatePlaybookEmbeddings();
