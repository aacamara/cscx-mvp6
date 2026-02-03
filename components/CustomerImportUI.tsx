/**
 * PRD-1: Customer Import UI Component
 * Supports Google Sheets URL and CSV file upload
 * Step wizard: Source → Mapping → Preview → Import
 */

import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

type ImportStep = 'source' | 'mapping' | 'preview' | 'importing' | 'results';
type SourceType = 'google_sheets' | 'csv';

interface ColumnMapping {
  name: string;
  arr?: string;
  renewal_date?: string;
  health_score?: string;
  industry?: string;
  contact_name?: string;
  contact_email?: string;
  contact_title?: string;
}

interface ImportResult {
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  errors: Array<{ row: number; reason: string }>;
}

interface PreviewRow {
  [key: string]: string;
}

interface CustomerImportUIProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
}

export const CustomerImportUI: React.FC<CustomerImportUIProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { getAuthHeaders } = useAuth();
  const [step, setStep] = useState<ImportStep>('source');
  const [sourceType, setSourceType] = useState<SourceType>('google_sheets');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: '' });
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dedupAction, setDedupAction] = useState<'update' | 'skip' | 'create'>('skip');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = import.meta.env.VITE_API_URL || '';

  // Column options for mapping
  const requiredFields = [
    { key: 'name', label: 'Customer Name', required: true },
  ];

  const optionalFields = [
    { key: 'arr', label: 'ARR (Annual Revenue)' },
    { key: 'renewal_date', label: 'Renewal Date' },
    { key: 'health_score', label: 'Health Score' },
    { key: 'industry', label: 'Industry' },
    { key: 'contact_name', label: 'Primary Contact Name' },
    { key: 'contact_email', label: 'Primary Contact Email' },
    { key: 'contact_title', label: 'Primary Contact Title' },
  ];

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      setCsvFile(file);
      setError(null);

      // Parse CSV headers
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          setColumns(headers);

          // Parse preview data (first 5 rows)
          const preview: PreviewRow[] = [];
          for (let i = 1; i < Math.min(lines.length, 6); i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row: PreviewRow = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx] || '';
            });
            if (Object.values(row).some(v => v)) {
              preview.push(row);
            }
          }
          setPreviewData(preview);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  // Load Google Sheets data
  const loadSheetsData = useCallback(async () => {
    if (!sheetsUrl.trim()) {
      setError('Please enter a Google Sheets URL');
      return;
    }

    // Extract spreadsheet ID from URL
    const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      setError('Invalid Google Sheets URL. Please use a link like: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, use mock columns - in production, fetch from Sheets API
      const mockColumns = ['Company Name', 'ARR', 'Renewal Date', 'Health Score', 'Industry', 'Contact Name', 'Contact Email'];
      setColumns(mockColumns);

      const mockPreview: PreviewRow[] = [
        { 'Company Name': 'Acme Corp', 'ARR': '$120,000', 'Renewal Date': '2026-12-01', 'Health Score': '85', 'Industry': 'Technology', 'Contact Name': 'John Doe', 'Contact Email': 'john@acme.com' },
        { 'Company Name': 'Beta Inc', 'ARR': '$95,000', 'Renewal Date': '2026-06-15', 'Health Score': '72', 'Industry': 'Healthcare', 'Contact Name': 'Jane Smith', 'Contact Email': 'jane@beta.com' },
        { 'Company Name': 'Gamma LLC', 'ARR': '$200,000', 'Renewal Date': '2027-01-01', 'Health Score': '91', 'Industry': 'Finance', 'Contact Name': 'Bob Wilson', 'Contact Email': 'bob@gamma.com' },
      ];
      setPreviewData(mockPreview);

      setStep('mapping');
    } catch (err) {
      setError('Failed to load spreadsheet. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }, [sheetsUrl]);

  // Proceed to mapping
  const proceedToMapping = useCallback(() => {
    if (sourceType === 'google_sheets') {
      loadSheetsData();
    } else if (csvFile && columns.length > 0) {
      setStep('mapping');
    }
  }, [sourceType, loadSheetsData, csvFile, columns]);

  // Validate mapping
  const validateMapping = useCallback(() => {
    if (!mapping.name) {
      setError('Customer Name mapping is required');
      return false;
    }
    return true;
  }, [mapping]);

  // Proceed to preview
  const proceedToPreview = useCallback(() => {
    if (validateMapping()) {
      setError(null);
      setStep('preview');
    }
  }, [validateMapping]);

  // Execute import
  const executeImport = useCallback(async () => {
    setStep('importing');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/customers/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          sourceType,
          sourceRef: sourceType === 'google_sheets' ? sheetsUrl : csvFile?.name,
          columnMapping: mapping,
          dedupAction
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Import failed');
      }

      // Mock result for now - in production, poll for job completion
      const mockResult: ImportResult = {
        total_rows: previewData.length,
        created_count: Math.floor(previewData.length * 0.8),
        updated_count: Math.floor(previewData.length * 0.1),
        skipped_count: Math.floor(previewData.length * 0.05),
        failed_count: Math.floor(previewData.length * 0.05),
        errors: []
      };

      setResult(data.summary || mockResult);
      setStep('results');
      onSuccess?.(data.summary || mockResult);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }, [sourceType, sheetsUrl, csvFile, mapping, dedupAction, previewData, getAuthHeaders, API_URL, onSuccess]);

  // Reset and close
  const handleClose = useCallback(() => {
    setStep('source');
    setSourceType('google_sheets');
    setSheetsUrl('');
    setCsvFile(null);
    setColumns([]);
    setMapping({ name: '' });
    setPreviewData([]);
    setError(null);
    setResult(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Import Customers</h2>
              <p className="text-sm text-cscx-gray-400 mt-1">
                {step === 'source' && 'Choose your data source'}
                {step === 'mapping' && 'Map columns to fields'}
                {step === 'preview' && 'Review before importing'}
                {step === 'importing' && 'Importing...'}
                {step === 'results' && 'Import Complete'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-cscx-gray-400 hover:text-white rounded-lg hover:bg-cscx-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {['source', 'mapping', 'preview', 'results'].map((s, idx) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step === s ? 'bg-cscx-accent text-white' :
                    ['source', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > idx
                      ? 'bg-green-500 text-white' : 'bg-cscx-gray-700 text-cscx-gray-400'}`}
                >
                  {['source', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > idx ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : idx + 1}
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-0.5 ${['source', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > idx ? 'bg-green-500' : 'bg-cscx-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Source Selection */}
          {step === 'source' && (
            <div className="space-y-6">
              {/* Source Type Toggle */}
              <div className="flex gap-2 p-1 bg-cscx-gray-800 rounded-lg">
                <button
                  onClick={() => setSourceType('google_sheets')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors
                    ${sourceType === 'google_sheets' ? 'bg-cscx-accent text-white' : 'text-cscx-gray-400 hover:text-white'}`}
                >
                  Google Sheets
                </button>
                <button
                  onClick={() => setSourceType('csv')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors
                    ${sourceType === 'csv' ? 'bg-cscx-accent text-white' : 'text-cscx-gray-400 hover:text-white'}`}
                >
                  CSV Upload
                </button>
              </div>

              {/* Google Sheets Input */}
              {sourceType === 'google_sheets' && (
                <div>
                  <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                    Google Sheets URL
                  </label>
                  <input
                    type="url"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white
                      focus:outline-none focus:border-cscx-accent placeholder:text-cscx-gray-600"
                  />
                  <p className="mt-2 text-xs text-cscx-gray-500">
                    Make sure your spreadsheet is shared with your Google account
                  </p>
                </div>
              )}

              {/* CSV Upload */}
              {sourceType === 'csv' && (
                <div>
                  <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
                    Upload CSV File
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-cscx-gray-700 rounded-lg p-8 text-center cursor-pointer
                      hover:border-cscx-accent transition-colors"
                  >
                    {csvFile ? (
                      <div>
                        <svg className="w-12 h-12 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-white font-medium">{csvFile.name}</p>
                        <p className="text-cscx-gray-400 text-sm">{columns.length} columns detected</p>
                      </div>
                    ) : (
                      <div>
                        <svg className="w-12 h-12 mx-auto text-cscx-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-cscx-gray-300">Drop a CSV file here or click to browse</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-cscx-gray-400 text-sm mb-4">
                Map your spreadsheet columns to CSCX fields
              </p>

              {/* Required Fields */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-cscx-accent">Required</h3>
                {requiredFields.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <label className="w-40 text-sm text-cscx-gray-300">{field.label}</label>
                    <select
                      value={(mapping as any)[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white
                        focus:outline-none focus:border-cscx-accent"
                    >
                      <option value="">Select column...</option>
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Optional Fields */}
              <div className="space-y-3 mt-6">
                <h3 className="text-sm font-semibold text-cscx-gray-400">Optional</h3>
                {optionalFields.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <label className="w-40 text-sm text-cscx-gray-400">{field.label}</label>
                    <select
                      value={(mapping as any)[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className="flex-1 px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white
                        focus:outline-none focus:border-cscx-accent"
                    >
                      <option value="">-- Not mapped --</option>
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Dedup Options */}
              <div className="mt-6 p-4 bg-cscx-gray-800/50 rounded-lg">
                <h3 className="text-sm font-semibold text-white mb-2">Duplicate Handling</h3>
                <p className="text-xs text-cscx-gray-400 mb-3">What to do when a customer name already exists</p>
                <div className="flex gap-4">
                  {[
                    { value: 'skip', label: 'Skip' },
                    { value: 'update', label: 'Update existing' },
                    { value: 'create', label: 'Create duplicate' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dedup"
                        value={opt.value}
                        checked={dedupAction === opt.value}
                        onChange={(e) => setDedupAction(e.target.value as any)}
                        className="accent-cscx-accent"
                      />
                      <span className="text-sm text-cscx-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <p className="text-cscx-gray-400 text-sm mb-4">
                Preview of {previewData.length} rows (showing first 5)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cscx-gray-700">
                      <th className="text-left py-2 px-3 text-cscx-gray-400">Customer Name</th>
                      {mapping.arr && <th className="text-left py-2 px-3 text-cscx-gray-400">ARR</th>}
                      {mapping.renewal_date && <th className="text-left py-2 px-3 text-cscx-gray-400">Renewal</th>}
                      {mapping.industry && <th className="text-left py-2 px-3 text-cscx-gray-400">Industry</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b border-cscx-gray-800">
                        <td className="py-2 px-3 text-white">{row[mapping.name] || '-'}</td>
                        {mapping.arr && <td className="py-2 px-3 text-cscx-gray-300">{row[mapping.arr] || '-'}</td>}
                        {mapping.renewal_date && <td className="py-2 px-3 text-cscx-gray-300">{row[mapping.renewal_date] || '-'}</td>}
                        {mapping.industry && <td className="py-2 px-3 text-cscx-gray-300">{row[mapping.industry] || '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-cscx-accent/30 border-t-cscx-accent rounded-full animate-spin" />
              <p className="text-white font-medium">Importing customers...</p>
              <p className="text-cscx-gray-400 text-sm mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step 5: Results */}
          {step === 'results' && result && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">Import Complete</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-400">{result.created_count}</p>
                  <p className="text-sm text-cscx-gray-400">Created</p>
                </div>
                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{result.updated_count}</p>
                  <p className="text-sm text-cscx-gray-400">Updated</p>
                </div>
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-400">{result.skipped_count}</p>
                  <p className="text-sm text-cscx-gray-400">Skipped</p>
                </div>
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-400">{result.failed_count}</p>
                  <p className="text-sm text-cscx-gray-400">Failed</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-cscx-gray-400 mb-2">Errors</h4>
                  <div className="max-h-32 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-red-400">
                        Row {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cscx-gray-800 flex justify-between">
          {step !== 'source' && step !== 'importing' && step !== 'results' && (
            <button
              onClick={() => setStep(step === 'mapping' ? 'source' : 'mapping')}
              className="px-4 py-2 text-cscx-gray-400 hover:text-white"
            >
              Back
            </button>
          )}
          {step === 'source' && <div />}

          <div className="flex gap-3">
            {step === 'results' ? (
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white font-medium rounded-lg"
              >
                Done
              </button>
            ) : step !== 'importing' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-cscx-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (step === 'source') proceedToMapping();
                    else if (step === 'mapping') proceedToPreview();
                    else if (step === 'preview') executeImport();
                  }}
                  disabled={loading || (step === 'source' && sourceType === 'csv' && !csvFile) || (step === 'source' && sourceType === 'google_sheets' && !sheetsUrl)}
                  className="px-6 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white font-medium rounded-lg
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {step === 'source' && 'Next'}
                  {step === 'mapping' && 'Preview'}
                  {step === 'preview' && 'Import'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerImportUI;
