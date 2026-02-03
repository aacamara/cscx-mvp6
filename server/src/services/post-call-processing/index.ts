/**
 * Post-Call Processing Service
 * PRD-116: Orchestrates automated post-call workflows
 *
 * Workflow:
 * 1. Receive trigger (webhook or manual)
 * 2. Fetch/receive transcript
 * 3. Analyze transcript with AI
 * 4. Create tasks for action items
 * 5. Generate follow-up email draft
 * 6. Store in approval queue
 * 7. Send notifications (Slack/Email/In-app)
 * 8. Update CRM (if configured)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { transcriptAnalyzer, TranscriptAnalyzer } from './transcript-analyzer.js';
import { followUpEmailGenerator, FollowUpEmailGenerator } from './follow-up-email-generator.js';
import { sendSlackAlert } from '../notifications/slack.js';
import { gmailService } from '../google/gmail.js';
import type {
  PostCallProcessingResult,
  ProcessingQueueItem,
  TriggerPostCallRequest,
  PostCallStatusResponse,
  TranscriptAnalysisOutput,
  ActionItem,
  TriggerSource,
  TranscriptSource,
  ProcessingStatus,
  PostCallNotification,
} from './types.js';

// Re-export types
export * from './types.js';

// ============================================
// Post-Call Processing Service
// ============================================

export class PostCallProcessingService {
  private supabase: SupabaseClient | null = null;
  private analyzer: TranscriptAnalyzer;
  private emailGenerator: FollowUpEmailGenerator;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.analyzer = transcriptAnalyzer;
    this.emailGenerator = followUpEmailGenerator;
  }

  // ============================================
  // Main Processing Methods
  // ============================================

  /**
   * Trigger post-call processing from any source
   */
  async triggerProcessing(
    userId: string,
    request: TriggerPostCallRequest,
    source: TriggerSource = 'manual'
  ): Promise<{ success: boolean; resultId?: string; error?: string }> {
    try {
      // Create initial processing result record
      const resultId = await this.createProcessingResult(userId, request, source);

      // Queue for async processing
      await this.queueProcessing(resultId, userId, request.customerId, source, request);

      // Start processing (could be moved to a background worker)
      this.processAsync(resultId, userId, request).catch((err) => {
        console.error(`Background processing failed for ${resultId}:`, err);
        this.updateProcessingStatus(resultId, 'failed', err.message);
      });

      return { success: true, resultId };
    } catch (error) {
      console.error('Failed to trigger post-call processing:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Async processing workflow
   */
  private async processAsync(
    resultId: string,
    userId: string,
    request: TriggerPostCallRequest
  ): Promise<void> {
    try {
      // Update status to processing
      await this.updateProcessingStatus(resultId, 'processing');

      // Step 1: Get transcript text
      let transcriptText = request.transcriptText;
      if (!transcriptText && request.transcriptUrl) {
        transcriptText = await this.fetchTranscriptFromUrl(request.transcriptUrl, userId);
      }

      if (!transcriptText) {
        throw new Error('No transcript text available');
      }

      // Step 2: Analyze transcript
      const analysis = await this.analyzer.analyze({
        transcript: transcriptText,
        meetingTitle: request.meetingTitle || 'Customer Meeting',
        customerName: await this.getCustomerName(request.customerId),
        participants: request.participants?.map((p) => p.name),
        meetingType: 'customer_call',
      });

      // Step 3: Create tasks for action items
      const taskIds = await this.createTasksFromActionItems(
        userId,
        request.customerId,
        request.meetingId,
        analysis.actionItems
      );

      // Step 4: Generate follow-up email
      const emailDraft = await this.emailGenerator.generate({
        customerName: await this.getCustomerName(request.customerId) || 'Customer',
        meetingTitle: request.meetingTitle || 'Meeting',
        meetingDate: request.meetingDate ? new Date(request.meetingDate) : new Date(),
        participants: request.participants || [],
        analysis,
        senderName: await this.getUserName(userId),
      });

      // Step 5: Create email approval record
      const approvalId = await this.createEmailApproval(
        userId,
        request.customerId,
        resultId,
        emailDraft
      );

      // Step 6: Update processing result with all data
      await this.updateProcessingResult(resultId, {
        transcriptText,
        summary: analysis.summary,
        actionItems: analysis.actionItems,
        commitments: analysis.commitments,
        riskSignals: analysis.riskSignals,
        expansionSignals: analysis.expansionSignals,
        competitorMentions: analysis.competitorMentions,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        followUpEmailDraft: emailDraft,
        followUpEmailApprovalId: approvalId,
        tasksCreated: taskIds,
        status: 'completed',
        processedAt: new Date(),
      });

      // Step 7: Send notifications
      await this.sendNotifications(userId, request.customerId, request.meetingTitle || 'Meeting', analysis, resultId);

      // Step 8: Update CRM (optional, based on integration status)
      await this.updateCRM(userId, request.customerId, resultId, analysis);

    } catch (error) {
      console.error('Post-call processing failed:', error);
      await this.updateProcessingStatus(resultId, 'failed', (error as Error).message);
      throw error;
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Create initial processing result record
   */
  private async createProcessingResult(
    userId: string,
    request: TriggerPostCallRequest,
    source: TriggerSource
  ): Promise<string> {
    if (!this.supabase) {
      // In-memory fallback for development
      return `pcr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const { data, error } = await this.supabase
      .from('post_call_processing_results')
      .insert({
        meeting_id: request.meetingId,
        customer_id: request.customerId,
        user_id: userId,
        transcript_source: request.source || 'manual',
        meeting_title: request.meetingTitle,
        meeting_date: request.meetingDate,
        duration_minutes: request.durationMinutes,
        participants: request.participants || [],
        status: 'pending',
        triggered_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create processing result:', error);
      throw new Error('Failed to create processing result record');
    }

    return data.id;
  }

  /**
   * Queue processing for async execution
   */
  private async queueProcessing(
    resultId: string,
    userId: string,
    customerId: string | undefined,
    source: TriggerSource,
    triggerData: unknown
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('post_call_processing_queue').insert({
      processing_result_id: resultId,
      user_id: userId,
      customer_id: customerId,
      trigger_source: source,
      trigger_data: triggerData,
      status: 'queued',
      priority: source === 'manual' ? 10 : 0,
      next_attempt_at: new Date().toISOString(),
    });
  }

  /**
   * Update processing status
   */
  private async updateProcessingStatus(
    resultId: string,
    status: ProcessingStatus,
    error?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const updates: Record<string, unknown> = { status };

    if (status === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.processed_at = new Date().toISOString();
    }

    if (error) {
      updates.processing_error = error;
    }

    await this.supabase
      .from('post_call_processing_results')
      .update(updates)
      .eq('id', resultId);
  }

  /**
   * Update processing result with analysis data
   */
  private async updateProcessingResult(
    resultId: string,
    data: Partial<{
      transcriptText: string;
      summary: string;
      actionItems: ActionItem[];
      commitments: unknown[];
      riskSignals: unknown[];
      expansionSignals: unknown[];
      competitorMentions: string[];
      sentiment: string;
      sentimentScore: number;
      followUpEmailDraft: unknown;
      followUpEmailApprovalId: string;
      tasksCreated: string[];
      status: string;
      processedAt: Date;
    }>
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('post_call_processing_results')
      .update({
        transcript_text: data.transcriptText,
        summary: data.summary,
        action_items: data.actionItems,
        commitments: data.commitments,
        risk_signals: data.riskSignals,
        expansion_signals: data.expansionSignals,
        competitor_mentions: data.competitorMentions,
        sentiment: data.sentiment,
        sentiment_score: data.sentimentScore,
        follow_up_email_draft: data.followUpEmailDraft,
        follow_up_email_approval_id: data.followUpEmailApprovalId,
        tasks_created: data.tasksCreated,
        status: data.status,
        processed_at: data.processedAt?.toISOString(),
      })
      .eq('id', resultId);
  }

  /**
   * Get processing result by ID
   */
  async getProcessingResult(resultId: string): Promise<PostCallProcessingResult | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('post_call_processing_results')
      .select('*')
      .eq('id', resultId)
      .single();

    if (error || !data) return null;

    return this.mapDbToResult(data);
  }

  /**
   * Get processing status
   */
  async getProcessingStatus(resultId: string): Promise<PostCallStatusResponse | null> {
    const result = await this.getProcessingResult(resultId);
    if (!result) return null;

    return {
      id: result.id,
      status: result.status,
      progress: this.getProgressInfo(result.status),
      result: result.status === 'completed' ? result : undefined,
      error: result.processingError,
    };
  }

  /**
   * Get recent processing results for a user
   */
  async getRecentResults(
    userId: string,
    limit: number = 20,
    customerId?: string
  ): Promise<PostCallProcessingResult[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('post_call_processing_results')
      .select('*')
      .eq('user_id', userId)
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(this.mapDbToResult);
  }

  // ============================================
  // Task Creation
  // ============================================

  /**
   * Create tasks from extracted action items
   */
  private async createTasksFromActionItems(
    userId: string,
    customerId: string | undefined,
    meetingId: string,
    actionItems: ActionItem[]
  ): Promise<string[]> {
    if (!this.supabase || actionItems.length === 0) return [];

    const taskIds: string[] = [];

    for (const item of actionItems) {
      try {
        const { data, error } = await this.supabase
          .from('tasks')
          .insert({
            user_id: userId,
            customer_id: customerId,
            title: item.description,
            description: `Action item from meeting. Assigned to: ${item.owner} (${item.ownerType})`,
            due_date: item.dueDate,
            priority: item.priority,
            status: 'pending',
            source: 'post_call_processing',
            metadata: {
              meetingId,
              owner: item.owner,
              ownerType: item.ownerType,
            },
          })
          .select('id')
          .single();

        if (!error && data) {
          taskIds.push(data.id);
        }
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    }

    return taskIds;
  }

  // ============================================
  // Email Approval
  // ============================================

  /**
   * Create email approval record for HITL review
   */
  private async createEmailApproval(
    userId: string,
    customerId: string | undefined,
    resultId: string,
    emailDraft: unknown
  ): Promise<string> {
    if (!this.supabase) {
      return `approval_${Date.now()}`;
    }

    const { data, error } = await this.supabase
      .from('google_pending_approvals')
      .insert({
        user_id: userId,
        customer_id: customerId,
        action_type: 'send_email',
        action_data: emailDraft,
        status: 'pending',
        reason: `Follow-up email from post-call processing (${resultId})`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour expiry
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create email approval:', error);
      // Return a placeholder ID
      return `approval_${Date.now()}`;
    }

    return data.id;
  }

  // ============================================
  // Notifications
  // ============================================

  /**
   * Send notifications about completed processing
   */
  private async sendNotifications(
    userId: string,
    customerId: string | undefined,
    meetingTitle: string,
    analysis: TranscriptAnalysisOutput,
    resultId: string
  ): Promise<void> {
    try {
      // Get user's Slack webhook if configured
      const slackWebhook = await this.getUserSlackWebhook(userId);

      if (slackWebhook) {
        const customerName = await this.getCustomerName(customerId);

        await sendSlackAlert(slackWebhook, {
          type: 'success',
          title: 'Post-Call Processing Complete',
          message: `*${meetingTitle}*${customerName ? ` with ${customerName}` : ''}\n\n${analysis.summary}`,
          customer: customerId && customerName ? {
            id: customerId,
            name: customerName,
          } : undefined,
          priority: analysis.riskSignals.length > 0 ? 'high' : 'medium',
          actionUrl: `/workflows/post-call/${resultId}`,
          fields: {
            'Action Items': analysis.actionItems.length,
            'Risk Signals': analysis.riskSignals.length,
            'Sentiment': `${this.getSentimentEmoji(analysis.sentiment)} ${analysis.sentiment}`,
          },
        });
      }

      // Create in-app notification
      await this.createInAppNotification(userId, customerId, meetingTitle, analysis, resultId);

    } catch (error) {
      console.error('Failed to send notifications:', error);
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    customerId: string | undefined,
    meetingTitle: string,
    analysis: TranscriptAnalysisOutput,
    resultId: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('notifications').insert({
      user_id: userId,
      type: 'post_call_complete',
      title: 'Post-Call Processing Complete',
      message: `Analysis ready for "${meetingTitle}". ${analysis.actionItems.length} action items extracted.`,
      data: {
        resultId,
        customerId,
        meetingTitle,
        actionItemCount: analysis.actionItems.length,
        riskSignalCount: analysis.riskSignals.length,
        sentiment: analysis.sentiment,
      },
      read: false,
    });
  }

  // ============================================
  // CRM Integration
  // ============================================

  /**
   * Update CRM with meeting data
   */
  private async updateCRM(
    userId: string,
    customerId: string | undefined,
    resultId: string,
    analysis: TranscriptAnalysisOutput
  ): Promise<void> {
    // Check if CRM integration is enabled
    // For now, log the intent - actual integration depends on PRD-181 (Salesforce)
    console.log(`CRM update for result ${resultId}:`, {
      customerId,
      summary: analysis.summary,
      actionItemCount: analysis.actionItems.length,
    });

    // TODO: Implement when Salesforce integration is available
    // await salesforceService.logActivity(userId, customerId, {...});
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Fetch transcript from URL
   */
  private async fetchTranscriptFromUrl(url: string, userId: string): Promise<string> {
    // This would fetch transcript from Zoom/Otter API
    // For now, return empty - actual implementation depends on integration
    console.log(`Fetching transcript from ${url} for user ${userId}`);
    throw new Error('Transcript URL fetching not yet implemented');
  }

  /**
   * Get customer name by ID
   */
  private async getCustomerName(customerId: string | undefined): Promise<string | null> {
    if (!customerId || !this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    return data?.name || null;
  }

  /**
   * Get user name by ID
   */
  private async getUserName(userId: string): Promise<string | undefined> {
    if (!this.supabase) return undefined;

    const { data } = await this.supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    return data?.name;
  }

  /**
   * Get user's Slack webhook URL
   */
  private async getUserSlackWebhook(userId: string): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('user_settings')
      .select('slack_webhook_url')
      .eq('user_id', userId)
      .single();

    return data?.slack_webhook_url || null;
  }

  /**
   * Get progress info for status
   */
  private getProgressInfo(status: ProcessingStatus): { step: string; percentage: number } {
    switch (status) {
      case 'pending':
        return { step: 'Queued', percentage: 0 };
      case 'processing':
        return { step: 'Analyzing transcript', percentage: 50 };
      case 'completed':
        return { step: 'Complete', percentage: 100 };
      case 'failed':
        return { step: 'Failed', percentage: 0 };
      case 'partial':
        return { step: 'Partially complete', percentage: 75 };
      default:
        return { step: 'Unknown', percentage: 0 };
    }
  }

  /**
   * Get sentiment emoji
   */
  private getSentimentEmoji(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😟';
      case 'mixed':
        return '🤔';
      default:
        return '😐';
    }
  }

  /**
   * Map database row to PostCallProcessingResult
   */
  private mapDbToResult(row: Record<string, unknown>): PostCallProcessingResult {
    return {
      id: row.id as string,
      meetingId: row.meeting_id as string,
      customerId: row.customer_id as string | undefined,
      userId: row.user_id as string,
      transcriptId: row.transcript_id as string | undefined,
      transcriptSource: row.transcript_source as TranscriptSource | undefined,
      transcriptText: row.transcript_text as string | undefined,
      meetingTitle: row.meeting_title as string | undefined,
      meetingDate: row.meeting_date ? new Date(row.meeting_date as string) : undefined,
      durationMinutes: row.duration_minutes as number | undefined,
      participants: (row.participants as Array<{ name: string; email?: string }>) || [],
      summary: row.summary as string | undefined,
      actionItems: (row.action_items as ActionItem[]) || [],
      commitments: (row.commitments as unknown[]) || [],
      riskSignals: (row.risk_signals as unknown[]) || [],
      expansionSignals: (row.expansion_signals as unknown[]) || [],
      competitorMentions: (row.competitor_mentions as string[]) || [],
      sentiment: row.sentiment as string | undefined,
      sentimentScore: row.sentiment_score as number | undefined,
      followUpEmailDraft: row.follow_up_email_draft as unknown,
      followUpEmailApprovalId: row.follow_up_email_approval_id as string | undefined,
      tasksCreated: (row.tasks_created as string[]) || [],
      crmUpdated: (row.crm_updated as boolean) || false,
      crmActivityId: row.crm_activity_id as string | undefined,
      crmSyncError: row.crm_sync_error as string | undefined,
      status: (row.status as ProcessingStatus) || 'pending',
      processingError: row.processing_error as string | undefined,
      retryCount: (row.retry_count as number) || 0,
      triggeredAt: new Date(row.triggered_at as string),
      processingStartedAt: row.processing_started_at
        ? new Date(row.processing_started_at as string)
        : undefined,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ============================================
  // Webhook Log Methods
  // ============================================

  /**
   * Log incoming webhook for audit
   */
  async logWebhook(
    source: string,
    eventType: string,
    eventId: string | undefined,
    payload: unknown
  ): Promise<string | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('post_call_webhook_logs')
      .insert({
        source,
        event_type: eventType,
        event_id: eventId,
        payload,
        processed: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log webhook:', error);
      return null;
    }

    return data.id;
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(
    logId: string,
    resultId?: string,
    error?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('post_call_webhook_logs')
      .update({
        processed: true,
        processing_result_id: resultId,
        error,
      })
      .eq('id', logId);
  }
}

// Export singleton
export const postCallProcessingService = new PostCallProcessingService();
export default postCallProcessingService;
