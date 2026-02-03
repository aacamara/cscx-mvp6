/**
 * Quiet Account Alert Types
 * PRD-106: Detect and alert on accounts with extended silence
 *
 * Monitors for accounts lacking meaningful CSM interaction:
 * - Meetings, emails, support tickets, CSM notes
 * - Segment-specific thresholds (Enterprise: 21d, Mid-Market: 30d, SMB: 45d)
 * - Escalation at 60+ days of silence
 */
export const DEFAULT_QUIET_THRESHOLDS = {
    enterprise: 21,
    'mid-market': 30,
    smb: 45,
    startup: 45,
    escalation: 60,
};
export const DEFAULT_QUIET_ACCOUNT_CONFIG = {
    thresholds: DEFAULT_QUIET_THRESHOLDS,
    excludedStages: ['churned', 'onboarding', 'implementation'],
    excludedReasons: ['seasonal_business', 'known_hiatus', 'contract_pause'],
    alertSchedule: '0 9 * * 1', // Monday 9 AM
    enableSlackAlerts: true,
    enableEmailAlerts: false,
    autoCreateTasks: true,
    taskDueDateOffsetDays: 5,
};
//# sourceMappingURL=quietAccount.js.map