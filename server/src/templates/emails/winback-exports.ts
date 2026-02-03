/**
 * Win-Back Campaign Templates Exports (PRD-030)
 * Re-exported through index.ts for convenience
 */

export { generateWinbackDay1Email, type WinbackDay1Variables } from './winback-day1.js';
export { generateWinbackDay7Email, type WinbackDay7Variables } from './winback-day7.js';
export { generateWinbackDay14Email, type WinbackDay14Variables } from './winback-day14.js';
export { generateWinbackDay21Email, type WinbackDay21Variables } from './winback-day21.js';
export { generateWinbackDay28Email, type WinbackDay28Variables } from './winback-day28.js';

export type WinbackSequenceDay = 1 | 7 | 14 | 21 | 28;

export interface WinbackSequenceEmail {
  day: WinbackSequenceDay;
  dayOffset: number;
  purpose: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sendTime: string;
}

export const WINBACK_SEQUENCE_TEMPLATE = {
  name: 'Win-Back Campaign',
  type: 'winback',
  description: '5-email sequence to re-engage churned customers over 28 days',
  emails: [
    { day: 1, dayOffset: 0, purpose: 'reconnect', sendTime: '09:00', description: 'Personal reconnection, acknowledge time passed' },
    { day: 7, dayOffset: 6, purpose: 'value_reminder', sendTime: '10:00', description: 'Highlight past successes and ROI' },
    { day: 14, dayOffset: 13, purpose: 'new_capabilities', sendTime: '10:00', description: 'Product updates addressing their needs' },
    { day: 21, dayOffset: 20, purpose: 'social_proof', sendTime: '10:00', description: 'Case study and special offer' },
    { day: 28, dayOffset: 27, purpose: 'invitation', sendTime: '09:00', description: 'Low-pressure coffee invitation' },
  ] as const,
};
