import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CustomerField =
  | 'name'
  | 'industry'
  | 'arr'
  | 'health_score'
  | 'stage'
  | 'primary_contact_name'
  | 'primary_contact_email';

interface FieldDefinition {
  key: CustomerField;
  label: string;
  required: boolean;
  aliases: string[]; // header names that auto-map to this field (lowercase)
  validate?: (value: string) => string | null; // returns error message or null
}

interface ColumnMapping {
  [csvColumn: string]: CustomerField | '';
}

interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: number;
  errorDetails: Array<{ row: number; message: string }>;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

interface CustomerImportProps {
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const CUSTOMER_FIELDS: FieldDefinition[] = [
  {
    key: 'name',
    label: 'Customer Name',
    required: true,
    aliases: ['name', 'customer name', 'customer', 'company', 'company name', 'account', 'account name'],
  },
  {
    key: 'industry',
    label: 'Industry',
    required: false,
    aliases: ['industry', 'sector', 'vertical'],
  },
  {
    key: 'arr',
    label: 'ARR',
    required: false,
    aliases: ['arr', 'annual recurring revenue', 'revenue', 'mrr', 'contract value'],
    validate: (value: string) => {
      if (!value) return null;
      const cleaned = value.replace(/[$,\s]/g, '');
      if (isNaN(Number(cleaned))) return 'Must be a valid number';
      return null;
    },
  },
  {
    key: 'health_score',
    label: 'Health Score',
    required: false,
    aliases: ['health_score', 'health score', 'health', 'score', 'customer health'],
    validate: (value: string) => {
      if (!value) return null;
      const num = Number(value);
      if (isNaN(num)) return 'Must be a valid number';
      if (num < 0 || num > 100) return 'Must be between 0 and 100';
      return null;
    },
  },
  {
    key: 'stage',
    label: 'Stage',
    required: false,
    aliases: ['stage', 'status', 'lifecycle', 'lifecycle stage', 'customer stage'],
    validate: (value: string) => {
      if (!value) return null;
      const valid = ['active', 'onboarding', 'at_risk', 'churned'];
      if (!valid.includes(value.toLowerCase().replace(/[\s-]/g, '_'))) {
        return `Must be one of: ${valid.join(', ')}`;
      }
      return null;
    },
  },
  {
    key: 'primary_contact_name',
    label: 'Primary Contact Name',
    required: false,
    aliases: ['primary_contact_name', 'primary contact name', 'contact name', 'contact', 'primary contact'],
  },
  {
    key: 'primary_contact_email',
    label: 'Primary Contact Email',
    required: false,
    aliases: ['primary_contact_email', 'primary contact email', 'contact email', 'email', 'contact_email'],
    validate: (value: string) => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Must be a valid email address';
      return null;
    },
  },
];

const TEMPLATE_HEADERS = CUSTOMER_FIELDS.map((f) => f.key);

// ---------------------------------------------------------------------------
// CSV Helpers
// ---------------------------------------------------------------------------

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();
    let matched = false;

    for (const field of CUSTOMER_FIELDS) {
      if (field.aliases.includes(normalizedHeader)) {
        // Only map if this field is not already mapped
        const alreadyMapped = Object.values(mapping).includes(field.key);
        if (!alreadyMapped) {
          mapping[header] = field.key;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      mapping[header] = '';
    }
  }

  return mapping;
}

function generateTemplateCSV(): string {
  return TEMPLATE_HEADERS.join(',') + '\n';
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CustomerImport: React.FC<CustomerImportProps> = ({ organizationId }) => {
  const { getAuthHeaders } = useAuth();

  // State
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const processFile = useCallback((file: File) => {
    setError(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are accepted. Please upload a .csv file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File exceeds the 5MB size limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers: csvHeaders, rows: csvRows } = parseCSV(text);

      if (csvHeaders.length === 0) {
        setError('The CSV file appears to be empty or has no headers.');
        return;
      }

      if (csvRows.length === 0) {
        setError('The CSV file has headers but no data rows.');
        return;
      }

      setFileName(file.name);
      setHeaders(csvHeaders);
      setRows(csvRows);
      setMapping(autoDetectMapping(csvHeaders));
      setStep('mapping');
    };

    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
    };

    reader.readAsText(file);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // -------------------------------------------------------------------------
  // Mapping
  // -------------------------------------------------------------------------

  const handleMappingChange = useCallback(
    (csvColumn: string, fieldKey: CustomerField | '') => {
      setMapping((prev) => ({ ...prev, [csvColumn]: fieldKey }));
    },
    [],
  );

  const isMappingValid = useMemo(() => {
    const mappedFields = Object.values(mapping).filter(Boolean);
    return mappedFields.includes('name');
  }, [mapping]);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const validateData = useCallback((): ValidationWarning[] => {
    const newWarnings: ValidationWarning[] = [];
    const nameColumnIndex = headers.findIndex((h) => mapping[h] === 'name');

    rows.forEach((row, rowIndex) => {
      // Check required name field
      if (nameColumnIndex === -1 || !row[nameColumnIndex]?.trim()) {
        newWarnings.push({
          row: rowIndex + 2, // +2 for 1-based index + header row
          field: 'name',
          message: 'Customer name is required',
        });
      }

      // Run field-specific validators
      headers.forEach((header, colIndex) => {
        const fieldKey = mapping[header];
        if (!fieldKey) return;

        const fieldDef = CUSTOMER_FIELDS.find((f) => f.key === fieldKey);
        if (!fieldDef?.validate) return;

        const value = row[colIndex]?.trim() || '';
        if (!value) return; // skip empty optional fields

        const validationError = fieldDef.validate(value);
        if (validationError) {
          newWarnings.push({
            row: rowIndex + 2,
            field: fieldDef.label,
            message: validationError,
          });
        }
      });
    });

    return newWarnings;
  }, [headers, rows, mapping]);

  const handleProceedToPreview = useCallback(() => {
    const newWarnings = validateData();
    setWarnings(newWarnings);
    setStep('preview');
  }, [validateData]);

  // -------------------------------------------------------------------------
  // Build customer records
  // -------------------------------------------------------------------------

  const buildCustomerRecords = useCallback(() => {
    return rows
      .map((row) => {
        const record: Record<string, string | number | undefined> = {};

        headers.forEach((header, colIndex) => {
          const fieldKey = mapping[header];
          if (!fieldKey) return;

          let value: string | number | undefined = row[colIndex]?.trim();
          if (!value) return;

          // Type coercion for numeric fields
          if (fieldKey === 'arr') {
            const cleaned = value.replace(/[$,\s]/g, '');
            value = isNaN(Number(cleaned)) ? undefined : Number(cleaned);
          } else if (fieldKey === 'health_score') {
            value = isNaN(Number(value)) ? undefined : Number(value);
          } else if (fieldKey === 'stage') {
            value = value.toLowerCase().replace(/[\s-]/g, '_');
          }

          if (value !== undefined) {
            record[fieldKey] = value;
          }
        });

        return record;
      })
      .filter((record) => record.name); // Exclude rows missing required name
  }, [headers, rows, mapping]);

  // -------------------------------------------------------------------------
  // Import execution
  // -------------------------------------------------------------------------

  const handleImport = useCallback(async () => {
    setStep('importing');
    setImportProgress(0);
    setError(null);

    const customers = buildCustomerRecords();

    // Simulate initial progress while waiting for server
    const progressInterval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      const response = await fetch(`${API_BASE}/api/customers/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          organizationId,
          customers,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Import failed with status ${response.status}`);
      }

      const result: ImportResult = await response.json();
      setImportProgress(100);
      setImportResult(result);

      // Brief delay so user sees 100% before switching to results
      setTimeout(() => {
        setStep('results');
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setImportProgress(0);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during import.');
      setStep('preview');
    }
  }, [buildCustomerRecords, getAuthHeaders, organizationId]);

  // -------------------------------------------------------------------------
  // Template download
  // -------------------------------------------------------------------------

  const handleDownloadTemplate = useCallback(() => {
    downloadCSV(generateTemplateCSV(), 'customer_import_template.csv');
  }, []);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setWarnings([]);
    setImportResult(null);
    setImportProgress(0);
    setError(null);
    setIsDragOver(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const getMappedFieldsCount = () => Object.values(mapping).filter(Boolean).length;

  const getUnmappedRequiredFields = (): string[] => {
    const mapped = new Set(Object.values(mapping));
    return CUSTOMER_FIELDS.filter((f) => f.required && !mapped.has(f.key)).map((f) => f.label);
  };

  // =========================================================================
  // STEP: Upload
  // =========================================================================

  const renderUploadStep = () => (
    <div className="flex flex-col items-center gap-6">
      {/* Drag & Drop Zone */}
      <div
        className={`w-full border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group ${
          isDragOver
            ? 'border-cscx-accent bg-cscx-accent/10 shadow-accent-glow'
            : 'border-cscx-gray-700 hover:border-cscx-accent hover:shadow-accent-glow bg-cscx-gray-900'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div
          className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 border transition-colors ${
            isDragOver
              ? 'bg-cscx-accent/20 border-cscx-accent'
              : 'bg-cscx-gray-800 border-cscx-gray-700 group-hover:border-cscx-accent group-hover:bg-cscx-accent/10'
          }`}
        >
          <svg className="w-8 h-8 text-cscx-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {isDragOver ? 'Drop your CSV file here' : 'Upload Customer CSV'}
        </h3>
        <p className="text-sm text-cscx-gray-400 mb-3">Drag and drop or click to browse</p>
        <p className="text-xs text-cscx-gray-500">CSV files only, max 5MB</p>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Template Download */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownloadTemplate();
        }}
        className="flex items-center gap-2 px-4 py-2 bg-cscx-gray-800 text-cscx-gray-300 border border-cscx-gray-700 rounded-lg hover:bg-cscx-gray-700 hover:text-white text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Download Template
      </button>
    </div>
  );

  // =========================================================================
  // STEP: Column Mapping
  // =========================================================================

  const renderMappingStep = () => {
    const unmappedRequired = getUnmappedRequiredFields();

    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Map Columns</h3>
            <p className="text-sm text-cscx-gray-400 mt-1">
              {fileName} &mdash; {rows.length} rows, {headers.length} columns &mdash;{' '}
              {getMappedFieldsCount()} mapped
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-cscx-gray-400 hover:text-white transition-colors"
          >
            Start Over
          </button>
        </div>

        {/* Unmapped required warning */}
        {unmappedRequired.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-300">
              Required fields not mapped: <strong>{unmappedRequired.join(', ')}</strong>
            </p>
          </div>
        )}

        {/* Mapping Table */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cscx-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                  CSV Column
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                  Maps To
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-cscx-gray-400 uppercase tracking-wider">
                  Sample Values
                </th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header, idx) => (
                <tr
                  key={header + idx}
                  className={`border-b border-cscx-gray-800 ${
                    mapping[header] ? '' : 'opacity-60'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-cscx-gray-200">{header}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping[header] || ''}
                      onChange={(e) =>
                        handleMappingChange(header, e.target.value as CustomerField | '')
                      }
                      className="w-full bg-cscx-gray-800 border border-cscx-gray-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cscx-accent focus:border-cscx-accent"
                    >
                      <option value="">-- Skip this column --</option>
                      {CUSTOMER_FIELDS.map((field) => {
                        const alreadyMapped =
                          Object.entries(mapping).some(
                            ([col, val]) => val === field.key && col !== header,
                          );
                        return (
                          <option key={field.key} value={field.key} disabled={alreadyMapped}>
                            {field.label} {field.required ? '(required)' : ''}{' '}
                            {alreadyMapped ? '(already mapped)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {previewRows.slice(0, 3).map((row, ri) => (
                        <span
                          key={ri}
                          className="inline-block bg-cscx-gray-800 text-cscx-gray-300 text-xs px-2 py-0.5 rounded max-w-[120px] truncate"
                        >
                          {row[idx] || <span className="text-cscx-gray-500 italic">empty</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Preview Table */}
        <div>
          <h4 className="text-sm font-medium text-cscx-gray-300 mb-2">Preview (first 5 rows)</h4>
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cscx-gray-700">
                  <th className="px-3 py-2 text-left text-xs text-cscx-gray-500 font-medium">#</th>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2 text-left text-xs font-medium whitespace-nowrap ${
                        mapping[h] ? 'text-cscx-accent' : 'text-cscx-gray-500'
                      }`}
                    >
                      {mapping[h]
                        ? CUSTOMER_FIELDS.find((f) => f.key === mapping[h])?.label || h
                        : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-cscx-gray-800 last:border-0">
                    <td className="px-3 py-2 text-cscx-gray-500">{ri + 1}</td>
                    {headers.map((h, ci) => (
                      <td
                        key={ci}
                        className={`px-3 py-2 whitespace-nowrap ${
                          mapping[h] ? 'text-cscx-gray-200' : 'text-cscx-gray-500'
                        }`}
                      >
                        {row[ci] || <span className="italic text-cscx-gray-600">--</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-cscx-gray-700 text-cscx-gray-300 rounded-lg hover:bg-cscx-gray-800 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleProceedToPreview}
            disabled={!isMappingValid}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              isMappingValid
                ? 'bg-cscx-accent text-white hover:opacity-90 hover:-translate-y-0.5 shadow-accent-glow'
                : 'bg-cscx-gray-700 text-cscx-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Preview
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // STEP: Preview
  // =========================================================================

  const renderPreviewStep = () => {
    const customerRecords = buildCustomerRecords();
    const criticalWarnings = warnings.filter((w) => w.field === 'name');
    const nonCriticalWarnings = warnings.filter((w) => w.field !== 'name');

    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Import Preview</h3>
            <p className="text-sm text-cscx-gray-400 mt-1">
              Review the data before importing.
            </p>
          </div>
          <button
            onClick={() => setStep('mapping')}
            className="text-sm text-cscx-gray-400 hover:text-white transition-colors"
          >
            Back to Mapping
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{customerRecords.length}</p>
            <p className="text-xs text-cscx-gray-400 mt-1">Customers to Import</p>
          </div>
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${criticalWarnings.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {rows.length - customerRecords.length}
            </p>
            <p className="text-xs text-cscx-gray-400 mt-1">Rows Skipped (Missing Name)</p>
          </div>
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${nonCriticalWarnings.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {nonCriticalWarnings.length}
            </p>
            <p className="text-xs text-cscx-gray-400 mt-1">Validation Warnings</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-300">Import Failed</p>
              <p className="text-sm text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-cscx-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h4 className="text-sm font-medium text-yellow-300">
                Validation Warnings ({warnings.length})
              </h4>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {warnings.slice(0, 50).map((w, i) => (
                <div
                  key={i}
                  className="px-4 py-2 border-b border-cscx-gray-800 last:border-0 flex items-center gap-4 text-sm"
                >
                  <span className="text-cscx-gray-500 font-mono text-xs w-16 flex-shrink-0">
                    Row {w.row}
                  </span>
                  <span className="text-cscx-gray-300 w-40 flex-shrink-0">{w.field}</span>
                  <span className="text-yellow-400">{w.message}</span>
                </div>
              ))}
              {warnings.length > 50 && (
                <div className="px-4 py-2 text-center text-cscx-gray-500 text-sm">
                  ...and {warnings.length - 50} more warnings
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setStep('mapping')}
            className="px-4 py-2 border border-cscx-gray-700 text-cscx-gray-300 rounded-lg hover:bg-cscx-gray-800 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={handleImport}
            disabled={customerRecords.length === 0}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              customerRecords.length > 0
                ? 'bg-cscx-accent text-white hover:opacity-90 hover:-translate-y-0.5 shadow-accent-glow'
                : 'bg-cscx-gray-700 text-cscx-gray-500 cursor-not-allowed'
            }`}
          >
            Import {customerRecords.length} Customer{customerRecords.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // STEP: Importing (progress)
  // =========================================================================

  const renderImportingStep = () => (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="w-16 h-16 rounded-full bg-cscx-accent/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-cscx-accent animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">Importing Customers...</h3>
        <p className="text-sm text-cscx-gray-400 mt-1">Please wait while we process your data.</p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-xs text-cscx-gray-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(importProgress)}%</span>
        </div>
        <div className="w-full bg-cscx-gray-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-cscx-accent h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${importProgress}%` }}
          />
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // STEP: Results
  // =========================================================================

  const renderResultsStep = () => {
    if (!importResult) return null;

    const hasErrors = importResult.errors > 0;
    const allFailed = importResult.imported === 0 && importResult.errors > 0;

    return (
      <div className="flex flex-col gap-6">
        {/* Status Header */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              allFailed
                ? 'bg-red-500/20'
                : hasErrors
                  ? 'bg-yellow-500/20'
                  : 'bg-green-500/20'
            }`}
          >
            {allFailed ? (
              <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className={`w-8 h-8 ${hasErrors ? 'text-yellow-400' : 'text-green-400'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">
              {allFailed
                ? 'Import Failed'
                : hasErrors
                  ? 'Import Completed with Errors'
                  : 'Import Successful'}
            </h3>
            <p className="text-sm text-cscx-gray-400 mt-1">
              {allFailed
                ? 'No customers could be imported.'
                : `${importResult.imported} customer${importResult.imported !== 1 ? 's' : ''} imported successfully.`}
            </p>
          </div>
        </div>

        {/* Result Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{importResult.imported}</p>
            <p className="text-xs text-cscx-gray-400 mt-1">Successfully Imported</p>
          </div>
          <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${importResult.errors > 0 ? 'text-red-400' : 'text-cscx-gray-500'}`}>
              {importResult.errors}
            </p>
            <p className="text-xs text-cscx-gray-400 mt-1">Errors</p>
          </div>
        </div>

        {/* Error Details */}
        {importResult.errorDetails.length > 0 && (
          <div className="bg-cscx-gray-900 border border-red-500/30 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-cscx-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h4 className="text-sm font-medium text-red-300">
                Error Details ({importResult.errorDetails.length})
              </h4>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {importResult.errorDetails.map((err, i) => (
                <div
                  key={i}
                  className="px-4 py-2 border-b border-cscx-gray-800 last:border-0 flex items-center gap-4 text-sm"
                >
                  <span className="text-cscx-gray-500 font-mono text-xs w-16 flex-shrink-0">
                    Row {err.row}
                  </span>
                  <span className="text-red-400">{err.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-cscx-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-accent-glow"
          >
            Import More Customers
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // Main Render
  // =========================================================================

  return (
    <div className="bg-cscx-black min-h-0">
      <div className="max-w-3xl mx-auto">
        {/* Title Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Import Customers</h2>
            <p className="text-sm text-cscx-gray-400 mt-1">
              Upload a CSV file to bulk-import customers into your organization.
            </p>
          </div>
          {step === 'upload' && (
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-cscx-gray-400 hover:text-white border border-cscx-gray-700 rounded-md hover:bg-cscx-gray-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              CSV Template
            </button>
          )}
        </div>

        {/* Step Indicator */}
        {step !== 'upload' && (
          <div className="flex items-center gap-2 mb-6">
            {(['upload', 'mapping', 'preview', 'importing', 'results'] as Step[]).map(
              (s, idx) => {
                const stepLabels: Record<Step, string> = {
                  upload: 'Upload',
                  mapping: 'Map Columns',
                  preview: 'Preview',
                  importing: 'Importing',
                  results: 'Results',
                };
                const stepOrder: Step[] = ['upload', 'mapping', 'preview', 'importing', 'results'];
                const currentIdx = stepOrder.indexOf(step);
                const isActive = s === step;
                const isComplete = idx < currentIdx;

                return (
                  <React.Fragment key={s}>
                    {idx > 0 && (
                      <div
                        className={`flex-1 h-px ${
                          isComplete || isActive ? 'bg-cscx-accent' : 'bg-cscx-gray-700'
                        }`}
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isActive
                            ? 'bg-cscx-accent text-white'
                            : isComplete
                              ? 'bg-cscx-accent/30 text-cscx-accent'
                              : 'bg-cscx-gray-800 text-cscx-gray-500'
                        }`}
                      >
                        {isComplete ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={`text-xs whitespace-nowrap ${
                          isActive ? 'text-white font-medium' : 'text-cscx-gray-500'
                        }`}
                      >
                        {stepLabels[s]}
                      </span>
                    </div>
                  </React.Fragment>
                );
              },
            )}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-xl p-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'results' && renderResultsStep()}
        </div>
      </div>
    </div>
  );
};

export default CustomerImport;
