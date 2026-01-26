/**
 * Skill Registry
 * Central registry for storing and looking up skills
 */

import {
  Skill,
  SkillCategory,
  SkillRegistryEntry,
  SkillSearchResult,
} from './types.js';
import { BUILTIN_SKILLS } from './builtins/index.js';

// ============================================
// Skill Registry
// ============================================

export class SkillRegistry {
  private skills: Map<string, SkillRegistryEntry> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> skill IDs

  constructor() {
    // Load built-in skills on initialization
    this.loadBuiltinSkills();
  }

  /**
   * Load built-in skills into the registry
   */
  private loadBuiltinSkills(): void {
    for (const skill of BUILTIN_SKILLS) {
      this.register(skill, '1.0.0');
    }
    console.log(`[SkillRegistry] Loaded ${BUILTIN_SKILLS.length} built-in skills`);
  }

  /**
   * Register a skill
   */
  register(skill: Skill, version: string = '1.0.0'): void {
    const entry: SkillRegistryEntry = {
      skill,
      enabled: true,
      version,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.skills.set(skill.id, entry);

    // Index keywords for search
    for (const keyword of skill.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (!this.keywordIndex.has(normalizedKeyword)) {
        this.keywordIndex.set(normalizedKeyword, new Set());
      }
      this.keywordIndex.get(normalizedKeyword)!.add(skill.id);
    }
  }

  /**
   * Unregister a skill
   */
  unregister(skillId: string): boolean {
    const entry = this.skills.get(skillId);
    if (!entry) return false;

    // Remove from keyword index
    for (const keyword of entry.skill.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      const skillIds = this.keywordIndex.get(normalizedKeyword);
      if (skillIds) {
        skillIds.delete(skillId);
        if (skillIds.size === 0) {
          this.keywordIndex.delete(normalizedKeyword);
        }
      }
    }

    this.skills.delete(skillId);
    return true;
  }

  /**
   * Get a skill by ID
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId)?.skill;
  }

  /**
   * Get a skill entry with metadata
   */
  getEntry(skillId: string): SkillRegistryEntry | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
      .filter(e => e.enabled)
      .map(e => e.skill);
  }

  /**
   * Get all skill entries
   */
  getAllEntries(): SkillRegistryEntry[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): Skill[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Enable/disable a skill
   */
  setEnabled(skillId: string, enabled: boolean): boolean {
    const entry = this.skills.get(skillId);
    if (!entry) return false;

    entry.enabled = enabled;
    entry.updatedAt = new Date();
    return true;
  }

  /**
   * Check if a skill exists
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * Search skills by keyword or description
   */
  search(query: string): SkillSearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();
    const results: Map<string, SkillSearchResult> = new Map();

    // Direct keyword match
    for (const [keyword, skillIds] of this.keywordIndex.entries()) {
      if (keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword)) {
        for (const skillId of skillIds) {
          const entry = this.skills.get(skillId);
          if (entry && entry.enabled) {
            const existing = results.get(skillId);
            const matchScore = keyword === normalizedQuery ? 10 : 5;

            if (existing) {
              existing.matchScore += matchScore;
              existing.matchedKeywords.push(keyword);
            } else {
              results.set(skillId, {
                skill: entry.skill,
                matchScore,
                matchedKeywords: [keyword],
              });
            }
          }
        }
      }
    }

    // Fuzzy match on name and description
    for (const entry of this.skills.values()) {
      if (!entry.enabled) continue;

      const nameMatch = entry.skill.name.toLowerCase().includes(normalizedQuery);
      const descMatch = entry.skill.description.toLowerCase().includes(normalizedQuery);

      if (nameMatch || descMatch) {
        const existing = results.get(entry.skill.id);
        const matchScore = nameMatch ? 8 : 3;

        if (existing) {
          existing.matchScore += matchScore;
        } else {
          results.set(entry.skill.id, {
            skill: entry.skill,
            matchScore,
            matchedKeywords: [],
          });
        }
      }
    }

    // Sort by match score descending
    return Array.from(results.values()).sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Find the best matching skill for user input
   */
  findMatchingSkill(userInput: string): SkillSearchResult | null {
    const results = this.search(userInput);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get skill count
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Get enabled skill count
   */
  enabledCount(): number {
    return Array.from(this.skills.values()).filter(e => e.enabled).length;
  }

  /**
   * Get skill IDs
   */
  getIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get skills summary for UI
   */
  getSummary(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: SkillCategory;
    enabled: boolean;
    cacheable: boolean;
    estimatedDurationSeconds: number;
    estimatedCostSavingsPercent: number;
  }> {
    return Array.from(this.skills.values()).map(entry => ({
      id: entry.skill.id,
      name: entry.skill.name,
      description: entry.skill.description,
      icon: entry.skill.icon,
      category: entry.skill.category,
      enabled: entry.enabled,
      cacheable: entry.skill.cacheable.enabled,
      estimatedDurationSeconds: entry.skill.estimatedDurationSeconds,
      estimatedCostSavingsPercent: entry.skill.estimatedCostSavingsPercent,
    }));
  }
}

// Export singleton
export const skillRegistry = new SkillRegistry();
