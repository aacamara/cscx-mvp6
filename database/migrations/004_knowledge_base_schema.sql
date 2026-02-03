-- ============================================
-- KNOWLEDGE BASE SCHEMA UPDATE
-- Adds columns needed by the knowledge service
-- ============================================

-- Add missing columns to knowledge_base table
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'universal';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'indexed';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS word_count INTEGER;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_kb_layer ON knowledge_base(layer);
CREATE INDEX IF NOT EXISTS idx_kb_user_id ON knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_customer_id ON knowledge_base(customer_id);
CREATE INDEX IF NOT EXISTS idx_kb_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_kb_source_type ON knowledge_base(source_type);

-- Create knowledge_chunks table if it doesn't exist
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),  -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- Create search function for knowledge base with pgvector
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_layer text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  document_layer text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kb.title as document_title,
    kb.layer as document_layer
  FROM knowledge_chunks kc
  JOIN knowledge_base kb ON kc.document_id = kb.id
  WHERE
    kb.status = 'indexed'
    AND (filter_layer IS NULL OR kb.layer = filter_layer)
    AND (filter_user_id IS NULL OR kb.user_id = filter_user_id OR kb.layer = 'universal')
    AND (1 - (kc.embedding <=> query_embedding)) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
