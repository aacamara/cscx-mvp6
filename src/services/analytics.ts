/**
 * Analytics Service
 * Tracks user behavior and feature engagement for compound product launch
 * PRD: Compound Product Launch (CP-002)
 */

import { supabase } from '../../lib/supabase';

// Session ID persists for the browser session
let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    // Check sessionStorage first
    sessionId = sessionStorage.getItem('cscx_session_id');
    if (!sessionId) {
      // Generate new session ID
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('cscx_session_id', sessionId);
    }
  }
  return sessionId;
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export interface AnalyticsEventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export interface AnalyticsEvent {
  event: string;
  properties?: AnalyticsEventProperties;
  userId?: string | null;
  sessionId: string;
  timestamp: string;
}

/**
 * Track an analytics event
 * @param event - Event name (e.g., 'invite_code_entered', 'customer_list_viewed')
 * @param properties - Optional properties object with event-specific data
 */
export async function trackEvent(
  event: string,
  properties?: AnalyticsEventProperties
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const sid = getSessionId();
    const timestamp = new Date().toISOString();

    // Log to Supabase analytics_events table
    if (supabase) {
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event,
          properties: properties || {},
          user_id: userId,
          session_id: sid,
          timestamp,
        });

      if (error) {
        // Don't throw - analytics should never break the app
        console.warn('[Analytics] Failed to track event:', event, error.message);
      }
    }

    // Optional: Send to external analytics (Mixpanel, Amplitude)
    if (typeof window !== 'undefined') {
      // Mixpanel
      if ((window as any).mixpanel) {
        (window as any).mixpanel.track(event, {
          ...properties,
          session_id: sid,
        });
      }
      // Amplitude
      if ((window as any).amplitude) {
        (window as any).amplitude.track(event, {
          ...properties,
          session_id: sid,
        });
      }
    }

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.debug('[Analytics]', event, properties);
    }
  } catch (err) {
    // Silent fail - analytics should never break the app
    console.warn('[Analytics] Error tracking event:', event, err);
  }
}

/**
 * Track page view
 * @param pageName - Name of the page viewed
 * @param path - URL path
 */
export function trackPageView(pageName: string, path: string): void {
  trackEvent('page_viewed', {
    page_name: pageName,
    path,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
  });
}

/**
 * Track feature usage
 * @param featureName - Name of the feature used
 * @param action - Action performed (e.g., 'clicked', 'opened', 'completed')
 */
export function trackFeature(featureName: string, action: string): void {
  trackEvent('feature_used', {
    feature_name: featureName,
    action,
  });
}

/**
 * Track error occurrence
 * @param errorType - Type of error
 * @param errorMessage - Error message
 * @param context - Additional context
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  context?: AnalyticsEventProperties
): void {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
  });
}

// Pre-defined event tracking functions for compound product launch

/** Track invite code entry */
export function trackInviteCodeEntered(code: string): void {
  trackEvent('invite_code_entered', {
    code_length: code.length,
  });
}

/** Track invite code validation result */
export function trackInviteCodeValidated(valid: boolean, code: string): void {
  trackEvent('invite_code_validated', {
    valid,
    code_masked: code.slice(0, 2) + '***',
  });
}

/** Track Google Sign-In started */
export function trackGoogleSignInStarted(): void {
  trackEvent('google_signin_started');
}

/** Track Google Sign-In completed */
export function trackGoogleSignInCompleted(success: boolean): void {
  trackEvent('google_signin_completed', { success });
}

/** Track customer list viewed */
export function trackCustomerListViewed(count: number): void {
  trackEvent('customer_list_viewed', { customer_count: count });
}

/** Track CSV template downloaded */
export function trackCsvTemplateDownloaded(): void {
  trackEvent('csv_template_downloaded');
}

/** Track CSV import completed */
export function trackCsvImportCompleted(count: number, errors: number): void {
  trackEvent('csv_import_completed', {
    imported_count: count,
    error_count: errors,
  });
}

/** Track onboarding started */
export function trackOnboardingStarted(customerId?: string): void {
  trackEvent('onboarding_started', {
    customer_id: customerId,
    has_customer: !!customerId,
  });
}

/** Track welcome modal shown */
export function trackWelcomeModalShown(): void {
  trackEvent('welcome_modal_shown');
}

/** Track welcome modal dismissed */
export function trackWelcomeModalDismissed(timeOnModal: number): void {
  trackEvent('welcome_modal_dismissed', {
    time_on_modal_ms: timeOnModal,
  });
}

/** Track feature exploration */
export function trackFeatureExplored(featureName: string): void {
  trackEvent('feature_explored', {
    feature_name: featureName,
  });
}

/** Track contract upload started */
export function trackContractUploadStarted(): void {
  trackEvent('contract_upload_started');
}

/** Track contract parsed */
export function trackContractParsed(success: boolean, entitlementsCount?: number): void {
  trackEvent('contract_parsed', {
    success,
    entitlements_count: entitlementsCount,
  });
}

export default {
  trackEvent,
  trackPageView,
  trackFeature,
  trackError,
  trackInviteCodeEntered,
  trackInviteCodeValidated,
  trackGoogleSignInStarted,
  trackGoogleSignInCompleted,
  trackCustomerListViewed,
  trackCsvTemplateDownloaded,
  trackCsvImportCompleted,
  trackOnboardingStarted,
  trackWelcomeModalShown,
  trackWelcomeModalDismissed,
  trackFeatureExplored,
  trackContractUploadStarted,
  trackContractParsed,
};
