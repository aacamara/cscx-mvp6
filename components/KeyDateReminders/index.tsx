/**
 * Key Date Reminders Component (PRD-109)
 *
 * Displays upcoming key date reminders with suggested actions.
 * Supports filtering, dismissing, and quick actions.
 */

import React, { useEffect, useState } from 'react';
import { useKeyDates, formatKeyDate, formatDaysUntil, getUrgencyBadge, getDateTypeColor } from '../../hooks/useKeyDates';
import { KeyDateReminder, KeyDateType, DATE_TYPE_CONFIG, ReminderUrgency } from '../../types/keyDates';

// ============================================
// Main Component
// ============================================

interface KeyDateRemindersProps {
  customerId?: string;
  days?: number;
  compact?: boolean;
  onActionClick?: (action: string, reminder: KeyDateReminder) => void;
}

export const KeyDateReminders: React.FC<KeyDateRemindersProps> = ({
  customerId,
  days = 30,
  compact = false,
  onActionClick,
}) => {
  const {
    upcomingReminders,
    loading,
    error,
    fetchUpcomingReminders,
    dismissReminder,
  } = useKeyDates(customerId ? { customerId } : {});

  const [activeFilter, setActiveFilter] = useState<KeyDateType | 'all'>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    fetchUpcomingReminders(days);
  }, [fetchUpcomingReminders, days]);

  // Filter reminders
  const filteredReminders = upcomingReminders.filter(r => {
    if (!showDismissed && r.status === 'dismissed') return false;
    if (activeFilter !== 'all' && r.keyDate.dateType !== activeFilter) return false;
    if (customerId && r.keyDate.customerId !== customerId) return false;
    return true;
  });

  // Group by urgency
  const urgencyGroups = {
    critical: filteredReminders.filter(r => r.urgency === 'critical'),
    high: filteredReminders.filter(r => r.urgency === 'high'),
    medium: filteredReminders.filter(r => r.urgency === 'medium'),
    low: filteredReminders.filter(r => r.urgency === 'low'),
  };

  const handleDismiss = async (reminderId: string) => {
    try {
      await dismissReminder(reminderId);
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
    }
  };

  const handleAction = (action: string, reminder: KeyDateReminder) => {
    if (onActionClick) {
      onActionClick(action, reminder);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 text-red-400">
        <p className="font-medium">Error loading reminders</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <CompactView
        reminders={filteredReminders}
        onDismiss={handleDismiss}
        onAction={handleAction}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-cscx-accent" />
          Key Date Reminders
          {filteredReminders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-cscx-accent text-white rounded-full">
              {filteredReminders.length}
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`text-xs px-2 py-1 rounded ${
              showDismissed
                ? 'bg-cscx-gray-700 text-white'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {showDismissed ? 'Hide Dismissed' : 'Show Dismissed'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <FilterTab
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          label="All"
          count={upcomingReminders.length}
        />
        {Object.entries(DATE_TYPE_CONFIG).map(([type, config]) => {
          const count = upcomingReminders.filter(r => r.keyDate.dateType === type).length;
          if (count === 0) return null;
          return (
            <FilterTab
              key={type}
              active={activeFilter === type}
              onClick={() => setActiveFilter(type as KeyDateType)}
              label={config.label}
              count={count}
            />
          );
        })}
      </div>

      {/* Reminders by Urgency */}
      {filteredReminders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {urgencyGroups.critical.length > 0 && (
            <ReminderGroup
              title="Critical"
              reminders={urgencyGroups.critical}
              urgency="critical"
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          )}
          {urgencyGroups.high.length > 0 && (
            <ReminderGroup
              title="High Priority"
              reminders={urgencyGroups.high}
              urgency="high"
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          )}
          {urgencyGroups.medium.length > 0 && (
            <ReminderGroup
              title="Medium Priority"
              reminders={urgencyGroups.medium}
              urgency="medium"
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          )}
          {urgencyGroups.low.length > 0 && (
            <ReminderGroup
              title="Low Priority"
              reminders={urgencyGroups.low}
              urgency="low"
              onDismiss={handleDismiss}
              onAction={handleAction}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// Sub-Components
// ============================================

const FilterTab: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}> = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
      active
        ? 'bg-cscx-accent text-white'
        : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hover:text-white'
    }`}
  >
    {label}
    {count > 0 && (
      <span className={`ml-1.5 ${active ? 'text-white/80' : 'text-cscx-gray-400'}`}>
        ({count})
      </span>
    )}
  </button>
);

const ReminderGroup: React.FC<{
  title: string;
  reminders: KeyDateReminder[];
  urgency: ReminderUrgency;
  onDismiss: (id: string) => void;
  onAction: (action: string, reminder: KeyDateReminder) => void;
}> = ({ title, reminders, urgency, onDismiss, onAction }) => {
  const borderColor = {
    critical: 'border-red-600',
    high: 'border-orange-500',
    medium: 'border-yellow-500',
    low: 'border-green-600',
  }[urgency];

  return (
    <div>
      <h3 className="text-sm font-medium text-cscx-gray-400 mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${getUrgencyBadge(urgency)}`} />
        {title}
      </h3>
      <div className="space-y-3">
        {reminders.map(reminder => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            borderColor={borderColor}
            onDismiss={onDismiss}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
};

const ReminderCard: React.FC<{
  reminder: KeyDateReminder;
  borderColor: string;
  onDismiss: (id: string) => void;
  onAction: (action: string, reminder: KeyDateReminder) => void;
}> = ({ reminder, borderColor, onDismiss, onAction }) => {
  const { keyDate, daysUntil, suggestedActions, customerContext, status } = reminder;
  const isDismissed = status === 'dismissed';
  const dateTypeConfig = DATE_TYPE_CONFIG[keyDate.dateType];

  return (
    <div
      className={`bg-cscx-gray-800 border-l-4 ${borderColor} rounded-lg p-4 ${
        isDismissed ? 'opacity-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${getDateTypeColor(keyDate.dateType)}`}>
              {dateTypeConfig.label}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getUrgencyBadge(reminder.urgency)}`}>
              {formatDaysUntil(daysUntil)}
            </span>
          </div>
          <h4 className="text-white font-medium">{keyDate.title}</h4>
          <p className="text-sm text-cscx-gray-400">
            {keyDate.customerName || 'Customer'} - {formatKeyDate(keyDate.dateValue)}
          </p>
        </div>

        {!isDismissed && (
          <button
            onClick={() => onDismiss(reminder.id)}
            className="text-cscx-gray-500 hover:text-cscx-gray-300 p-1"
            title="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Context */}
      {customerContext && (customerContext.totalRevenue || customerContext.healthStatus) && (
        <div className="flex items-center gap-4 text-xs text-cscx-gray-400 mb-3">
          {customerContext.totalRevenue && (
            <span>Revenue: ${customerContext.totalRevenue.toLocaleString()}</span>
          )}
          {customerContext.healthStatus && (
            <span className="flex items-center gap-1">
              Health:
              <span className={getHealthStatusColor(customerContext.healthStatus)}>
                {customerContext.healthStatus.charAt(0).toUpperCase() + customerContext.healthStatus.slice(1)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-cscx-gray-500 font-medium">Suggested Actions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map(action => (
              <button
                key={action.id}
                onClick={() => onAction(action.id, reminder)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  action.priority === 'primary'
                    ? 'bg-cscx-accent hover:bg-cscx-accent/80 text-white'
                    : 'bg-cscx-gray-700 hover:bg-cscx-gray-600 text-cscx-gray-300'
                }`}
              >
                {action.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CompactView: React.FC<{
  reminders: KeyDateReminder[];
  onDismiss: (id: string) => void;
  onAction: (action: string, reminder: KeyDateReminder) => void;
}> = ({ reminders, onDismiss, onAction }) => {
  if (reminders.length === 0) {
    return (
      <div className="text-sm text-cscx-gray-400 py-2">
        No upcoming key dates
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.slice(0, 5).map(reminder => (
        <div
          key={reminder.id}
          className="flex items-center justify-between bg-cscx-gray-800 rounded-lg px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getUrgencyBadge(reminder.urgency)}`} />
            <span className="text-sm text-white truncate max-w-[150px]">
              {reminder.keyDate.title}
            </span>
            <span className="text-xs text-cscx-gray-400">
              {formatDaysUntil(reminder.daysUntil)}
            </span>
          </div>
          <button
            onClick={() => onDismiss(reminder.id)}
            className="text-cscx-gray-500 hover:text-cscx-gray-300"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      {reminders.length > 5 && (
        <p className="text-xs text-cscx-gray-400 text-center">
          +{reminders.length - 5} more reminders
        </p>
      )}
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="bg-cscx-gray-800 rounded-lg p-8 text-center">
    <CalendarIcon className="w-12 h-12 text-cscx-gray-600 mx-auto mb-4" />
    <h3 className="text-white font-medium mb-2">No Upcoming Key Dates</h3>
    <p className="text-sm text-cscx-gray-400 max-w-md mx-auto">
      You're all caught up! No key dates are coming up in the selected time window.
      Add key dates to track important customer milestones.
    </p>
  </div>
);

// ============================================
// Utility Functions
// ============================================

function getHealthStatusColor(status: string): string {
  const colors: Record<string, string> = {
    excellent: 'text-green-400',
    good: 'text-blue-400',
    at_risk: 'text-yellow-400',
    critical: 'text-red-400',
  };
  return colors[status] || 'text-cscx-gray-400';
}

// ============================================
// Icons
// ============================================

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default KeyDateReminders;
