/**
 * Email Templates Index
 * PRD-026: One-Click QBR Email Generation
 * PRD-028: Onboarding Welcome Sequence
 * PRD-031: Executive Sponsor Outreach
 * PRD-032: Champion Nurture Sequence
 * PRD-033: Product Update Announcements
 * PRD-035: Thank You Note Generator
 * PRD-037: Feedback/Testimonial Request
 * PRD-044: Multi-Threading Introduction
 * PRD-048: Case Study Request
 */

// QBR Templates (PRD-026)
export { generateQBRInviteEmail, type QBRInviteData, type QBRInviteResult } from './qbr-invite.js';
export { generateQBRFollowupEmail, type QBRFollowupData, type QBRFollowupResult } from './qbr-followup.js';

// Welcome Sequence Templates (PRD-028)
export { generateWelcomeDay1Email, type WelcomeDay1Variables } from './welcome-day1.js';
export { generateWelcomeDay3Email, type WelcomeDay3Variables } from './welcome-day3.js';
export { generateWelcomeDay7Email, type WelcomeDay7Variables } from './welcome-day7.js';
export { generateWelcomeDay14Email, type WelcomeDay14Variables } from './welcome-day14.js';
export { generateWelcomeDay30Email, type WelcomeDay30Variables } from './welcome-day30.js';

// Executive Outreach Templates (PRD-031)
export { generateExecutiveIntroEmail, type ExecutiveIntroData, type ExecutiveIntroResult } from './executive-intro.js';
export { generateExecutiveBriefingEmail, type ExecutiveBriefingData, type ExecutiveBriefingResult } from './executive-briefing.js';
export { generateExecutiveStrategicEmail, type ExecutiveStrategicData, type ExecutiveStrategicResult } from './executive-strategic.js';

// Champion Nurture Sequence Templates (PRD-032)
export { generateChampionRecognitionEmail, type ChampionRecognitionVariables } from './champion-recognition.js';
export { generateChampionExclusiveEmail, type ChampionExclusiveVariables } from './champion-exclusive.js';
export { generateChampionCareerEmail, type ChampionCareerVariables } from './champion-career.js';
export { generateChampionCommunityEmail, type ChampionCommunityVariables } from './champion-community.js';
export { generateChampionCheckinEmail, type ChampionCheckinVariables } from './champion-checkin.js';

// Product Update Announcement Templates (PRD-033)
export { generateProductUpdateEmail, type ProductUpdateVariables, type ProductUpdateResult } from './product-update.js';
export { generateFeatureAnnouncementEmail, type FeatureAnnouncementVariables, type FeatureAnnouncementResult } from './feature-announcement.js';

// Testimonial/Feedback Request Templates (PRD-037)
export { generateTestimonialRequestEmail, type TestimonialRequestData, type TestimonialRequestResult } from './testimonial-request.js';
export { generateReviewRequestEmail, type ReviewRequestData, type ReviewRequestResult } from './review-request.js';
export { generateReferenceRequestEmail, type ReferenceRequestData, type ReferenceRequestResult } from './reference-request.js';

// Reference Request Templates (PRD-043)
export { generateReferenceSpecificEmail, type ReferenceSpecificData, type ReferenceSpecificResult } from './reference-specific.js';

// Thank You Note Templates (PRD-035)
export { generateThankYouReferralEmail, type ThankYouReferralVariables, DEFAULT_REFERRAL_GESTURES } from './thank-you-referral.js';
export { generateThankYouRenewalEmail, type ThankYouRenewalVariables } from './thank-you-renewal.js';
export { generateThankYouFeedbackEmail, type ThankYouFeedbackVariables } from './thank-you-feedback.js';
export { generateThankYouCaseStudyEmail, type ThankYouCaseStudyVariables, DEFAULT_ADVOCACY_GESTURES } from './thank-you-case-study.js';
export { generateThankYouGeneralEmail, type ThankYouGeneralVariables, SUGGESTED_OCCASIONS } from './thank-you-general.js';

// Multi-Threading Introduction Templates (PRD-044)
export { generateIntroRequestEmail, type IntroRequestData, type IntroRequestResult } from './intro-request.js';
export { generateIntroDraftEmail, generateRoleBasedIntroDraft, INTRO_DRAFT_PRESETS, type IntroDraftData, type IntroDraftResult, type IntroDraftPreset } from './intro-draft.js';

// Case Study Request Templates (PRD-048)
export { generateCaseStudyRequestEmail, type CaseStudyRequestData, type CaseStudyRequestResult } from './case-study-request.js';
export { generateCaseStudyFollowupEmail, type CaseStudyFollowupData, type CaseStudyFollowupResult, type CaseStudyFollowupType } from './case-study-followup.js';

// Template type definitions
export type WelcomeSequenceDay = 1 | 3 | 7 | 14 | 30;

export interface WelcomeSequenceEmail {
  day: WelcomeSequenceDay;
  dayOffset: number;
  purpose: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sendTime: string;
}

// Template metadata for the welcome sequence
export const WELCOME_SEQUENCE_TEMPLATE = {
  name: 'Welcome Sequence',
  type: 'welcome',
  description: '5-email sequence for new customer onboarding over 30 days',
  emails: [
    { day: 1, dayOffset: 0, purpose: 'welcome', sendTime: '09:00', description: 'Welcome & CSM Introduction' },
    { day: 3, dayOffset: 2, purpose: 'kickoff_prep', sendTime: '08:00', description: 'Kickoff Meeting Preparation' },
    { day: 7, dayOffset: 6, purpose: 'resources', sendTime: '10:00', description: 'Resource Kit & Training Links' },
    { day: 14, dayOffset: 13, purpose: 'check_in', sendTime: '10:00', description: 'Two-Week Progress Check-In' },
    { day: 30, dayOffset: 29, purpose: 'milestone', sendTime: '10:00', description: '30-Day Milestone Celebration' },
  ] as const,
};

// Champion Nurture Sequence Types (PRD-032)
export type ChampionNurtureEmailType = 'recognition' | 'exclusive' | 'career' | 'community' | 'checkin';

export interface ChampionNurtureEmail {
  week: number;
  dayOffset: number;
  purpose: ChampionNurtureEmailType;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sendTime: string;
}

// Template metadata for the champion nurture sequence
export const CHAMPION_NURTURE_SEQUENCE_TEMPLATE = {
  name: 'Champion Nurture Sequence',
  type: 'champion_nurture',
  description: '5-email sequence for nurturing customer champions over 8 weeks',
  emails: [
    { week: 0, dayOffset: 0, purpose: 'recognition', sendTime: '10:00', description: 'Recognition & Appreciation' },
    { week: 2, dayOffset: 14, purpose: 'exclusive', sendTime: '09:00', description: 'Exclusive Preview Access' },
    { week: 4, dayOffset: 28, purpose: 'career', sendTime: '10:00', description: 'Career Development & Visibility' },
    { week: 6, dayOffset: 42, purpose: 'community', sendTime: '10:00', description: 'Champion Community Invitation' },
    { week: 8, dayOffset: 56, purpose: 'checkin', sendTime: '14:00', description: 'Personal Check-in & Connection' },
  ] as const,
};

// Thank You Note Types (PRD-035)
export type ThankYouOccasion =
  | 'referral'
  | 'case_study'
  | 'positive_feedback'
  | 'renewal'
  | 'onboarding_complete'
  | 'speaking_event'
  | 'product_feedback'
  | 'general';

export interface ThankYouGesture {
  id: string;
  label: string;
}

// Template metadata for thank you notes
export const THANK_YOU_NOTE_TEMPLATES = {
  name: 'Thank You Notes',
  type: 'thank_you',
  description: 'Personalized thank you notes for various customer contributions',
  occasions: [
    { occasion: 'referral', template: 'thank-you-referral', description: 'Referral to new customer' },
    { occasion: 'case_study', template: 'thank-you-case-study', description: 'Case study or advocacy participation' },
    { occasion: 'positive_feedback', template: 'thank-you-feedback', description: 'NPS or positive feedback' },
    { occasion: 'renewal', template: 'thank-you-renewal', description: 'Contract renewal' },
    { occasion: 'onboarding_complete', template: 'thank-you-general', description: 'Successful onboarding completion' },
    { occasion: 'speaking_event', template: 'thank-you-case-study', description: 'Speaking at event or webinar' },
    { occasion: 'product_feedback', template: 'thank-you-feedback', description: 'Valuable product feedback' },
    { occasion: 'general', template: 'thank-you-general', description: 'General appreciation' },
  ] as const,
};
