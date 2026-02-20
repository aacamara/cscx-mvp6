/**
 * Organization-scoped query helpers
 * Adds organization_id filtering to Supabase queries.
 *
 * The backend uses the service_role key which bypasses RLS,
 * so we must explicitly filter by organization_id in all queries.
 */

import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the organization_id from the request, or null if in demo/dev mode.
 */
export function getOrgId(req: Request): string | null {
  return req.organizationId || null;
}

/**
 * Apply organization_id filter to a Supabase query builder.
 * - With org context: returns only that org's data
 * - Without org context: returns only shared/demo data (organization_id IS NULL)
 *
 * SECURITY: Never returns unfiltered data. This prevents cross-org data leaks
 * when a user is authenticated but hasn't joined an organization yet.
 *
 * Usage:
 *   const query = supabase.from('customers').select('*');
 *   const filtered = applyOrgFilter(query, req);
 */
export function applyOrgFilter<T>(
  query: any, // PostgrestFilterBuilder — using any to avoid complex generic types
  req: Request
): T {
  const orgId = getOrgId(req);

  if (orgId) {
    // Filter to this organization's data
    return query.eq('organization_id', orgId) as T;
  }

  // No org context (demo/unauthenticated) — restrict to shared/demo data only.
  // This prevents unauthenticated or org-less users from seeing any org's data.
  return query.is('organization_id', null) as T;
}

/**
 * Apply organization_id filter, but include BOTH org-specific and null (shared) data.
 * Useful for knowledge_base and other tables that have global + org-specific entries.
 */
export function applyOrgFilterInclusive<T>(
  query: any,
  req: Request
): T {
  const orgId = getOrgId(req);

  if (orgId) {
    // Include org-specific data AND shared (null org) data
    return query.or(`organization_id.eq.${orgId},organization_id.is.null`) as T;
  }

  // No org context — restrict to shared/demo data only
  return query.is('organization_id', null) as T;
}

/**
 * Set organization_id on a record before insert.
 * Returns the data object with organization_id added.
 */
export function withOrgId<T extends Record<string, unknown>>(
  data: T,
  req: Request
): T {
  const orgId = getOrgId(req);
  if (!orgId) return data; // No org context — don't add column (safe before migration)
  return {
    ...data,
    organization_id: orgId,
  } as T;
}

/**
 * Filter in-memory data by organization_id (for in-memory fallback stores).
 * When no org context, returns all data (demo mode).
 */
export function filterInMemoryByOrg<T extends { organization_id?: string | null }>(
  items: T[],
  req: Request
): T[] {
  const orgId = getOrgId(req);
  if (!orgId) return items; // Demo mode — return all
  return items.filter(item => item.organization_id === orgId || !item.organization_id);
}
