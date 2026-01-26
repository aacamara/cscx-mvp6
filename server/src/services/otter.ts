/**
 * Otter AI Integration Service
 * Handles meeting transcripts from Otter.ai
 * Processes transcripts, extracts insights, and stores in Google Drive
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { driveService } from './google/drive.js';
import { docsService } from './google/docs.js';
import Anthropic from '@anthropic-ai/sdk';

// Types
export interface OtterWebhookPayload {
  event: 'transcript_ready' | 'meeting_started' | 'meeting_ended';
  meeting_id: string;
  title: string;
  participants?: string[];
  duration_minutes?: number;
  transcript?: string;
  summary?: string;
  action_items?: string[];
  start_time?: string;
  end_time?: string;
}

export interface TranscriptAnalysis {
  summary: string;
  keyTopics: string[];
  actionItems: { item: string; assignee?: string; dueDate?: string }[];
  decisions: { decision: string; context: string }[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number;  // -1.0 to 1.0
  nextSteps: string[];
  risks: string[];
  opportunities: string[];
}

export interface MeetingTranscript {
  id: string;
  customerId: string;
  userId: string;
  calendarEventId?: string;
  meetingTitle: string;
  source: 'otter' | 'google_meet' | 'zoom' | 'manual';
  sourceMeetingId?: string;
  sourceUrl?: string;
  participants: { name: string; email?: string; role?: string }[];
  speakers: { name: string; speakingTimeSeconds: number; speakingPct: number }[];
  transcriptText: string;
  summary: string;
  keyTopics: string[];
  actionItems: { item: string; assignee?: string; dueDate?: string }[];
  decisions: { decision: string; context: string }[];
  sentiment: string;
  sentimentScore: number;
  meetingDate: Date;
  durationMinutes: number;
  meetingType?: string;
  googleFileId?: string;
  googleFolderId?: string;
  notesDocId?: string;
  createdAt: Date;
  processedAt?: Date;
}

class OtterService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Process incoming Otter webhook
   */
  async processWebhook(
    payload: OtterWebhookPayload,
    userId: string,
    customerId?: string
  ): Promise<{ success: boolean; transcript?: MeetingTranscript; error?: string }> {
    try {
      if (payload.event !== 'transcript_ready') {
        return { success: true };  // Ignore non-transcript events
      }

      if (!payload.transcript) {
        return { success: false, error: 'No transcript in payload' };
      }

      // Try to find customer from meeting title or participants
      const resolvedCustomerId = customerId || await this.resolveCustomerFromMeeting(
        payload.title,
        payload.participants || []
      );

      // Analyze transcript with AI
      const analysis = await this.analyzeTranscript(payload.transcript, payload.title);

      // Get customer folders if we have a customer
      let googleFileId: string | undefined;
      let googleFolderId: string | undefined;
      let notesDocId: string | undefined;

      if (resolvedCustomerId) {
        const folders = await this.getCustomerFolders(resolvedCustomerId);
        if (folders) {
          // Save transcript text file
          const transcriptFile = await this.saveTranscriptToGoogleDrive(
            userId,
            folders.transcripts,
            payload.title,
            payload.transcript,
            payload.start_time ? new Date(payload.start_time) : new Date()
          );
          googleFileId = transcriptFile?.id;
          googleFolderId = folders.transcripts;

          // Generate meeting notes document
          const notesDoc = await this.generateMeetingNotes(
            userId,
            folders.meetingNotes,
            payload.title,
            analysis,
            payload.participants || []
          );
          notesDocId = notesDoc?.id;
        }
      }

      // Save to database
      const transcript = await this.saveTranscriptRecord({
        customerId: resolvedCustomerId,
        userId,
        calendarEventId: undefined,  // Could match to calendar if we have event ID
        meetingTitle: payload.title,
        source: 'otter',
        sourceMeetingId: payload.meeting_id,
        participants: (payload.participants || []).map(p => ({ name: p })),
        speakers: [],  // Otter may provide this in future
        transcriptText: payload.transcript,
        summary: analysis.summary,
        keyTopics: analysis.keyTopics,
        actionItems: analysis.actionItems,
        decisions: analysis.decisions,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        meetingDate: payload.start_time ? new Date(payload.start_time) : new Date(),
        durationMinutes: payload.duration_minutes || 0,
        googleFileId,
        googleFolderId,
        notesDocId,
      });

      return { success: true, transcript };
    } catch (error) {
      console.error('Error processing Otter webhook:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Analyze transcript with AI
   */
  async analyzeTranscript(transcript: string, title: string): Promise<TranscriptAnalysis> {
    if (!this.anthropic) {
      // Return basic analysis without AI
      return {
        summary: `Meeting: ${title}`,
        keyTopics: [],
        actionItems: [],
        decisions: [],
        sentiment: 'neutral',
        sentimentScore: 0,
        nextSteps: [],
        risks: [],
        opportunities: [],
      };
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Analyze this meeting transcript and extract key information. Return your analysis in JSON format.

Meeting Title: ${title}

Transcript:
${transcript.substring(0, 15000)}  // Limit to avoid token limits

Return JSON with this structure:
{
  "summary": "2-3 paragraph summary of the meeting",
  "keyTopics": ["topic1", "topic2", ...],
  "actionItems": [{"item": "description", "assignee": "name or null", "dueDate": "date or null"}],
  "decisions": [{"decision": "what was decided", "context": "why/how"}],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "sentimentScore": -1.0 to 1.0,
  "nextSteps": ["step1", "step2", ...],
  "risks": ["risk1", "risk2", ...],
  "opportunities": ["opportunity1", "opportunity2", ...]
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Error analyzing transcript:', error);
    }

    // Fallback
    return {
      summary: `Meeting: ${title}`,
      keyTopics: [],
      actionItems: [],
      decisions: [],
      sentiment: 'neutral',
      sentimentScore: 0,
      nextSteps: [],
      risks: [],
      opportunities: [],
    };
  }

  /**
   * Save transcript text file to Google Drive
   */
  private async saveTranscriptToGoogleDrive(
    userId: string,
    folderId: string,
    title: string,
    transcript: string,
    meetingDate: Date
  ): Promise<{ id: string; url: string } | null> {
    try {
      const dateStr = meetingDate.toISOString().split('T')[0];
      const fileName = `${dateStr} - ${title}.txt`;

      const file = await driveService.uploadFile(userId, {
        name: fileName,
        mimeType: 'text/plain',
        content: Buffer.from(transcript, 'utf-8'),
        folderId,
      });

      if (file) {
        return {
          id: file.id,
          url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        };
      }
    } catch (error) {
      console.error('Error saving transcript to Drive:', error);
    }
    return null;
  }

  /**
   * Generate meeting notes document from analysis
   */
  private async generateMeetingNotes(
    userId: string,
    folderId: string,
    title: string,
    analysis: TranscriptAnalysis,
    participants: string[]
  ): Promise<{ id: string; url: string } | null> {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const docTitle = `${dateStr} - ${title} Notes`;

      // Build document content
      const content = this.buildMeetingNotesContent(title, analysis, participants);

      const doc = await docsService.createDocument(userId, {
        title: docTitle,
        template: 'meeting_notes' as any,  // Template type
        folderId,
        content,
      });

      if (doc) {
        return {
          id: doc.id,
          url: `https://docs.google.com/document/d/${doc.id}/edit`,
        };
      }
    } catch (error) {
      console.error('Error generating meeting notes:', error);
    }
    return null;
  }

  /**
   * Build meeting notes content from analysis
   */
  private buildMeetingNotesContent(
    title: string,
    analysis: TranscriptAnalysis,
    participants: string[]
  ): string {
    let content = `# ${title}\n\n`;
    content += `**Date:** ${new Date().toLocaleDateString()}\n`;
    content += `**Participants:** ${participants.join(', ')}\n\n`;

    content += `## Summary\n${analysis.summary}\n\n`;

    if (analysis.keyTopics.length > 0) {
      content += `## Key Topics\n`;
      analysis.keyTopics.forEach(topic => {
        content += `- ${topic}\n`;
      });
      content += '\n';
    }

    if (analysis.decisions.length > 0) {
      content += `## Decisions Made\n`;
      analysis.decisions.forEach(d => {
        content += `- **${d.decision}**: ${d.context}\n`;
      });
      content += '\n';
    }

    if (analysis.actionItems.length > 0) {
      content += `## Action Items\n`;
      analysis.actionItems.forEach(item => {
        let line = `- [ ] ${item.item}`;
        if (item.assignee) line += ` (@${item.assignee})`;
        if (item.dueDate) line += ` - Due: ${item.dueDate}`;
        content += line + '\n';
      });
      content += '\n';
    }

    if (analysis.nextSteps.length > 0) {
      content += `## Next Steps\n`;
      analysis.nextSteps.forEach(step => {
        content += `- ${step}\n`;
      });
      content += '\n';
    }

    if (analysis.risks.length > 0) {
      content += `## Risks Identified\n`;
      analysis.risks.forEach(risk => {
        content += `- ⚠️ ${risk}\n`;
      });
      content += '\n';
    }

    if (analysis.opportunities.length > 0) {
      content += `## Opportunities\n`;
      analysis.opportunities.forEach(opp => {
        content += `- 💡 ${opp}\n`;
      });
      content += '\n';
    }

    content += `\n---\n*Meeting Sentiment: ${analysis.sentiment} (${analysis.sentimentScore.toFixed(2)})*\n`;
    content += `*Auto-generated from Otter.ai transcript*`;

    return content;
  }

  /**
   * Try to resolve customer from meeting title or participants
   */
  private async resolveCustomerFromMeeting(
    title: string,
    participants: string[]
  ): Promise<string | null> {
    if (!this.supabase) return null;

    // Try to match customer name in title
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name')
      .limit(100);

    if (customers) {
      const titleLower = title.toLowerCase();
      for (const customer of customers as any[]) {
        if (titleLower.includes(customer.name.toLowerCase())) {
          return customer.id;
        }
      }

      // Try to match by participant email domains
      // This would require stakeholders table lookup
    }

    return null;
  }

  /**
   * Get customer folder IDs
   */
  private async getCustomerFolders(customerId: string): Promise<{
    transcripts: string;
    meetingNotes: string;
  } | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customer_workspace_folders' as any)
      .select('meetings_transcripts_folder_id, meetings_notes_folder_id')
      .eq('customer_id', customerId)
      .single();

    if (data) {
      const row = data as any;
      return {
        transcripts: row.meetings_transcripts_folder_id,
        meetingNotes: row.meetings_notes_folder_id,
      };
    }

    return null;
  }

  /**
   * Save transcript record to database
   */
  private async saveTranscriptRecord(data: {
    customerId?: string | null;
    userId: string;
    calendarEventId?: string;
    meetingTitle: string;
    source: 'otter' | 'google_meet' | 'zoom' | 'manual';
    sourceMeetingId?: string;
    participants: { name: string; email?: string; role?: string }[];
    speakers: { name: string; speakingTimeSeconds: number; speakingPct: number }[];
    transcriptText: string;
    summary: string;
    keyTopics: string[];
    actionItems: { item: string; assignee?: string; dueDate?: string }[];
    decisions: { decision: string; context: string }[];
    sentiment: string;
    sentimentScore: number;
    meetingDate: Date;
    durationMinutes: number;
    meetingType?: string;
    googleFileId?: string;
    googleFolderId?: string;
    notesDocId?: string;
  }): Promise<MeetingTranscript | null> {
    if (!this.supabase) return null;

    const { data: record, error } = await this.supabase
      .from('meeting_transcripts' as any)
      .insert({
        customer_id: data.customerId,
        user_id: data.userId,
        calendar_event_id: data.calendarEventId,
        meeting_title: data.meetingTitle,
        source: data.source,
        source_meeting_id: data.sourceMeetingId,
        participants: data.participants,
        speakers: data.speakers,
        transcript_text: data.transcriptText,
        summary: data.summary,
        key_topics: data.keyTopics,
        action_items: data.actionItems,
        decisions: data.decisions,
        sentiment: data.sentiment,
        sentiment_score: data.sentimentScore,
        meeting_date: data.meetingDate.toISOString(),
        duration_minutes: data.durationMinutes,
        meeting_type: data.meetingType,
        google_file_id: data.googleFileId,
        google_folder_id: data.googleFolderId,
        notes_doc_id: data.notesDocId,
        processed_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error saving transcript record:', error);
      return null;
    }

    return this.mapToMeetingTranscript(record);
  }

  /**
   * Get transcripts for a customer
   */
  async getCustomerTranscripts(customerId: string): Promise<MeetingTranscript[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('customer_id', customerId)
      .order('meeting_date', { ascending: false });

    if (error) {
      console.error('Error fetching transcripts:', error);
      return [];
    }

    return data.map(this.mapToMeetingTranscript);
  }

  /**
   * Get a specific transcript
   */
  async getTranscript(transcriptId: string): Promise<MeetingTranscript | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('id', transcriptId)
      .single();

    if (error || !data) return null;

    return this.mapToMeetingTranscript(data);
  }

  /**
   * Map DB record to MeetingTranscript
   */
  private mapToMeetingTranscript(record: any): MeetingTranscript {
    return {
      id: record.id,
      customerId: record.customer_id,
      userId: record.user_id,
      calendarEventId: record.calendar_event_id,
      meetingTitle: record.meeting_title,
      source: record.source,
      sourceMeetingId: record.source_meeting_id,
      sourceUrl: record.source_url,
      participants: record.participants || [],
      speakers: record.speakers || [],
      transcriptText: record.transcript_text,
      summary: record.summary,
      keyTopics: record.key_topics || [],
      actionItems: record.action_items || [],
      decisions: record.decisions || [],
      sentiment: record.sentiment,
      sentimentScore: record.sentiment_score,
      meetingDate: new Date(record.meeting_date),
      durationMinutes: record.duration_minutes,
      meetingType: record.meeting_type,
      googleFileId: record.google_file_id,
      googleFolderId: record.google_folder_id,
      notesDocId: record.notes_doc_id,
      createdAt: new Date(record.created_at),
      processedAt: record.processed_at ? new Date(record.processed_at) : undefined,
    };
  }
}

export const otterService = new OtterService();
export default otterService;
