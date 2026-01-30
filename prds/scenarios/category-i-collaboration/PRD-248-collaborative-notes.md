# PRD-248: Collaborative Notes

## Metadata
- **PRD ID**: PRD-248
- **Title**: Collaborative Notes
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-241 (@Mention), Customer data model

---

## Problem Statement

CSMs create notes about customers in various places (personal docs, CRM, Slack, etc.), leading to fragmented knowledge. There's no centralized, collaborative note-taking system within CSCX.AI where team members can collectively document customer information with real-time collaboration.

## User Story

> As a CSM, I want to create and collaborate on notes about my customers within CSCX.AI, with real-time editing, @mentions, and automatic linking to customer context so that all team knowledge is centralized and accessible.

---

## Functional Requirements

### FR-1: Note Creation & Organization
- **FR-1.1**: Create notes linked to specific customer
- **FR-1.2**: Note templates for common types (meeting notes, call summary, risk assessment)
- **FR-1.3**: Tag/categorize notes for easy filtering
- **FR-1.4**: Pin important notes to top
- **FR-1.5**: Archive old notes without deleting

### FR-2: Rich Text Editor
- **FR-2.1**: Markdown support with formatting toolbar
- **FR-2.2**: @mention team members (triggers notifications)
- **FR-2.3**: Link to other entities (contacts, tasks, documents)
- **FR-2.4**: Inline images and file attachments
- **FR-2.5**: Code blocks and tables
- **FR-2.6**: Checklists/todo items within notes

### FR-3: Real-Time Collaboration
- **FR-3.1**: Multiple users can edit simultaneously
- **FR-3.2**: Show collaborator cursors and presence
- **FR-3.3**: Conflict-free concurrent editing (CRDT)
- **FR-3.4**: Live preview of others' changes
- **FR-3.5**: Highlight recent changes

### FR-4: Version History
- **FR-4.1**: Full version history with timestamps
- **FR-4.2**: Show who made each change
- **FR-4.3**: Compare versions side-by-side
- **FR-4.4**: Restore previous version
- **FR-4.5**: Comment on specific versions

### FR-5: Access & Sharing
- **FR-5.1**: Note visibility levels (private, team, public)
- **FR-5.2**: Share note with specific users
- **FR-5.3**: Read-only vs edit permissions
- **FR-5.4**: Generate shareable link
- **FR-5.5**: Track who has viewed the note

### FR-6: Search & Discovery
- **FR-6.1**: Full-text search across all notes
- **FR-6.2**: Filter by customer, tag, author, date
- **FR-6.3**: Recent notes quick access
- **FR-6.4**: AI-powered related notes suggestions
- **FR-6.5**: Search within note content

---

## Non-Functional Requirements

### NFR-1: Performance
- Note loads within 500ms
- Real-time sync latency < 200ms

### NFR-2: Reliability
- No data loss on concurrent edits
- Offline editing with sync on reconnect

### NFR-3: Scalability
- Support 10,000+ notes per organization
- Handle 50+ concurrent editors

---

## Technical Approach

### Data Model Extensions

```sql
-- note_templates
CREATE TABLE note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  created_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Content
  title VARCHAR(500) NOT NULL,
  content TEXT,
  content_json JSONB, -- For rich text editor (Tiptap/ProseMirror format)

  -- Organization
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  -- Visibility
  visibility VARCHAR(20) DEFAULT 'team', -- 'private', 'team', 'public'

  -- Metadata
  template_id UUID REFERENCES note_templates(id),
  word_count INTEGER DEFAULT 0,
  last_edited_by_user_id UUID REFERENCES users(id),
  last_edited_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- note_collaborators
CREATE TABLE note_collaborators (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  permission VARCHAR(20) DEFAULT 'edit', -- 'view', 'edit', 'admin'
  added_by_user_id UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ,
  PRIMARY KEY (note_id, user_id)
);

-- note_versions (for history)
CREATE TABLE note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(500),
  content TEXT,
  content_json JSONB,
  edited_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- note_entity_links
CREATE TABLE note_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  entity_type VARCHAR(50), -- 'stakeholder', 'task', 'document', 'meeting'
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_customer ON notes(customer_id);
CREATE INDEX idx_notes_author ON notes(created_by_user_id);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_notes_fulltext ON notes USING GIN(to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_note_versions ON note_versions(note_id, version_number);
```

### Real-Time Collaboration (CRDT)

```typescript
// Using Yjs for CRDT-based collaboration
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

class CollaborativeNote {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private content: Y.XmlFragment;
  private awareness: awarenessProtocol.Awareness;

  constructor(noteId: string, userId: string) {
    this.doc = new Y.Doc();
    this.content = this.doc.getXmlFragment('content');

    // Connect to WebSocket server
    this.provider = new WebsocketProvider(
      'wss://api.cscx.ai/collaboration',
      `note:${noteId}`,
      this.doc
    );

    // Set up awareness (cursors, presence)
    this.awareness = this.provider.awareness;
    this.awareness.setLocalState({
      user: { id: userId, name: getUserName(userId), color: getUserColor(userId) }
    });
  }

  // Get other users' cursors
  getCollaborators() {
    return Array.from(this.awareness.getStates().values());
  }

  // Apply local change
  applyChange(change: any) {
    this.doc.transact(() => {
      // Apply change to Yjs document
    });
  }
}
```

### API Endpoints

```typescript
// Note CRUD
POST   /api/notes
GET    /api/notes
GET    /api/notes/:id
PATCH  /api/notes/:id
DELETE /api/notes/:id

// Organization
POST   /api/notes/:id/pin
POST   /api/notes/:id/archive
POST   /api/notes/:id/tags

// Collaboration
POST   /api/notes/:id/collaborators
DELETE /api/notes/:id/collaborators/:userId
GET    /api/notes/:id/collaborators

// Version history
GET    /api/notes/:id/versions
GET    /api/notes/:id/versions/:versionId
POST   /api/notes/:id/restore/:versionId

// Search
GET    /api/notes/search?q={query}&customer={id}&tags={tags}

// Templates
GET    /api/note-templates
POST   /api/note-templates
```

### WebSocket Events

```typescript
// Server -> Client
interface NoteWSEvents {
  'note:update': { noteId: string; changes: Uint8Array }; // Yjs update
  'note:awareness': { noteId: string; states: Map<number, any> }; // Cursors
  'note:saved': { noteId: string; version: number };
}

// Client -> Server
interface NoteWSClientEvents {
  'note:join': { noteId: string };
  'note:leave': { noteId: string };
  'note:update': { noteId: string; changes: Uint8Array };
  'note:awareness': { noteId: string; state: any };
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Notes created per CSM per week | 5+ | Analytics |
| Collaborative editing sessions | 20% of notes | Real-time tracking |
| Note search usage | 30% of users weekly | Search analytics |
| Knowledge consolidation | 50% reduction in external notes | User surveys |

---

## Acceptance Criteria

- [ ] User can create note linked to customer
- [ ] Rich text editor with formatting, @mentions, links
- [ ] Multiple users can edit note simultaneously
- [ ] Collaborator cursors visible in real-time
- [ ] Changes sync within 200ms
- [ ] Version history shows all changes with authors
- [ ] Previous versions can be restored
- [ ] Notes searchable by full text and filters
- [ ] Notes can be shared with specific permissions
- [ ] Templates available for common note types

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| CRDT/Yjs integration | 4 days |
| Rich text editor (Tiptap) | 4 days |
| API endpoints | 2 days |
| WebSocket server | 2 days |
| Version history UI | 2 days |
| Search implementation | 2 days |
| Testing | 2 days |
| **Total** | **20 days** |

---

## Notes

- Consider integration with Google Docs for export
- Add AI summarization of long notes
- Future: Voice-to-note transcription
- Future: Smart linking suggestions
- Future: Note templates with AI auto-fill
