/**
 * CADGPlanCard - Renders CADG execution plan with approve/reject actions
 * Shows plan structure, data sources, and methodology steps
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

export interface CADGPlan {
  planId: string;
  taskType: string;
  structure: {
    sections: Array<{
      name: string;
      description: string;
      dataSources: string[];
    }>;
    outputFormat: string;
    estimatedLength: string;
  };
  inputs: {
    knowledgeBase: any[];
    platformData: any[];
    externalSources: any[];
  };
  destination: {
    primary: string;
    secondary: string;
    chatPreview: boolean;
  };
}

export interface CADGCapability {
  id: string;
  name: string;
  description: string;
}

export interface CADGMethodology {
  id: string;
  name: string;
  steps: number;
}

export interface CADGPlanMetadata {
  isGenerative: boolean;
  taskType: string;
  confidence: number;
  requiresApproval: boolean;
  plan: CADGPlan;
  capability: CADGCapability | null;
  methodology: CADGMethodology | null;
}

interface CADGPlanCardProps {
  metadata: CADGPlanMetadata;
  onApproved?: (artifactId: string) => void;
  onRejected?: () => void;
}

// ============================================
// Component
// ============================================

export const CADGPlanCard: React.FC<CADGPlanCardProps> = ({
  metadata,
  onApproved,
  onRejected,
}) => {
  const { getAuthHeaders } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'generating' | 'complete' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const { plan, capability, methodology, taskType, confidence } = metadata;

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    setStatus('generating');

    try {
      const response = await fetch(`${API_URL}/api/cadg/plan/${plan.planId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to approve plan');
      }

      const data = await response.json();
      setStatus('complete');
      onApproved?.(data.artifactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan');
      setStatus('error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/cadg/plan/${plan.planId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ reason: 'User rejected' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to reject plan');
      }

      setStatus('rejected');
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject plan');
    } finally {
      setIsRejecting(false);
    }
  };

  const formatTaskType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Status-based rendering
  if (status === 'complete') {
    return (
      <div className="bg-green-900/30 border border-green-600/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-green-400">
          <span className="text-xl">✅</span>
          <span className="font-medium">Document Generated Successfully!</span>
        </div>
        <p className="text-green-300/80 text-sm mt-2">
          Your {formatTaskType(taskType)} has been created and saved to {plan.destination.primary}.
        </p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xl">❌</span>
          <span className="font-medium">Plan Rejected</span>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          You can ask me to create a different plan or modify your request.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cscx-accent/20 to-transparent p-4 border-b border-cscx-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h3 className="text-white font-semibold">Execution Plan</h3>
            </div>
            <p className="text-cscx-gray-400 text-sm mt-1">
              {formatTaskType(taskType)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cscx-gray-400">Confidence</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              confidence >= 0.9 ? 'bg-green-900/50 text-green-400' :
              confidence >= 0.7 ? 'bg-yellow-900/50 text-yellow-400' :
              'bg-orange-900/50 text-orange-400'
            }`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Capability & Methodology */}
      {(capability || methodology) && (
        <div className="px-4 py-3 border-b border-cscx-gray-700 flex flex-wrap gap-3">
          {capability && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-500">Capability:</span>
              <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                {capability.name}
              </span>
            </div>
          )}
          {methodology && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-500">Methodology:</span>
              <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">
                {methodology.name} ({methodology.steps} steps)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
          Document Structure
        </h4>
        <div className="space-y-2">
          {plan.structure.sections.map((section, index) => (
            <div
              key={index}
              className="bg-cscx-gray-900/50 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleSection(index)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-cscx-gray-900/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-cscx-gray-500 text-xs font-mono">{index + 1}</span>
                  <span className="text-white text-sm font-medium">{section.name}</span>
                </div>
                <span className="text-cscx-gray-500 text-xs">
                  {expandedSections.has(index) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(index) && (
                <div className="px-3 pb-3 pt-1">
                  <p className="text-cscx-gray-400 text-xs mb-2">{section.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {section.dataSources.map((source, i) => (
                      <span
                        key={i}
                        className="text-xs bg-cscx-gray-800 text-cscx-gray-400 px-1.5 py-0.5 rounded"
                      >
                        {source.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Output Info */}
      <div className="px-4 pb-4">
        <div className="bg-cscx-gray-900/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-cscx-gray-500">Output Format:</span>
              <span className="text-white ml-2">{plan.structure.outputFormat}</span>
            </div>
            <div>
              <span className="text-cscx-gray-500">Est. Length:</span>
              <span className="text-white ml-2">{plan.structure.estimatedLength}</span>
            </div>
            <div className="col-span-2">
              <span className="text-cscx-gray-500">Destination:</span>
              <span className="text-white ml-2">{plan.destination.primary}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {status === 'pending' && (
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isRejecting ? 'Rejecting...' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="flex-1 px-4 py-2.5 bg-cscx-accent hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isApproving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <span>✓</span>
                Approve & Generate
              </>
            )}
          </button>
        </div>
      )}

      {/* Generating Status */}
      {status === 'generating' && (
        <div className="px-4 pb-4">
          <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent" />
            <div>
              <p className="text-blue-400 font-medium">Generating Document...</p>
              <p className="text-blue-300/70 text-sm">This may take a moment</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CADGPlanCard;
