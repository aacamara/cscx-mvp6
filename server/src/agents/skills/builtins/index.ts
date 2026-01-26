/**
 * Built-in Skills Index
 * Exports all built-in skills for the CSCX.AI platform
 */

export { kickoffMeetingSkill } from './kickoff-meeting.js';
export { welcomeEmailSkill } from './welcome-email.js';
export { onboardingChecklistSkill } from './onboarding-checklist.js';
export { healthCheckSkill } from './health-check.js';
export { renewalPrepSkill } from './renewal-prep.js';

import { Skill } from '../types.js';
import { kickoffMeetingSkill } from './kickoff-meeting.js';
import { welcomeEmailSkill } from './welcome-email.js';
import { onboardingChecklistSkill } from './onboarding-checklist.js';
import { healthCheckSkill } from './health-check.js';
import { renewalPrepSkill } from './renewal-prep.js';

/**
 * All built-in skills
 */
export const BUILTIN_SKILLS: Skill[] = [
  kickoffMeetingSkill,
  welcomeEmailSkill,
  onboardingChecklistSkill,
  healthCheckSkill,
  renewalPrepSkill,
];

/**
 * Get built-in skill by ID
 */
export function getBuiltinSkill(skillId: string): Skill | undefined {
  return BUILTIN_SKILLS.find(s => s.id === skillId);
}

/**
 * Get all built-in skill IDs
 */
export function getBuiltinSkillIds(): string[] {
  return BUILTIN_SKILLS.map(s => s.id);
}
