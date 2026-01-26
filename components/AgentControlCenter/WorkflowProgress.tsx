/**
 * WorkflowProgress Component
 *
 * Displays real-time progress of agent workflows with step tracking,
 * output links, and HITL approval buttons.
 */

import React from 'react';
import { CSAgentType, CS_AGENTS } from '../../types/agents';

// Workflow step type from backend
interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
}

// Workflow output type
interface WorkflowOutput {
  driveLinks?: Array<{
    type: string;
    name: string;
    webViewLink: string;
    id: string;
  }>;
  summary?: string;
  data?: Record<string, unknown>;
}

// Workflow execution type
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'fetching' | 'processing' | 'creating' | 'awaiting_review' | 'approved' | 'rejected' | 'completed' | 'failed';
  steps: WorkflowStep[];
  output?: WorkflowOutput;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

interface WorkflowProgressProps {
  execution: WorkflowExecution;
  agentType: CSAgentType;
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  execution,
  agentType,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const agent = CS_AGENTS[agentType];

  const getStatusLabel = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'pending': return 'Initializing...';
      case 'fetching': return 'Fetching data from Google Workspace...';
      case 'processing': return 'Processing and analyzing data...';
      case 'creating': return 'Creating outputs in Google Drive...';
      case 'awaiting_review': return 'Ready for your review';
      case 'approved': return 'Approved - completing workflow...';
      case 'rejected': return 'Rejected';
      case 'completed': return 'Completed successfully';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const getStatusColor = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'pending':
      case 'fetching':
      case 'processing':
      case 'creating': return '#f59e0b'; // amber
      case 'awaiting_review': return '#3b82f6'; // blue
      case 'approved':
      case 'completed': return '#22c55e'; // green
      case 'rejected':
      case 'failed': return '#ef4444'; // red
      default: return '#888';
    }
  };

  const getStepIcon = (step: WorkflowStep) => {
    switch (step.status) {
      case 'completed': return '✓';
      case 'in_progress': return '⟳';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  const isInProgress = ['pending', 'fetching', 'processing', 'creating', 'approved'].includes(execution.status);
  const showApproval = execution.status === 'awaiting_review';

  return (
    <div className="workflow-progress">
      {/* Header */}
      <div className="workflow-header">
        <div className="workflow-agent-icon">{agent?.icon || '🤖'}</div>
        <div className="workflow-info">
          <h3 className="workflow-name">{execution.workflowName}</h3>
          <p className="workflow-status" style={{ color: getStatusColor(execution.status) }}>
            {isInProgress && <span className="workflow-spinner" />}
            {getStatusLabel(execution.status)}
          </p>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="workflow-steps">
        {execution.steps.map((step, index) => (
          <div
            key={step.id}
            className={`workflow-step ${step.status}`}
          >
            <span className="step-icon" style={{
              color: step.status === 'completed' ? '#22c55e' :
                     step.status === 'in_progress' ? '#f59e0b' :
                     step.status === 'failed' ? '#ef4444' : '#666'
            }}>
              {getStepIcon(step)}
            </span>
            <span className="step-name">{step.name}</span>
            {step.status === 'in_progress' && (
              <span className="step-progress-bar">
                <span className="step-progress-fill" />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Output Links */}
      {execution.output?.driveLinks && execution.output.driveLinks.length > 0 && (
        <div className="workflow-outputs">
          <p className="outputs-label">Created Files:</p>
          <div className="output-links">
            {execution.output.driveLinks.map((link, i) => (
              <a
                key={i}
                href={link.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="output-link"
              >
                {getFileIcon(link.type)} {link.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {execution.output?.summary && (
        <div className="workflow-summary">
          <p>{execution.output.summary}</p>
        </div>
      )}

      {/* Error */}
      {execution.error && (
        <div className="workflow-error">
          <p>Error: {execution.error}</p>
        </div>
      )}

      {/* Approval Buttons */}
      {showApproval && (
        <div className="workflow-approval">
          <p className="approval-prompt">Review the created files and approve to finalize.</p>
          <div className="approval-buttons">
            <button
              className="approval-btn reject"
              onClick={onReject}
              disabled={isProcessing}
            >
              ✗ Reject
            </button>
            <button
              className="approval-btn approve"
              onClick={onApprove}
              disabled={isProcessing}
            >
              ✓ Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to get file icon based on type
function getFileIcon(type: string): string {
  switch (type) {
    case 'folder': return '📁';
    case 'doc': return '📄';
    case 'sheet': return '📊';
    case 'slide': return '📽️';
    default: return '📎';
  }
}

export default WorkflowProgress;
