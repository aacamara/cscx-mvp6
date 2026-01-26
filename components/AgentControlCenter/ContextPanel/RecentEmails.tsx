import { useState, useEffect } from 'react';

interface Email {
  id: string;
  subject: string;
  from: string;
  preview: string;
  timestamp: string;
  unread: boolean;
}

export function RecentEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const userId = localStorage.getItem('userId') || '';
        const API_URL = import.meta.env.VITE_API_URL || '';

        const response = await fetch(`${API_URL}/api/workspace/context/emails`, {
          headers: userId ? { 'x-user-id': userId } : {}
        });

        if (response.ok) {
          const data = await response.json();
          setEmails(data.emails || []);
        } else {
          setEmails([]);
        }
      } catch (error) {
        console.error('Failed to fetch recent emails:', error);
        setEmails([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmails();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.round((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.round(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  const extractName = (email: string) => {
    return email.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <div className="context-section">
        <div className="context-section-header">
          <span className="section-icon">✉️</span>
          <span className="section-title">Recent Emails</span>
        </div>
        <div className="context-loading">Loading...</div>
      </div>
    );
  }

  const unreadCount = emails.filter(e => e.unread).length;

  return (
    <div className="context-section">
      <div className="context-section-header">
        <span className="section-icon">✉️</span>
        <span className="section-title">Recent Emails</span>
        {unreadCount > 0 && (
          <span className="section-badge">{unreadCount} new</span>
        )}
      </div>
      <div className="email-list">
        {emails.slice(0, 3).map((email) => (
          <div key={email.id} className={`email-item ${email.unread ? 'unread' : ''}`}>
            <div className="email-header">
              <span className="email-from">{extractName(email.from)}</span>
              <span className="email-time">{formatTime(email.timestamp)}</span>
            </div>
            <div className="email-subject">{email.subject}</div>
            <div className="email-preview">{email.preview}</div>
          </div>
        ))}
        {emails.length === 0 && (
          <div className="context-empty">No recent emails</div>
        )}
      </div>
    </div>
  );
}
