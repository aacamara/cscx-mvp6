/**
 * Mobile Meeting Notes Service
 * PRD-269: Mobile Meeting Notes
 *
 * AI-powered mobile meeting notes capture with voice transcription,
 * quick action items, real-time collaboration, and post-meeting processing.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Types
// ============================================

export interface MeetingNote {
  id: string;
  meeting_id?: string;
  customer_id?: string;
  customer_name?: string;
  title: string;
  content: string;
  attendees: Attendee[];
  action_items: ActionItem[];
  highlights: Highlight[];
  voice_notes: VoiceNote[];
  risks: RiskFlag[];
  opportunities: OpportunityFlag[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  template_type?: MeetingTemplateType;
  started_at: Date;
  ended_at?: Date;
  status: 'active' | 'processing' | 'completed';
  created_by: string;
  collaborators: string[];
  last_synced_at?: Date;
  offline_changes?: OfflineChange[];
}

export interface Attendee {
  id: string;
  name: string;
  email?: string;
  role?: 'customer' | 'internal' | 'partner' | 'unknown';
  is_present: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  owner_id?: string;
  owner_name?: string;
  owner_type: 'customer' | 'internal' | 'both' | 'unknown';
  due_date?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  created_at: Date;
  source: 'manual' | 'ai_extracted';
}

export interface Highlight {
  id: string;
  text: string;
  timestamp: Date;
  type: 'key_moment' | 'decision' | 'quote' | 'concern';
  speaker?: string;
}

export interface VoiceNote {
  id: string;
  uri: string;
  transcription?: string;
  duration: number;
  timestamp: Date;
  status: 'recording' | 'transcribing' | 'completed' | 'failed';
}

export interface RiskFlag {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface OpportunityFlag {
  id: string;
  description: string;
  potential: 'low' | 'medium' | 'high';
  type: 'upsell' | 'cross_sell' | 'expansion' | 'referral';
  timestamp: Date;
}

export interface OfflineChange {
  id: string;
  field: string;
  value: any;
  timestamp: Date;
  synced: boolean;
}

export type MeetingTemplateType =
  | 'discovery'
  | 'qbr'
  | 'kickoff'
  | 'check_in'
  | 'escalation'
  | 'renewal'
  | 'training'
  | 'general';

export interface MeetingTemplate {
  type: MeetingTemplateType;
  name: string;
  description: string;
  default_topics: string[];
  suggested_duration: number;
}

export interface ProcessedMeetingNotes {
  summary: string;
  key_topics: string[];
  action_items: ActionItem[];
  risks: RiskFlag[];
  opportunities: OpportunityFlag[];
  sentiment: 'positive' | 'neutral' | 'negative';
  follow_up_email: string;
  next_steps: string[];
}

export interface CalendarMeeting {
  id: string;
  title: string;
  customer_id?: string;
  customer_name?: string;
  start_time: Date;
  end_time: Date;
  attendees: string[];
  location?: string;
}

// ============================================
// Meeting Templates
// ============================================

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    type: 'discovery',
    name: 'Discovery Call',
    description: 'Initial call to understand customer needs and goals',
    default_topics: ['Current challenges', 'Goals and objectives', 'Timeline', 'Budget', 'Decision makers'],
    suggested_duration: 45,
  },
  {
    type: 'qbr',
    name: 'Quarterly Business Review',
    description: 'Review of progress, metrics, and strategic planning',
    default_topics: ['Health score review', 'Usage metrics', 'ROI discussion', 'Goals for next quarter', 'Expansion opportunities'],
    suggested_duration: 60,
  },
  {
    type: 'kickoff',
    name: 'Kickoff Meeting',
    description: 'Project/implementation kickoff with new customer',
    default_topics: ['Team introductions', 'Project scope', 'Timeline', 'Communication plan', 'Success criteria'],
    suggested_duration: 60,
  },
  {
    type: 'check_in',
    name: 'Regular Check-in',
    description: 'Routine status update and relationship maintenance',
    default_topics: ['Recent updates', 'Open issues', 'Upcoming needs', 'Feedback'],
    suggested_duration: 30,
  },
  {
    type: 'escalation',
    name: 'Escalation Meeting',
    description: 'Address urgent issues or concerns',
    default_topics: ['Issue summary', 'Impact assessment', 'Root cause', 'Resolution plan', 'Prevention measures'],
    suggested_duration: 45,
  },
  {
    type: 'renewal',
    name: 'Renewal Discussion',
    description: 'Contract renewal negotiation and planning',
    default_topics: ['Value delivered', 'Pricing discussion', 'Contract terms', 'Growth plans', 'Competitive considerations'],
    suggested_duration: 45,
  },
  {
    type: 'training',
    name: 'Training Session',
    description: 'Product training or enablement session',
    default_topics: ['Training objectives', 'Features covered', 'Q&A', 'Follow-up resources', 'Feedback'],
    suggested_duration: 60,
  },
  {
    type: 'general',
    name: 'General Meeting',
    description: 'General purpose meeting notes',
    default_topics: [],
    suggested_duration: 30,
  },
];

// ============================================
// Mobile Meeting Notes Service
// ============================================

export class MobileMeetingNotesService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Create a new meeting note
   */
  async createMeetingNote(params: {
    customer_id?: string;
    customer_name?: string;
    title: string;
    template_type?: MeetingTemplateType;
    meeting_id?: string;
    created_by: string;
    attendees?: Attendee[];
  }): Promise<MeetingNote> {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const note: MeetingNote = {
      id: noteId,
      meeting_id: params.meeting_id,
      customer_id: params.customer_id,
      customer_name: params.customer_name,
      title: params.title,
      content: '',
      attendees: params.attendees || [],
      action_items: [],
      highlights: [],
      voice_notes: [],
      risks: [],
      opportunities: [],
      template_type: params.template_type || 'general',
      started_at: new Date(),
      status: 'active',
      created_by: params.created_by,
      collaborators: [params.created_by],
    };

    // Store in database
    const { error } = await supabase
      .from('mobile_meeting_notes')
      .insert({
        id: note.id,
        meeting_id: note.meeting_id,
        customer_id: note.customer_id,
        customer_name: note.customer_name,
        title: note.title,
        content: note.content,
        attendees: JSON.stringify(note.attendees),
        action_items: JSON.stringify(note.action_items),
        highlights: JSON.stringify(note.highlights),
        voice_notes: JSON.stringify(note.voice_notes),
        risks: JSON.stringify(note.risks),
        opportunities: JSON.stringify(note.opportunities),
        template_type: note.template_type,
        started_at: note.started_at.toISOString(),
        status: note.status,
        created_by: note.created_by,
        collaborators: note.collaborators,
      });

    if (error) {
      console.error('Error creating meeting note:', error);
      throw new Error('Failed to create meeting note');
    }

    return note;
  }

  /**
   * Get meeting note by ID
   */
  async getMeetingNote(noteId: string): Promise<MeetingNote | null> {
    const { data, error } = await supabase
      .from('mobile_meeting_notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDatabaseToNote(data);
  }

  /**
   * Update meeting note
   */
  async updateMeetingNote(noteId: string, updates: Partial<MeetingNote>): Promise<MeetingNote> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.attendees !== undefined) updateData.attendees = JSON.stringify(updates.attendees);
    if (updates.action_items !== undefined) updateData.action_items = JSON.stringify(updates.action_items);
    if (updates.highlights !== undefined) updateData.highlights = JSON.stringify(updates.highlights);
    if (updates.voice_notes !== undefined) updateData.voice_notes = JSON.stringify(updates.voice_notes);
    if (updates.risks !== undefined) updateData.risks = JSON.stringify(updates.risks);
    if (updates.opportunities !== undefined) updateData.opportunities = JSON.stringify(updates.opportunities);
    if (updates.sentiment !== undefined) updateData.sentiment = updates.sentiment;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.ended_at !== undefined) updateData.ended_at = updates.ended_at.toISOString();
    if (updates.last_synced_at !== undefined) updateData.last_synced_at = updates.last_synced_at.toISOString();

    const { data, error } = await supabase
      .from('mobile_meeting_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating meeting note:', error);
      throw new Error('Failed to update meeting note');
    }

    return this.mapDatabaseToNote(data);
  }

  /**
   * Add action item to meeting note
   */
  async addActionItem(noteId: string, actionItem: Omit<ActionItem, 'id' | 'created_at' | 'source'>): Promise<ActionItem> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    const newItem: ActionItem = {
      ...actionItem,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date(),
      source: 'manual',
    };

    note.action_items.push(newItem);
    await this.updateMeetingNote(noteId, { action_items: note.action_items });

    return newItem;
  }

  /**
   * Add highlight to meeting note
   */
  async addHighlight(noteId: string, highlight: Omit<Highlight, 'id' | 'timestamp'>): Promise<Highlight> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    const newHighlight: Highlight = {
      ...highlight,
      id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    note.highlights.push(newHighlight);
    await this.updateMeetingNote(noteId, { highlights: note.highlights });

    return newHighlight;
  }

  /**
   * Add voice note with transcription
   */
  async addVoiceNote(noteId: string, voiceNote: {
    uri: string;
    duration: number;
    transcription?: string;
  }): Promise<VoiceNote> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    const newVoiceNote: VoiceNote = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: voiceNote.uri,
      duration: voiceNote.duration,
      transcription: voiceNote.transcription,
      timestamp: new Date(),
      status: voiceNote.transcription ? 'completed' : 'transcribing',
    };

    note.voice_notes.push(newVoiceNote);

    // Append transcription to content if available
    if (voiceNote.transcription) {
      note.content += `\n\n[Voice Note - ${new Date().toLocaleTimeString()}]\n${voiceNote.transcription}`;
    }

    await this.updateMeetingNote(noteId, {
      voice_notes: note.voice_notes,
      content: note.content,
    });

    return newVoiceNote;
  }

  /**
   * Add risk flag
   */
  async addRiskFlag(noteId: string, risk: Omit<RiskFlag, 'id' | 'timestamp'>): Promise<RiskFlag> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    const newRisk: RiskFlag = {
      ...risk,
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    note.risks.push(newRisk);
    await this.updateMeetingNote(noteId, { risks: note.risks });

    return newRisk;
  }

  /**
   * Add opportunity flag
   */
  async addOpportunityFlag(noteId: string, opportunity: Omit<OpportunityFlag, 'id' | 'timestamp'>): Promise<OpportunityFlag> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    const newOpportunity: OpportunityFlag = {
      ...opportunity,
      id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    note.opportunities.push(newOpportunity);
    await this.updateMeetingNote(noteId, { opportunities: note.opportunities });

    return newOpportunity;
  }

  /**
   * Detect current meeting from calendar
   */
  async detectCurrentMeeting(userId: string): Promise<CalendarMeeting | null> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 min before
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000); // 15 min after

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      start_time: new Date(data.start_time),
      end_time: new Date(data.end_time),
      attendees: data.attendees || [],
      location: data.location,
    };
  }

  /**
   * Process meeting notes after meeting ends - AI-powered
   */
  async processMeetingNotes(noteId: string): Promise<ProcessedMeetingNotes> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    // Update status to processing
    await this.updateMeetingNote(noteId, { status: 'processing' });

    // Combine all content
    const fullContent = this.buildFullContent(note);

    // Call Claude for AI processing
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: this.buildProcessingPrompt(note, fullContent),
        },
      ],
    });

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
    const processed = this.parseProcessingResponse(analysisText);

    // Merge AI-extracted action items with manually added ones
    const mergedActionItems = this.mergeActionItems(note.action_items, processed.action_items);

    // Update the note with processed data
    await this.updateMeetingNote(noteId, {
      action_items: mergedActionItems,
      risks: [...note.risks, ...processed.risks],
      opportunities: [...note.opportunities, ...processed.opportunities],
      sentiment: processed.sentiment,
      status: 'completed',
      ended_at: new Date(),
    });

    return processed;
  }

  /**
   * Create tasks from action items
   */
  async createTasksFromActionItems(noteId: string): Promise<{ created: number; failed: number }> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    let created = 0;
    let failed = 0;

    for (const item of note.action_items.filter(a => a.status === 'open')) {
      try {
        const { error } = await supabase
          .from('tasks')
          .insert({
            customer_id: note.customer_id,
            title: item.title,
            description: item.description,
            owner_id: item.owner_id,
            due_date: item.due_date?.toISOString(),
            priority: item.priority,
            status: 'pending',
            source: 'meeting_notes',
            source_id: noteId,
          });

        if (error) {
          failed++;
        } else {
          created++;
        }
      } catch {
        failed++;
      }
    }

    return { created, failed };
  }

  /**
   * Sync offline changes
   */
  async syncOfflineChanges(noteId: string, changes: OfflineChange[]): Promise<MeetingNote> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    // Apply changes in order
    const updates: Partial<MeetingNote> = {};

    for (const change of changes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      (updates as any)[change.field] = change.value;
    }

    updates.last_synced_at = new Date();

    return this.updateMeetingNote(noteId, updates);
  }

  /**
   * List meeting notes for user
   */
  async listMeetingNotes(params: {
    user_id: string;
    customer_id?: string;
    status?: 'active' | 'processing' | 'completed';
    limit?: number;
    offset?: number;
  }): Promise<MeetingNote[]> {
    let query = supabase
      .from('mobile_meeting_notes')
      .select('*')
      .contains('collaborators', [params.user_id])
      .order('started_at', { ascending: false });

    if (params.customer_id) {
      query = query.eq('customer_id', params.customer_id);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    query = query.range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1);

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDatabaseToNote);
  }

  /**
   * Get meeting templates
   */
  getMeetingTemplates(): MeetingTemplate[] {
    return MEETING_TEMPLATES;
  }

  /**
   * Join existing note as collaborator
   */
  async joinMeetingNote(noteId: string, userId: string): Promise<MeetingNote> {
    const note = await this.getMeetingNote(noteId);
    if (!note) {
      throw new Error('Meeting note not found');
    }

    if (!note.collaborators.includes(userId)) {
      note.collaborators.push(userId);
      await supabase
        .from('mobile_meeting_notes')
        .update({ collaborators: note.collaborators })
        .eq('id', noteId);
    }

    return note;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private mapDatabaseToNote(data: any): MeetingNote {
    return {
      id: data.id,
      meeting_id: data.meeting_id,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      title: data.title,
      content: data.content,
      attendees: typeof data.attendees === 'string' ? JSON.parse(data.attendees) : data.attendees || [],
      action_items: typeof data.action_items === 'string' ? JSON.parse(data.action_items) : data.action_items || [],
      highlights: typeof data.highlights === 'string' ? JSON.parse(data.highlights) : data.highlights || [],
      voice_notes: typeof data.voice_notes === 'string' ? JSON.parse(data.voice_notes) : data.voice_notes || [],
      risks: typeof data.risks === 'string' ? JSON.parse(data.risks) : data.risks || [],
      opportunities: typeof data.opportunities === 'string' ? JSON.parse(data.opportunities) : data.opportunities || [],
      sentiment: data.sentiment,
      template_type: data.template_type,
      started_at: new Date(data.started_at),
      ended_at: data.ended_at ? new Date(data.ended_at) : undefined,
      status: data.status,
      created_by: data.created_by,
      collaborators: data.collaborators || [],
      last_synced_at: data.last_synced_at ? new Date(data.last_synced_at) : undefined,
    };
  }

  private buildFullContent(note: MeetingNote): string {
    const parts: string[] = [];

    // Main content
    if (note.content) {
      parts.push(note.content);
    }

    // Voice transcriptions
    for (const voice of note.voice_notes) {
      if (voice.transcription) {
        parts.push(`[Voice Note] ${voice.transcription}`);
      }
    }

    // Highlights
    for (const highlight of note.highlights) {
      parts.push(`[HIGHLIGHT - ${highlight.type.toUpperCase()}] ${highlight.text}`);
    }

    // Risk flags
    for (const risk of note.risks) {
      parts.push(`[RISK - ${risk.severity.toUpperCase()}] ${risk.description}`);
    }

    // Opportunity flags
    for (const opp of note.opportunities) {
      parts.push(`[OPPORTUNITY - ${opp.type.toUpperCase()}] ${opp.description}`);
    }

    return parts.join('\n\n');
  }

  private buildProcessingPrompt(note: MeetingNote, content: string): string {
    const customerContext = note.customer_name ? `\nCustomer: ${note.customer_name}` : '';
    const templateContext = note.template_type ? `\nMeeting Type: ${note.template_type}` : '';

    return `You are an expert Customer Success analyst. Analyze these meeting notes and extract actionable insights.

Meeting Details:
- Title: ${note.title}
- Date: ${note.started_at.toISOString()}
- Attendees: ${note.attendees.map(a => a.name).join(', ')}${customerContext}${templateContext}

MEETING NOTES:
---
${content}
---

Existing Action Items (from manual entry):
${note.action_items.map(a => `- ${a.title} (${a.owner_type})`).join('\n') || 'None'}

Please provide analysis in the following JSON format:

{
  "summary": "2-3 sentence executive summary of the meeting",
  "key_topics": ["topic1", "topic2", "topic3"],
  "action_items": [
    {
      "title": "Clear description of the action",
      "description": "Additional context if needed",
      "owner_type": "customer|internal|both|unknown",
      "owner_name": "Person's name if mentioned",
      "due_date": "YYYY-MM-DD if mentioned",
      "priority": "low|medium|high"
    }
  ],
  "risks": [
    {
      "description": "Description of the risk",
      "severity": "low|medium|high"
    }
  ],
  "opportunities": [
    {
      "description": "Description of the opportunity",
      "potential": "low|medium|high",
      "type": "upsell|cross_sell|expansion|referral"
    }
  ],
  "sentiment": "positive|neutral|negative",
  "follow_up_email": "Draft follow-up email text",
  "next_steps": ["Next step 1", "Next step 2"]
}

Important:
- Only include NEW action items not already in the existing list
- Be conservative with risk severity
- Include specific follow-up email draft
- Extract any mentioned deadlines or dates

Return ONLY valid JSON, no additional text.`;
  }

  private parseProcessingResponse(responseText: string): ProcessedMeetingNotes {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || 'No summary available',
        key_topics: parsed.key_topics || [],
        action_items: (parsed.action_items || []).map((item: any) => ({
          id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: item.title,
          description: item.description,
          owner_type: item.owner_type || 'unknown',
          owner_name: item.owner_name,
          due_date: item.due_date ? new Date(item.due_date) : undefined,
          priority: item.priority || 'medium',
          status: 'open' as const,
          created_at: new Date(),
          source: 'ai_extracted' as const,
        })),
        risks: (parsed.risks || []).map((risk: any) => ({
          id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          description: risk.description,
          severity: risk.severity || 'medium',
          timestamp: new Date(),
        })),
        opportunities: (parsed.opportunities || []).map((opp: any) => ({
          id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          description: opp.description,
          potential: opp.potential || 'medium',
          type: opp.type || 'expansion',
          timestamp: new Date(),
        })),
        sentiment: parsed.sentiment || 'neutral',
        follow_up_email: parsed.follow_up_email || '',
        next_steps: parsed.next_steps || [],
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        summary: 'Failed to process meeting notes',
        key_topics: [],
        action_items: [],
        risks: [],
        opportunities: [],
        sentiment: 'neutral',
        follow_up_email: '',
        next_steps: [],
      };
    }
  }

  private mergeActionItems(existing: ActionItem[], aiExtracted: ActionItem[]): ActionItem[] {
    const merged = [...existing];

    for (const aiItem of aiExtracted) {
      // Check for duplicates based on title similarity
      const isDuplicate = existing.some(e =>
        e.title.toLowerCase().includes(aiItem.title.toLowerCase().substring(0, 20)) ||
        aiItem.title.toLowerCase().includes(e.title.toLowerCase().substring(0, 20))
      );

      if (!isDuplicate) {
        merged.push(aiItem);
      }
    }

    return merged;
  }
}

// ============================================
// Singleton Export
// ============================================

export const mobileMeetingNotesService = new MobileMeetingNotesService();
