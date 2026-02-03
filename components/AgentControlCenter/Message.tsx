import React, { useState } from 'react';
import { AGENTS, CS_AGENTS, AgentId, CSAgentType } from '../../types/agents';
import { ToolResultCard } from './ToolResultCard';

// Loading skeleton for messages
// Message actions component (copy, etc.)
const MessageActions: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="message-actions"
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px',
        opacity: 0,
        transition: 'opacity 0.2s ease-in-out',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        borderRadius: '6px',
        padding: '4px',
      }}
    >
      <button
        onClick={handleCopy}
        style={{
          background: copied ? '#22c55e' : 'transparent',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '11px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'background 0.2s',
        }}
        title="Copy message"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
};

export const MessageSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="message agent-message" style={{ opacity: 0.6 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
              backgroundSize: '200% 100%',
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                height: '12px',
                width: '60%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: '12px',
                width: '80%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                animationDelay: '0.1s',
              }}
            />
            <div
              style={{
                height: '12px',
                width: '45%',
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #222 25%, #333 50%, #222 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s',
              }}
            />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

// Copy button component for code blocks
const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: copied ? '#22c55e' : '#333',
        border: 'none',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '11px',
        color: '#fff',
        opacity: 0,
        transition: 'opacity 0.2s, background 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
      className="code-copy-btn"
    >
      {copied ? '✓ Copied!' : '📋 Copy'}
    </button>
  );
};

// Collapsible JSON viewer component
const CollapsibleJson: React.FC<{ data: any; label?: string; defaultExpanded?: boolean }> = ({
  data,
  label = 'JSON',
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  // Try to parse if string to check if valid JSON
  let isValid = true;
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      isValid = false;
    }
  }

  // Count keys/items for preview
  const getPreview = () => {
    if (!isValid) return 'Invalid JSON';
    if (Array.isArray(parsed)) return `Array[${parsed.length}]`;
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      return `Object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
    }
    return String(parsed).slice(0, 50);
  };

  return (
    <div style={{
      margin: '8px 0',
      border: '1px solid #333',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#0d0d0d',
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: '#1a1a1a',
          border: 'none',
          cursor: 'pointer',
          color: '#ccc',
          fontSize: '12px',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>
            ▶
          </span>
          <span style={{ color: '#e63946', fontWeight: 500 }}>{label}</span>
          <span style={{ color: '#666', fontSize: '11px' }}>{getPreview()}</span>
        </span>
        <CopyButton code={jsonString} />
      </button>
      {isExpanded && (
        <pre style={{
          margin: 0,
          padding: '12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          overflowX: 'auto',
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
          <code style={{ color: '#8cc84b' }}>{jsonString}</code>
        </pre>
      )}
    </div>
  );
};

// Code block component with copy button (detects JSON and shows collapsible viewer)
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  // Check if this is JSON content
  const isJson = language === 'json' || (language === '' && code.trim().startsWith('{') || code.trim().startsWith('['));
  let isValidJson = false;

  if (isJson) {
    try {
      JSON.parse(code);
      isValidJson = true;
    } catch {
      isValidJson = false;
    }
  }

  // Use collapsible viewer for valid JSON
  if (isValidJson) {
    return <CollapsibleJson data={code} label={language || 'json'} defaultExpanded={code.length < 500} />;
  }

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
      }}
      className="code-block-container"
    >
      <pre
        style={{
          background: '#1a1a1a',
          padding: '12px',
          paddingRight: '60px',
          borderRadius: '8px',
          overflow: 'auto',
          fontSize: '12px',
          fontFamily: 'monospace',
          border: '1px solid #333',
          margin: 0,
        }}
      >
        <code style={{ color: '#e0e0e0' }}>{code}</code>
      </pre>
      <CopyButton code={code} />
      <style>{`
        .code-block-container:hover .code-copy-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

type MessageStatus = 'sending' | 'sent' | 'failed';

interface MessageProps {
  message: string;
  agent?: AgentId;
  isUser?: boolean;
  isThinking?: boolean;
  isApproval?: boolean;
  onApprove?: (approved: boolean) => void;
  toolResults?: Array<{ toolCallId?: string; toolName: string; result: any }>;
  attachment?: {
    name: string;
    size: number;
    type: string;
  };
  status?: MessageStatus;
  onRetry?: () => void;
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

// Rich table component for markdown tables
const MarkdownTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  return (
    <div style={{
      overflowX: 'auto',
      margin: '12px 0',
      borderRadius: '8px',
      border: '1px solid #333',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
        minWidth: '300px',
      }}>
        <thead>
          <tr style={{ background: '#1a1a1a' }}>
            {headers.map((header, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontWeight: 600,
                borderBottom: '2px solid #333',
                color: '#e63946',
                whiteSpace: 'nowrap',
              }}>
                {parseInline(header.trim())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              style={{
                background: rowIndex % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(230,57,70,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = rowIndex % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #222',
                  color: '#ccc',
                }}>
                  {parseInline(cell.trim())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Parse a table row into cells
function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .filter((_, i, arr) => i > 0 && i < arr.length - 1) // Remove first and last empty splits
    .map(cell => cell.trim());
}

// Check if a line is a table separator (e.g., |---|---|)
function isTableSeparator(line: string): boolean {
  return /^\|[\s:-]+\|[\s|:-]*$/.test(line.trim());
}

// Parse markdown to React elements with clickable links
function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split('\n');

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLanguage = '';
  let codeBlockStartIndex = 0;

  // Table parsing state
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableStartIndex = 0;

  const flushTable = () => {
    if (tableHeaders.length > 0 && tableRows.length > 0) {
      elements.push(
        <MarkdownTable key={`table-${tableStartIndex}`} headers={tableHeaders} rows={tableRows} />
      );
    }
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  lines.forEach((line, lineIndex) => {
    // Handle code block start/end
    if (line.startsWith('```')) {
      if (inTable) flushTable();
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockContent = [];
        codeBlockLanguage = line.slice(3).trim();
        codeBlockStartIndex = lineIndex;
      } else {
        // Ending a code block
        inCodeBlock = false;
        const code = codeBlockContent.join('\n');
        elements.push(
          <CodeBlock key={`codeblock-${codeBlockStartIndex}`} code={code} language={codeBlockLanguage} />
        );
        codeBlockContent = [];
        codeBlockLanguage = '';
      }
      return;
    }

    // If inside code block, collect content
    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Table parsing
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');

    if (isTableRow) {
      if (!inTable) {
        // Starting a new table
        inTable = true;
        tableStartIndex = lineIndex;
        tableHeaders = parseTableRow(line);
      } else if (isTableSeparator(line)) {
        // Skip separator line
      } else {
        // Regular table row
        tableRows.push(parseTableRow(line));
      }
      return;
    } else if (inTable) {
      // End of table
      flushTable();
    }

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
    // Empty line
    else if (line.trim() === '') {
      elements.push(<br key={lineIndex} />);
    }
    // Regular paragraph
    else {
      elements.push(<p key={lineIndex} style={{ margin: '4px 0' }}>{parseInline(line)}</p>);
    }
  });

  // Flush any remaining table
  if (inTable) {
    flushTable();
  }

  // Handle unclosed code block at end of text
  if (inCodeBlock && codeBlockContent.length > 0) {
    const code = codeBlockContent.join('\n');
    elements.push(
      <CodeBlock key={`codeblock-${codeBlockStartIndex}`} code={code} language={codeBlockLanguage} />
    );
  }

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
  toolResults,
  attachment,
  status,
  onRetry
}) => {
  if (isUser) {
    return (
      <div
        className="message user-message message-with-actions"
        style={{ opacity: status === 'sending' ? 0.7 : 1 }}
      >
        <MessageActions content={message} />
        <div className="message-content user">
          <p>{message}</p>
          {/* Status indicator */}
          {status && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              fontSize: '10px',
            }}>
              {status === 'sending' && (
                <span style={{ color: '#888' }}>Sending...</span>
              )}
              {status === 'failed' && (
                <>
                  <span style={{ color: '#ef4444' }}>Failed to send</span>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      style={{
                        background: 'transparent',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {/* Attachment indicator for user messages */}
          {attachment && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              padding: '6px 10px',
              background: 'rgba(230, 57, 70, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(230, 57, 70, 0.2)',
            }}>
              <span style={{ fontSize: '14px' }}>📄</span>
              <span style={{
                fontSize: '11px',
                color: '#e63946',
                fontWeight: 500,
              }}>
                {attachment.name}
              </span>
              <span style={{
                fontSize: '10px',
                color: '#888',
                marginLeft: 'auto',
              }}>
                {(attachment.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
        <p className="message-sender">CSM</p>
      </div>
    );
  }

  const agentInfo = getAgentInfo(agent);

  return (
    <div className="message agent-message message-with-actions">
      <MessageActions content={message} />
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
