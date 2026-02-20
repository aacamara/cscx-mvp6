-- ============================================
-- FIX: Embedding Dimension Mismatch (B1)
-- ============================================
-- Root cause: knowledge_chunks.embedding defined as vector(1536) (OpenAI)
-- but EmbeddingService uses text-embedding-005 (Gemini) which outputs 768 dims.
-- This migration aligns the schema with the active embedding model.

-- 1. Drop dependent functions first
DROP FUNCTION IF EXISTS search_knowledge(vector, float, int, text, uuid);

-- 2. Drop the ivfflat index (dimension-specific)
DROP INDEX IF EXISTS idx_chunks_embedding;

-- 3. Alter column from vector(1536) to vector(768)
ALTER TABLE knowledge_chunks
  ALTER COLUMN embedding TYPE vector(768);

-- 4. Recreate ivfflat index with correct dimension
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- 5. Recreate search_knowledge function with vector(768)
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(768),
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

-- 6. Create search_knowledge_chunks alias (used by EmbeddingService.searchSimilar)
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
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
  SELECT * FROM search_knowledge(
    query_embedding, match_threshold, match_count, filter_layer, filter_user_id
  );
END;
$$;
