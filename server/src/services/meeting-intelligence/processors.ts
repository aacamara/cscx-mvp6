/**
 * Meeting Transcript Processors
 * Parse transcripts from various sources (Zoom, Otter, VTT, etc.)
 */

import type { MeetingTranscript, TranscriptSegment, MeetingParticipant } from './index.js';

// ============================================
// VTT Parser (WebVTT format - Zoom transcripts)
// ============================================

/**
 * Parse VTT transcript format
 * Zoom cloud recordings use VTT format
 */
export function parseVTT(vttContent: string, meetingId: string, title: string): MeetingTranscript {
  const segments: TranscriptSegment[] = [];
  const participants = new Map<string, MeetingParticipant>();

  // Split by double newline to get cue blocks
  const blocks = vttContent.split(/\n\n+/);

  for (const block of blocks) {
    // Skip WEBVTT header and NOTE blocks
    if (block.startsWith('WEBVTT') || block.startsWith('NOTE')) {
      continue;
    }

    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Parse timestamp line (e.g., "00:00:00.000 --> 00:00:05.000")
    const timestampLine = lines.find((l) => l.includes('-->'));
    if (!timestampLine) continue;

    const [startStr, endStr] = timestampLine.split('-->').map((t) => t.trim());
    const startTime = parseVTTTime(startStr);
    const endTime = parseVTTTime(endStr);

    // The rest is the text content
    const textLines = lines.slice(lines.indexOf(timestampLine) + 1);
    let text = textLines.join(' ').trim();

    // Extract speaker if present (format: "Speaker Name: text")
    let speaker = 'Unknown';
    const speakerMatch = text.match(/^([^:]+):\s*/);
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      text = text.substring(speakerMatch[0].length).trim();
    }

    if (text) {
      segments.push({
        speaker,
        text,
        startTime,
        endTime,
      });

      // Track participant
      if (!participants.has(speaker)) {
        participants.set(speaker, {
          name: speaker,
          speakingTime: 0,
        });
      }
      participants.get(speaker)!.speakingTime! += endTime - startTime;
    }
  }

  // Calculate duration from last segment
  const duration = segments.length > 0
    ? Math.ceil((segments[segments.length - 1].endTime || 0) / 60)
    : 0;

  return {
    meetingId,
    source: 'zoom',
    title,
    startTime: new Date(),
    duration,
    participants: Array.from(participants.values()),
    transcript: segments,
  };
}

/**
 * Parse VTT timestamp to seconds
 */
function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const seconds = parseFloat(parts.pop() || '0');
  const minutes = parseInt(parts.pop() || '0', 10);
  const hours = parseInt(parts.pop() || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================
// Otter.ai Parser
// ============================================

/**
 * Parse Otter.ai transcript format
 */
export function parseOtterTranscript(
  otterData: {
    title: string;
    created_at: string;
    summary?: string;
    transcripts: Array<{
      speaker: { name: string; email?: string };
      text: string;
      start_time: number;
      end_time: number;
    }>;
  },
  meetingId: string
): MeetingTranscript {
  const participants = new Map<string, MeetingParticipant>();

  const segments: TranscriptSegment[] = otterData.transcripts.map((t) => {
    const speaker = t.speaker.name;

    // Track participant
    if (!participants.has(speaker)) {
      participants.set(speaker, {
        name: speaker,
        email: t.speaker.email,
        speakingTime: 0,
      });
    }
    participants.get(speaker)!.speakingTime! += (t.end_time - t.start_time) / 1000;

    return {
      speaker,
      text: t.text,
      startTime: t.start_time / 1000,
      endTime: t.end_time / 1000,
    };
  });

  // Calculate duration
  const duration = segments.length > 0
    ? Math.ceil((segments[segments.length - 1].endTime || 0) / 60)
    : 0;

  return {
    meetingId,
    source: 'otter',
    title: otterData.title,
    startTime: new Date(otterData.created_at),
    duration,
    participants: Array.from(participants.values()),
    transcript: segments,
    rawText: otterData.summary,
  };
}

// ============================================
// Plain Text Parser
// ============================================

/**
 * Parse plain text transcript
 * Attempts to detect speaker changes
 */
export function parsePlainTextTranscript(
  text: string,
  meetingId: string,
  title: string,
  startTime?: Date
): MeetingTranscript {
  const segments: TranscriptSegment[] = [];
  const participants = new Map<string, MeetingParticipant>();

  // Split by common speaker patterns
  // Pattern: "Name:" or "NAME:" or "[Name]" at start of line
  const lines = text.split('\n');
  let currentSpeaker = 'Unknown';
  let currentText = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for speaker change
    const speakerMatch = trimmedLine.match(/^(?:\[([^\]]+)\]|([A-Za-z\s]+):)\s*/);

    if (speakerMatch) {
      // Save previous segment
      if (currentText) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
        });

        // Track participant
        if (!participants.has(currentSpeaker)) {
          participants.set(currentSpeaker, { name: currentSpeaker });
        }
      }

      // Start new segment
      currentSpeaker = (speakerMatch[1] || speakerMatch[2]).trim();
      currentText = trimmedLine.substring(speakerMatch[0].length);
    } else {
      // Continue current segment
      currentText += ' ' + trimmedLine;
    }
  }

  // Save final segment
  if (currentText) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
    });
    if (!participants.has(currentSpeaker)) {
      participants.set(currentSpeaker, { name: currentSpeaker });
    }
  }

  return {
    meetingId,
    source: 'manual',
    title,
    startTime: startTime || new Date(),
    participants: Array.from(participants.values()),
    transcript: segments,
    rawText: text,
  };
}

// ============================================
// Google Meet Parser (SRT format)
// ============================================

/**
 * Parse SRT subtitle format (Google Meet exports)
 */
export function parseSRT(srtContent: string, meetingId: string, title: string): MeetingTranscript {
  const segments: TranscriptSegment[] = [];
  const participants = new Map<string, MeetingParticipant>();

  // Split by numbered entries
  const entries = srtContent.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.trim().split('\n');
    if (lines.length < 3) continue;

    // Skip sequence number (first line)
    // Parse timestamp (second line)
    const timestampLine = lines[1];
    const timestampMatch = timestampLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );

    if (!timestampMatch) continue;

    const startTime = parseSRTTime(timestampMatch[1]);
    const endTime = parseSRTTime(timestampMatch[2]);

    // Rest is text
    let text = lines.slice(2).join(' ').trim();

    // Extract speaker if present
    let speaker = 'Unknown';
    const speakerMatch = text.match(/^<v\s+([^>]+)>/);
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      text = text.replace(/<\/?v[^>]*>/g, '').trim();
    }

    if (text) {
      segments.push({
        speaker,
        text,
        startTime,
        endTime,
      });

      if (!participants.has(speaker)) {
        participants.set(speaker, { name: speaker, speakingTime: 0 });
      }
      participants.get(speaker)!.speakingTime! += endTime - startTime;
    }
  }

  const duration = segments.length > 0
    ? Math.ceil((segments[segments.length - 1].endTime || 0) / 60)
    : 0;

  return {
    meetingId,
    source: 'google_meet',
    title,
    startTime: new Date(),
    duration,
    participants: Array.from(participants.values()),
    transcript: segments,
  };
}

/**
 * Parse SRT timestamp to seconds
 */
function parseSRTTime(timeStr: string): number {
  const [time, ms] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + parseInt(ms, 10) / 1000;
}

// ============================================
// Microsoft Teams Parser
// ============================================

/**
 * Parse Microsoft Teams transcript format
 */
export function parseTeamsTranscript(
  teamsData: {
    meetingTitle: string;
    startDateTime: string;
    endDateTime?: string;
    transcriptEntries: Array<{
      speaker: { displayName: string; email?: string };
      text: string;
      timestamp: string;
    }>;
  },
  meetingId: string
): MeetingTranscript {
  const participants = new Map<string, MeetingParticipant>();

  const segments: TranscriptSegment[] = teamsData.transcriptEntries.map((entry, index) => {
    const speaker = entry.speaker.displayName;
    const startTime = new Date(entry.timestamp).getTime() / 1000;

    // Estimate end time from next entry
    const nextEntry = teamsData.transcriptEntries[index + 1];
    const endTime = nextEntry
      ? new Date(nextEntry.timestamp).getTime() / 1000
      : startTime + 5; // Default 5 second segment

    // Track participant
    if (!participants.has(speaker)) {
      participants.set(speaker, {
        name: speaker,
        email: entry.speaker.email,
        speakingTime: 0,
      });
    }
    participants.get(speaker)!.speakingTime! += endTime - startTime;

    return {
      speaker,
      text: entry.text,
      startTime,
      endTime,
    };
  });

  // Calculate duration
  const startDateTime = new Date(teamsData.startDateTime);
  const endDateTime = teamsData.endDateTime
    ? new Date(teamsData.endDateTime)
    : new Date(startDateTime.getTime() + (segments[segments.length - 1]?.endTime || 0) * 1000);

  const duration = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / 60000);

  return {
    meetingId,
    source: 'teams',
    title: teamsData.meetingTitle,
    startTime: startDateTime,
    endTime: endDateTime,
    duration,
    participants: Array.from(participants.values()),
    transcript: segments,
  };
}

// ============================================
// Auto-detect Parser
// ============================================

/**
 * Auto-detect transcript format and parse
 */
export function parseTranscript(
  content: string,
  meetingId: string,
  title: string,
  format?: 'vtt' | 'srt' | 'otter' | 'teams' | 'plain'
): MeetingTranscript {
  // Try to auto-detect format if not specified
  if (!format) {
    if (content.startsWith('WEBVTT')) {
      format = 'vtt';
    } else if (/^\d+\n\d{2}:\d{2}:\d{2},\d{3}/.test(content)) {
      format = 'srt';
    } else if (content.includes('"transcripts"') || content.includes('"speaker"')) {
      format = 'otter';
    } else {
      format = 'plain';
    }
  }

  switch (format) {
    case 'vtt':
      return parseVTT(content, meetingId, title);
    case 'srt':
      return parseSRT(content, meetingId, title);
    case 'otter':
      return parseOtterTranscript(JSON.parse(content), meetingId);
    case 'teams':
      return parseTeamsTranscript(JSON.parse(content), meetingId);
    case 'plain':
    default:
      return parsePlainTextTranscript(content, meetingId, title);
  }
}

// ============================================
// Participant Role Detection
// ============================================

/**
 * Detect participant roles based on names and context
 */
export function detectParticipantRoles(
  participants: MeetingParticipant[],
  customerCompanyName?: string,
  internalDomain?: string
): MeetingParticipant[] {
  return participants.map((p) => {
    let role: 'host' | 'participant' | 'customer' | 'internal' = 'participant';

    // Check email domain
    if (p.email) {
      if (internalDomain && p.email.endsWith(`@${internalDomain}`)) {
        role = 'internal';
      } else if (customerCompanyName) {
        // Assume external emails are customers in customer meetings
        role = 'customer';
      }
    }

    // Check name for common patterns
    const nameLower = p.name.toLowerCase();
    if (nameLower.includes('host') || nameLower.includes('organizer')) {
      role = 'internal';
    }

    return {
      ...p,
      role,
    };
  });
}
