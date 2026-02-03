/**
 * NaturalLanguageTask Component
 * PRD-234: Natural Language Task Creation
 *
 * Allows users to create tasks using natural language input.
 * AI parses the input to extract customer, due date, priority, and task type.
 */

import { useEffect, useState } from 'react';
import {
  useNaturalLanguageTask,
  getPriorityColor,
  getPriorityLabel,
  getTaskTypeIcon,
  getTaskTypeLabel,
  formatConfidence,
  getConfidenceColor,
} from '../../hooks/useNaturalLanguageTask';
import type { SuggestedTask, TaskPriority, TaskType } from '../../types/naturalLanguageTask';
import './styles.css';

interface NaturalLanguageTaskProps {
  customerId?: string;
  customerName?: string;
  onTaskCreated?: (task: { id: string; title: string }) => void;
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function NaturalLanguageTask({
  customerId,
  customerName,
  onTaskCreated,
  onCancel,
  placeholder = 'Type a task like "Follow up with Sarah next Tuesday about the renewal"',
  className = '',
  autoFocus = false,
}: NaturalLanguageTaskProps) {
  const {
    state,
    setInput,
    clearInput,
    parseTask,
    startEditing,
    updateEdit,
    cancelEdit,
    createTask,
    reset,
  } = useNaturalLanguageTask({
    current_customer_id: customerId,
    current_customer_name: customerName,
  });

  const [showPreview, setShowPreview] = useState(false);

  // Auto-parse when user stops typing
  useEffect(() => {
    if (state.input.trim().length > 10 && !state.isTyping && !state.isParsing && !state.parsed) {
      const timer = setTimeout(() => {
        parseTask();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.input, state.isTyping, state.isParsing, state.parsed, parseTask]);

  // Show preview when parsed
  useEffect(() => {
    if (state.parsed && state.suggestedTask) {
      setShowPreview(true);
    }
  }, [state.parsed, state.suggestedTask]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Parse on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (state.input.trim()) {
        parseTask();
      }
    }
    // Cancel on Escape
    if (e.key === 'Escape') {
      if (showPreview) {
        setShowPreview(false);
      } else {
        onCancel?.();
      }
    }
  };

  const handleCreate = async () => {
    const result = await createTask();
    if (result.success && result.task) {
      onTaskCreated?.({ id: result.task.id, title: result.task.title });
      reset();
      setShowPreview(false);
    }
  };

  const handleCancel = () => {
    reset();
    setShowPreview(false);
    onCancel?.();
  };

  return (
    <div className={`nl-task ${className}`}>
      {/* Input Section */}
      <div className="nl-task-input-section">
        <div className="nl-task-input-wrapper">
          <textarea
            className="nl-task-input"
            value={state.input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={2}
          />
          {state.input && (
            <button className="nl-task-clear" onClick={clearInput} title="Clear">
              x
            </button>
          )}
        </div>

        <div className="nl-task-input-actions">
          <span className="nl-task-hint">Press Enter to parse, Shift+Enter for new line</span>
          <button
            className="nl-task-parse-btn"
            onClick={() => parseTask()}
            disabled={!state.input.trim() || state.isParsing}
          >
            {state.isParsing ? 'Parsing...' : 'Parse Task'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {state.isParsing && (
        <div className="nl-task-loading">
          <div className="nl-task-spinner" />
          <span>Analyzing your task...</span>
        </div>
      )}

      {/* Error State */}
      {state.parseError && (
        <div className="nl-task-error">
          <span className="nl-task-error-icon">!</span>
          <span>{state.parseError}</span>
          <button onClick={() => parseTask()}>Retry</button>
        </div>
      )}

      {/* Preview Section */}
      {showPreview && state.suggestedTask && !state.isParsing && (
        <div className="nl-task-preview">
          <div className="nl-task-preview-header">
            <h3>Task Preview</h3>
            <div className="nl-task-confidence">
              <span
                className="nl-task-confidence-badge"
                style={{ backgroundColor: getConfidenceColor(state.parsed?.confidence || 0) }}
              >
                {formatConfidence(state.parsed?.confidence || 0)} confident
              </span>
            </div>
          </div>

          {state.isEditing && state.editedTask ? (
            <TaskEditor
              task={state.editedTask}
              onUpdate={updateEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <TaskPreviewCard
              task={state.suggestedTask}
              parsed={state.parsed}
              onEdit={startEditing}
            />
          )}

          {/* Ambiguities */}
          {state.ambiguities.length > 0 && (
            <div className="nl-task-ambiguities">
              <h4>Needs clarification:</h4>
              <ul>
                {state.ambiguities.map((amb, i) => (
                  <li key={i}>
                    <strong>{amb.field}:</strong> {amb.issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="nl-task-preview-actions">
            <button className="nl-task-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button
              className="nl-task-btn-primary"
              onClick={handleCreate}
              disabled={state.isCreating}
            >
              {state.isCreating ? 'Creating...' : 'Create Task'}
            </button>
          </div>

          {state.createError && (
            <div className="nl-task-create-error">{state.createError}</div>
          )}
        </div>
      )}

      {/* Success Message */}
      {state.createdTask && (
        <div className="nl-task-success">
          <span className="nl-task-success-icon">Done!</span>
          <span>Task "{state.createdTask.title}" created successfully!</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Task Preview Card Sub-component
// ============================================

interface TaskPreviewCardProps {
  task: SuggestedTask;
  parsed: { entities: { customer?: { match_confidence: number }; due_date?: { confidence: number } }; confidence: number } | null;
  onEdit: () => void;
}

function TaskPreviewCard({ task, parsed, onEdit }: TaskPreviewCardProps) {
  return (
    <div className="nl-task-card">
      <div className="nl-task-card-header">
        <span className="nl-task-type-badge">
          <span className="nl-task-type-icon">{getTaskTypeIcon(task.task_type)}</span>
          <span>{getTaskTypeLabel(task.task_type)}</span>
        </span>
        <button className="nl-task-edit-btn" onClick={onEdit}>
          Edit
        </button>
      </div>

      <h4 className="nl-task-title">{task.title}</h4>

      <div className="nl-task-details">
        {/* Customer */}
        {task.customer_name && (
          <div className="nl-task-detail">
            <span className="nl-task-detail-icon">Building</span>
            <span className="nl-task-detail-label">Customer:</span>
            <span className="nl-task-detail-value">{task.customer_name}</span>
            {parsed?.entities.customer && (
              <span
                className="nl-task-match-indicator"
                style={{ color: getConfidenceColor(parsed.entities.customer.match_confidence) }}
              >
                ({formatConfidence(parsed.entities.customer.match_confidence)} match)
              </span>
            )}
          </div>
        )}

        {/* Stakeholder */}
        {task.stakeholder_name && (
          <div className="nl-task-detail">
            <span className="nl-task-detail-icon">Person</span>
            <span className="nl-task-detail-label">Contact:</span>
            <span className="nl-task-detail-value">{task.stakeholder_name}</span>
          </div>
        )}

        {/* Due Date */}
        {task.due_date && (
          <div className="nl-task-detail">
            <span className="nl-task-detail-icon">Calendar</span>
            <span className="nl-task-detail-label">Due:</span>
            <span className="nl-task-detail-value">
              {new Date(task.due_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Priority */}
        <div className="nl-task-detail">
          <span className="nl-task-detail-icon">Flag</span>
          <span className="nl-task-detail-label">Priority:</span>
          <span
            className="nl-task-priority-badge"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
          >
            {getPriorityLabel(task.priority)}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && task.description !== task.title && (
        <div className="nl-task-description">
          <p>{task.description}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Task Editor Sub-component
// ============================================

interface TaskEditorProps {
  task: Partial<SuggestedTask>;
  onUpdate: (field: keyof SuggestedTask, value: unknown) => void;
  onCancel: () => void;
}

function TaskEditor({ task, onUpdate, onCancel }: TaskEditorProps) {
  const priorityOptions: TaskPriority[] = ['high', 'medium', 'low'];
  const taskTypeOptions: TaskType[] = [
    'follow_up',
    'send',
    'schedule',
    'review',
    'call',
    'email',
    'research',
    'meeting',
    'documentation',
    'other',
  ];

  return (
    <div className="nl-task-editor">
      <div className="nl-task-editor-field">
        <label>Title</label>
        <input
          type="text"
          value={task.title || ''}
          onChange={(e) => onUpdate('title', e.target.value)}
        />
      </div>

      <div className="nl-task-editor-row">
        <div className="nl-task-editor-field">
          <label>Due Date</label>
          <input
            type="date"
            value={task.due_date || ''}
            onChange={(e) => onUpdate('due_date', e.target.value)}
          />
        </div>

        <div className="nl-task-editor-field">
          <label>Priority</label>
          <select
            value={task.priority || 'medium'}
            onChange={(e) => onUpdate('priority', e.target.value)}
          >
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {getPriorityLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="nl-task-editor-field">
          <label>Type</label>
          <select
            value={task.task_type || 'other'}
            onChange={(e) => onUpdate('task_type', e.target.value)}
          >
            {taskTypeOptions.map((t) => (
              <option key={t} value={t}>
                {getTaskTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="nl-task-editor-field">
        <label>Description (optional)</label>
        <textarea
          value={task.description || ''}
          onChange={(e) => onUpdate('description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="nl-task-editor-actions">
        <button className="nl-task-btn-secondary" onClick={onCancel}>
          Cancel Edit
        </button>
      </div>
    </div>
  );
}

// ============================================
// Quick Add Task Input (Minimal version)
// ============================================

interface QuickAddTaskProps {
  customerId?: string;
  customerName?: string;
  onTaskCreated?: (task: { id: string; title: string }) => void;
  className?: string;
}

export function QuickAddTask({
  customerId,
  customerName,
  onTaskCreated,
  className = '',
}: QuickAddTaskProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        className={`nl-task-quick-add-btn ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        <span className="nl-task-quick-add-icon">+</span>
        <span>Quick Add Task</span>
      </button>
    );
  }

  return (
    <div className={`nl-task-quick-add ${className}`}>
      <NaturalLanguageTask
        customerId={customerId}
        customerName={customerName}
        onTaskCreated={(task) => {
          onTaskCreated?.(task);
          setIsExpanded(false);
        }}
        onCancel={() => setIsExpanded(false)}
        placeholder="What needs to be done? (e.g., 'Follow up next week')"
        autoFocus
      />
    </div>
  );
}

export default NaturalLanguageTask;
