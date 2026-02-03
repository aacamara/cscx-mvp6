/**
 * QBR Generator Component
 * PRD-220: Intelligent QBR Generator
 *
 * AI-powered QBR deck generation with Google Slides integration
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type OutputFormat = 'presentation' | 'document' | 'both';

interface QBRSection {
  id: string;
  name: string;
  description: string;
  included: boolean;
}

interface CustomerData {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  industry?: string;
  renewalDate?: string;
}

interface PreviewData {
  customer: CustomerData;
  quarter: string;
  year: number;
  metrics: {
    activeUsers: number;
    totalUsers: number;
    adoptionRate: number;
    usageTrend: string;
  };
  support: {
    totalTickets: number;
    resolvedTickets: number;
    openTickets: number;
    satisfactionScore: number;
  };
  dataAvailable: {
    metrics: boolean;
    tickets: boolean;
    stakeholders: boolean;
  };
}

interface GeneratedQBR {
  id: string;
  customerId: string;
  customerName: string;
  quarter: Quarter;
  year: number;
  status: string;
  presentationId?: string;
  presentationUrl?: string;
  documentId?: string;
  documentUrl?: string;
  generatedAt: string;
}

interface QBRGeneratorProps {
  customerId: string;
  customerName?: string;
  onComplete?: (qbr: GeneratedQBR) => void;
  onClose?: () => void;
}

const DEFAULT_SECTIONS: QBRSection[] = [
  { id: 'executive_summary', name: 'Executive Summary', description: 'High-level overview and key highlights', included: true },
  { id: 'partnership_health', name: 'Partnership Health', description: 'Health score trends and metrics', included: true },
  { id: 'usage_metrics', name: 'Usage Metrics', description: 'Product adoption and usage data', included: true },
  { id: 'key_achievements', name: 'Key Achievements', description: 'Milestones and wins this quarter', included: true },
  { id: 'challenges_addressed', name: 'Challenges Addressed', description: 'Issues resolved and ongoing improvements', included: true },
  { id: 'support_summary', name: 'Support Summary', description: 'Ticket analysis and satisfaction scores', included: true },
  { id: 'product_roadmap', name: 'Product Roadmap', description: 'Upcoming features relevant to customer', included: true },
  { id: 'recommendations', name: 'Recommendations', description: 'AI-generated suggestions for improvement', included: true },
  { id: 'next_quarter_goals', name: 'Next Quarter Goals', description: 'Objectives and success metrics', included: true },
];

export const QBRGenerator: React.FC<QBRGeneratorProps> = ({
  customerId,
  customerName,
  onComplete,
  onClose
}) => {
  // State
  const [step, setStep] = useState<'configure' | 'preview' | 'generating' | 'complete'>('configure');
  const [quarter, setQuarter] = useState<Quarter>(getCurrentQuarter());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [format, setFormat] = useState<OutputFormat>('presentation');
  const [sections, setSections] = useState<QBRSection[]>(DEFAULT_SECTIONS);
  const [customHighlights, setCustomHighlights] = useState<string>('');
  const [customChallenges, setCustomChallenges] = useState<string>('');
  const [customGoals, setCustomGoals] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState<string>('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [generatedQBR, setGeneratedQBR] = useState<GeneratedQBR | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview data
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/qbr/preview/${customerId}?quarter=${quarter}&year=${year}`
      );
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
      } else {
        setError(data.error?.message || 'Failed to load preview');
      }
    } catch (err) {
      setError('Failed to fetch preview data');
    } finally {
      setLoading(false);
    }
  }, [customerId, quarter, year]);

  // Load preview on step change
  useEffect(() => {
    if (step === 'preview') {
      fetchPreview();
    }
  }, [step, fetchPreview]);

  // Generate QBR
  const generateQBR = async () => {
    setStep('generating');
    setError(null);

    try {
      const includeSections = sections
        .filter(s => s.included)
        .map(s => s.id);

      const customData: Record<string, any> = {};
      if (customHighlights.trim()) {
        customData.highlights = customHighlights.split('\n').filter(h => h.trim());
      }
      if (customChallenges.trim()) {
        customData.challenges = customChallenges.split('\n').filter(c => c.trim());
      }
      if (customGoals.trim()) {
        customData.goals = customGoals.split('\n').filter(g => g.trim());
      }
      if (additionalContext.trim()) {
        customData.additionalContext = additionalContext;
      }

      const response = await fetch('/api/qbr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user' // In production, get from auth context
        },
        body: JSON.stringify({
          customerId,
          quarter,
          year,
          format,
          includeSections,
          customData: Object.keys(customData).length > 0 ? customData : undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedQBR(data.qbr);
        setStep('complete');
        onComplete?.(data.qbr);
      } else {
        setError(data.error?.message || 'Failed to generate QBR');
        setStep('preview');
      }
    } catch (err) {
      setError('Failed to generate QBR');
      setStep('preview');
    }
  };

  // Toggle section
  const toggleSection = (sectionId: string) => {
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId ? { ...s, included: !s.included } : s
      )
    );
  };

  // Render configuration step
  const renderConfigureStep = () => (
    <div className="space-y-6">
      {/* Quarter and Year Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quarter
          </label>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value as Quarter)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="Q1">Q1 (Jan-Mar)</option>
            <option value="Q2">Q2 (Apr-Jun)</option>
            <option value="Q3">Q3 (Jul-Sep)</option>
            <option value="Q4">Q4 (Oct-Dec)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Year
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Output Format */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Output Format
        </label>
        <div className="flex gap-4">
          {[
            { value: 'presentation', label: 'Slides', icon: '📊' },
            { value: 'document', label: 'Document', icon: '📄' },
            { value: 'both', label: 'Both', icon: '📑' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFormat(option.value as OutputFormat)}
              className={`flex-1 px-4 py-3 rounded-lg border ${
                format === option.value
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="text-xl">{option.icon}</span>
              <span className="ml-2">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sections Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Include Sections
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sections.map(section => (
            <label
              key={section.id}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                section.included
                  ? 'bg-gray-800 border-red-500'
                  : 'bg-gray-900 border-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={section.included}
                onChange={() => toggleSection(section.id)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 ${
                section.included ? 'bg-red-600' : 'bg-gray-700'
              }`}>
                {section.included && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                )}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{section.name}</div>
                <div className="text-gray-500 text-xs">{section.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Inputs */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Custom Highlights (optional)
            <span className="text-gray-500 ml-1 font-normal">- one per line</span>
          </label>
          <textarea
            value={customHighlights}
            onChange={(e) => setCustomHighlights(e.target.value)}
            placeholder="Add specific achievements or wins to highlight..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Custom Challenges (optional)
          </label>
          <textarea
            value={customChallenges}
            onChange={(e) => setCustomChallenges(e.target.value)}
            placeholder="Add specific challenges to address..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Next Quarter Goals (optional)
          </label>
          <textarea
            value={customGoals}
            onChange={(e) => setCustomGoals(e.target.value)}
            placeholder="Add specific goals for next quarter..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Context (optional)
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Any other context for the AI to consider..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  // Render preview step
  const renderPreviewStep = () => (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : preview ? (
        <>
          {/* Customer Overview */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              {preview.customer.name} - {preview.quarter} {preview.year} QBR Preview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Health Score"
                value={`${preview.customer.healthScore}/100`}
                trend={preview.customer.healthTrend}
              />
              <MetricCard
                label="ARR"
                value={`$${preview.customer.arr.toLocaleString()}`}
              />
              <MetricCard
                label="User Adoption"
                value={`${preview.metrics.adoptionRate}%`}
                subtitle={`${preview.metrics.activeUsers}/${preview.metrics.totalUsers} users`}
              />
              <MetricCard
                label="Support Tickets"
                value={preview.support.totalTickets.toString()}
                subtitle={`${preview.support.openTickets} open`}
              />
            </div>
          </div>

          {/* Data Availability */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Data Sources</h4>
            <div className="flex flex-wrap gap-3">
              <DataBadge
                label="Usage Metrics"
                available={preview.dataAvailable.metrics}
              />
              <DataBadge
                label="Support Tickets"
                available={preview.dataAvailable.tickets}
              />
              <DataBadge
                label="Stakeholders"
                available={preview.dataAvailable.stakeholders}
              />
            </div>
          </div>

          {/* Selected Sections Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              Sections to Generate ({sections.filter(s => s.included).length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {sections.filter(s => s.included).map(section => (
                <span
                  key={section.id}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-300"
                >
                  {section.name}
                </span>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Output Format</h4>
            <p className="text-white">
              {format === 'presentation' && 'Google Slides Presentation'}
              {format === 'document' && 'Google Doc'}
              {format === 'both' && 'Google Slides + Google Doc'}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );

  // Render generating step
  const renderGeneratingStep = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">
          Generating Your QBR
        </h3>
        <p className="text-gray-400">
          Claude is analyzing data and creating your presentation...
        </p>
      </div>
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Analyzing metrics</span>
          <span>Creating slides</span>
          <span>Finalizing</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full animate-pulse w-2/3"></div>
        </div>
      </div>
    </div>
  );

  // Render complete step
  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/50 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          QBR Generated Successfully!
        </h3>
        <p className="text-gray-400">
          Your {quarter} {year} QBR for {customerName || generatedQBR?.customerName} is ready.
        </p>
      </div>

      {generatedQBR && (
        <div className="space-y-4">
          {generatedQBR.presentationUrl && (
            <a
              href={generatedQBR.presentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">📊</span>
                <div>
                  <div className="text-white font-medium">Google Slides Presentation</div>
                  <div className="text-sm text-gray-400">Click to open in Google Slides</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {generatedQBR.documentUrl && generatedQBR.documentUrl !== '#' && (
            <a
              href={generatedQBR.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">📄</span>
                <div>
                  <div className="text-white font-medium">Google Doc</div>
                  <div className="text-sm text-gray-400">Click to open in Google Docs</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setStep('configure');
                setGeneratedQBR(null);
              }}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Generate Another
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🤖</span>
            Intelligent QBR Generator
          </h2>
          <p className="text-sm text-gray-400">
            {customerName && `Creating QBR for ${customerName}`}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress Steps */}
      {step !== 'complete' && (
        <div className="px-6 py-3 bg-gray-800/50 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {['Configure', 'Preview', 'Generate'].map((stepName, index) => (
              <React.Fragment key={stepName}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index === 0 && step === 'configure' ? 'bg-red-600 text-white' :
                    index === 1 && step === 'preview' ? 'bg-red-600 text-white' :
                    index === 2 && step === 'generating' ? 'bg-red-600 text-white' :
                    index < (['configure', 'preview', 'generating'].indexOf(step)) ? 'bg-green-600 text-white' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${
                    ['configure', 'preview', 'generating'][index] === step
                      ? 'text-white font-medium'
                      : 'text-gray-500'
                  }`}>
                    {stepName}
                  </span>
                </div>
                {index < 2 && (
                  <div className={`flex-1 h-px mx-4 ${
                    index < ['configure', 'preview', 'generating'].indexOf(step)
                      ? 'bg-green-600'
                      : 'bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {step === 'configure' && renderConfigureStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'generating' && renderGeneratingStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>

      {/* Footer Actions */}
      {(step === 'configure' || step === 'preview') && (
        <div className="px-6 py-4 border-t border-gray-800 flex justify-between">
          {step === 'preview' ? (
            <>
              <button
                onClick={() => setStep('configure')}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Back to Configure
              </button>
              <button
                onClick={generateQBR}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span>🚀</span>
                Generate QBR
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('preview')}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Preview & Generate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Helper Components
const MetricCard: React.FC<{
  label: string;
  value: string;
  trend?: 'improving' | 'stable' | 'declining';
  subtitle?: string;
}> = ({ label, value, trend, subtitle }) => (
  <div className="bg-gray-700/50 rounded-lg p-3">
    <div className="text-sm text-gray-400 mb-1">{label}</div>
    <div className="text-xl font-semibold text-white flex items-center gap-2">
      {value}
      {trend && (
        <span className={`text-sm ${
          trend === 'improving' ? 'text-green-400' :
          trend === 'declining' ? 'text-red-400' :
          'text-gray-400'
        }`}>
          {trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→'}
        </span>
      )}
    </div>
    {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
  </div>
);

const DataBadge: React.FC<{ label: string; available: boolean }> = ({ label, available }) => (
  <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
    available
      ? 'bg-green-900/50 text-green-400'
      : 'bg-gray-700 text-gray-500'
  }`}>
    {available ? (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
      </svg>
    )}
    {label}
  </span>
);

// Utility function
function getCurrentQuarter(): Quarter {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

export default QBRGenerator;
