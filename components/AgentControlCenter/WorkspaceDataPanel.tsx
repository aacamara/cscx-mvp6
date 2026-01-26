import React, { useState } from 'react';
import { AIAnalysis } from '../AIAnalysis';

// Types for workspace data
export interface WorkspaceDocument {
  id: string;
  name: string;
  link: string;
  modifiedTime?: string;
  type: 'doc' | 'sheet' | 'slide' | 'file';
}

export interface WorkspaceMeeting {
  id?: string;
  title: string;
  startTime: string;
  endTime?: string;
  meetLink?: string;
  calendarLink?: string;
  attendees?: string[];
}

export interface WorkspaceEmail {
  id: string;
  subject: string;
  from?: string;
  snippet?: string;
  date?: string;
  isUnread?: boolean;
}

export interface WorkspaceData {
  documents?: WorkspaceDocument[];
  spreadsheets?: WorkspaceDocument[];
  presentations?: WorkspaceDocument[];
  meetings?: WorkspaceMeeting[];
  emails?: WorkspaceEmail[];
  files?: WorkspaceDocument[];
  lastUpdated?: Date;
}

interface WorkspaceDataPanelProps {
  data: WorkspaceData;
  isCollapsed?: boolean;
  onToggle?: () => void;
  customerName?: string;
}

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string;
  icon: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, count, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="workspace-section">
      <button
        className="workspace-section-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#1a1a1a',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: isOpen ? '8px' : '0'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', fontWeight: 500 }}>
          <span>{icon}</span>
          <span>{title}</span>
          <span style={{
            background: '#e63946',
            color: '#fff',
            borderRadius: '10px',
            padding: '1px 8px',
            fontSize: '11px',
            fontWeight: 600
          }}>{count}</span>
        </span>
        <span style={{ color: '#666', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="workspace-section-content" style={{ paddingLeft: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// Document item component with Analyze option for sheets
const DocumentItem: React.FC<{
  doc: WorkspaceDocument;
  onAnalyze?: (doc: WorkspaceDocument) => void;
}> = ({ doc, onAnalyze }) => {
  const icons: Record<string, string> = {
    doc: '📄',
    sheet: '📊',
    slide: '📽️',
    file: '📁'
  };

  // Detect if it's a spreadsheet by type or by link/name
  const isSheet = doc.type === 'sheet' ||
    doc.link?.includes('spreadsheets') ||
    doc.name?.toLowerCase().includes('.xlsx') ||
    doc.name?.toLowerCase().includes('sheet');

  // Extract spreadsheet ID from link
  const getSpreadsheetId = () => {
    const match = doc.link?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : doc.id;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '4px',
        color: '#ccc',
        fontSize: '12px',
        transition: 'background 0.15s',
        background: 'transparent'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#252525'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>{icons[doc.type] || '📄'}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {doc.name}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {isSheet && onAnalyze && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze({ ...doc, id: getSpreadsheetId() });
            }}
            style={{
              padding: '2px 6px',
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
            title="Analyze with AI"
          >
            🤖 Analyze
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(doc.link, '_blank');
          }}
          style={{
            padding: '2px 6px',
            background: '#333',
            color: '#ccc',
            border: 'none',
            borderRadius: '3px',
            fontSize: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}
          title="Open in new tab"
        >
          Open ↗
        </button>
      </div>
    </div>
  );
};

// Meeting item component
const MeetingItem: React.FC<{ meeting: WorkspaceMeeting }> = ({ meeting }) => {
  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return time;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px',
        borderRadius: '4px',
        background: '#1a1a1a',
        marginBottom: '6px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🗓️</span>
        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 500, flex: 1 }}>{meeting.title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
        <span style={{ color: '#888', fontSize: '11px' }}>
          {formatTime(meeting.startTime)}
          {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px', paddingLeft: '24px', marginTop: '4px' }}>
        {meeting.meetLink && (
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open(meeting.meetLink, '_blank'); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              background: '#2a6b2a',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '10px',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            📹 Join Meet
          </a>
        )}
        {meeting.calendarLink && (
          <a
            href={meeting.calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); window.open(meeting.calendarLink, '_blank'); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              background: '#333',
              color: '#ccc',
              borderRadius: '4px',
              fontSize: '10px',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            📅 View
          </a>
        )}
      </div>
    </div>
  );
};

// Email item component
const EmailItem: React.FC<{ email: WorkspaceEmail }> = ({ email }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px',
        borderRadius: '4px',
        background: email.isUnread ? '#1a1a2a' : '#1a1a1a',
        marginBottom: '6px',
        borderLeft: email.isUnread ? '3px solid #e63946' : '3px solid transparent'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{email.isUnread ? '📬' : '📧'}</span>
        <span style={{
          color: '#fff',
          fontSize: '12px',
          fontWeight: email.isUnread ? 600 : 400,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {email.subject || '(No Subject)'}
        </span>
      </div>
      {email.from && (
        <div style={{ paddingLeft: '24px', color: '#888', fontSize: '11px' }}>
          From: {email.from}
        </div>
      )}
      {email.snippet && (
        <div style={{
          paddingLeft: '24px',
          color: '#666',
          fontSize: '11px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {email.snippet}
        </div>
      )}
    </div>
  );
};

export const WorkspaceDataPanel: React.FC<WorkspaceDataPanelProps> = ({
  data,
  isCollapsed = false,
  onToggle,
  customerName
}) => {
  const [analysisDoc, setAnalysisDoc] = useState<WorkspaceDocument | null>(null);

  const handleAnalyze = (doc: WorkspaceDocument) => {
    setAnalysisDoc(doc);
  };

  const hasData =
    (data.documents?.length || 0) > 0 ||
    (data.spreadsheets?.length || 0) > 0 ||
    (data.presentations?.length || 0) > 0 ||
    (data.meetings?.length || 0) > 0 ||
    (data.emails?.length || 0) > 0 ||
    (data.files?.length || 0) > 0;

  // Count total items
  const totalItems =
    (data.documents?.length || 0) +
    (data.spreadsheets?.length || 0) +
    (data.presentations?.length || 0) +
    (data.meetings?.length || 0) +
    (data.emails?.length || 0) +
    (data.files?.length || 0);

  if (isCollapsed) {
    return (
      <div
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#e63946',
          padding: '16px 10px',
          borderRadius: '8px 0 0 8px',
          cursor: 'pointer',
          boxShadow: '-4px 0 15px rgba(230, 57, 70, 0.3)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.padding = '16px 14px';
          e.currentTarget.style.background = '#ff4d5a';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.padding = '16px 10px';
          e.currentTarget.style.background = '#e63946';
        }}
      >
        <span style={{ fontSize: '20px' }}>📁</span>
        <span style={{
          writingMode: 'vertical-rl',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '1px'
        }}>
          WORKSPACE
        </span>
        {totalItems > 0 && (
          <span style={{
            background: '#fff',
            color: '#e63946',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 700,
            minWidth: '18px',
            textAlign: 'center'
          }}>
            {totalItems}
          </span>
        )}
        <span style={{ fontSize: '14px', marginTop: '4px' }}>◀</span>
      </div>
    );
  }

  return (
    <div
      className="workspace-data-panel"
      style={{
        width: '280px',
        background: '#111',
        borderLeft: '1px solid #222',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0a0a0a'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📁</span> Workspace
          {totalItems > 0 && (
            <span style={{
              background: '#e63946',
              color: '#fff',
              borderRadius: '10px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600
            }}>
              {totalItems}
            </span>
          )}
        </h3>
        <button
          onClick={onToggle}
          style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#888',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#252525';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1a1a1a';
            e.currentTarget.style.color = '#888';
          }}
        >
          <span>▶</span> Collapse
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
        {!hasData ? (
          <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            <p>No data loaded yet.</p>
            <p style={{ marginTop: '8px' }}>Ask Claude to fetch your:</p>
            <ul style={{ textAlign: 'left', marginTop: '8px', listStyle: 'none', padding: 0 }}>
              <li>• "Show my Google Docs"</li>
              <li>• "What meetings today?"</li>
              <li>• "Check my emails"</li>
            </ul>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Meetings Section */}
            <CollapsibleSection
              title="Today's Meetings"
              icon="📅"
              count={data.meetings?.length || 0}
              defaultOpen={true}
            >
              {data.meetings?.map((meeting, i) => (
                <MeetingItem key={meeting.id || i} meeting={meeting} />
              ))}
            </CollapsibleSection>

            {/* Documents Section */}
            <CollapsibleSection
              title="Documents"
              icon="📄"
              count={data.documents?.length || 0}
            >
              {data.documents?.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} onAnalyze={handleAnalyze} />
              ))}
            </CollapsibleSection>

            {/* Spreadsheets Section */}
            <CollapsibleSection
              title="Spreadsheets"
              icon="📊"
              count={data.spreadsheets?.length || 0}
            >
              {data.spreadsheets?.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} onAnalyze={handleAnalyze} />
              ))}
            </CollapsibleSection>

            {/* Presentations Section */}
            <CollapsibleSection
              title="Presentations"
              icon="📽️"
              count={data.presentations?.length || 0}
            >
              {data.presentations?.map((doc) => (
                <DocumentItem key={doc.id} doc={doc} />
              ))}
            </CollapsibleSection>

            {/* Emails Section */}
            <CollapsibleSection
              title="Recent Emails"
              icon="📧"
              count={data.emails?.length || 0}
              defaultOpen={false}
            >
              {data.emails?.slice(0, 10).map((email) => (
                <EmailItem key={email.id} email={email} />
              ))}
            </CollapsibleSection>

            {/* Files Section */}
            <CollapsibleSection
              title="Recent Files"
              icon="📁"
              count={data.files?.length || 0}
              defaultOpen={false}
            >
              {data.files?.map((file) => (
                <DocumentItem key={file.id} doc={file} />
              ))}
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Footer */}
      {data.lastUpdated && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #222',
          fontSize: '10px',
          color: '#666',
          textAlign: 'center'
        }}>
          Last updated: {data.lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* AI Analysis Modal */}
      {analysisDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setAnalysisDoc(null)}
        >
          <div
            style={{ width: '100%', maxWidth: '700px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <AIAnalysis
              spreadsheetId={analysisDoc.id}
              onClose={() => setAnalysisDoc(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDataPanel;
