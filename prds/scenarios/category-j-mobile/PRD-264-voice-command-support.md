# PRD-264: Voice Command Support

## Metadata
- **PRD ID**: PRD-264
- **Title**: Voice Command Support
- **Category**: J - Mobile & Accessibility
- **Priority**: P3
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), Speech recognition API, AI assistant

---

## Problem Statement

CSMs are often multitasking - driving to customer meetings, walking between sessions at conferences, or preparing while doing other activities. Typing on mobile is slow and awkward in these situations, but they still need to interact with CSCX.AI.

## User Story

> As a CSM on the go, I want to interact with CSCX.AI using voice commands so that I can get information and take actions hands-free while multitasking.

---

## Functional Requirements

### FR-1: Voice Input
- **FR-1.1**: Activate voice with button or wake word
- **FR-1.2**: Continuous listening mode (configurable)
- **FR-1.3**: Visual feedback during listening
- **FR-1.4**: Interim transcription display
- **FR-1.5**: Noise cancellation

### FR-2: Command Recognition
- **FR-2.1**: Natural language command parsing
- **FR-2.2**: Customer name recognition
- **FR-2.3**: Common action shortcuts ("tell me about...", "draft email to...")
- **FR-2.4**: Confirmation for destructive actions
- **FR-2.5**: "Undo" voice command

### FR-3: Voice Response
- **FR-3.1**: Text-to-speech for AI responses
- **FR-3.2**: Adjustable speech rate
- **FR-3.3**: Voice response toggle
- **FR-3.4**: Pause/resume during playback
- **FR-3.5**: Summary mode for long responses

### FR-4: Hands-Free Navigation
- **FR-4.1**: "Go to [customer]" navigation
- **FR-4.2**: "Show my tasks" commands
- **FR-4.3**: "Read notifications" command
- **FR-4.4**: "Back" and "Home" navigation
- **FR-4.5**: "Scroll up/down" commands

### FR-5: Voice Dictation
- **FR-5.1**: Dictate notes and emails
- **FR-5.2**: Punctuation commands ("period", "comma")
- **FR-5.3**: Formatting commands ("new paragraph")
- **FR-5.4**: Edit commands ("delete last sentence")
- **FR-5.5**: Review and confirm before saving

---

## Non-Functional Requirements

### NFR-1: Accuracy
- 95%+ recognition accuracy for common commands

### NFR-2: Responsiveness
- Transcription appears within 500ms

### NFR-3: Privacy
- Voice data not stored without consent

---

## Technical Approach

### Speech Recognition Integration

```typescript
// Voice command system
class VoiceCommandSystem {
  private recognition: SpeechRecognition;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private commandHandlers: Map<string, CommandHandler> = new Map();

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.synthesis = window.speechSynthesis;

    this.setupEventHandlers();
    this.registerDefaultCommands();
  }

  private setupEventHandlers(): void {
    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const result = event.results[last];

      if (result.isFinal) {
        this.processCommand(result[0].transcript);
      } else {
        this.emitInterimResult(result[0].transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.emitError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emitListeningStateChange(false);
    };
  }

  private registerDefaultCommands(): void {
    // Navigation commands
    this.registerCommand('go to *', async (customer) => {
      const match = await findCustomerByName(customer);
      if (match) {
        navigate(`/customers/${match.id}`);
        return `Opening ${match.name}`;
      }
      return `Could not find customer ${customer}`;
    });

    // Information commands
    this.registerCommand('tell me about *', async (customer) => {
      const summary = await getCustomerSummary(customer);
      return summary;
    });

    // Action commands
    this.registerCommand('draft email to *', async (customer) => {
      const match = await findCustomerByName(customer);
      navigate(`/customers/${match.id}/email/new`);
      return `Starting email draft for ${match.name}`;
    });

    // Task commands
    this.registerCommand('show my tasks', async () => {
      navigate('/tasks');
      const tasks = await getMyTasks();
      return `You have ${tasks.length} tasks. ${tasks[0]?.title || 'No urgent tasks.'}`;
    });
  }

  registerCommand(pattern: string, handler: CommandHandler): void {
    this.commandHandlers.set(pattern, handler);
  }

  async processCommand(transcript: string): Promise<void> {
    const normalized = transcript.toLowerCase().trim();

    for (const [pattern, handler] of this.commandHandlers) {
      const match = this.matchPattern(pattern, normalized);
      if (match) {
        const response = await handler(...match.args);
        if (response) {
          this.speak(response);
        }
        return;
      }
    }

    // Fall back to AI assistant
    const aiResponse = await sendToAI(transcript);
    this.speak(aiResponse);
  }

  private matchPattern(pattern: string, input: string): { args: string[] } | null {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '(.+)') + '$');
    const match = input.match(regex);
    if (match) {
      return { args: match.slice(1) };
    }
    return null;
  }

  startListening(): void {
    if (this.isListening) return;
    this.recognition.start();
    this.isListening = true;
    this.emitListeningStateChange(true);
  }

  stopListening(): void {
    this.recognition.stop();
    this.isListening = false;
    this.emitListeningStateChange(false);
  }

  speak(text: string): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    this.synthesis.speak(utterance);
  }
}
```

### Voice UI Components

```typescript
// Voice input button component
const VoiceInputButton: React.FC<{
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
}> = ({ onTranscript, onError }) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const voiceSystem = useVoiceCommandSystem();

  const handlePress = () => {
    if (isListening) {
      voiceSystem.stopListening();
    } else {
      voiceSystem.startListening();
    }
  };

  useEffect(() => {
    voiceSystem.onListeningChange(setIsListening);
    voiceSystem.onInterimResult(setInterimText);
    voiceSystem.onFinalResult(onTranscript);
    voiceSystem.onError(onError);
  }, [voiceSystem]);

  return (
    <div className="voice-input">
      <button
        onClick={handlePress}
        className={`voice-button ${isListening ? 'listening' : ''}`}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      >
        <MicrophoneIcon />
        {isListening && <PulsingRing />}
      </button>
      {interimText && (
        <div className="interim-transcript">{interimText}</div>
      )}
    </div>
  );
};

// Voice response player
const VoiceResponsePlayer: React.FC<{ text: string }> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const voiceSystem = useVoiceCommandSystem();

  const handlePlay = () => {
    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      voiceSystem.speak(text);
      setIsPlaying(true);
    }
  };

  return (
    <button onClick={handlePlay} className="voice-play-button">
      {isPlaying ? <StopIcon /> : <PlayIcon />}
      <span>{isPlaying ? 'Stop' : 'Listen'}</span>
    </button>
  );
};
```

### Voice Dictation Mode

```typescript
// Dictation mode for composing text
class DictationMode {
  private buffer: string = '';
  private recognition: SpeechRecognition;

  private punctuationMap: Record<string, string> = {
    'period': '.',
    'comma': ',',
    'question mark': '?',
    'exclamation mark': '!',
    'colon': ':',
    'semicolon': ';',
    'new line': '\n',
    'new paragraph': '\n\n'
  };

  processInput(transcript: string): string {
    let processed = transcript;

    // Handle punctuation commands
    for (const [command, punctuation] of Object.entries(this.punctuationMap)) {
      processed = processed.replace(new RegExp(command, 'gi'), punctuation);
    }

    // Handle edit commands
    if (processed.toLowerCase().includes('delete last sentence')) {
      this.buffer = this.deleteLastSentence(this.buffer);
      return this.buffer;
    }

    if (processed.toLowerCase().includes('delete last word')) {
      this.buffer = this.deleteLastWord(this.buffer);
      return this.buffer;
    }

    this.buffer += (this.buffer ? ' ' : '') + processed;
    return this.buffer;
  }

  private deleteLastSentence(text: string): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    sentences.pop();
    return sentences.join(' ');
  }

  private deleteLastWord(text: string): string {
    return text.replace(/\s*\S+\s*$/, '');
  }

  clear(): void {
    this.buffer = '';
  }

  getBuffer(): string {
    return this.buffer;
  }
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Voice feature adoption | 20% of mobile users | Feature tracking |
| Command recognition accuracy | 95%+ | Recognition logs |
| Voice session completion | 80%+ | Session tracking |
| User satisfaction | 4/5+ | Feedback |

---

## Acceptance Criteria

- [ ] Voice input activates with button press
- [ ] Interim transcription displayed while speaking
- [ ] Natural language commands recognized
- [ ] Customer names matched accurately
- [ ] Text-to-speech reads responses
- [ ] Dictation mode with punctuation commands
- [ ] Edit commands work (delete last word/sentence)
- [ ] Voice navigation functional
- [ ] Confirmation required for actions
- [ ] Works on iOS Safari and Chrome Android

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Speech recognition integration | 3 days |
| Command parsing system | 3 days |
| Text-to-speech | 2 days |
| Voice UI components | 2 days |
| Dictation mode | 2 days |
| Customer name matching | 2 days |
| Testing | 2 days |
| **Total** | **16 days** |

---

## Notes

- Browser speech API support varies
- Consider cloud speech API for better accuracy
- Future: Wake word detection ("Hey CSCX")
- Future: Voice profiles for multiple users
- Future: Accent and language customization
