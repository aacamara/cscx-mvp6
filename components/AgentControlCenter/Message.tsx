import React from 'react';
import { AGENTS, CS_AGENTS, AgentId, CSAgentType } from '../../types/agents';
import { ToolResultCard } from './ToolResultCard';

interface MessageProps {
  message: string;
  agent?: AgentId;
  isUser?: boolean;
  isThinking?: boolean;
  isApproval?: boolean;
  onApprove?: (approved: boolean) => void;
  toolResults?: Array<{ toolCallId?: string; toolName: string; result: any }>;
}

// Clean up spurious placeholder text from AI responses
function cleanAIResponse(text: string): string {
  // Remove various placeholder patterns the AI might generate
  // Patterns seen: _PLACEHOLDER0__, PLACEHOLDER1_, _PLACEHOLDER0_, PLACEHOLDER2__
  return text
    .replace(/_*PLACEHOLDER\d+_*/gi, '')  // All placeholder variations
    .replace(/\*\*_*PLACEHOLDER\d+_*\*\*/gi, '')  // Bold placeholders
    .replace(/([⚡✅📄🔗📊📈📉🎯])\s*_*PLACEHOLDER\d+_*/gi, '$1')  // Emoji + placeholder
    .replace(/\bPLACEHOLDER\d*\b_*/gi, '')  // Standalone placeholders
    .replace(/^\d+\.\s*$/gm, '')  // Empty numbered list items
    .replace(/^[-•]\s*$/gm, '')  // Empty bullet points
    .replace(/\s{2,}/g, ' ')  // Double spaces
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Multiple newlines
    .trim();
}

// Parse markdown to React elements with clickable links
function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIndex) => {
    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={lineIndex} style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: 600 }}>{parseInline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={lineIndex} style={{ margin: '12px 0 6px', fontSize: '15px', fontWeight: 600 }}>{parseInline(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={lineIndex} style={{ margin: '14px 0 8px', fontSize: '16px', fontWeight: 700 }}>{parseInline(line.slice(2))}</h2>);
    }
    // Bullet points
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={lineIndex} style={{ marginLeft: '16px', marginBottom: '2px' }}>{parseInline(line.slice(2))}</li>);
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={lineIndex} style={{ marginLeft: '16px', marginBottom: '2px', listStyleType: 'decimal' }}>{parseInline(line.replace(/^\d+\.\s/, ''))}</li>);
    }
    // Code block
    else if (line.startsWith('```')) {
      // Skip code fence markers
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<br key={lineIndex} />);
    }
    // Regular paragraph
    else {
      elements.push(<p key={lineIndex} style={{ margin: '4px 0' }}>{parseInline(line)}</p>);
    }
  });

  return elements;
}

// Parse inline markdown (bold, italic, links, code)
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Pattern for links, bold, italic, code, and Google URLs
  const patterns = [
    // Markdown links [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, render: (match: RegExpExecArray) => (
      <a key={keyIndex++} href={match[2]} target="_blank" rel="noopener noreferrer"
         style={{ color: '#e63946', textDecoration: 'underline', cursor: 'pointer' }}
         onClick={(e) => { e.preventDefault(); window.open(match[2], '_blank'); }}>
        {match[1]} 🔗
      </a>
    )},
    // Google Doc/Sheet/Slide/Calendar URLs
    { regex: /(https:\/\/(docs|sheets|slides|calendar|drive)\.google\.com\/[^\s)]+)/g, render: (match: RegExpExecArray) => {
      const url = match[1];
      const type = match[2];
      const icons: Record<string, string> = { docs: '📄', sheets: '📊', slides: '📽️', calendar: '📅', drive: '📁' };
      return (
        <a key={keyIndex++} href={url} target="_blank" rel="noopener noreferrer"
           style={{ color: '#e63946', textDecoration: 'underline', cursor: 'pointer' }}
           onClick={(e) => { e.preventDefault(); window.open(url, '_blank'); }}>
          {icons[type] || '🔗'} Open in Google {type.charAt(0).toUpperCase() + type.slice(1)}
        </a>
      );
    }},
    // Bold **text**
    { regex: /\*\*([^*]+)\*\*/g, render: (match: RegExpExecArray) => <strong key={keyIndex++}>{match[1]}</strong> },
    // Italic *text* or _text_
    { regex: /(\*|_)([^*_]+)\1/g, render: (match: RegExpExecArray) => <em key={keyIndex++}>{match[2]}</em> },
    // Inline code `code`
    { regex: /`([^`]+)`/g, render: (match: RegExpExecArray) => (
      <code key={keyIndex++} style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{match[1]}</code>
    )},
  ];

  // Simple parser - process patterns in order
  // Use a placeholder pattern that won't be matched by markdown regex (no underscores/asterisks)
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern.regex, (match, ...groups) => {
      const execResult = { 0: match, 1: groups[0], 2: groups[1] } as unknown as RegExpExecArray;
      const element = pattern.render(execResult);
      // Store element and return placeholder with safe delimiters
      parts.push(element);
      return `\x00ELEM${parts.length - 1}\x00`;
    });
  }

  // If no patterns matched, return the text as-is
  if (parts.length === 0) return text;

  // Reconstruct with placeholders replaced
  const finalParts: React.ReactNode[] = [];
  const segments = result.split(/\x00ELEM(\d+)\x00/);
  segments.forEach((segment, i) => {
    if (i % 2 === 0) {
      if (segment) finalParts.push(segment);
    } else {
      finalParts.push(parts[parseInt(segment)]);
    }
  });

  return <>{finalParts}</>;
}

// Helper to get agent info from either legacy or CS agents
const getAgentInfo = (agent?: AgentId) => {
  if (!agent) return CS_AGENTS.onboarding;
  // Check CS_AGENTS first (new specialist agents)
  if (agent in CS_AGENTS) return CS_AGENTS[agent as CSAgentType];
  // Fallback to legacy AGENTS
  if (agent in AGENTS) return AGENTS[agent as keyof typeof AGENTS];
  // Default
  return CS_AGENTS.onboarding;
};

export const Message: React.FC<MessageProps> = ({
  message,
  agent,
  isUser,
  isThinking,
  isApproval,
  onApprove,
  toolResults
}) => {
  if (isUser) {
    return (
      <div className="message user-message">
        <div className="message-content user">
          <p>{message}</p>
        </div>
        <p className="message-sender">CSM</p>
      </div>
    );
  }

  const agentInfo = getAgentInfo(agent);

  return (
    <div className="message agent-message">
      <div
        className="agent-avatar"
        style={{ backgroundColor: `${agentInfo.color}20` }}
      >
        {agentInfo.icon}
      </div>
      <div className="message-body">
        <div className="message-content agent">
          {isThinking ? (
            <div className="thinking">
              <div className="thinking-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="thinking-text">{message}</span>
            </div>
          ) : (
            <>
              <div className="markdown-content">
                {parseMarkdown(cleanAIResponse(message))}
              </div>
              {/* Render tool results as nice cards */}
              {toolResults && toolResults.length > 0 && (
                <div className="tool-results">
                  {toolResults.map((tr, index) => (
                    <ToolResultCard
                      key={tr.toolCallId || index}
                      toolName={tr.toolName}
                      result={tr.result}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <p className="message-sender" style={{ color: agentInfo.color }}>
          {agentInfo.name}
        </p>
        {isApproval && onApprove && (
          <div className="approval-buttons">
            <button className="approve" onClick={() => onApprove(true)}>
              ✓ Approve
            </button>
            <button className="reject" onClick={() => onApprove(false)}>
              ✗ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
