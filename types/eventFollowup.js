/**
 * Event Follow-Up Types
 * PRD-055: Webinar/Event Follow-Up Sequence
 *
 * Types for post-event follow-up sequences based on attendance status.
 */
// ============================================
// Sequence Template Metadata
// ============================================
export const EVENT_FOLLOWUP_ATTENDED_TEMPLATE = {
    name: 'Event Follow-Up - Attended',
    type: 'event_followup_attended',
    description: '3-email sequence for customers who attended an event',
    emails: [
        { day: 1, dayOffset: 0, emailType: 'thank_you', sendTime: '10:00', description: 'Thank You & Key Takeaways' },
        { day: 3, dayOffset: 2, emailType: 'resources', sendTime: '09:00', description: 'Resources & Toolkit' },
        { day: 7, dayOffset: 6, emailType: 'discussion', sendTime: '10:00', description: 'Personalized Discussion Offer' },
    ],
};
export const EVENT_FOLLOWUP_MISSED_TEMPLATE = {
    name: 'Event Follow-Up - Missed',
    type: 'event_followup_missed',
    description: '2-email sequence for customers who registered but missed an event',
    emails: [
        { day: 1, dayOffset: 0, emailType: 'recording', sendTime: '10:00', description: 'Recording & Summary' },
        { day: 4, dayOffset: 3, emailType: 'highlights', sendTime: '09:00', description: 'Key Highlights & Quick Start' },
    ],
};
//# sourceMappingURL=eventFollowup.js.map