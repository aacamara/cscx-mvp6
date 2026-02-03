/**
 * PRD-121: Escalation Form Component
 *
 * Quick escalation creation form with severity selection,
 * category classification, and impact description.
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Customer {
  id: string;
  name: string;
  arr?: number;
  health_score?: number;
}

interface EscalationFormProps {
  customer: Customer;
  onSubmit: (data: EscalationFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export interface EscalationFormData {
  customerId: string;
  severity: 'P1' | 'P2' | 'P3';
  category: 'technical' | 'support' | 'product' | 'commercial' | 'relationship';
  title: string;
  description: string;
  impact: string;
  customerContacts?: Array<{
    name: string;
    email?: string;
    role?: string;
  }>;
}

type Severity = 'P1' | 'P2' | 'P3';
type Category = 'technical' | 'support' | 'product' | 'commercial' | 'relationship';

const SEVERITY_OPTIONS: Array<{
  value: Severity;
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: 'P1',
    label: 'P1 - Critical',
    description: 'Service down, major business impact, exec involvement required',
    color: 'bg-red-600',
  },
  {
    value: 'P2',
    label: 'P2 - High',
    description: 'Significant impact, degraded service, urgent response needed',
    color: 'bg-orange-500',
  },
  {
    value: 'P3',
    label: 'P3 - Medium',
    description: 'Moderate impact, workarounds available, timely response needed',
    color: 'bg-yellow-500',
  },
];

const CATEGORY_OPTIONS: Array<{
  value: Category;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'technical',
    label: 'Technical',
    description: 'Platform issues, bugs, outages, performance problems',
    icon: '🔧',
  },
  {
    value: 'support',
    label: 'Support',
    description: 'Support quality, response time, unresolved tickets',
    icon: '🎧',
  },
  {
    value: 'product',
    label: 'Product',
    description: 'Missing features, product limitations, roadmap concerns',
    icon: '📦',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'Billing, pricing, contract disputes, commercial terms',
    icon: '💰',
  },
  {
    value: 'relationship',
    label: 'Relationship',
    description: 'Communication issues, trust concerns, executive complaints',
    icon: '🤝',
  },
];

export const EscalationForm: React.FC<EscalationFormProps> = ({
  customer,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const [severity, setSeverity] = useState<Severity>('P2');
  const [category, setCategory] = useState<Category>('support');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.length < 20) {
      newErrors.description = 'Please provide more detail (at least 20 characters)';
    }

    if (!impact.trim()) {
      newErrors.impact = 'Impact description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const formData: EscalationFormData = {
      customerId: customer.id,
      severity,
      category,
      title: title.trim(),
      description: description.trim(),
      impact: impact.trim(),
    };

    if (contactName.trim()) {
      formData.customerContacts = [
        {
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
          role: contactRole.trim() || undefined,
        },
      ];
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Info Header */}
      <div className="bg-cscx-gray-800 rounded-lg p-4 border border-cscx-gray-700">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-cscx-gray-400">Customer</p>
            <h3 className="text-lg font-semibold text-white">{customer.name}</h3>
          </div>
          <div className="text-right">
            {customer.arr && (
              <p className="text-sm text-cscx-gray-300">
                ARR: <span className="font-medium">${customer.arr.toLocaleString()}</span>
              </p>
            )}
            {customer.health_score !== undefined && (
              <p className="text-sm">
                Health:{' '}
                <span
                  className={`font-medium ${
                    customer.health_score >= 80
                      ? 'text-green-400'
                      : customer.health_score >= 60
                      ? 'text-yellow-400'
                      : customer.health_score >= 40
                      ? 'text-orange-400'
                      : 'text-red-400'
                  }`}
                >
                  {customer.health_score}/100
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Severity Selection */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
          Severity Level *
        </label>
        <div className="grid grid-cols-3 gap-3">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSeverity(option.value)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                severity === option.value
                  ? 'border-cscx-accent bg-cscx-gray-800'
                  : 'border-cscx-gray-700 hover:border-cscx-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="font-medium text-white">{option.label}</span>
              </div>
              <p className="text-xs text-cscx-gray-400">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
          Category *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(option.value)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                category === option.value
                  ? 'border-cscx-accent bg-cscx-gray-800'
                  : 'border-cscx-gray-700 hover:border-cscx-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{option.icon}</span>
                <span className="font-medium text-white">{option.label}</span>
              </div>
              <p className="text-xs text-cscx-gray-400 line-clamp-2">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
          Escalation Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of the issue"
          className={`w-full px-4 py-2 bg-cscx-gray-800 border rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent ${
            errors.title ? 'border-red-500' : 'border-cscx-gray-700'
          }`}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-400">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
          Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed description of the issue, including timeline and context"
          rows={4}
          className={`w-full px-4 py-2 bg-cscx-gray-800 border rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none ${
            errors.description ? 'border-red-500' : 'border-cscx-gray-700'
          }`}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-400">{errors.description}</p>
        )}
      </div>

      {/* Impact */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
          Business Impact *
        </label>
        <textarea
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder="How is this affecting the customer's business? (e.g., revenue loss, blocked users, compliance risk)"
          rows={3}
          className={`w-full px-4 py-2 bg-cscx-gray-800 border rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent resize-none ${
            errors.impact ? 'border-red-500' : 'border-cscx-gray-700'
          }`}
        />
        {errors.impact && (
          <p className="mt-1 text-sm text-red-400">{errors.impact}</p>
        )}
      </div>

      {/* Customer Contact (Optional) */}
      <div className="bg-cscx-gray-800/50 rounded-lg p-4 border border-cscx-gray-700">
        <h4 className="text-sm font-medium text-cscx-gray-300 mb-3">
          Customer Contact (Optional)
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Name"
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 text-sm focus:outline-none focus:border-cscx-accent"
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email"
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 text-sm focus:outline-none focus:border-cscx-accent"
          />
          <input
            type="text"
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
            placeholder="Role"
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 text-sm focus:outline-none focus:border-cscx-accent"
          />
        </div>
      </div>

      {/* War Room Notice */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🏠</span>
          <div>
            <h4 className="text-sm font-medium text-blue-400">
              War Room Will Be Created Automatically
            </h4>
            <p className="text-xs text-cscx-gray-400 mt-1">
              A dedicated Slack channel will be created, stakeholders will be notified,
              and an escalation brief will be generated. This typically takes less than
              2 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-cscx-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-cscx-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating War Room...
            </>
          ) : (
            <>
              <span>🚨</span>
              Create Escalation
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EscalationForm;
