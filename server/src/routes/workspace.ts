import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { gmailService } from '../services/google/gmail.js';
import { calendarService } from '../services/google/calendar.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Supabase client for fetching customer contacts
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Mock Data for Demo
// ============================================

const DEMO_CONTACTS = [
  { id: '1', email: 'sarah.johnson@acmecorp.com', name: 'Sarah Johnson', title: 'VP of Engineering', company: 'Acme Corp', source: 'stakeholder' },
  { id: '2', email: 'mike.chen@acmecorp.com', name: 'Mike Chen', title: 'Product Manager', company: 'Acme Corp', source: 'stakeholder' },
  { id: '3', email: 'jessica.liu@acmecorp.com', name: 'Jessica Liu', title: 'CTO', company: 'Acme Corp', source: 'stakeholder' },
  { id: '4', email: 'john.smith@techstart.io', name: 'John Smith', title: 'Director of Ops', company: 'TechStart', source: 'recent' },
  { id: '5', email: 'amy.wong@globalinc.com', name: 'Amy Wong', title: 'Success Manager', company: 'Global Inc', source: 'recent' },
  { id: '6', email: 'david.park@enterprise.co', name: 'David Park', title: 'CEO', company: 'Enterprise Co', source: 'stakeholder' },
  { id: '7', email: 'lisa.zhang@startup.ai', name: 'Lisa Zhang', title: 'Head of Product', company: 'Startup AI', source: 'recent' },
];

// ============================================
// GET /api/workspace/contacts/search
// Search contacts for typeahead
// ============================================
router.get('/contacts/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = '10' } = req.query;
    const query = (q as string || '').toLowerCase();
    const maxResults = parseInt(limit as string, 10);

    if (!query) {
      return res.json({ contacts: [], hasMore: false });
    }

    // Filter contacts based on search query
    const filtered = DEMO_CONTACTS.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query)
    );

    const contacts = filtered.slice(0, maxResults);
    const hasMore = filtered.length > maxResults;

    res.json({ contacts, hasMore });
  } catch (error) {
    console.error('Contact search error:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

// ============================================
// GET /api/workspace/calendar/availability
// Get available time slots for scheduling
// ============================================
router.get('/calendar/availability', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, duration = '30' } = req.query;
    const durationMinutes = parseInt(duration as string, 10);

    // Parse dates or use defaults (next 7 days)
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate
      ? new Date(endDate as string)
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Generate mock available slots
    const slots = generateAvailableSlots(start, end, durationMinutes);

    res.json({
      slots,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Helper to generate mock available slots
function generateAvailableSlots(start: Date, end: Date, durationMinutes: number) {
  const slots: Array<{
    start: string;
    end: string;
    duration: number;
    available: boolean;
  }> = [];

  // Start from the next hour
  const current = new Date(start);
  current.setMinutes(0, 0, 0);
  current.setHours(current.getHours() + 1);

  while (current < end) {
    const dayOfWeek = current.getDay();
    const hour = current.getHours();

    // Only include business hours (9 AM - 5 PM, Mon-Fri)
    if (dayOfWeek > 0 && dayOfWeek < 6 && hour >= 9 && hour < 17) {
      // Randomly mark some slots as unavailable (for realism)
      const available = Math.random() > 0.3;

      slots.push({
        start: current.toISOString(),
        end: new Date(current.getTime() + durationMinutes * 60 * 1000).toISOString(),
        duration: durationMinutes,
        available,
      });
    }

    // Move to next slot
    current.setMinutes(current.getMinutes() + durationMinutes);
  }

  return slots.filter((s) => s.available).slice(0, 20); // Return only available slots
}

// ============================================
// POST /api/workspace/calendar/schedule
// Schedule a meeting (creates approval request)
// ============================================
router.post('/calendar/schedule', async (req: Request, res: Response) => {
  try {
    const { title, type, startTime, endTime, attendees, description, addMeetLink, sendNotifications } = req.body;

    // Validate required fields
    if (!title || !startTime || !endTime || !attendees?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In production, this would:
    // 1. Create a pending approval record
    // 2. Return approval ID for HITL flow
    // For demo, simulate success

    const meetingId = `meeting-${Date.now()}`;
    const meetLink = addMeetLink ? `https://meet.google.com/${Math.random().toString(36).substr(2, 10)}` : null;

    res.json({
      success: true,
      meetingId,
      meetLink,
      status: 'pending_approval',
      message: 'Meeting scheduled pending approval',
      details: {
        title,
        type,
        startTime,
        endTime,
        attendees,
        meetLink,
      },
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

// ============================================
// POST /api/workspace/email/send
// Send an email (creates approval request)
// ============================================
router.post('/email/send', async (req: Request, res: Response) => {
  try {
    const { to, cc, bcc, subject, body, attachments } = req.body;

    // Validate required fields
    if (!to?.length || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In production, this would:
    // 1. Create a pending approval record
    // 2. Return approval ID for HITL flow
    // For demo, simulate success

    const emailId = `email-${Date.now()}`;

    res.json({
      success: true,
      emailId,
      status: 'pending_approval',
      message: 'Email queued pending approval',
      details: {
        to,
        cc,
        bcc,
        subject,
        hasAttachments: attachments?.length > 0,
      },
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ============================================
// POST /api/workspace/ai/enhance
// Enhance text using AI
// ============================================
router.post('/ai/enhance', async (req: Request, res: Response) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Check if Anthropic is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return a simple enhancement without AI
      const enhanced = basicEnhancement(text, context);
      return res.json({ enhanced, source: 'basic' });
    }

    // Build the enhancement prompt based on context
    const systemPrompt = buildEnhancementSystemPrompt(context);
    const userPrompt = buildEnhancementUserPrompt(text, context);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text from response
    const enhanced = response.content[0].type === 'text'
      ? response.content[0].text
      : text;

    res.json({ enhanced, source: 'ai' });
  } catch (error) {
    console.error('AI enhance error:', error);
    // Fallback to basic enhancement
    const enhanced = basicEnhancement(req.body.text, req.body.context);
    res.json({ enhanced, source: 'basic' });
  }
});

// Helper functions for AI enhancement
function buildEnhancementSystemPrompt(context: {
  type: string;
  customerName?: string;
  tone?: string;
  agentType?: string;
}): string {
  const toneDesc = context.tone || 'professional';
  const typeDesc = context.type === 'email' ? 'email' : context.type === 'meeting_description' ? 'meeting description' : 'document';

  return `You are an expert Customer Success professional helping to write ${toneDesc} ${typeDesc}s.
Your task is to enhance the provided text to be more polished, clear, and effective while maintaining the original intent.
Keep the same general structure but improve:
- Clarity and conciseness
- Professional tone
- Grammar and punctuation
- Impact and engagement
Do not add placeholder text like {customerName}. Keep it natural.
Return ONLY the enhanced text with no explanation or preamble.`;
}

function buildEnhancementUserPrompt(text: string, context: {
  type: string;
  customerName?: string;
  additionalContext?: string;
}): string {
  let prompt = `Please enhance this ${context.type}:\n\n${text}`;

  if (context.customerName) {
    prompt += `\n\nContext: This is for a customer named ${context.customerName}.`;
  }

  if (context.additionalContext) {
    prompt += `\n\nAdditional context: ${context.additionalContext}`;
  }

  return prompt;
}

function basicEnhancement(text: string, context?: { type?: string }): string {
  let enhanced = text;

  // Capitalize first letter of sentences
  enhanced = enhanced.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) =>
    p1 + p2.toUpperCase()
  );

  // Ensure proper punctuation at end
  if (!/[.!?]$/.test(enhanced.trim())) {
    enhanced = enhanced.trim() + '.';
  }

  // Add greeting if missing for emails
  if (context?.type === 'email' && !enhanced.toLowerCase().startsWith('hi') && !enhanced.toLowerCase().startsWith('hello') && !enhanced.toLowerCase().startsWith('dear')) {
    enhanced = 'Hi,\n\n' + enhanced;
  }

  // Add closing if missing for emails
  if (context?.type === 'email' && !enhanced.toLowerCase().includes('best') && !enhanced.toLowerCase().includes('regards') && !enhanced.toLowerCase().includes('thanks')) {
    enhanced = enhanced.trim() + '\n\nBest regards';
  }

  return enhanced;
}

// ============================================
// GET /api/workspace/drive/files
// Search Drive files for attachments
// ============================================
router.get('/drive/files', async (req: Request, res: Response) => {
  try {
    const { q, limit = '10' } = req.query;
    const query = (q as string || '').toLowerCase();

    // Mock Drive files
    const mockFiles = [
      { id: 'file1', name: 'Q4 QBR Presentation.pptx', mimeType: 'application/vnd.google-apps.presentation', modifiedTime: '2024-01-15T10:00:00Z' },
      { id: 'file2', name: 'Onboarding Checklist.docx', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2024-01-14T09:00:00Z' },
      { id: 'file3', name: 'Customer Health Metrics.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2024-01-13T08:00:00Z' },
      { id: 'file4', name: 'Success Plan Template.docx', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2024-01-12T07:00:00Z' },
      { id: 'file5', name: 'Training Materials.pdf', mimeType: 'application/pdf', modifiedTime: '2024-01-11T06:00:00Z' },
    ];

    const filtered = query
      ? mockFiles.filter((f) => f.name.toLowerCase().includes(query))
      : mockFiles;

    res.json({
      files: filtered.slice(0, parseInt(limit as string, 10)),
      hasMore: filtered.length > parseInt(limit as string, 10),
    });
  } catch (error) {
    console.error('Drive files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ============================================
// POST /api/workspace/documents/create
// Create a document from template
// ============================================
router.post('/documents/create', async (req: Request, res: Response) => {
  try {
    const { template, title, folder, shareWith } = req.body;

    if (!template || !title) {
      return res.status(400).json({ error: 'Template and title are required' });
    }

    // In production, this would create a Google Doc/Sheet/Slide
    // For demo, simulate success

    const documentId = `doc-${Date.now()}`;
    const webViewLink = `https://docs.google.com/document/d/${documentId}`;

    res.json({
      success: true,
      documentId,
      webViewLink,
      title,
      template,
      sharedWith: shareWith?.map((c: { email: string }) => c.email) || [],
    });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// ============================================
// GET /api/workspace/context/upcoming
// Get upcoming meetings for context panel
// ============================================
router.get('/context/upcoming', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      // Return mock data if no user
      return res.json({ meetings: getMockUpcomingMeetings() });
    }

    try {
      // Try to fetch real meetings from Google Calendar
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = await calendarService.listEvents(userId, {
        timeMin: now,
        timeMax: nextWeek,
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      if (events && events.length > 0) {
        const meetings = events.map((event: any) => ({
          id: event.id,
          title: event.summary || 'Untitled Meeting',
          startTime: event.start?.dateTime || event.start?.date,
          endTime: event.end?.dateTime || event.end?.date,
          attendees: event.attendees?.map((a: any) => a.email) || [],
          meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri
        }));

        return res.json({ meetings });
      }
    } catch (googleError) {
      console.log('Google Calendar not available, using mock data:', (googleError as Error).message);
    }

    // Fallback to mock data
    res.json({ meetings: getMockUpcomingMeetings() });
  } catch (error) {
    console.error('Upcoming meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming meetings' });
  }
});

function getMockUpcomingMeetings() {
  const now = new Date();
  return [
    {
      id: 'm1',
      title: 'QBR with Acme Corp',
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      attendees: ['sarah.johnson@acmecorp.com'],
      meetLink: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'm2',
      title: 'Training Session - TechStart',
      startTime: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 27 * 60 * 60 * 1000).toISOString(),
      attendees: ['john.smith@techstart.io'],
      meetLink: 'https://meet.google.com/klm-nopq-rst',
    },
    {
      id: 'm3',
      title: 'Check-in Call',
      startTime: new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() + 50.5 * 60 * 60 * 1000).toISOString(),
      attendees: ['amy.wong@globalinc.com'],
    },
  ];
}

// ============================================
// GET /api/workspace/context/emails
// Get recent email threads for context panel
// ============================================
router.get('/context/emails', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.json({ emails: getMockRecentEmails() });
    }

    try {
      // Try to fetch real emails from Gmail
      const result = await gmailService.searchEmails(userId, {
        query: 'in:inbox',
        maxResults: 10
      });

      if (result && result.threads && result.threads.length > 0) {
        const emails = result.threads.slice(0, 5).map((thread: any) => {
          const lastMessage = thread.messages?.[thread.messages.length - 1];
          const headers = lastMessage?.payload?.headers || [];
          const fromHeader = headers.find((h: any) => h.name === 'From');
          const subjectHeader = headers.find((h: any) => h.name === 'Subject');
          const dateHeader = headers.find((h: any) => h.name === 'Date');

          // Extract email from "Name <email>" format
          const fromMatch = fromHeader?.value?.match(/<(.+?)>/) || [null, fromHeader?.value];
          const fromEmail = fromMatch[1] || fromHeader?.value || 'unknown@email.com';

          // Get snippet as preview
          const preview = lastMessage?.snippet || '';

          return {
            id: thread.id,
            subject: subjectHeader?.value || 'No Subject',
            from: fromEmail,
            preview: preview.substring(0, 100),
            timestamp: dateHeader?.value ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
            unread: thread.messages?.some((m: any) => m.labelIds?.includes('UNREAD')) || false
          };
        });

        return res.json({ emails });
      }
    } catch (googleError) {
      console.log('Gmail not available, using mock data:', (googleError as Error).message);
    }

    // Fallback to mock data
    res.json({ emails: getMockRecentEmails() });
  } catch (error) {
    console.error('Recent emails error:', error);
    res.status(500).json({ error: 'Failed to fetch recent emails' });
  }
});

function getMockRecentEmails() {
  return [
    {
      id: 'e1',
      subject: 'Re: Q4 Goals Discussion',
      from: 'sarah.johnson@acmecorp.com',
      preview: 'Thanks for the summary. I have a few questions about...',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      unread: true,
    },
    {
      id: 'e2',
      subject: 'Training Resources',
      from: 'john.smith@techstart.io',
      preview: 'Could you send over the training deck we discussed?',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      unread: false,
    },
    {
      id: 'e3',
      subject: 'Renewal Discussion',
      from: 'david.park@enterprise.co',
      preview: "We'd like to discuss expanding our contract...",
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      unread: false,
    },
  ];
}

// ============================================
// GET /api/workspace/contacts/customer/:customerId
// Get contacts for a specific customer (stakeholders)
// ============================================
router.get('/contacts/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!supabase) {
      return res.json({ contacts: DEMO_CONTACTS });
    }

    // Fetch stakeholders for this customer
    let query = supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    query = applyOrgFilter(query, req);

    const { data: stakeholders, error } = await query;

    if (error || !stakeholders || stakeholders.length === 0) {
      // Fallback to demo contacts
      return res.json({ contacts: DEMO_CONTACTS });
    }

    // Transform stakeholders to contact format
    const contacts = stakeholders.map((s: any, index: number) => ({
      id: s.id || `stk-${index}`,
      email: s.email || s.contact || '',
      name: s.name,
      title: s.role || s.title,
      company: s.company || '',
      source: 'stakeholder'
    })).filter((c: any) => c.email);

    res.json({ contacts: contacts.length > 0 ? contacts : DEMO_CONTACTS });
  } catch (error) {
    console.error('Customer contacts error:', error);
    res.json({ contacts: DEMO_CONTACTS });
  }
});

export default router;
