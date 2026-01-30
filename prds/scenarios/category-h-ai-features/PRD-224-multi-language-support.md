# PRD-224: Multi-Language Support

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-224 |
| **Title** | Multi-Language Support |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer Success teams increasingly work with global customers who communicate in different languages. CSMs may need to read emails in French, draft responses in Spanish, or analyze meeting transcripts in German. The AI assistant should seamlessly handle multiple languages, translating when needed and generating content in the appropriate language for each customer.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to read customer emails in their original language with translation provided.
2. **As a CSM**, I want to draft emails in the customer's preferred language.
3. **As a CSM**, I want meeting summaries generated in the language of the meeting.
4. **As a CSM**, I want to ask questions in English and get answers about non-English content.
5. **As a CSM**, I want language preferences stored per customer/stakeholder.

### Secondary User Stories
1. **As a CSM**, I want automatic language detection on incoming communications.
2. **As a CSM**, I want to toggle between original and translated views.
3. **As a Global CS Leader**, I want reports generated in multiple languages.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic language detection on all text input
- [ ] Real-time translation of customer communications
- [ ] Content generation in specified target language
- [ ] Language preference storage per stakeholder
- [ ] Bilingual display option (original + translation)

### Languages Supported (Tier 1)
- [ ] English (base)
- [ ] Spanish
- [ ] French
- [ ] German
- [ ] Portuguese
- [ ] Japanese
- [ ] Chinese (Simplified)

### Languages Supported (Tier 2)
- [ ] Italian
- [ ] Dutch
- [ ] Korean
- [ ] Arabic
- [ ] Hindi

### Content Types
- [ ] Email composition and reading
- [ ] Meeting transcript analysis
- [ ] Document extraction and Q&A
- [ ] Chat interface interactions
- [ ] Report generation

## Technical Specification

### Architecture

```
Input Text → Language Detector → Translation Engine → Processing → Output Formatter
                                       ↓
                              Language-Aware AI
```

### Language Detection

```typescript
interface LanguageDetection {
  text_sample: string;
  detected_language: string;
  confidence: number;
  alternative_languages?: { language: string; confidence: number }[];
}

async function detectLanguage(text: string): Promise<LanguageDetection> {
  // Use Claude's built-in language understanding
  // or dedicated language detection service
  const response = await claude.analyze({
    prompt: `Detect the language of this text. Return the ISO 639-1 code, confidence (0-1), and any alternative possibilities.

    Text: ${text.slice(0, 500)}`,
    response_format: 'json'
  });

  return response;
}
```

### Translation Service

```typescript
interface TranslationRequest {
  text: string;
  source_language?: string;  // Auto-detect if not provided
  target_language: string;
  preserve_formatting: boolean;
  context?: string;  // Business context for better translation
}

interface TranslationResult {
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  confidence: number;
}

async function translateText(request: TranslationRequest): Promise<TranslationResult> {
  const prompt = `
    Translate the following text from ${request.source_language || 'auto-detected language'} to ${request.target_language}.

    Context: This is a ${request.context || 'business communication'} in a Customer Success context.

    Requirements:
    - Maintain professional tone
    - Preserve any technical terms
    - Keep formatting (bullet points, paragraphs)
    - Preserve names and company references

    Text to translate:
    ${request.text}

    Provide the translation only, no explanations.
  `;

  return await claude.translate(prompt);
}
```

### Language-Aware Content Generation

```typescript
interface ContentGenerationRequest {
  task: 'email' | 'summary' | 'response' | 'report';
  target_language: string;
  context: CustomerContext;
  user_input: string;  // Can be in any language
}

async function generateContent(request: ContentGenerationRequest): Promise<string> {
  const systemPrompt = `
    You are a Customer Success AI assistant.
    Generate all output in ${request.target_language}.
    The user may communicate in any language - understand and respond appropriately.

    Customer context:
    - Name: ${request.context.customer_name}
    - Preferred language: ${request.target_language}
    - Stakeholder: ${request.context.stakeholder_name}
  `;

  return await claude.generate({
    system: systemPrompt,
    user: request.user_input,
    task: request.task
  });
}
```

### API Endpoints

#### POST /api/translate
```json
{
  "text": "Bonjour, j'aimerais discuter de notre renouvellement.",
  "target_language": "en",
  "context": "customer_email"
}
```

Response:
```json
{
  "original_text": "Bonjour, j'aimerais discuter de notre renouvellement.",
  "translated_text": "Hello, I would like to discuss our renewal.",
  "source_language": "fr",
  "target_language": "en",
  "confidence": 0.98
}
```

#### POST /api/generate/multilingual
```json
{
  "task": "email",
  "prompt": "Write a renewal follow-up email",
  "customer_id": "uuid",
  "target_language": "es"  // Spanish
}
```

Response:
```json
{
  "content": "Estimado/a [Nombre],\n\nEspero que se encuentre bien...",
  "language": "es",
  "english_summary": "Spanish renewal follow-up email thanking customer and requesting meeting"
}
```

#### PUT /api/stakeholders/{id}/preferences
```json
{
  "preferred_language": "fr",
  "communication_preferences": {
    "email_language": "fr",
    "meeting_language": "en"
  }
}
```

### Database Schema

```sql
-- Add language preferences to stakeholders
ALTER TABLE stakeholders
ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en',
ADD COLUMN language_preferences JSONB;

-- Translation cache for frequently accessed content
CREATE TABLE translation_cache (
  id UUID PRIMARY KEY,
  content_hash TEXT NOT NULL,
  source_language VARCHAR(10) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  UNIQUE(content_hash, source_language, target_language)
);

-- Language detection results
CREATE TABLE language_detections (
  id UUID PRIMARY KEY,
  content_type VARCHAR(50),  -- email, meeting, document
  content_id TEXT,
  detected_language VARCHAR(10),
  confidence DECIMAL(3,2),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UI/UX Design

### Bilingual Email View
```
┌─────────────────────────────────────────────────────────┐
│ From: Pierre Dubois <pierre@acmefrance.fr>              │
│ Subject: Discussion renouvellement                      │
│ Language: French 🇫🇷 [Show Original] [Translate to EN]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ TRANSLATION (English)                                   │
│ ─────────────────────                                   │
│ Hello,                                                  │
│                                                         │
│ I would like to discuss our contract renewal. We are    │
│ very satisfied with the service but have some questions │
│ about pricing for the new year.                         │
│                                                         │
│ Could we schedule a call this week?                     │
│                                                         │
│ Best regards,                                           │
│ Pierre                                                  │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ORIGINAL (French)                               [Hide]  │
│ ─────────────────                                       │
│ Bonjour,                                                │
│                                                         │
│ J'aimerais discuter de notre renouvellement de contrat. │
│ Nous sommes très satisfaits du service mais avons       │
│ quelques questions sur les tarifs pour l'année          │
│ prochaine.                                              │
│                                                         │
│ Pourrions-nous planifier un appel cette semaine?        │
│                                                         │
│ Cordialement,                                           │
│ Pierre                                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Reply in French 🇫🇷] [Reply in English 🇺🇸]             │
└─────────────────────────────────────────────────────────┘
```

### Language-Aware Email Composition
```
┌─────────────────────────────────────────────────────────┐
│ COMPOSE EMAIL                                           │
├─────────────────────────────────────────────────────────┤
│ To: Pierre Dubois (pierre@acmefrance.fr)                │
│ Preferred Language: French 🇫🇷                           │
│                                                         │
│ Language: [French 🇫🇷 ▼]                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Your prompt (in any language):                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Write a response agreeing to the meeting and        │ │
│ │ suggesting Thursday at 2pm Paris time               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Generate in French]                                    │
│                                                         │
│ GENERATED EMAIL                                         │
│ ───────────────                                         │
│ Bonjour Pierre,                                         │
│                                                         │
│ Merci pour votre message. Je serais ravi de discuter    │
│ de votre renouvellement.                                │
│                                                         │
│ Êtes-vous disponible jeudi à 14h (heure de Paris)?      │
│                                                         │
│ Cordialement                                            │
│                                                         │
│ [English Preview: "Hello Pierre, Thank you for your..."]│
│                                                         │
│ [Send] [Edit] [Regenerate]                              │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Claude API (with multilingual capabilities)
- Translation caching layer
- Language detection service
- Stakeholder preference storage

### Related PRDs
- PRD-215: Smart Email Response Suggestions
- PRD-213: AI Meeting Summarization
- PRD-222: Document Understanding & Extraction

## Success Metrics

### Quantitative
- Translation accuracy > 95% (validated by native speakers)
- Language detection accuracy > 99%
- Generation fluency score > 4/5 (native speaker ratings)
- Response time for translation < 2 seconds

### Qualitative
- CSMs confidently engage with non-English customers
- Translated content maintains professional tone
- Language switching is seamless

## Rollout Plan

### Phase 1: Translation (Week 1-2)
- Basic translation for emails
- Language detection
- Tier 1 languages

### Phase 2: Generation (Week 3-4)
- Email generation in multiple languages
- Stakeholder language preferences
- Bilingual display

### Phase 3: Full Coverage (Week 5-6)
- Meeting transcript translation
- Document extraction in multiple languages
- Tier 2 languages

### Phase 4: Polish (Week 7-8)
- Translation memory/caching
- Quality improvements
- Regional variants (es-ES vs es-MX)

## Open Questions
1. How do we handle mixed-language content?
2. Should we support regional variants (UK vs US English)?
3. How do we quality-assure translations at scale?
4. What's the approach for technical/domain-specific terminology?
