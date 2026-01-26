import { useState, useMemo } from 'react';
import type { CSAgentType } from '../../../../types/agents';
import { ActionContainer } from '../ActionContainer';
import { ActionStep } from '../ActionStep';
import { ContactTypeahead } from '../Shared';
import type {
  ActionStep as ActionStepType,
  DocumentType,
  DocumentFormData,
  Contact,
} from '../types';
import {
  DOCUMENT_TEMPLATE_CONFIGS as docTemplates,
  AGENT_ACTION_CONFIGS as agentConfigs,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DocumentActionsProps {
  agentType: CSAgentType;
  onCancel: () => void;
  onComplete: (result: { success: boolean; documentId?: string; webViewLink?: string }) => void;
  customerName?: string;
}

type Step = 'template' | 'details' | 'share' | 'create';

const STEP_CONFIG: Record<Step, { title: string; description?: string }> = {
  template: { title: 'Template', description: 'Choose a document template' },
  details: { title: 'Details', description: 'Name your document' },
  share: { title: 'Share', description: 'Share with team members (optional)' },
  create: { title: 'Create', description: 'Review and create' },
};

const FILE_TYPE_ICONS: Record<string, string> = {
  doc: '📄',
  sheet: '📊',
  slide: '📑',
};

export function DocumentActions({
  agentType,
  onCancel,
  onComplete,
  customerName,
}: DocumentActionsProps) {
  const [currentStep, setCurrentStep] = useState<Step>('template');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<DocumentFormData>({
    template: null,
    title: '',
    folder: customerName ? `CSCX - ${customerName}` : undefined,
    shareWith: [],
  });

  // Get available templates based on agent
  const availableTemplates = useMemo(() => {
    return agentConfigs[agentType].documentTemplates;
  }, [agentType]);

  // Build steps array for progress indicator
  const steps: ActionStepType[] = useMemo(() => {
    const stepOrder: Step[] = ['template', 'details', 'share', 'create'];
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
    const stepOrder: Step[] = ['template', 'details', 'share', 'create'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) setCurrentStep(stepOrder[currentIndex - 1]);
  };
  const goNext = () => {
    const stepOrder: Step[] = ['template', 'details', 'share', 'create'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) setCurrentStep(stepOrder[currentIndex + 1]);
  };

  // Form handlers
  const handleTemplateSelect = (templateId: DocumentType) => {
    const template = docTemplates[templateId];
    const defaultTitle = customerName
      ? `${template.label} - ${customerName}`
      : template.label;

    setFormData((prev) => ({
      ...prev,
      template: templateId,
      title: defaultTitle,
    }));
    goNext();
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.template || !formData.title) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/workspace/documents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {})
        },
        body: JSON.stringify({
          template: formData.template,
          title: formData.title,
          folder: formData.folder,
          shareWith: formData.shareWith,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onComplete({ success: true, documentId: data.documentId, webViewLink: data.webViewLink });
      } else {
        setSubmitError(data.error || 'Failed to create document');
      }
    } catch (error) {
      console.error('Document create error:', error);
      setSubmitError('Failed to connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = formData.template ? docTemplates[formData.template] : null;

  return (
    <ActionContainer
      type="document"
      title="Create Document"
      steps={steps}
      currentStep={currentStepIndex + 1}
      onClose={onCancel}
    >
      {/* Step 1: Select Template */}
      {currentStep === 'template' && (
        <ActionStep
          title={STEP_CONFIG.template.title}
          description={STEP_CONFIG.template.description}
          showBack={false}
          showNext={false}
        >
          <div className="document-template-grid">
            {availableTemplates.map((templateId) => {
              const template = docTemplates[templateId];
              return (
                <button
                  key={templateId}
                  className={`document-template-card ${formData.template === templateId ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(templateId)}
                >
                  <div className="template-header">
                    <span className="template-icon">{template.icon}</span>
                    <span className="template-type-badge">
                      {FILE_TYPE_ICONS[template.fileType]}
                    </span>
                  </div>
                  <span className="template-label">{template.label}</span>
                  <span className="template-description">{template.description}</span>
                </button>
              );
            })}
          </div>
        </ActionStep>
      )}

      {/* Step 2: Document Details */}
      {currentStep === 'details' && selectedTemplate && (
        <ActionStep
          title={STEP_CONFIG.details.title}
          description={STEP_CONFIG.details.description}
          onBack={goBack}
          onNext={goNext}
          isNextDisabled={!formData.title}
        >
          <div className="document-details">
            <div className="form-group">
              <label className="form-label">Document Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document name..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Save to Folder</label>
              <input
                type="text"
                className="form-input"
                value={formData.folder || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, folder: e.target.value }))}
                placeholder="My Drive"
              />
              <p className="form-hint">
                Documents are automatically organized in customer folders
              </p>
            </div>

            <div className="selected-template-info">
              <span className="info-icon">{selectedTemplate.icon}</span>
              <div className="info-details">
                <span className="info-label">{selectedTemplate.label}</span>
                <span className="info-type">
                  {selectedTemplate.fileType === 'doc' && 'Google Doc'}
                  {selectedTemplate.fileType === 'sheet' && 'Google Sheet'}
                  {selectedTemplate.fileType === 'slide' && 'Google Slides'}
                </span>
              </div>
            </div>
          </div>
        </ActionStep>
      )}

      {/* Step 3: Share */}
      {currentStep === 'share' && (
        <ActionStep
          title={STEP_CONFIG.share.title}
          description={STEP_CONFIG.share.description}
          onBack={goBack}
          onNext={goNext}
          nextLabel={formData.shareWith.length === 0 ? 'Skip' : 'Continue'}
        >
          <div className="share-section">
            <ContactTypeahead
              label="Share with"
              selectedContacts={formData.shareWith}
              onContactsChange={(contacts: Contact[]) =>
                setFormData((prev) => ({ ...prev, shareWith: contacts }))
              }
              placeholder="Add people to share with..."
            />
            <p className="share-hint">
              Shared users will receive edit access to the document
            </p>
          </div>
        </ActionStep>
      )}

      {/* Step 4: Create */}
      {currentStep === 'create' && selectedTemplate && (
        <ActionStep
          title={STEP_CONFIG.create.title}
          description="Review and create your document"
          showBack={false}
          showNext={false}
        >
          <div className="document-preview">
            <div className="preview-card">
              <div className="preview-header">
                <span className="preview-icon">{selectedTemplate.icon}</span>
                <div className="preview-title-section">
                  <h4 className="preview-title">{formData.title}</h4>
                  <span className="preview-type">
                    {selectedTemplate.fileType === 'doc' && 'Google Doc'}
                    {selectedTemplate.fileType === 'sheet' && 'Google Sheet'}
                    {selectedTemplate.fileType === 'slide' && 'Google Slides'}
                  </span>
                </div>
              </div>

              <div className="preview-details">
                <div className="preview-row">
                  <span className="preview-label">📁 Folder</span>
                  <span className="preview-value">{formData.folder || 'My Drive'}</span>
                </div>

                {formData.shareWith.length > 0 && (
                  <div className="preview-row">
                    <span className="preview-label">👥 Shared with</span>
                    <span className="preview-value">
                      {formData.shareWith.map((c) => c.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="preview-actions">
              <button
                className="preview-btn preview-btn-secondary"
                onClick={() => setCurrentStep('details')}
                disabled={isSubmitting}
              >
                ← Edit Details
              </button>
              <button
                className="preview-btn preview-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" />
                    Creating...
                  </>
                ) : (
                  <>📄 Create Document</>
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
          </div>
        </ActionStep>
      )}
    </ActionContainer>
  );
}
