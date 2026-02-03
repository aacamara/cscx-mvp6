/**
 * Mobile Document Scanner Component (PRD-267)
 *
 * Provides camera-based document scanning functionality for mobile devices,
 * including edge detection preview, multi-page scanning, and OCR processing.
 */

import React, { useState, useRef, useCallback } from 'react';

// ============================================
// Types
// ============================================

type DocumentType = 'contract' | 'business_card' | 'meeting_notes' | 'invoice' | 'other';

interface ScannedPage {
  id: string;
  imageData: string;
  pageNumber: number;
  width: number;
  height: number;
  thumbnail?: string;
}

interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  extractedData?: Record<string, unknown>;
}

interface ScannedDocument {
  id: string;
  fileName: string;
  documentType: DocumentType;
  pageCount: number;
  extractedText: string;
  ocrConfidence: number;
  structuredData?: Record<string, unknown>;
  customerId?: string;
  customerName?: string;
  createdAt: Date;
}

interface ScanResult {
  document: ScannedDocument;
  classification: DocumentClassification;
  extractedText: string;
  ocrConfidence: number;
  linkedEntity?: {
    type: 'contact' | 'contract';
    id: string;
    name: string;
  };
}

interface DocumentScannerProps {
  customerId?: string;
  onScanComplete?: (result: ScanResult) => void;
  onCancel?: () => void;
  defaultFileName?: string;
  allowedTypes?: DocumentType[];
}

// ============================================
// Helper Components
// ============================================

const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`animate-spin ${className}`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ============================================
// Page Thumbnails Component
// ============================================

interface PageThumbnailsProps {
  pages: ScannedPage[];
  onRemove: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const PageThumbnails: React.FC<PageThumbnailsProps> = ({
  pages,
  onRemove,
}) => {
  if (pages.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-cscx-gray-300">
          Scanned Pages ({pages.length})
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="relative flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border border-cscx-gray-700 group"
          >
            <img
              src={`data:image/jpeg;base64,${page.thumbnail || page.imageData}`}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => onRemove(index)}
                className="p-1.5 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors"
              >
                <TrashIcon className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {page.pageNumber}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Document Type Selector
// ============================================

interface DocumentTypeSelectorProps {
  selectedType: DocumentType;
  onSelect: (type: DocumentType) => void;
  allowedTypes?: DocumentType[];
}

const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  selectedType,
  onSelect,
  allowedTypes,
}) => {
  const types: { value: DocumentType; label: string; icon: string }[] = [
    { value: 'contract', label: 'Contract', icon: '📝' },
    { value: 'business_card', label: 'Business Card', icon: '💼' },
    { value: 'meeting_notes', label: 'Meeting Notes', icon: '📋' },
    { value: 'invoice', label: 'Invoice', icon: '🧾' },
    { value: 'other', label: 'Other', icon: '📄' },
  ];

  const filteredTypes = allowedTypes
    ? types.filter((t) => allowedTypes.includes(t.value))
    : types;

  return (
    <div className="grid grid-cols-3 gap-2">
      {filteredTypes.map((type) => (
        <button
          key={type.value}
          onClick={() => onSelect(type.value)}
          className={`p-3 rounded-lg border text-center transition-all ${
            selectedType === type.value
              ? 'border-cscx-accent bg-cscx-accent/10 text-white'
              : 'border-cscx-gray-700 hover:border-cscx-gray-600 text-cscx-gray-300'
          }`}
        >
          <span className="text-2xl block mb-1">{type.icon}</span>
          <span className="text-xs">{type.label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================
// Processing Status Component
// ============================================

interface ProcessingStatusProps {
  status: 'idle' | 'capturing' | 'processing' | 'classifying' | 'complete' | 'error';
  progress?: number;
  message?: string;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  progress,
  message,
}) => {
  const statusConfig = {
    idle: { text: 'Ready to scan', color: 'text-cscx-gray-400' },
    capturing: { text: 'Capturing...', color: 'text-blue-400' },
    processing: { text: 'Processing OCR...', color: 'text-yellow-400' },
    classifying: { text: 'Classifying document...', color: 'text-purple-400' },
    complete: { text: 'Complete!', color: 'text-green-400' },
    error: { text: 'Error occurred', color: 'text-red-400' },
  };

  const config = statusConfig[status];

  if (status === 'idle') return null;

  return (
    <div className="mt-4 p-4 bg-cscx-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        {status !== 'complete' && status !== 'error' && (
          <SpinnerIcon className="w-5 h-5 text-cscx-accent" />
        )}
        {status === 'complete' && (
          <CheckIcon className="w-5 h-5 text-green-400" />
        )}
        <div className="flex-1">
          <p className={`font-medium ${config.color}`}>{config.text}</p>
          {message && (
            <p className="text-sm text-cscx-gray-400 mt-0.5">{message}</p>
          )}
        </div>
      </div>
      {progress !== undefined && progress > 0 && progress < 100 && (
        <div className="mt-3 h-1.5 bg-cscx-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-cscx-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================
// Result Preview Component
// ============================================

interface ResultPreviewProps {
  result: ScanResult;
  onConfirm: () => void;
  onRetry: () => void;
}

const ResultPreview: React.FC<ResultPreviewProps> = ({
  result,
  onConfirm,
  onRetry,
}) => {
  const { document, classification, extractedText } = result;

  return (
    <div className="space-y-4">
      <div className="bg-cscx-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white">{document.fileName}</h3>
            <p className="text-sm text-cscx-gray-400">
              {document.pageCount} page{document.pageCount !== 1 ? 's' : ''} -
              {classification.documentType.replace('_', ' ')}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-cscx-gray-500">Confidence</span>
            <p className="text-lg font-bold text-cscx-accent">
              {Math.round(result.ocrConfidence * 100)}%
            </p>
          </div>
        </div>

        {result.linkedEntity && (
          <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">
              Created {result.linkedEntity.type}: {result.linkedEntity.name}
            </p>
          </div>
        )}
      </div>

      <div className="bg-cscx-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-cscx-gray-300 mb-2">
          Extracted Text
        </h4>
        <div className="max-h-48 overflow-y-auto bg-black/30 rounded-lg p-3">
          <pre className="text-xs text-cscx-gray-400 whitespace-pre-wrap font-mono">
            {extractedText.substring(0, 1000)}
            {extractedText.length > 1000 && '...'}
          </pre>
        </div>
      </div>

      {classification.extractedData && (
        <div className="bg-cscx-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-cscx-gray-300 mb-2">
            Extracted Data
          </h4>
          <div className="space-y-1">
            {Object.entries(classification.extractedData).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-cscx-gray-500 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-white">
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-2.5 border border-cscx-gray-700 text-cscx-gray-300 rounded-lg hover:bg-cscx-gray-800 transition-colors"
        >
          Scan Again
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-cscx-accent text-white font-bold py-2.5 px-4 rounded-lg hover:opacity-90 transition-all"
        >
          Save Document
        </button>
      </div>
    </div>
  );
};

// ============================================
// Main Document Scanner Component
// ============================================

export const DocumentScanner: React.FC<DocumentScannerProps> = ({
  customerId,
  onScanComplete,
  onCancel,
  defaultFileName,
  allowedTypes,
}) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [status, setStatus] = useState<ProcessingStatusProps['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selectedType, setSelectedType] = useState<DocumentType>('other');
  const [fileName, setFileName] = useState(
    defaultFileName || `Scan_${new Date().toISOString().split('T')[0]}`
  );
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file/image capture
  const handleCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setStatus('capturing');

      Array.from(files).forEach((file, index) => {
        const reader = new FileReader();

        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];

          // Create image to get dimensions
          const img = new Image();
          img.onload = () => {
            const newPage: ScannedPage = {
              id: `page-${Date.now()}-${index}`,
              imageData: base64,
              pageNumber: pages.length + index + 1,
              width: img.width,
              height: img.height,
              thumbnail: base64, // In real app, would create smaller thumbnail
            };

            setPages((prev) => [...prev, newPage]);
            setStatus('idle');
          };
          img.src = result;
        };

        reader.readAsDataURL(file);
      });

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [pages.length]
  );

  // Remove a page
  const handleRemovePage = useCallback((index: number) => {
    setPages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber pages
      return updated.map((page, i) => ({
        ...page,
        pageNumber: i + 1,
      }));
    });
  }, []);

  // Process the scanned pages
  const handleProcessScan = useCallback(async () => {
    if (pages.length === 0) return;

    setError(null);
    setStatus('processing');
    setProgress(10);
    setStatusMessage('Uploading pages...');

    try {
      setProgress(30);
      setStatusMessage('Running OCR...');

      const response = await fetch('/api/mobile/documents/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'default-user', // Would come from auth context
        },
        body: JSON.stringify({
          pages: pages.map((p) => ({
            id: p.id,
            imageData: p.imageData,
            pageNumber: p.pageNumber,
            width: p.width,
            height: p.height,
          })),
          customerId,
          fileName: `${fileName}.pdf`,
          autoClassify: true,
          extractData: true,
        }),
      });

      setProgress(70);
      setStatus('classifying');
      setStatusMessage('Analyzing document type...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to process document');
      }

      const data = await response.json();

      setProgress(100);
      setStatus('complete');
      setStatusMessage('Document processed successfully!');

      const scanResult: ScanResult = {
        document: {
          ...data.data.document,
          createdAt: new Date(data.data.document.createdAt),
        },
        classification: data.data.classification,
        extractedText: data.data.extractedText,
        ocrConfidence: data.data.ocrConfidence,
        linkedEntity: data.data.linkedEntity,
      };

      setResult(scanResult);
    } catch (err) {
      console.error('Scan processing error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to process scan');
    }
  }, [pages, customerId, fileName]);

  // Confirm and save result
  const handleConfirm = useCallback(() => {
    if (result && onScanComplete) {
      onScanComplete(result);
    }
  }, [result, onScanComplete]);

  // Reset and try again
  const handleRetry = useCallback(() => {
    setPages([]);
    setResult(null);
    setStatus('idle');
    setProgress(0);
    setStatusMessage('');
    setError(null);
  }, []);

  // Show result preview if complete
  if (result) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-xl p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DocumentIcon className="w-6 h-6 text-cscx-accent" />
            Scan Complete
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-cscx-gray-400 hover:text-white transition-colors"
            >
              &times;
            </button>
          )}
        </div>
        <ResultPreview
          result={result}
          onConfirm={handleConfirm}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-xl p-6 animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CameraIcon className="w-6 h-6 text-cscx-accent" />
          Document Scanner
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-cscx-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Camera/Upload Area */}
      <div
        className="border-2 border-dashed border-cscx-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-cscx-accent hover:bg-cscx-accent/5 transition-all group"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleCapture}
          className="hidden"
          accept="image/*"
          capture="environment"
          multiple
        />
        <div className="w-16 h-16 mx-auto bg-cscx-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-cscx-accent/20 transition-colors">
          <CameraIcon className="w-8 h-8 text-cscx-accent" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          {pages.length === 0 ? 'Scan Document' : 'Add More Pages'}
        </h3>
        <p className="text-sm text-cscx-gray-400">
          Tap to capture with camera or upload image
        </p>
      </div>

      {/* Page Thumbnails */}
      <PageThumbnails pages={pages} onRemove={handleRemovePage} />

      {/* Document Type Selection */}
      {pages.length > 0 && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
            Document Type (optional)
          </label>
          <DocumentTypeSelector
            selectedType={selectedType}
            onSelect={setSelectedType}
            allowedTypes={allowedTypes}
          />
        </div>
      )}

      {/* File Name Input */}
      {pages.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-cscx-gray-300 mb-2">
            Document Name
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-full px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
            placeholder="Enter document name"
          />
        </div>
      )}

      {/* Processing Status */}
      <ProcessingStatus
        status={status}
        progress={progress}
        message={statusMessage}
      />

      {/* Action Buttons */}
      {pages.length > 0 && status === 'idle' && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleRetry}
            className="flex-1 px-4 py-2.5 border border-cscx-gray-700 text-cscx-gray-300 rounded-lg hover:bg-cscx-gray-800 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleProcessScan}
            disabled={pages.length === 0}
            className="flex-1 bg-cscx-accent text-white font-bold py-2.5 px-4 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Process {pages.length} Page{pages.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Help Text */}
      <p className="mt-4 text-xs text-cscx-gray-500 text-center">
        Supports contracts, business cards, meeting notes, and invoices.
        AI will automatically extract text and classify the document.
      </p>
    </div>
  );
};

export default DocumentScanner;
