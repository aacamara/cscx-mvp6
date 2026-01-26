import React, { useState } from 'react';

interface EmailPreviewModalProps {
  email: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
  };
  onSend: (email: { to: string[]; cc?: string[]; subject: string; body: string }) => void;
  onCancel: () => void;
  onGetSuggestions?: (email: { subject: string; body: string }) => Promise<string>;
  isLoading?: boolean;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  email,
  onSend,
  onCancel,
  onGetSuggestions,
  isLoading = false
}) => {
  const [editedEmail, setEditedEmail] = useState(email);
  const [isGettingSuggestions, setIsGettingSuggestions] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showCc, setShowCc] = useState((email.cc?.length || 0) > 0);

  const handleGetSuggestions = async () => {
    if (!onGetSuggestions) return;
    setIsGettingSuggestions(true);
    try {
      const result = await onGetSuggestions({
        subject: editedEmail.subject,
        body: editedEmail.body
      });
      setSuggestion(result);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setIsGettingSuggestions(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      setEditedEmail(prev => ({ ...prev, body: suggestion }));
      setSuggestion(null);
    }
  };

  return (
    <div className="email-preview-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="email-preview-modal" style={{
        background: '#111',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>📧 Email Preview</h3>
          <button onClick={onCancel} style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '20px',
            cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Email Form */}
        <div style={{ padding: '20px' }}>
          {/* To Field */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>To:</label>
            <input
              type="text"
              value={editedEmail.to.join(', ')}
              onChange={(e) => setEditedEmail(prev => ({
                ...prev,
                to: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* CC Field */}
          {showCc ? (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>CC:</label>
              <input
                type="text"
                value={editedEmail.cc?.join(', ') || ''}
                onChange={(e) => setEditedEmail(prev => ({
                  ...prev,
                  cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowCc(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#e63946',
                fontSize: '12px',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >+ Add CC</button>
          )}

          {/* Subject Field */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Subject:</label>
            <input
              type="text"
              value={editedEmail.subject}
              onChange={(e) => setEditedEmail(prev => ({ ...prev, subject: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Body Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Message:</label>
            <textarea
              value={editedEmail.body}
              onChange={(e) => setEditedEmail(prev => ({ ...prev, body: e.target.value }))}
              rows={12}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
            />
          </div>

          {/* Claude Suggestion */}
          {suggestion && (
            <div style={{
              background: '#1a2a1a',
              border: '1px solid #2a4a2a',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>🤖 Claude's Suggestion</span>
                <div>
                  <button
                    onClick={applySuggestion}
                    style={{
                      background: '#4ade80',
                      color: '#000',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >Apply</button>
                  <button
                    onClick={() => setSuggestion(null)}
                    style={{
                      background: 'none',
                      color: '#888',
                      border: '1px solid #444',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >Dismiss</button>
                </div>
              </div>
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontSize: '13px',
                color: '#ccc',
                maxHeight: '200px',
                overflow: 'auto'
              }}>{suggestion}</pre>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {onGetSuggestions && (
              <button
                onClick={handleGetSuggestions}
                disabled={isGettingSuggestions}
                style={{
                  background: '#1a1a2a',
                  color: '#818cf8',
                  border: '1px solid #4338ca',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isGettingSuggestions ? '⏳ Getting suggestions...' : '🤖 Get Claude Suggestions'}
              </button>
            )}
            <button
              onClick={onCancel}
              style={{
                background: '#1a1a1a',
                color: '#888',
                border: '1px solid #333',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >Cancel</button>
            <button
              onClick={() => onSend(editedEmail)}
              disabled={isLoading || !editedEmail.to.length || !editedEmail.subject}
              style={{
                background: '#e63946',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isLoading ? '⏳ Sending...' : '📤 Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
