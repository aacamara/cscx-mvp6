/**
 * Customer Matcher Service (PRD-002)
 * Matches uploaded Excel rows to existing customers in the database
 *
 * Features:
 * - Exact matching by ID, email, or name
 * - Fuzzy matching for name variations
 * - Confidence scoring
 * - Suggestions for unmatched rows
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  ExcelColumnMapping,
  MatchedCustomer,
  UnmatchedRow,
  MatchResults,
} from '../fileUpload/excelParser.js';

// Types
export interface CustomerRecord {
  id: string;
  name: string;
  email?: string;
  arr?: number;
  healthScore?: number;
  stage?: string;
}

export interface MatchConfig {
  fuzzyThreshold: number;       // Minimum similarity score (0-1) for fuzzy match
  maxSuggestions: number;       // Max suggestions for unmatched rows
  preferExactMatch: boolean;    // Prefer exact matches over fuzzy
}

const DEFAULT_CONFIG: MatchConfig = {
  fuzzyThreshold: 0.7,
  maxSuggestions: 3,
  preferExactMatch: true,
};

class CustomerMatcherService {
  private supabase: SupabaseClient | null = null;
  private customerCache: Map<string, CustomerRecord[]> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Match uploaded rows to existing customers
   */
  async matchRows(
    rows: Record<string, any>[],
    columnMapping: ExcelColumnMapping,
    matchConfig: Partial<MatchConfig> = {}
  ): Promise<MatchResults> {
    const cfg = { ...DEFAULT_CONFIG, ...matchConfig };

    // Load all customers for matching
    const customers = await this.loadCustomers();

    const matched: MatchedCustomer[] = [];
    const unmatched: UnmatchedRow[] = [];

    // Create lookup maps for fast matching
    const customersByName = new Map<string, CustomerRecord>();
    const customersByEmail = new Map<string, CustomerRecord>();
    const customersById = new Map<string, CustomerRecord>();

    for (const customer of customers) {
      customersById.set(customer.id, customer);
      customersByName.set(this.normalizeString(customer.name), customer);
      if (customer.email) {
        customersByEmail.set(customer.email.toLowerCase(), customer);
      }
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Get identifier values from row based on mapping
      const customerName = columnMapping.customerName ? row[columnMapping.customerName] : null;
      const customerId = columnMapping.customerId ? row[columnMapping.customerId] : null;
      const customerEmail = columnMapping.customerEmail ? row[columnMapping.customerEmail] : null;

      let match: { customer: CustomerRecord; matchType: MatchedCustomer['matchType']; confidence: number } | null = null;

      // Try exact match by ID first
      if (customerId && customersById.has(String(customerId))) {
        const customer = customersById.get(String(customerId))!;
        match = { customer, matchType: 'id', confidence: 1.0 };
      }

      // Try exact match by email
      if (!match && customerEmail) {
        const normalizedEmail = customerEmail.toLowerCase().trim();
        if (customersByEmail.has(normalizedEmail)) {
          const customer = customersByEmail.get(normalizedEmail)!;
          match = { customer, matchType: 'email', confidence: 1.0 };
        }
      }

      // Try exact match by name
      if (!match && customerName) {
        const normalizedName = this.normalizeString(customerName);
        if (customersByName.has(normalizedName)) {
          const customer = customersByName.get(normalizedName)!;
          match = { customer, matchType: 'exact', confidence: 1.0 };
        }
      }

      // Try fuzzy match by name
      if (!match && customerName) {
        const fuzzyMatch = this.findBestFuzzyMatch(customerName, customers, cfg.fuzzyThreshold);
        if (fuzzyMatch) {
          match = { customer: fuzzyMatch.customer, matchType: 'fuzzy', confidence: fuzzyMatch.similarity };
        }
      }

      if (match) {
        matched.push({
          rowIndex: i,
          rowData: row,
          customerId: match.customer.id,
          customerName: match.customer.name,
          matchConfidence: match.confidence,
          matchType: match.matchType,
        });
      } else {
        // Find suggestions for unmatched rows
        const searchedValue = customerName || customerEmail || customerId || 'Unknown';
        const suggestions = this.findSuggestions(String(searchedValue), customers, cfg.maxSuggestions);

        unmatched.push({
          rowIndex: i,
          rowData: row,
          searchedValue: String(searchedValue),
          suggestions,
        });
      }
    }

    const matchRate = rows.length > 0 ? (matched.length / rows.length) * 100 : 0;

    return {
      matched,
      unmatched,
      matchRate: Math.round(matchRate * 10) / 10,
    };
  }

  /**
   * Apply manual matches from user
   */
  applyManualMatches(
    matchResults: MatchResults,
    manualMatches: Array<{ rowIndex: number; customerId: string; customerName: string }>
  ): MatchResults {
    const newMatched = [...matchResults.matched];
    const newUnmatched = [...matchResults.unmatched];

    for (const manual of manualMatches) {
      // Find and remove from unmatched
      const unmatchedIndex = newUnmatched.findIndex(u => u.rowIndex === manual.rowIndex);
      if (unmatchedIndex !== -1) {
        const unmatchedRow = newUnmatched[unmatchedIndex];
        newUnmatched.splice(unmatchedIndex, 1);

        // Add to matched
        newMatched.push({
          rowIndex: manual.rowIndex,
          rowData: unmatchedRow.rowData,
          customerId: manual.customerId,
          customerName: manual.customerName,
          matchConfidence: 1.0,
          matchType: 'exact', // Manual match is considered exact
        });
      }
    }

    const totalRows = newMatched.length + newUnmatched.length;
    const matchRate = totalRows > 0 ? (newMatched.length / totalRows) * 100 : 0;

    return {
      matched: newMatched,
      unmatched: newUnmatched,
      matchRate: Math.round(matchRate * 10) / 10,
    };
  }

  /**
   * Load all customers from database
   */
  private async loadCustomers(): Promise<CustomerRecord[]> {
    // Check cache first
    const cacheKey = 'all_customers';
    const cached = this.customerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.supabase) {
      // Return mock customers for testing
      const mockCustomers: CustomerRecord[] = [
        { id: 'cust-1', name: 'Acme Corp', email: 'contact@acme.com', arr: 50000, healthScore: 72 },
        { id: 'cust-2', name: 'Beta Inc', email: 'info@beta.com', arr: 75000, healthScore: 85 },
        { id: 'cust-3', name: 'TechStart', email: 'hello@techstart.io', arr: 25000, healthScore: 78 },
        { id: 'cust-4', name: 'Delta Co', email: 'sales@deltaco.com', arr: 100000, healthScore: 65 },
        { id: 'cust-5', name: 'Omega LLC', email: 'team@omega.co', arr: 60000, healthScore: 81 },
        { id: 'cust-6', name: 'Zeta Corp', email: 'contact@zetacorp.com', arr: 45000, healthScore: 45 },
      ];
      this.customerCache.set(cacheKey, mockCustomers);
      return mockCustomers;
    }

    const { data, error } = await this.supabase
      .from('customers')
      .select('id, name, primary_contact_email, arr, health_score, stage');

    if (error) {
      console.error('Failed to load customers:', error);
      return [];
    }

    const customers: CustomerRecord[] = (data || []).map(c => ({
      id: c.id,
      name: c.name,
      email: c.primary_contact_email,
      arr: c.arr,
      healthScore: c.health_score,
      stage: c.stage,
    }));

    // Cache for 5 minutes
    this.customerCache.set(cacheKey, customers);
    setTimeout(() => this.customerCache.delete(cacheKey), 5 * 60 * 1000);

    return customers;
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, ''); // Remove special characters
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    // Create distance matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity score (0-1) between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Find best fuzzy match for a name
   */
  private findBestFuzzyMatch(
    searchName: string,
    customers: CustomerRecord[],
    threshold: number
  ): { customer: CustomerRecord; similarity: number } | null {
    let bestMatch: { customer: CustomerRecord; similarity: number } | null = null;

    for (const customer of customers) {
      const similarity = this.calculateSimilarity(searchName, customer.name);

      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { customer, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Find suggestions for unmatched rows
   */
  private findSuggestions(
    searchValue: string,
    customers: CustomerRecord[],
    maxSuggestions: number
  ): Array<{ customerId: string; customerName: string; similarity: number }> {
    const scored = customers.map(customer => ({
      customerId: customer.id,
      customerName: customer.name,
      similarity: this.calculateSimilarity(searchValue, customer.name),
    }));

    // Sort by similarity descending and take top N
    return scored
      .filter(s => s.similarity > 0.3) // Only include somewhat relevant suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions);
  }

  /**
   * Clear customer cache (useful after updates)
   */
  clearCache(): void {
    this.customerCache.clear();
  }
}

// Singleton instance
export const customerMatcher = new CustomerMatcherService();
export default customerMatcher;
