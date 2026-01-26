import type { MeetingFormData, MeetingTypeConfig } from '../types';
import { ContactChip } from '../Shared/ContactChip';

interface MeetingPreviewProps {
  formData: MeetingFormData;
  meetingConfig: MeetingTypeConfig;
  onConfirm: () => void;
  onEdit: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

export function MeetingPreview({
  formData,
  meetingConfig,
  onConfirm,
  onEdit,
  isSubmitting,
  error,
}: MeetingPreviewProps) {
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="meeting-preview">
      <div className="preview-card">
        {/* Header */}
        <div className="preview-header">
          <span className="preview-icon">{meetingConfig.icon}</span>
          <div className="preview-title-section">
            <h4 className="preview-title">{formData.title || meetingConfig.label}</h4>
            <span className="preview-type">{meetingConfig.label}</span>
          </div>
        </div>

        {/* Details */}
        <div className="preview-details">
          {/* Time */}
          <div className="preview-row">
            <span className="preview-label">📅 When</span>
            <div className="preview-value">
              {formData.selectedSlot ? (
                <>
                  <span className="preview-date">
                    {formatDateTime(formData.selectedSlot.start)}
                  </span>
                  <span className="preview-duration">
                    ({formatDuration(formData.selectedSlot.start, formData.selectedSlot.end)})
                  </span>
                </>
              ) : (
                <span className="preview-missing">No time selected</span>
              )}
            </div>
          </div>

          {/* Attendees */}
          <div className="preview-row">
            <span className="preview-label">👥 Attendees</span>
            <div className="preview-value preview-attendees">
              {formData.attendees.length > 0 ? (
                formData.attendees.map((contact) => (
                  <ContactChip key={contact.id} contact={contact} size="sm" />
                ))
              ) : (
                <span className="preview-missing">No attendees added</span>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="preview-row">
            <span className="preview-label">⚙️ Options</span>
            <div className="preview-value preview-options">
              {formData.addMeetLink && (
                <span className="preview-badge">
                  <span className="badge-icon">🔗</span> Google Meet
                </span>
              )}
              {formData.sendReminder && (
                <span className="preview-badge">
                  <span className="badge-icon">🔔</span> Send Reminders
                </span>
              )}
              {!formData.addMeetLink && !formData.sendReminder && (
                <span className="preview-muted">No additional options</span>
              )}
            </div>
          </div>

          {/* Message */}
          {(formData.enhancedMessage || formData.message) && (
            <div className="preview-row preview-row-full">
              <span className="preview-label">💬 Message</span>
              <div className="preview-message">
                {formData.enhancedMessage || formData.message}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="preview-actions">
          <button
            className="preview-btn preview-btn-secondary"
            onClick={onEdit}
            disabled={isSubmitting}
          >
            ← Edit Details
          </button>
          <button
            className="preview-btn preview-btn-primary"
            onClick={onConfirm}
            disabled={isSubmitting || !formData.selectedSlot || formData.attendees.length === 0}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" />
                Scheduling...
              </>
            ) : (
              <>
                📅 Schedule Meeting
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="submit-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* HITL Notice */}
      <div className="hitl-notice">
        <span className="hitl-icon">🛡️</span>
        <span>
          This action requires approval before execution. You'll be able to review and confirm before the meeting is created.
        </span>
      </div>
    </div>
  );
}
