import type { CSAgentType } from '../../../../types/agents';
import { AIEnhanceButton } from '../Shared';

interface MessageEditorProps {
  subject: string;
  body: string;
  enhancedBody?: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onEnhanced: (enhancedBody: string) => void;
  customerName?: string;
  agentType?: CSAgentType;
  placeholder?: string;
}

export function MessageEditor({
  subject,
  body,
  enhancedBody,
  onSubjectChange,
  onBodyChange,
  onEnhanced,
  customerName,
  agentType,
  placeholder = 'Write your message...',
}: MessageEditorProps) {
  const displayBody = enhancedBody || body;

  const handleBodyChange = (newBody: string) => {
    // If user edits after enhancement, clear enhanced version
    onBodyChange(newBody);
  };

  return (
    <div className="message-editor">
      {/* Subject Line */}
      <div className="editor-field">
        <label className="editor-label">Subject</label>
        <input
          type="text"
          className="editor-input"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Enter subject..."
        />
      </div>

      {/* Body */}
      <div className="editor-field">
        <div className="editor-label-row">
          <label className="editor-label">Message</label>
          <AIEnhanceButton
            text={body}
            onEnhanced={onEnhanced}
            context={{
              type: 'email',
              customerName,
              agentType,
              tone: 'professional',
            }}
            size="sm"
          />
        </div>
        <textarea
          className="editor-textarea"
          value={displayBody}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
        />
      </div>

      {/* Character Count */}
      <div className="editor-footer">
        <span className="char-count">{displayBody.length} characters</span>
        {enhancedBody && (
          <span className="enhanced-badge">
            ✨ AI Enhanced
          </span>
        )}
      </div>
    </div>
  );
}
