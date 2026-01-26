import { useState, useEffect } from 'react';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  meetLink?: string;
}

export function UpcomingMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const userId = localStorage.getItem('userId') || '';
        const API_URL = import.meta.env.VITE_API_URL || '';

        const response = await fetch(`${API_URL}/api/workspace/context/upcoming`, {
          headers: userId ? { 'x-user-id': userId } : {}
        });

        if (response.ok) {
          const data = await response.json();
          setMeetings(data.meetings || []);
        } else {
          setMeetings([]);
        }
      } catch (error) {
        console.error('Failed to fetch upcoming meetings:', error);
        setMeetings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.round((date.getTime() - now.getTime()) / (1000 * 60));
      return `in ${diffMins}m`;
    } else if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="context-section">
        <div className="context-section-header">
          <span className="section-icon">📅</span>
          <span className="section-title">Upcoming</span>
        </div>
        <div className="context-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="context-section">
      <div className="context-section-header">
        <span className="section-icon">📅</span>
        <span className="section-title">Upcoming</span>
        <span className="section-count">{meetings.length}</span>
      </div>
      <div className="meeting-list">
        {meetings.slice(0, 3).map((meeting) => (
          <div key={meeting.id} className="meeting-item">
            <div className="meeting-time">{formatTime(meeting.startTime)}</div>
            <div className="meeting-details">
              <span className="meeting-title">{meeting.title}</span>
              <span className="meeting-attendees">
                {meeting.attendees.length} attendee{meeting.attendees.length > 1 ? 's' : ''}
              </span>
            </div>
            {meeting.meetLink && (
              <a
                href={meeting.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="meeting-join"
                title="Join meeting"
              >
                🔗
              </a>
            )}
          </div>
        ))}
        {meetings.length === 0 && (
          <div className="context-empty">No upcoming meetings</div>
        )}
      </div>
    </div>
  );
}
