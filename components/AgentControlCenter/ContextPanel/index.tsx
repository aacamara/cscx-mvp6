import { useState } from 'react';
import { UpcomingMeetings } from './UpcomingMeetings';
import { RecentEmails } from './RecentEmails';
import { CustomerHealth } from './CustomerHealth';

interface ContextPanelProps {
  customerName?: string;
  healthScore?: number;
  renewalDate?: string;
  arr?: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function ContextPanel({
  customerName,
  healthScore,
  renewalDate,
  arr,
  isCollapsed = false,
  onToggle,
}: ContextPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (isCollapsed) {
    return (
      <div className="context-panel collapsed">
        <button className="context-toggle" onClick={onToggle} title="Show context panel">
          <span className="toggle-icon">◀</span>
        </button>
        <div className="collapsed-icons">
          <button
            className="collapsed-icon-btn"
            onClick={() => {
              onToggle?.();
              setActiveSection('meetings');
            }}
            title="Upcoming meetings"
          >
            📅
          </button>
          <button
            className="collapsed-icon-btn"
            onClick={() => {
              onToggle?.();
              setActiveSection('emails');
            }}
            title="Recent emails"
          >
            ✉️
          </button>
          <button
            className="collapsed-icon-btn"
            onClick={() => {
              onToggle?.();
              setActiveSection('health');
            }}
            title="Customer health"
          >
            🏢
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <span className="panel-title">Context</span>
        <button className="context-toggle" onClick={onToggle} title="Hide context panel">
          <span className="toggle-icon">▶</span>
        </button>
      </div>

      <div className="context-panel-content">
        <CustomerHealth
          customerName={customerName}
          healthScore={healthScore}
          renewalDate={renewalDate}
          arr={arr}
        />
        <UpcomingMeetings />
        <RecentEmails />
      </div>
    </div>
  );
}

export { UpcomingMeetings } from './UpcomingMeetings';
export { RecentEmails } from './RecentEmails';
export { CustomerHealth } from './CustomerHealth';
