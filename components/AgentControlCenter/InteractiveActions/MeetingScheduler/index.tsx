import { useState, useMemo } from 'react';
import type { CSAgentType } from '../../../../types/agents';
import { ActionContainer } from '../ActionContainer';
import { ActionStep } from '../ActionStep';
import { ContactTypeahead, AIEnhanceButton } from '../Shared';
import { AvailabilityPicker } from './AvailabilityPicker';
import { MeetingPreview } from './MeetingPreview';
import type {
  ActionStep as ActionStepType,
  MeetingType,
  MeetingFormData,
  Contact,
  TimeSlot,
} from '../types';
import {
  MEETING_TYPE_CONFIGS as meetingConfigs,
  AGENT_ACTION_CONFIGS as agentConfigs,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface MeetingSchedulerProps {
  agentType: CSAgentType;
  onCancel: () => void;
  onComplete: (result: { success: boolean; meetingId?: string; meetLink?: string }) => void;
  customerName?: string;
  stakeholders?: Contact[];
}

type Step = 'type' | 'time' | 'attendees' | 'message' | 'preview';

const STEP_CONFIG: Record<Step, { title: string; description?: string }> = {
  type: { title: 'Meeting Type', description: 'What kind of meeting?' },
  time: { title: 'Select Time', description: 'Pick an available slot' },
  attendees: { title: 'Add Attendees', description: 'Who should join?' },
  message: { title: 'Add Details', description: 'Optional message and options' },
  preview: { title: 'Confirm', description: 'Review and schedule' },
};

export function MeetingScheduler({
  agentType,
  onCancel,
  onComplete,
  customerName,
  stakeholders = [],
}: MeetingSchedulerProps) {
  const [currentStep, setCurrentStep] = useState<Step>('type');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<MeetingFormData>({
    type: null,
    title: '',
    selectedSlot: null,
    attendees: stakeholders,
    message: '',
    enhancedMessage: undefined,
    addMeetLink: true,
    sendReminder: true,
  });

  // Get available meeting types based on agent
  const availableMeetingTypes = useMemo(() => {
    return agentConfigs[agentType].meetingTypes;
  }, [agentType]);

  // Build steps array for progress indicator
  const steps: ActionStepType[] = useMemo(() => {
    const stepOrder: Step[] = ['type', 'time', 'attendees', 'message', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep);

    return stepOrder.map((step, index) => ({
      id: step,
      title: STEP_CONFIG[step].title,
      isComplete: index < currentIndex,
      isActive: step === currentStep,
    }));
  }, [currentStep]);

  const currentStepIndex = steps.findIndex((s) => s.isActive);

  // Navigation helpers
  const goToStep = (step: Step) => setCurrentStep(step);
  const goBack = () => {
    const stepOrder: Step[] = ['type', 'time', 'attendees', 'message', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) setCurrentStep(stepOrder[currentIndex - 1]);
  };
  const goNext = () => {
    const stepOrder: Step[] = ['type', 'time', 'attendees', 'message', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) setCurrentStep(stepOrder[currentIndex + 1]);
  };

  // Form handlers
  const handleTypeSelect = (type: MeetingType) => {
    const config = meetingConfigs[type];
    setFormData((prev) => ({
      ...prev,
      type,
      title: config.label,
    }));
    goNext();
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setFormData((prev) => ({ ...prev, selectedSlot: slot }));
  };

  const handleAttendeesChange = (attendees: Contact[]) => {
    setFormData((prev) => ({ ...prev, attendees }));
  };

  const handleMessageChange = (message: string) => {
    setFormData((prev) => ({ ...prev, message, enhancedMessage: undefined }));
  };

  const handleEnhanced = (enhancedMessage: string) => {
    setFormData((prev) => ({ ...prev, enhancedMessage }));
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.type || !formData.selectedSlot || formData.attendees.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/workspace/calendar/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {})
        },
        body: JSON.stringify({
          title: formData.title,
          type: formData.type,
          startTime: formData.selectedSlot.start.toISOString(),
          endTime: formData.selectedSlot.end.toISOString(),
          attendees: formData.attendees.map((c) => c.email),
          description: formData.enhancedMessage || formData.message,
          addMeetLink: formData.addMeetLink,
          sendNotifications: formData.sendReminder,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onComplete({ success: true, meetingId: data.meetingId, meetLink: data.meetLink });
      } else {
        setSubmitError(data.error || 'Failed to schedule meeting');
      }
    } catch (error) {
      console.error('Meeting schedule error:', error);
      setSubmitError('Failed to connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMeetingConfig = formData.type ? meetingConfigs[formData.type] : null;

  return (
    <ActionContainer
      type="meeting"
      title="Schedule Meeting"
      steps={steps}
      currentStep={currentStepIndex + 1}
      onClose={onCancel}
    >
      {/* Step 1: Select Meeting Type */}
      {currentStep === 'type' && (
        <ActionStep
          title={STEP_CONFIG.type.title}
          description={STEP_CONFIG.type.description}
          showBack={false}
          showNext={false}
        >
          <div className="meeting-type-grid">
            {availableMeetingTypes.map((typeId) => {
              const config = meetingConfigs[typeId];
              return (
                <button
                  key={typeId}
                  className={`meeting-type-card ${formData.type === typeId ? 'selected' : ''}`}
                  onClick={() => handleTypeSelect(typeId)}
                >
                  <span className="type-icon">{config.icon}</span>
                  <span className="type-label">{config.label}</span>
                  <span className="type-duration">{config.defaultDuration} min</span>
                </button>
              );
            })}
          </div>
        </ActionStep>
      )}

      {/* Step 2: Select Time */}
      {currentStep === 'time' && selectedMeetingConfig && (
        <ActionStep
          title={STEP_CONFIG.time.title}
          description={`Select a time for your ${selectedMeetingConfig.label.toLowerCase()}`}
          onBack={goBack}
          onNext={goNext}
          isNextDisabled={!formData.selectedSlot}
        >
          <AvailabilityPicker
            selectedSlot={formData.selectedSlot}
            onSlotSelect={handleSlotSelect}
            duration={selectedMeetingConfig.defaultDuration}
          />
        </ActionStep>
      )}

      {/* Step 3: Add Attendees */}
      {currentStep === 'attendees' && (
        <ActionStep
          title={STEP_CONFIG.attendees.title}
          description={STEP_CONFIG.attendees.description}
          onBack={goBack}
          onNext={goNext}
          isNextDisabled={formData.attendees.length === 0}
        >
          <div className="attendees-section">
            <ContactTypeahead
              label="Invite people"
              selectedContacts={formData.attendees}
              onContactsChange={handleAttendeesChange}
              placeholder="Search by name or email..."
            />
            <p className="attendees-hint">
              Start typing to search contacts or enter an email address
            </p>
          </div>
        </ActionStep>
      )}

      {/* Step 4: Message & Options */}
      {currentStep === 'message' && selectedMeetingConfig && (
        <ActionStep
          title={STEP_CONFIG.message.title}
          description="Add a message and configure options"
          onBack={goBack}
          onNext={goNext}
        >
          <div className="message-section">
            {/* Title */}
            <div className="form-group">
              <label className="form-label">Meeting Title</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={selectedMeetingConfig.label}
              />
            </div>

            {/* Message */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label">Message (optional)</label>
                <AIEnhanceButton
                  text={formData.message}
                  onEnhanced={handleEnhanced}
                  context={{
                    type: 'meeting_description',
                    customerName,
                    agentType,
                  }}
                  size="sm"
                />
              </div>
              <textarea
                className="form-textarea"
                value={formData.enhancedMessage || formData.message}
                onChange={(e) => handleMessageChange(e.target.value)}
                placeholder="Add agenda items or notes for attendees..."
                rows={4}
              />
            </div>

            {/* Options */}
            <div className="form-options">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={formData.addMeetLink}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, addMeetLink: e.target.checked }))
                  }
                />
                <span className="checkbox-label">Add Google Meet link</span>
              </label>
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={formData.sendReminder}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sendReminder: e.target.checked }))
                  }
                />
                <span className="checkbox-label">Send email notifications</span>
              </label>
            </div>
          </div>
        </ActionStep>
      )}

      {/* Step 5: Preview & Confirm */}
      {currentStep === 'preview' && selectedMeetingConfig && (
        <ActionStep
          title={STEP_CONFIG.preview.title}
          description="Review your meeting details"
          showBack={false}
          showNext={false}
        >
          <MeetingPreview
            formData={formData}
            meetingConfig={selectedMeetingConfig}
            onConfirm={handleSubmit}
            onEdit={() => goToStep('message')}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        </ActionStep>
      )}
    </ActionContainer>
  );
}
