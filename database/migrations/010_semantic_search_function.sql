-- Migration: 010_semantic_search_function.sql
-- Description: Add RPC function for semantic search on CSM playbooks
-- Created: 2026-01-22

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create semantic search function for CSM playbooks
-- Uses cosine similarity (1 - cosine distance) for ranking
CREATE OR REPLACE FUNCTION search_csm_playbooks(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  category text,
  subcategory text,
  title text,
  summary text,
  content text,
  use_cases text[],
  tags text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.category,
    p.subcategory,
    p.title,
    p.summary,
    p.content,
    p.use_cases,
    p.tags,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM csm_playbooks p
  WHERE
    p.embedding IS NOT NULL
    AND (filter_category IS NULL OR p.category = filter_category)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for faster vector similarity search
CREATE INDEX IF NOT EXISTS idx_csm_playbooks_embedding
ON csm_playbooks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON FUNCTION search_csm_playbooks IS 'Semantic search for CSM playbooks using pgvector cosine similarity';
