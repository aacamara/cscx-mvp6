/**
 * Thank You Note Routes
 * PRD-035: Thank You Note Generator
 *
 * API endpoints for generating and sending personalized thank you notes
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { gmailService } from '../services/google/gmail.js';
import { googleOAuth } from '../services/google/oauth.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import {
  generateThankYouReferralEmail,
  generateThankYouRenewalEmail,
  generateThankYouFeedbackEmail,
  generateThankYouCaseStudyEmail,
  generateThankYouGeneralEmail,
  DEFAULT_REFERRAL_GESTURES,
  DEFAULT_ADVOCACY_GESTURES,
  SUGGESTED_OCCASIONS,
  type ThankYouOccasion,
} from '../templates/emails/index.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
interface ThankYouGenerateRequest {
  occasion: ThankYouOccasion;
  stakeholderId?: string;
  recipientEmail?: string;
  recipientName?: string;

  // Referral-specific
  referredCompanyName?: string;
  referralDate?: string;
  referralStatus?: 'pipeline' | 'demo_scheduled' | 'closed_won' | 'active';

  // Renewal-specific
  contractTerm?: string;
  keyAchievements?: string[];
  upcomingFeatures?: string[];

  // Feedback-specific
  feedbackType?: 'nps' | 'review' | 'testimonial' | 'survey' | 'general';
  npsScore?: number;
  feedbackHighlight?: string;

  // Case study-specific
  caseStudyTitle?: string;
  participationType?: 'case_study' | 'reference' | 'speaking_event' | 'webinar' | 'podcast';
  eventName?: string;
  eventDate?: string;
  caseStudyUrl?: string;
  keyMetricsHighlighted?: string[];
  audienceReach?: string;

  // General
  customOccasion?: string;
  specificDetails?: string;
  personalTouch?: string;
  futureCommitment?: string;

  // Gesture options
  includeGesture?: boolean;
  gestureOptions?: Array<{ id: string; label: string }>;
}

interface ThankYouSendRequest extends ThankYouGenerateRequest {
  cc?: string[];
  bcc?: string[];
}

/**
 * GET /api/customers/:id/thank-you/preview
 * Generate a preview of the thank you note without sending
 */
router.get('/:id/thank-you/preview', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const {
      occasion = 'general',
      stakeholderId,
      recipientEmail,
      recipientName,
      ...options
    } = req.query as unknown as ThankYouGenerateRequest;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const userId = req.headers['x-user-id'] as string || req.query.userId as string;

    // Fetch customer data
    let previewCustQuery = supabase.from('customers').select('*');
    previewCustQuery = applyOrgFilter(previewCustQuery, req);
    const { data: customer, error: customerError } = await previewCustQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fetch stakeholder if provided
    let stakeholder = null;
    if (stakeholderId) {
      const { data } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('id', stakeholderId)
        .single();
      stakeholder = data;
    }

    // Get CSM info
    let csmInfo = {
      name: 'Your Customer Success Team',
      email: '',
      title: 'Customer Success Manager',
    };

    if (userId) {
      try {
        const tokens = await googleOAuth.getTokens(userId);
        if (tokens?.google_email) {
          csmInfo.email = tokens.google_email;
          const name = tokens.google_email.split('@')[0].replace(/[._]/g, ' ');
          csmInfo.name = name.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      } catch (err) {
        // Use default CSM info
      }
    }

    // Determine recipient
    const recipient = {
      name: recipientName || stakeholder?.name || customer.primary_contact_name || 'Valued Customer',
      email: recipientEmail || stakeholder?.email || customer.primary_contact_email || '',
    };

    // Check throttling
    const throttleResult = await checkThrottling(customerId, stakeholderId || undefined, occasion as ThankYouOccasion);

    // Generate email based on occasion
    const emailData = await generateThankYouEmail(
      occasion as ThankYouOccasion,
      {
        recipientName: recipient.name,
        customerName: customer.name,
        csmName: csmInfo.name,
        csmTitle: csmInfo.title,
        companyName: 'CSCX.AI',
        yearsAsCustomer: calculateYearsAsCustomer(customer.created_at),
        ...options,
      }
    );

    res.json({
      success: true,
      data: {
        preview: {
          to: recipient.email,
          subject: emailData.subject,
          bodyHtml: emailData.bodyHtml,
          bodyText: emailData.bodyText,
        },
        occasion,
        customer: {
          id: customerId,
          name: customer.name,
        },
        stakeholder: stakeholder ? {
          id: stakeholder.id,
          name: stakeholder.name,
          email: stakeholder.email,
          role: stakeholder.role,
        } : null,
        recipient,
        throttling: throttleResult,
        suggestedGestures: getGesturesForOccasion(occasion as ThankYouOccasion),
      },
    });
  } catch (error) {
    console.error('Error generating thank you preview:', error);
    res.status(500).json({
      error: { code: 'GENERATION_ERROR', message: 'Failed to generate thank you preview' }
    });
  }
});

/**
 * POST /api/customers/:id/thank-you
 * Generate and optionally send a thank you note
 */
router.post('/:id/thank-you', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const {
      occasion = 'general',
      stakeholderId,
      recipientEmail,
      recipientName,
      cc,
      bcc,
      ...options
    } = req.body as ThankYouSendRequest;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const userId = req.headers['x-user-id'] as string || req.query.userId as string;
    const sendNow = req.query.send === 'true';

    // Fetch customer data
    let sendCustQuery = supabase.from('customers').select('*');
    sendCustQuery = applyOrgFilter(sendCustQuery, req);
    const { data: customer, error: customerError } = await sendCustQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fetch stakeholder if provided
    let stakeholder = null;
    if (stakeholderId) {
      const { data } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('id', stakeholderId)
        .single();
      stakeholder = data;
    }

    // Get CSM info
    let csmInfo = {
      name: 'Your Customer Success Team',
      email: '',
      title: 'Customer Success Manager',
    };

    if (userId) {
      try {
        const tokens = await googleOAuth.getTokens(userId);
        if (tokens?.google_email) {
          csmInfo.email = tokens.google_email;
          const name = tokens.google_email.split('@')[0].replace(/[._]/g, ' ');
          csmInfo.name = name.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      } catch (err) {
        // Use default CSM info
      }
    }

    // Determine recipient
    const recipient = {
      name: recipientName || stakeholder?.name || customer.primary_contact_name || 'Valued Customer',
      email: recipientEmail || stakeholder?.email || customer.primary_contact_email || '',
    };

    if (!recipient.email) {
      return res.status(400).json({
        error: { code: 'NO_RECIPIENT', message: 'No recipient email provided' }
      });
    }

    // Check throttling (warn but don't block)
    const throttleResult = await checkThrottling(customerId, stakeholderId || undefined, occasion as ThankYouOccasion);

    // Generate email
    const emailData = await generateThankYouEmail(
      occasion as ThankYouOccasion,
      {
        recipientName: recipient.name,
        customerName: customer.name,
        csmName: csmInfo.name,
        csmTitle: csmInfo.title,
        companyName: 'CSCX.AI',
        yearsAsCustomer: calculateYearsAsCustomer(customer.created_at),
        ...options,
      }
    );

    let emailMessageId: string | null = null;
    let sentAt: Date | null = null;

    // Send if requested and user is authenticated
    if (sendNow && userId) {
      try {
        emailMessageId = await gmailService.sendEmail(userId, {
          to: [recipient.email],
          cc: cc || [],
          bcc: bcc || [],
          subject: emailData.subject,
          bodyHtml: emailData.bodyHtml,
          bodyText: emailData.bodyText,
        });
        sentAt = new Date();
      } catch (sendError) {
        console.error('Error sending thank you email:', sendError);
        // Don't fail the entire request, just note that sending failed
      }
    }

    // Log the thank you note
    const { data: logEntry, error: logError } = await supabase
      .from('thank_you_log')
      .insert({
        customer_id: customerId,
        stakeholder_id: stakeholderId || null,
        occasion,
        occasion_details: {
          ...options,
          recipientName: recipient.name,
        },
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        subject: emailData.subject,
        body_preview: emailData.bodyText.substring(0, 500),
        email_message_id: emailMessageId,
        gesture_offered: options.gestureOptions ? options.gestureOptions.map(g => g.label).join(', ') : null,
        sent_at: sentAt || new Date(),
        csm_id: userId || null,
        metadata: {
          sent: !!emailMessageId,
          throttle_warning: throttleResult.should_throttle,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging thank you note:', logError);
    }

    res.json({
      success: true,
      data: {
        id: logEntry?.id,
        email: {
          to: recipient.email,
          cc: cc || [],
          subject: emailData.subject,
          bodyHtml: emailData.bodyHtml,
          bodyText: emailData.bodyText,
        },
        sent: !!emailMessageId,
        emailMessageId,
        sentAt: sentAt?.toISOString(),
        occasion,
        customer: {
          id: customerId,
          name: customer.name,
        },
        recipient,
        throttling: throttleResult,
      },
    });
  } catch (error) {
    console.error('Error generating/sending thank you note:', error);
    res.status(500).json({
      error: { code: 'GENERATION_ERROR', message: 'Failed to generate thank you note' }
    });
  }
});

/**
 * GET /api/customers/:id/thank-you-history
 * Get history of thank you notes sent to a customer
 */
router.get('/:id/thank-you-history', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { limit = '20', offset = '0', stakeholderId } = req.query;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    let query = supabase
      .from('thank_you_log')
      .select(`
        *,
        stakeholders:stakeholder_id (
          id,
          name,
          email,
          role
        )
      `);
    query = applyOrgFilter(query, req);
    query = query
      .eq('customer_id', customerId)
      .order('sent_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (stakeholderId) {
      query = query.eq('stakeholder_id', stakeholderId);
    }

    const { data: history, error, count } = await query;

    if (error) {
      console.error('Error fetching thank you history:', error);
      return res.status(500).json({
        error: { code: 'FETCH_ERROR', message: 'Failed to fetch thank you history' }
      });
    }

    // Get throttle status
    const throttleResult = await checkThrottling(customerId, stakeholderId as string | undefined);

    res.json({
      success: true,
      data: {
        history: history || [],
        pagination: {
          total: count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
        throttling: throttleResult,
        summary: {
          total: history?.length || 0,
          last30Days: history?.filter(h =>
            new Date(h.sent_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length || 0,
          byOccasion: groupByOccasion(history || []),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching thank you history:', error);
    res.status(500).json({
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch thank you history' }
    });
  }
});

/**
 * GET /api/customers/:id/thank-you/occasions
 * Get suggested thank you occasions for a customer based on their activity
 */
router.get('/:id/thank-you/occasions', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Fetch customer data
    let occasionCustQuery = supabase.from('customers').select('*');
    occasionCustQuery = applyOrgFilter(occasionCustQuery, req);
    const { data: customer, error: customerError } = await occasionCustQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Get recent thank yous to avoid duplicate occasions
    const { data: recentThankYous } = await supabase
      .from('thank_you_log')
      .select('occasion, sent_at')
      .eq('customer_id', customerId)
      .gte('sent_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString());

    const recentOccasions = new Set((recentThankYous || []).map(t => t.occasion));

    // Build suggested occasions based on customer data
    const suggestions: Array<{
      occasion: ThankYouOccasion;
      reason: string;
      priority: 'high' | 'medium' | 'low';
      alreadyThanked: boolean;
    }> = [];

    // Check for renewal (if within 30 days of renewal date)
    if (customer.renewal_date) {
      const renewalDate = new Date(customer.renewal_date);
      const daysSinceRenewal = (Date.now() - renewalDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceRenewal >= 0 && daysSinceRenewal <= 30) {
        suggestions.push({
          occasion: 'renewal',
          reason: `Recently renewed on ${renewalDate.toLocaleDateString()}`,
          priority: 'high',
          alreadyThanked: recentOccasions.has('renewal'),
        });
      }
    }

    // Check for high NPS/feedback
    if (customer.nps_score && customer.nps_score >= 9) {
      suggestions.push({
        occasion: 'positive_feedback',
        reason: `High NPS score of ${customer.nps_score}`,
        priority: 'high',
        alreadyThanked: recentOccasions.has('positive_feedback'),
      });
    }

    // Check for successful onboarding
    if (customer.stage === 'active' && customer.onboarding_completed_at) {
      const onboardingDate = new Date(customer.onboarding_completed_at);
      const daysSinceOnboarding = (Date.now() - onboardingDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceOnboarding <= 14) {
        suggestions.push({
          occasion: 'onboarding_complete',
          reason: 'Recently completed onboarding',
          priority: 'medium',
          alreadyThanked: recentOccasions.has('onboarding_complete'),
        });
      }
    }

    // Always include general as an option
    suggestions.push({
      occasion: 'general',
      reason: 'General appreciation for partnership',
      priority: 'low',
      alreadyThanked: false,
    });

    res.json({
      success: true,
      data: {
        suggestions,
        allOccasions: [
          { occasion: 'referral', label: 'Referral', description: 'Customer referred new business' },
          { occasion: 'case_study', label: 'Case Study', description: 'Participated in case study or advocacy' },
          { occasion: 'positive_feedback', label: 'Positive Feedback', description: 'Gave high NPS or positive feedback' },
          { occasion: 'renewal', label: 'Renewal', description: 'Renewed their contract' },
          { occasion: 'onboarding_complete', label: 'Onboarding Complete', description: 'Successfully completed onboarding' },
          { occasion: 'speaking_event', label: 'Speaking Event', description: 'Spoke at event, webinar, or podcast' },
          { occasion: 'product_feedback', label: 'Product Feedback', description: 'Provided valuable product feedback' },
          { occasion: 'general', label: 'General', description: 'General appreciation' },
        ],
        recentThankYous: recentThankYous || [],
      },
    });
  } catch (error) {
    console.error('Error fetching thank you occasions:', error);
    res.status(500).json({
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch thank you occasions' }
    });
  }
});

// ==================== Helper Functions ====================

/**
 * Generate thank you email based on occasion
 */
async function generateThankYouEmail(
  occasion: ThankYouOccasion,
  variables: Record<string, any>
): Promise<{ subject: string; bodyHtml: string; bodyText: string }> {
  switch (occasion) {
    case 'referral':
      return generateThankYouReferralEmail({
        recipientName: variables.recipientName,
        customerName: variables.customerName,
        referredCompanyName: variables.referredCompanyName || 'the company you referred',
        referralDate: variables.referralDate,
        referralStatus: variables.referralStatus,
        yearsAsPartner: variables.yearsAsCustomer,
        csmName: variables.csmName,
        csmTitle: variables.csmTitle,
        companyName: variables.companyName,
        gestureOptions: variables.includeGesture !== false ? (variables.gestureOptions || DEFAULT_REFERRAL_GESTURES) : undefined,
      });

    case 'renewal':
      return generateThankYouRenewalEmail({
        recipientName: variables.recipientName,
        customerName: variables.customerName,
        contractTerm: variables.contractTerm,
        yearsAsCustomer: variables.yearsAsCustomer,
        keyAchievements: variables.keyAchievements,
        upcomingFeatures: variables.upcomingFeatures,
        csmName: variables.csmName,
        csmTitle: variables.csmTitle,
        companyName: variables.companyName,
      });

    case 'positive_feedback':
    case 'product_feedback':
      return generateThankYouFeedbackEmail({
        recipientName: variables.recipientName,
        customerName: variables.customerName,
        feedbackType: variables.feedbackType || (occasion === 'positive_feedback' ? 'nps' : 'general'),
        npsScore: variables.npsScore,
        feedbackHighlight: variables.feedbackHighlight,
        feedbackDate: variables.feedbackDate,
        impactStatement: variables.impactStatement,
        csmName: variables.csmName,
        csmTitle: variables.csmTitle,
        companyName: variables.companyName,
      });

    case 'case_study':
    case 'speaking_event':
      return generateThankYouCaseStudyEmail({
        recipientName: variables.recipientName,
        customerName: variables.customerName,
        caseStudyTitle: variables.caseStudyTitle,
        participationType: variables.participationType || (occasion === 'speaking_event' ? 'speaking_event' : 'case_study'),
        eventName: variables.eventName,
        eventDate: variables.eventDate,
        caseStudyUrl: variables.caseStudyUrl,
        keyMetricsHighlighted: variables.keyMetricsHighlighted,
        audienceReach: variables.audienceReach,
        csmName: variables.csmName,
        csmTitle: variables.csmTitle,
        companyName: variables.companyName,
        gestureOptions: variables.includeGesture !== false ? (variables.gestureOptions || DEFAULT_ADVOCACY_GESTURES) : undefined,
      });

    case 'onboarding_complete':
    case 'general':
    default:
      return generateThankYouGeneralEmail({
        recipientName: variables.recipientName,
        customerName: variables.customerName,
        occasion: variables.customOccasion || getOccasionLabel(occasion),
        specificDetails: variables.specificDetails,
        personalTouch: variables.personalTouch,
        futureCommitment: variables.futureCommitment,
        csmName: variables.csmName,
        csmTitle: variables.csmTitle,
        companyName: variables.companyName,
      });
  }
}

/**
 * Check if we should throttle thank yous
 */
async function checkThrottling(
  customerId: string,
  stakeholderId?: string,
  occasion?: ThankYouOccasion
): Promise<{
  should_throttle: boolean;
  reason: string | null;
  last_thank_you_at: string | null;
  thank_yous_last_30_days: number;
  same_occasion_recent: number;
  days_since_last: number | null;
}> {
  if (!supabase) {
    return {
      should_throttle: false,
      reason: null,
      last_thank_you_at: null,
      thank_yous_last_30_days: 0,
      same_occasion_recent: 0,
      days_since_last: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc('should_throttle_thank_you', {
      p_customer_id: customerId,
      p_stakeholder_id: stakeholderId || null,
      p_occasion: occasion || null,
    });

    if (error) {
      console.error('Error checking throttle:', error);
      return {
        should_throttle: false,
        reason: null,
        last_thank_you_at: null,
        thank_yous_last_30_days: 0,
        same_occasion_recent: 0,
        days_since_last: null,
      };
    }

    return data;
  } catch (err) {
    return {
      should_throttle: false,
      reason: null,
      last_thank_you_at: null,
      thank_yous_last_30_days: 0,
      same_occasion_recent: 0,
      days_since_last: null,
    };
  }
}

/**
 * Get gesture options for an occasion
 */
function getGesturesForOccasion(occasion: ThankYouOccasion): Array<{ id: string; label: string }> {
  switch (occasion) {
    case 'referral':
      return DEFAULT_REFERRAL_GESTURES;
    case 'case_study':
    case 'speaking_event':
      return DEFAULT_ADVOCACY_GESTURES;
    default:
      return [];
  }
}

/**
 * Get human-readable label for an occasion
 */
function getOccasionLabel(occasion: ThankYouOccasion): string {
  const labels: Record<ThankYouOccasion, string> = {
    referral: 'your referral',
    case_study: 'participating in our case study',
    positive_feedback: 'your positive feedback',
    renewal: 'renewing your partnership with us',
    onboarding_complete: 'successfully completing onboarding',
    speaking_event: 'speaking at our event',
    product_feedback: 'your valuable product feedback',
    general: 'your continued partnership',
  };
  return labels[occasion] || 'your continued partnership';
}

/**
 * Calculate years as customer
 */
function calculateYearsAsCustomer(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const years = (now.getTime() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

/**
 * Group history by occasion
 */
function groupByOccasion(history: Array<{ occasion: string }>): Record<string, number> {
  return history.reduce((acc, item) => {
    acc[item.occasion] = (acc[item.occasion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export default router;
