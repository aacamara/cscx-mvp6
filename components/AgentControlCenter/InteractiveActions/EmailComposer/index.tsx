import { useState, useMemo, useEffect } from 'react';
import type { CSAgentType } from '../../../../types/agents';
import { ActionContainer } from '../ActionContainer';
import { ActionStep } from '../ActionStep';
import { ContactChip } from '../Shared';
import { RecipientSelector } from './RecipientSelector';
import { MessageEditor } from './MessageEditor';
import type {
  ActionStep as ActionStepType,
  EmailTemplate,
  EmailFormData,
  DriveFile,
} from '../types';
import {
  EMAIL_TEMPLATE_CONFIGS as emailTemplates,
  AGENT_ACTION_CONFIGS as agentConfigs,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface EmailComposerProps {
  agentType: CSAgentType;
  onCancel: () => void;
  onComplete: (result: { success: boolean; emailId?: string }) => void;
  customerName?: string;
  stakeholders?: import('../types').Contact[];
}

type Step = 'recipients' | 'template' | 'compose' | 'attachments' | 'preview';

const STEP_CONFIG: Record<Step, { title: string; description?: string }> = {
  recipients: { title: 'Recipients', description: 'Who should receive this email?' },
  template: { title: 'Template', description: 'Start with a template or write from scratch' },
  compose: { title: 'Compose', description: 'Write your message' },
  attachments: { title: 'Attachments', description: 'Add files from Drive (optional)' },
  preview: { title: 'Send', description: 'Review and send' },
};

export function EmailComposer({
  agentType,
  onCancel,
  onComplete,
  customerName,
  stakeholders = [],
}: EmailComposerProps) {
  const [currentStep, setCurrentStep] = useState<Step>('recipients');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<EmailFormData>({
    recipients: stakeholders,
    cc: [],
    bcc: [],
    template: null,
    subject: '',
    body: '',
    enhancedBody: undefined,
    attachments: [],
  });

  // Get available templates based on agent
  const availableTemplates = useMemo(() => {
    return agentConfigs[agentType].emailTemplates;
  }, [agentType]);

  // Build steps array for progress indicator
  const steps: ActionStepType[] = useMemo(() => {
    const stepOrder: Step[] = ['recipients', 'template', 'compose', 'attachments', 'preview'];
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
  const goBack = () => {
    const stepOrder: Step[] = ['recipients', 'template', 'compose', 'attachments', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) setCurrentStep(stepOrder[currentIndex - 1]);
  };
  const goNext = () => {
    const stepOrder: Step[] = ['recipients', 'template', 'compose', 'attachments', 'preview'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) setCurrentStep(stepOrder[currentIndex + 1]);
  };

  // Form handlers
  const handleTemplateSelect = (templateId: EmailTemplate) => {
    const template = emailTemplates[templateId];
    setFormData((prev) => ({
      ...prev,
      template: templateId,
      subject: template.subject.replace('{productName}', 'CSCX.AI').replace('{companyName}', customerName || 'your company'),
      body: template.bodyTemplate
        .replace(/{firstName}/g, formData.recipients[0]?.name.split(' ')[0] || 'there')
        .replace(/{productName}/g, 'CSCX.AI')
        .replace(/{companyName}/g, customerName || 'your company')
        .replace(/{csmName}/g, 'Your CSM'),
    }));
    goNext();
  };

  const handleSkipTemplate = () => {
    setFormData((prev) => ({ ...prev, template: 'custom' }));
    goNext();
  };

  const handleAttachmentToggle = (file: DriveFile) => {
    setFormData((prev) => {
      const exists = prev.attachments.find((f) => f.id === file.id);
      if (exists) {
        return { ...prev, attachments: prev.attachments.filter((f) => f.id !== file.id) };
      }
      return { ...prev, attachments: [...prev.attachments, file] };
    });
  };

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Drive files for attachments
  useEffect(() => {
    const fetchDriveFiles = async () => {
      setDriveFilesLoading(true);
      try {
        const userId = localStorage.getItem('userId') || '';
        const response = await fetch(`${API_URL}/api/workspace/drive/files?limit=10`, {
          headers: userId ? { 'x-user-id': userId } : {}
        });

        if (response.ok) {
          const data = await response.json();
          setDriveFiles(data.files || []);
        }
      } catch (error) {
        console.error('Failed to fetch drive files:', error);
      } finally {
        setDriveFilesLoading(false);
      }
    };

    fetchDriveFiles();
  }, []);

  const handleSubmit = async () => {
    if (formData.recipients.length === 0 || !formData.subject || !formData.body) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/workspace/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {})
        },
        body: JSON.stringify({
          to: formData.recipients.map((c) => c.email),
          cc: formData.cc.map((c) => c.email),
          bcc: formData.bcc.map((c) => c.email),
          subject: formData.subject,
          body: formData.enhancedBody || formData.body,
          attachments: formData.attachments.map((f) => f.id),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onComplete({ success: true, emailId: data.emailId });
      } else {
        setSubmitError(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Email send error:', error);
      setSubmitError('Failed to connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ActionContainer
      type="email"
      title="Compose Email"
      steps={steps}
      currentStep={currentStepIndex + 1}
      onClose={onCancel}
    >
      {/* Step 1: Select Recipients */}
      {currentStep === 'recipients' && (
        <ActionStep
          title={STEP_CONFIG.recipients.title}
          description={STEP_CONFIG.recipients.description}
          showBack={false}
          onNext={goNext}
          isNextDisabled={formData.recipients.length === 0}
        >
          <RecipientSelector
            to={formData.recipients}
            cc={formData.cc}
            bcc={formData.bcc}
            onToChange={(contacts) => setFormData((prev) => ({ ...prev, recipients: contacts }))}
            onCcChange={(contacts) => setFormData((prev) => ({ ...prev, cc: contacts }))}
            onBccChange={(contacts) => setFormData((prev) => ({ ...prev, bcc: contacts }))}
            showCcBcc={showCcBcc}
            onToggleCcBcc={() => setShowCcBcc(true)}
          />
        </ActionStep>
      )}

      {/* Step 2: Select Template */}
      {currentStep === 'template' && (
        <ActionStep
          title={STEP_CONFIG.template.title}
          description={STEP_CONFIG.template.description}
          onBack={goBack}
          showNext={false}
        >
          <div className="template-grid">
            {availableTemplates.map((templateId) => {
              const template = emailTemplates[templateId];
              return (
                <button
                  key={templateId}
                  className={`template-card ${formData.template === templateId ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(templateId)}
                >
                  <span className="template-icon">{template.icon}</span>
                  <span className="template-label">{template.label}</span>
                </button>
              );
            })}
            <button className="template-card template-custom" onClick={handleSkipTemplate}>
              <span className="template-icon">✏️</span>
              <span className="template-label">Write from scratch</span>
            </button>
          </div>
        </ActionStep>
      )}

      {/* Step 3: Compose Message */}
      {currentStep === 'compose' && (
        <ActionStep
          title={STEP_CONFIG.compose.title}
          description={STEP_CONFIG.compose.description}
          onBack={goBack}
          onNext={goNext}
          isNextDisabled={!formData.subject || !formData.body}
        >
          <MessageEditor
            subject={formData.subject}
            body={formData.body}
            enhancedBody={formData.enhancedBody}
            onSubjectChange={(subject) => setFormData((prev) => ({ ...prev, subject }))}
            onBodyChange={(body) => setFormData((prev) => ({ ...prev, body, enhancedBody: undefined }))}
            onEnhanced={(enhancedBody) => setFormData((prev) => ({ ...prev, enhancedBody }))}
            customerName={customerName}
            agentType={agentType}
          />
        </ActionStep>
      )}

      {/* Step 4: Attachments */}
      {currentStep === 'attachments' && (
        <ActionStep
          title={STEP_CONFIG.attachments.title}
          description={STEP_CONFIG.attachments.description}
          onBack={goBack}
          onNext={goNext}
          nextLabel="Skip" // Can skip attachments
        >
          <div className="attachments-section">
            {driveFilesLoading ? (
              <div className="drive-files-loading">Loading files...</div>
            ) : driveFiles.length === 0 ? (
              <div className="drive-files-empty">No files available. Files from your Google Drive will appear here.</div>
            ) : null}
            <div className="drive-files">
              {driveFiles.map((file) => {
                const isSelected = formData.attachments.find((f) => f.id === file.id);
                return (
                  <button
                    key={file.id}
                    className={`drive-file ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleAttachmentToggle(file)}
                  >
                    <span className="file-icon">
                      {file.mimeType.includes('presentation') ? '📊' :
                       file.mimeType.includes('spreadsheet') ? '📈' : '📄'}
                    </span>
                    <span className="file-name">{file.name}</span>
                    {isSelected && <span className="file-check">✓</span>}
                  </button>
                );
              })}
            </div>
            {formData.attachments.length > 0 && (
              <div className="selected-attachments">
                <span className="attachments-count">
                  {formData.attachments.length} file{formData.attachments.length > 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </div>
        </ActionStep>
      )}

      {/* Step 5: Preview & Send */}
      {currentStep === 'preview' && (
        <ActionStep
          title={STEP_CONFIG.preview.title}
          description="Review your email before sending"
          showBack={false}
          showNext={false}
        >
          <div className="email-preview">
            <div className="preview-card">
              {/* Recipients */}
              <div className="preview-row">
                <span className="preview-label">To:</span>
                <div className="preview-recipients">
                  {formData.recipients.map((c) => (
                    <ContactChip key={c.id} contact={c} size="sm" />
                  ))}
                </div>
              </div>

              {formData.cc.length > 0 && (
                <div className="preview-row">
                  <span className="preview-label">CC:</span>
                  <div className="preview-recipients">
                    {formData.cc.map((c) => (
                      <ContactChip key={c.id} contact={c} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              {/* Subject */}
              <div className="preview-row">
                <span className="preview-label">Subject:</span>
                <span className="preview-subject">{formData.subject}</span>
              </div>

              {/* Body */}
              <div className="preview-body">
                <pre className="preview-message-text">{formData.enhancedBody || formData.body}</pre>
              </div>

              {/* Attachments */}
              {formData.attachments.length > 0 && (
                <div className="preview-row">
                  <span className="preview-label">Attachments:</span>
                  <div className="preview-attachments">
                    {formData.attachments.map((f) => (
                      <span key={f.id} className="attachment-badge">📎 {f.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="preview-actions">
              <button
                className="preview-btn preview-btn-secondary"
                onClick={() => setCurrentStep('compose')}
                disabled={isSubmitting}
              >
                ← Edit Email
              </button>
              <button
                className="preview-btn preview-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" />
                    Sending...
                  </>
                ) : (
                  <>✉️ Send Email</>
                )}
              </button>
            </div>

            {/* Error message */}
            {submitError && (
              <div className="submit-error">
                <span className="error-icon">⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            {/* HITL Notice */}
            <div className="hitl-notice">
              <span className="hitl-icon">🛡️</span>
              <span>
                This action requires approval before sending. You'll be able to review and confirm.
              </span>
            </div>
          </div>
        </ActionStep>
      )}
    </ActionContainer>
  );
}
