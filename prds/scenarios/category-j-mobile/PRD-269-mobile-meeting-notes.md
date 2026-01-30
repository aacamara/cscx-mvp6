# PRD-269: Mobile Meeting Notes

## Metadata
- **PRD ID**: PRD-269
- **Title**: Mobile Meeting Notes
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), PRD-264 (Voice Commands), Meeting intelligence

---

## Problem Statement

CSMs attend meetings away from their laptops - in conference rooms, at customer sites, during travel. Taking notes on mobile is cumbersome, and many meetings go undocumented. Later, they struggle to recall important details and action items.

## User Story

> As a CSM in a meeting, I want to easily capture notes on my mobile device using voice, quick templates, and structured inputs so that I never lose important meeting outcomes.

---

## Functional Requirements

### FR-1: Quick Start
- **FR-1.1**: One-tap meeting note start from notification
- **FR-1.2**: Auto-detect meeting from calendar
- **FR-1.3**: Quick customer selection
- **FR-1.4**: Template selection for meeting type
- **FR-1.5**: Join existing note if already started

### FR-2: Voice Capture
- **FR-2.1**: Voice recording of entire meeting
- **FR-2.2**: Voice-to-text for live notes
- **FR-2.3**: Highlight key moments (button tap)
- **FR-2.4**: Pause/resume recording
- **FR-2.5**: Bookmark timestamps

### FR-3: Structured Input
- **FR-3.1**: Quick-add action items
- **FR-3.2**: Tag stakeholders present
- **FR-3.3**: Risk/opportunity flags
- **FR-3.4**: Sentiment indicators
- **FR-3.5**: Pre-defined topic checkboxes

### FR-4: Real-Time Collaboration
- **FR-4.1**: Multiple team members contribute
- **FR-4.2**: See others' additions live
- **FR-4.3**: Assign action items to others
- **FR-4.4**: @mention for emphasis
- **FR-4.5**: Sync across devices

### FR-5: Post-Meeting Processing
- **FR-5.1**: AI generates summary
- **FR-5.2**: Extract action items automatically
- **FR-5.3**: Create tasks from action items
- **FR-5.4**: Suggest follow-up email
- **FR-5.5**: Link to meeting recording

---

## Non-Functional Requirements

### NFR-1: Reliability
- No note loss even with poor connectivity

### NFR-2: Speed
- Note creation < 3 seconds

### NFR-3: Usability
- Usable while focusing on meeting

---

## Technical Approach

### Mobile-First Notes Interface

```typescript
// Meeting notes mobile component
const MobileMeetingNotes: React.FC<{
  meetingId?: string;
  customerId?: string;
}> = ({ meetingId, customerId }) => {
  const [note, setNote] = useState<MeetingNote>(createEmptyNote());
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const { sync, pending } = useOfflineSync();

  // Auto-detect meeting from calendar
  useEffect(() => {
    if (!meetingId) {
      detectCurrentMeeting().then((meeting) => {
        if (meeting) {
          setNote((prev) => ({
            ...prev,
            meeting_id: meeting.id,
            customer_id: meeting.customer_id,
            title: meeting.title,
            attendees: meeting.attendees,
          }));
        }
      });
    }
  }, []);

  const handleVoiceNote = async () => {
    if (isRecording) {
      const recording = await stopRecording();
      const transcription = await transcribeAudio(recording.uri);

      setVoiceNotes([...voiceNotes, {
        id: generateId(),
        uri: recording.uri,
        transcription,
        timestamp: new Date(),
      }]);

      // Append to notes
      setNote((prev) => ({
        ...prev,
        content: prev.content + '\n\n' + transcription,
      }));
    } else {
      await startRecording();
    }
    setIsRecording(!isRecording);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with meeting info */}
      <MeetingHeader
        customer={note.customer_name}
        title={note.title}
        startTime={note.started_at}
        isRecording={isRecording}
      />

      {/* Quick action bar */}
      <QuickActionBar>
        <QuickActionButton
          icon={isRecording ? 'stop' : 'mic'}
          label={isRecording ? 'Stop' : 'Voice'}
          onPress={handleVoiceNote}
          active={isRecording}
        />
        <QuickActionButton
          icon="flag"
          label="Highlight"
          onPress={() => addHighlight()}
        />
        <QuickActionButton
          icon="checkbox"
          label="Action"
          onPress={() => showActionItemModal()}
        />
        <QuickActionButton
          icon="warning"
          label="Risk"
          onPress={() => addRiskFlag()}
        />
      </QuickActionBar>

      {/* Notes content */}
      <KeyboardAvoidingView behavior="padding" style={styles.notesArea}>
        <ScrollView>
          {/* Attendees */}
          <AttendeeTags
            attendees={note.attendees}
            onAdd={(attendee) => addAttendee(attendee)}
          />

          {/* Free-form notes */}
          <TextInput
            multiline
            placeholder="Meeting notes..."
            value={note.content}
            onChangeText={(text) => setNote({ ...note, content: text })}
            style={styles.notesInput}
          />

          {/* Action items section */}
          <ActionItemsList
            items={note.action_items}
            onAdd={addActionItem}
            onToggle={toggleActionItem}
            onAssign={assignActionItem}
          />

          {/* Voice notes */}
          {voiceNotes.length > 0 && (
            <VoiceNotesList notes={voiceNotes} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sync indicator */}
      <SyncIndicator pending={pending} />

      {/* End meeting button */}
      <Button
        title="End & Process"
        onPress={handleEndMeeting}
        style={styles.endButton}
      />
    </SafeAreaView>
  );
};
```

### Action Item Quick Add

```typescript
// Quick action item input
const QuickActionItemInput: React.FC<{
  onAdd: (item: ActionItem) => void;
}> = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const handleSubmit = () => {
    if (!title.trim()) return;

    onAdd({
      id: generateId(),
      title: title.trim(),
      owner_id: owner,
      due_date: dueDate,
      status: 'open',
      created_at: new Date(),
    });

    setTitle('');
    setOwner(null);
    setDueDate(null);
  };

  return (
    <View style={styles.actionItemInput}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Action item..."
        style={styles.input}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />

      <View style={styles.inputActions}>
        <TouchableOpacity onPress={() => showOwnerPicker()}>
          <Icon name="person" size={20} />
          {owner && <Text style={styles.badge}>1</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => showDatePicker()}>
          <Icon name="calendar" size={20} />
          {dueDate && <Text style={styles.badge}>!</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSubmit}>
          <Icon name="check" size={24} color="#e63946" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

### AI Post-Processing

```typescript
// Process meeting notes after meeting ends
const processMeetingNotes = async (note: MeetingNote): Promise<ProcessedNotes> => {
  // Combine all content
  const fullContent = [
    note.content,
    ...note.voice_transcriptions,
    ...note.highlights.map((h) => `[HIGHLIGHT] ${h.text}`),
  ].join('\n\n');

  // AI processing
  const processed = await claude.complete({
    prompt: `Analyze these meeting notes and extract:

${fullContent}

Please provide:
1. A concise summary (2-3 sentences)
2. All action items with suggested owners and due dates
3. Any risks or concerns mentioned
4. Any expansion opportunities mentioned
5. Overall sentiment (positive/neutral/negative)
6. Suggested follow-up email draft

Return as JSON.`
  });

  const result = JSON.parse(processed);

  // Merge AI-extracted action items with manually added ones
  const allActionItems = mergeActionItems(note.action_items, result.action_items);

  return {
    summary: result.summary,
    action_items: allActionItems,
    risks: result.risks,
    opportunities: result.opportunities,
    sentiment: result.sentiment,
    follow_up_email: result.follow_up_email,
  };
};

// Create tasks from action items
const createTasksFromActionItems = async (
  customerId: string,
  actionItems: ActionItem[]
): Promise<void> => {
  for (const item of actionItems) {
    await api.createTask({
      customer_id: customerId,
      title: item.title,
      owner_id: item.owner_id || getCurrentUserId(),
      due_date: item.due_date,
      source: 'meeting_notes',
      source_id: item.meeting_note_id,
    });
  }
};
```

### Real-Time Collaboration

```typescript
// Real-time sync for collaborative notes
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const useCollaborativeNotes = (noteId: string) => {
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      WS_URL,
      `meeting-notes-${noteId}`,
      doc
    );

    wsProvider.awareness.setLocalState({
      user: {
        name: getCurrentUserName(),
        color: getUserColor(),
      },
    });

    wsProvider.awareness.on('change', () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      setCollaborators(states.map((s) => s.user));
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [noteId]);

  const content = doc.getText('content');
  const actionItems = doc.getArray('actionItems');

  return {
    content,
    actionItems,
    collaborators,
    isConnected: provider?.synced,
  };
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mobile notes created | 30% of meetings | Note creation tracking |
| Notes completion rate | 80%+ | Content length analysis |
| Action items captured | 90% converted to tasks | Task creation from notes |
| Voice usage | 40% use voice features | Feature tracking |

---

## Acceptance Criteria

- [ ] Meeting notes started in < 3 seconds
- [ ] Auto-detects current meeting from calendar
- [ ] Voice recording and transcription work
- [ ] Quick action item entry functional
- [ ] Attendees can be tagged
- [ ] Notes sync across devices
- [ ] AI summary generated after meeting
- [ ] Action items auto-create tasks
- [ ] Works offline with sync
- [ ] Follow-up email suggested

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Mobile notes UI | 4 days |
| Voice recording/transcription | 3 days |
| Quick input components | 2 days |
| Real-time collaboration | 3 days |
| AI post-processing | 2 days |
| Offline sync | 2 days |
| Testing | 2 days |
| **Total** | **18 days** |

---

## Notes

- Consider integration with Zoom/Teams for recording
- Add meeting templates per type (QBR, kickoff, etc.)
- Future: Live transcription during meeting
- Future: AI-suggested questions during meeting
- Future: Sentiment tracking from voice tone
