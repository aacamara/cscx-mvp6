import React from 'react';

interface ToolResultCardProps {
  toolName: string;
  result: any;
  onItemClick?: (item: any) => void;
}

// Format a Google link based on type
const formatGoogleLink = (id: string, type: 'doc' | 'sheet' | 'slide' | 'calendar' | 'meet') => {
  const baseUrls: Record<string, string> = {
    doc: 'https://docs.google.com/document/d/',
    sheet: 'https://docs.google.com/spreadsheets/d/',
    slide: 'https://docs.google.com/presentation/d/',
    calendar: 'https://calendar.google.com/calendar/event?eid=',
    meet: '' // Meet links are provided directly
  };
  return type === 'meet' ? id : `${baseUrls[type]}${id}`;
};

// Clickable link component
const ClickableLink: React.FC<{
  href: string;
  icon: string;
  label: string;
  variant?: 'primary' | 'secondary';
}> = ({ href, icon, label, variant = 'primary' }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => { e.preventDefault(); window.open(href, '_blank'); }}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      background: variant === 'primary' ? '#e63946' : '#2a2a2a',
      color: '#fff',
      borderRadius: '4px',
      fontSize: '11px',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'opacity 0.15s'
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </a>
);

// Document list card
const DocumentListCard: React.FC<{ documents: any[]; type: 'doc' | 'sheet' | 'slide' }> = ({ documents, type }) => {
  const icons: Record<string, string> = { doc: '📄', sheet: '📊', slide: '📽️' };
  const labels: Record<string, string> = { doc: 'Google Docs', sheet: 'Google Sheets', slide: 'Google Slides' };

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px'
    }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
        {icons[type]} {labels[type]} ({documents.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflow: 'auto' }}>
        {documents.slice(0, 10).map((doc, i) => (
          <div key={doc.id || i} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: '#222',
            borderRadius: '4px'
          }}>
            <span style={{
              color: '#ccc',
              fontSize: '12px',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: '8px'
            }}>
              {doc.name || doc.title}
            </span>
            <ClickableLink
              href={doc.link || doc.webViewLink || formatGoogleLink(doc.id, type)}
              icon="↗"
              label="Open"
              variant="secondary"
            />
          </div>
        ))}
        {documents.length > 10 && (
          <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '4px' }}>
            ... and {documents.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
};

// Meeting list card
const MeetingListCard: React.FC<{ meetings: any[] }> = ({ meetings }) => {
  const formatTime = (time: string) => {
    try {
      return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return time;
    }
  };

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px'
    }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
        📅 Meetings ({meetings.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {meetings.map((meeting, i) => (
          <div key={meeting.id || i} style={{
            background: '#222',
            borderRadius: '6px',
            padding: '10px'
          }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
              {meeting.title}
            </div>
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>
              🕐 {formatTime(meeting.startTime)}
              {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {meeting.meetLink && (
                <ClickableLink
                  href={meeting.meetLink}
                  icon="📹"
                  label="Join Meet"
                  variant="primary"
                />
              )}
              {meeting.calendarLink && (
                <ClickableLink
                  href={meeting.calendarLink}
                  icon="📅"
                  label="View in Calendar"
                  variant="secondary"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Email list card
const EmailListCard: React.FC<{ emails: any[] }> = ({ emails }) => {
  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px'
    }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
        📧 Emails ({emails.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflow: 'auto' }}>
        {emails.slice(0, 10).map((email, i) => (
          <div key={email.id || i} style={{
            background: '#222',
            borderRadius: '4px',
            padding: '8px',
            borderLeft: email.isUnread ? '3px solid #e63946' : '3px solid #333'
          }}>
            <div style={{
              color: '#fff',
              fontSize: '12px',
              fontWeight: email.isUnread ? 600 : 400,
              marginBottom: '2px'
            }}>
              {email.subject || '(No Subject)'}
            </div>
            {email.from && (
              <div style={{ color: '#888', fontSize: '11px' }}>
                From: {email.from}
              </div>
            )}
            {email.snippet && (
              <div style={{
                color: '#666',
                fontSize: '11px',
                marginTop: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {email.snippet}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// AppScript card
const AppScriptCard: React.FC<{ script: any }> = ({ script }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(script.code);
  };

  return (
    <div style={{
      background: '#1a1a2a',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '8px',
      border: '1px solid #4338ca'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#818cf8' }}>
          ⚡ Apps Script Generated
        </div>
        <button
          onClick={copyToClipboard}
          style={{
            background: '#4338ca',
            color: '#fff',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          📋 Copy Code
        </button>
      </div>
      <div style={{
        background: '#0d0d15',
        borderRadius: '4px',
        padding: '8px',
        maxHeight: '200px',
        overflow: 'auto'
      }}>
        <pre style={{
          margin: 0,
          fontSize: '11px',
          color: '#a5f3fc',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }}>
          {script.code?.substring(0, 500)}
          {script.code?.length > 500 && '...'}
        </pre>
      </div>
      {script.instructions && (
        <div style={{ marginTop: '8px', padding: '8px', background: '#1a2a1a', borderRadius: '4px' }}>
          <div style={{ fontSize: '11px', color: '#4ade80', marginBottom: '4px' }}>📋 Deployment Instructions:</div>
          <div style={{ fontSize: '11px', color: '#86efac', whiteSpace: 'pre-wrap' }}>
            {script.instructions}
          </div>
        </div>
      )}
      {script.targetSpreadsheet && (
        <div style={{ marginTop: '8px' }}>
          <ClickableLink
            href={script.targetSpreadsheet}
            icon="📊"
            label="Open Target Spreadsheet"
            variant="primary"
          />
        </div>
      )}
    </div>
  );
};

export const ToolResultCard: React.FC<ToolResultCardProps> = ({ toolName, result }) => {
  if (!result?.success) {
    return null; // Don't render failed results
  }

  // Route to appropriate card based on tool name
  switch (toolName) {
    case 'get_documents':
      return result.documents?.length > 0 ? (
        <DocumentListCard documents={result.documents} type="doc" />
      ) : null;

    case 'get_spreadsheets':
      return result.spreadsheets?.length > 0 ? (
        <DocumentListCard documents={result.spreadsheets} type="sheet" />
      ) : null;

    case 'get_presentations':
      return result.presentations?.length > 0 ? (
        <DocumentListCard documents={result.presentations} type="slide" />
      ) : null;

    case 'get_todays_meetings':
    case 'get_upcoming_meetings':
      return result.meetings?.length > 0 ? (
        <MeetingListCard meetings={result.meetings} />
      ) : null;

    case 'get_recent_emails':
    case 'search_emails':
    case 'get_unread_emails':
      return result.emails?.length > 0 ? (
        <EmailListCard emails={result.emails} />
      ) : null;

    case 'generate_appscript':
      return result.script ? (
        <AppScriptCard script={result.script} />
      ) : null;

    case 'get_recent_files':
    case 'search_files':
      return result.files?.length > 0 ? (
        <DocumentListCard documents={result.files.map((f: any) => ({
          ...f,
          type: 'file',
          link: f.webViewLink || `https://drive.google.com/file/d/${f.id}`
        }))} type="doc" />
      ) : null;

    default:
      return null;
  }
};

export default ToolResultCard;
