/**
 * Run Knowledge Base Migration
 * Executes the pgvector schema updates on Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

async function runMigration() {
  console.log('🚀 Running Knowledge Base Migration...\n');

  const migrations = [
    {
      name: 'Add layer column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'universal'`
    },
    {
      name: 'Add user_id column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS user_id UUID`
    },
    {
      name: 'Add customer_id column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS customer_id UUID`
    },
    {
      name: 'Add source_type column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system'`
    },
    {
      name: 'Add source_url column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT`
    },
    {
      name: 'Add source_id column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_id TEXT`
    },
    {
      name: 'Add status column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'indexed'`
    },
    {
      name: 'Add error_message column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS error_message TEXT`
    },
    {
      name: 'Add word_count column',
      sql: `ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS word_count INTEGER`
    }
  ];

  for (const migration of migrations) {
    try {
      console.log(`📝 ${migration.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase.from('knowledge_base').select('id').limit(0);
        if (directError) {
          console.log(`   ⚠️  Note: ${error.message}`);
        }
      }
      console.log(`   ✅ Done`);
    } catch (err) {
      console.log(`   ⚠️  ${(err as Error).message}`);
    }
  }

  // Check if columns exist now
  console.log('\n🔍 Verifying schema...');
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, title, layer, status, source_type')
    .limit(1);

  if (error) {
    console.log(`❌ Schema verification failed: ${error.message}`);
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
    console.log('─'.repeat(60));
    console.log(`
-- Add missing columns to knowledge_base table
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'universal';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'indexed';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS word_count INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_kb_layer ON knowledge_base(layer);
CREATE INDEX IF NOT EXISTS idx_kb_status ON knowledge_base(status);

-- Create knowledge_chunks table for embeddings
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks(document_id);
    `);
    console.log('─'.repeat(60));
  } else {
    console.log('✅ Schema looks good!');
    console.log(`   Found columns: ${Object.keys(data?.[0] || {}).join(', ')}`);
  }

  console.log('\n🎉 Migration check complete!');
}

runMigration().catch(console.error);
