# PRD-225: Voice Note Transcription

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-225 |
| **Title** | Voice Note Transcription |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs often capture quick thoughts, meeting notes, or action items verbally while on-the-go or between meetings. Currently, these voice memos remain in audio format on phones and are rarely processed into actionable notes. AI should transcribe voice notes, extract key information, and integrate them into the customer record automatically.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to record voice notes directly in the app and have them transcribed.
2. **As a CSM**, I want to upload existing voice memos from my phone.
3. **As a CSM**, I want action items automatically extracted from voice notes.
4. **As a CSM**, I want voice notes linked to specific customers.
5. **As a CSM**, I want to search through transcribed voice note content.

### Secondary User Stories
1. **As a CSM**, I want to dictate emails instead of typing.
2. **As a CSM**, I want voice notes converted to formatted meeting summaries.
3. **As a CSM**, I want to add voice commentary to customer records.

## Acceptance Criteria

### Core Functionality
- [ ] In-app voice recording (web and mobile)
- [ ] Audio file upload (MP3, M4A, WAV, etc.)
- [ ] Automatic speech-to-text transcription
- [ ] Action item extraction from transcripts
- [ ] Customer association (automatic or manual)
- [ ] Full-text search across voice note transcripts

### Transcription Quality
- [ ] Accuracy > 95% for clear audio
- [ ] Speaker identification when multiple speakers
- [ ] Timestamp markers in transcript
- [ ] Support for industry/CS terminology
- [ ] Proper noun recognition (company/people names)

### Supported Formats
- [ ] MP3
- [ ] M4A (iPhone voice memos)
- [ ] WAV
- [ ] WebM (browser recording)
- [ ] OGG

## Technical Specification

### Architecture

```
Audio Input → Audio Processor → Speech-to-Text → Post-Processing → AI Analysis → Storage
                                                        ↓
                                               Entity Extraction
                                               Action Item Detection
```

### Audio Processing Pipeline

```typescript
interface VoiceNoteInput {
  audio_data: Blob | string;  // Blob for upload, URL for recording
  format: AudioFormat;
  duration_seconds: number;
  customer_id?: string;
  metadata?: {
    recorded_at?: Date;
    location?: string;
    context?: string;
  };
}

interface TranscriptionResult {
  id: string;
  text: string;
  segments: TranscriptSegment[];
  confidence: number;
  language: string;
  speakers?: Speaker[];
  duration_seconds: number;
}

interface TranscriptSegment {
  start_time: number;
  end_time: number;
  text: string;
  speaker_id?: string;
  confidence: number;
}
```

### Transcription Service

```typescript
async function transcribeAudio(input: VoiceNoteInput): Promise<TranscriptionResult> {
  // Preprocess audio (normalize, convert format if needed)
  const processedAudio = await preprocessAudio(input.audio_data);

  // Send to transcription service (Whisper API or similar)
  const rawTranscript = await speechToText(processedAudio);

  // Post-process for CS domain
  const enhancedTranscript = await enhanceTranscript(rawTranscript, {
    domain: 'customer_success',
    known_entities: await getKnownEntities(input.customer_id)
  });

  return enhancedTranscript;
}

async function enhanceTranscript(
  raw: RawTranscript,
  context: TranscriptContext
): Promise<TranscriptionResult> {
  // Use Claude to:
  // 1. Fix transcription errors using context
  // 2. Add proper capitalization for names
  // 3. Format for readability
  // 4. Add paragraph breaks

  const prompt = `
    Enhance this voice note transcript for a Customer Success context.

    Known entities:
    - Company names: ${context.known_entities.companies.join(', ')}
    - Person names: ${context.known_entities.people.join(', ')}
    - Product terms: ${context.known_entities.products.join(', ')}

    Raw transcript:
    ${raw.text}

    Tasks:
    1. Fix any obvious transcription errors
    2. Apply proper capitalization
    3. Add paragraph breaks for readability
    4. Preserve the original meaning exactly
  `;

  return await claude.enhance(prompt);
}
```

### AI Analysis

```typescript
interface VoiceNoteAnalysis {
  summary: string;
  action_items: ActionItem[];
  mentions: {
    customers: string[];
    people: string[];
    dates: string[];
  };
  sentiment: string;
  topics: string[];
  suggested_customer_id?: string;
}

async function analyzeVoiceNote(transcript: string): Promise<VoiceNoteAnalysis> {
  const prompt = `
    Analyze this voice note transcript from a Customer Success Manager.

    Transcript:
    ${transcript}

    Extract:
    1. Brief summary (1-2 sentences)
    2. Action items with owners if mentioned
    3. Customer/company mentions
    4. People mentioned
    5. Dates/times mentioned
    6. Overall sentiment/tone
    7. Key topics discussed

    Format as JSON.
  `;

  return await claude.analyze(prompt);
}
```

### API Endpoints

#### POST /api/voice-notes/record
Start/stop recording (WebSocket for streaming).

#### POST /api/voice-notes/upload
```json
{
  "audio_file": "base64 encoded audio",
  "format": "m4a",
  "customer_id": "optional-uuid",
  "context": "Post-meeting notes from TechCorp call"
}
```

Response:
```json
{
  "voice_note_id": "uuid",
  "status": "processing",
  "estimated_time_seconds": 30
}
```

#### GET /api/voice-notes/{id}
```json
{
  "id": "uuid",
  "status": "completed",
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "duration_seconds": 120,
  "created_at": "2026-01-29T10:00:00Z",
  "transcript": {
    "text": "Just finished the call with Sarah from TechCorp. She mentioned they're happy with the product but concerned about the upcoming price increase...",
    "confidence": 0.94,
    "segments": [...]
  },
  "analysis": {
    "summary": "Post-call notes about TechCorp satisfaction and pricing concerns",
    "action_items": [
      {
        "description": "Send pricing comparison showing value",
        "owner": "CSM",
        "due": "This week"
      },
      {
        "description": "Schedule follow-up with Sarah",
        "owner": "CSM"
      }
    ],
    "mentions": {
      "customers": ["TechCorp"],
      "people": ["Sarah"],
      "dates": ["next week"]
    },
    "sentiment": "cautiously positive",
    "topics": ["pricing", "satisfaction", "renewal"]
  },
  "audio_url": "secure-url-to-audio"
}
```

#### GET /api/voice-notes/search
```json
{
  "query": "pricing concerns",
  "customer_id": "optional",
  "date_range": { "from": "2026-01-01", "to": "2026-01-31" }
}
```

### Database Schema

```sql
CREATE TABLE voice_notes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  audio_url TEXT NOT NULL,
  audio_format VARCHAR(20),
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'processing',
  transcript TEXT,
  transcript_segments JSONB,
  transcript_confidence DECIMAL(3,2),
  analysis JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_voice_notes_user ON voice_notes(user_id, created_at DESC);
CREATE INDEX idx_voice_notes_customer ON voice_notes(customer_id);
CREATE INDEX idx_voice_notes_transcript ON voice_notes USING gin(to_tsvector('english', transcript));
```

## UI/UX Design

### Voice Note Recorder
```
┌─────────────────────────────────────────────────────────┐
│ VOICE NOTE                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ┌──────────┐                         │
│                    │    🎤    │                         │
│                    │  2:34    │                         │
│                    └──────────┘                         │
│                                                         │
│                    ████████░░░░                         │
│                    Recording...                         │
│                                                         │
│           [⏹ Stop]     [⏸ Pause]                       │
│                                                         │
│ Customer: [TechCorp Industries ▼] (optional)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Voice Note Processing View
```
┌─────────────────────────────────────────────────────────┐
│ VOICE NOTE - Jan 29, 2026, 10:15 AM                     │
│ Duration: 2:34 | Customer: TechCorp Industries          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🎵 [▶️ Play Audio]  ━━━━━━━━━━━━━━━━━━━━░░░░  2:34      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ TRANSCRIPT                                    [Edit]    │
│ ──────────                                              │
│ Just finished the call with Sarah from TechCorp. She    │
│ mentioned they're happy with the product overall but    │
│ are concerned about the upcoming price increase.        │
│                                                         │
│ She asked if we could prepare a comparison showing the  │
│ value they're getting compared to alternatives. I said  │
│ I'd send something over this week.                      │
│                                                         │
│ We should also schedule a follow-up next week to        │
│ discuss the renewal terms in more detail.               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ AI ANALYSIS                                             │
│ ───────────                                             │
│ Summary: Post-call notes - TechCorp satisfied but       │
│ concerned about pricing                                 │
│                                                         │
│ Action Items:                                           │
│ ☐ Send value comparison document       Due: This week   │
│ ☐ Schedule follow-up call              Due: Next week   │
│                                                         │
│ Topics: pricing, satisfaction, renewal                  │
│ Sentiment: Cautiously positive                          │
│                                                         │
│ [Create Tasks] [Add to Timeline] [Share]                │
└─────────────────────────────────────────────────────────┘
```

### Voice Notes List
```
┌─────────────────────────────────────────────────────────┐
│ VOICE NOTES                     [Record New] [Upload]   │
│ [All ▼] [Search...]                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ TODAY                                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎤 2:34  TechCorp - Post-call pricing concerns      │ │
│ │    10:15 AM | 2 action items                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ YESTERDAY                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎤 1:20  Acme Corp - QBR prep notes                 │ │
│ │    4:30 PM | 3 action items                         │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎤 0:45  GlobalCo - Quick update                    │ │
│ │    2:15 PM | No actions                             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Speech-to-text service (OpenAI Whisper or similar)
- Audio file storage (S3/GCS)
- WebRTC for browser recording
- Claude API for analysis

### Related PRDs
- PRD-213: AI Meeting Summarization
- PRD-269: Mobile Meeting Notes
- PRD-264: Voice Command Support

## Success Metrics

### Quantitative
- Transcription accuracy > 95%
- Processing time < 30 seconds for 2-minute note
- Action item extraction accuracy > 85%
- User adoption: 40% of CSMs use weekly

### Qualitative
- Transcripts are readable and accurate
- Action items match what was said
- Voice notes integrate smoothly into workflow

## Rollout Plan

### Phase 1: Basic Transcription (Week 1-2)
- Audio upload and transcription
- Basic transcript display
- Manual customer association

### Phase 2: Analysis (Week 3-4)
- AI analysis and extraction
- Action item detection
- Search capability

### Phase 3: Recording (Week 5-6)
- In-app recording
- Real-time transcription preview
- Automatic customer detection

### Phase 4: Integration (Week 7-8)
- Task creation from action items
- Timeline integration
- Mobile app support

## Open Questions
1. How long should we retain audio files?
2. Should we support real-time transcription during recording?
3. How do we handle poor audio quality?
4. What's the privacy policy for voice recordings?
