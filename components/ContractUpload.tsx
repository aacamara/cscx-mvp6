import React, { useState, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { SAMPLE_CONTRACT_TEXT } from '../constants';
import { ContractInput } from '../types';

interface Props {
  onUpload: (input: ContractInput) => void;
}

export const ContractUpload: React.FC<Props> = ({ onUpload }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [inputMode, setInputMode] = useState<'sample' | 'file'>('sample');
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    base64: string;
    previewUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        const result = reader.result as string;
        const rawBase64 = result.split(',')[1];

        setSelectedFile({
            file,
            base64: rawBase64,
            previewUrl: result
        });
        setInputMode('file');
        setShowPreview(true);
    };
    reader.readAsDataURL(file);
  };

  const handleUseSample = () => {
      setInputMode('sample');
      setShowPreview(true);
  };

  const handleConfirm = () => {
      let payload: ContractInput;

      if (inputMode === 'file' && selectedFile) {
          payload = {
              type: 'file',
              content: selectedFile.base64,
              mimeType: selectedFile.file.type,
              fileName: selectedFile.file.name
          };
      } else {
          payload = {
              type: 'text',
              content: SAMPLE_CONTRACT_TEXT,
              fileName: 'Sample Contract'
          };
      }

      onUpload(payload);
  };

  const renderPreviewContent = () => {
      if (inputMode === 'sample') {
          return <div className="whitespace-pre-wrap text-cscx-gray-300 font-mono text-sm">{SAMPLE_CONTRACT_TEXT}</div>;
      }

      if (inputMode === 'file' && selectedFile) {
          if (selectedFile.file.type.includes('image')) {
              return (
                  <div className="bg-white p-4 rounded">
                      <img src={selectedFile.previewUrl} alt="Contract Preview" className="max-w-full h-auto rounded" />
                  </div>
              );
          }
          if (selectedFile.file.type === 'application/pdf') {
              const fileSizeMB = (selectedFile.file.size / (1024 * 1024)).toFixed(2);
              return (
                  <div className="bg-cscx-gray-800 rounded-lg p-8 text-center">
                      <div className="w-20 h-20 mx-auto bg-cscx-accent/20 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-10 h-10 text-cscx-accent" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.92,12.31 10.92,12.31Z" />
                          </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">{selectedFile.file.name}</h3>
                      <p className="text-cscx-gray-400 mb-4">PDF Document • {fileSizeMB} MB</p>
                      <div className="flex items-center justify-center gap-2 text-cscx-success">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>Ready for AI extraction</span>
                      </div>
                      <p className="text-xs text-cscx-gray-500 mt-4">
                          Click "Confirm & Analyze" to extract contract data using AI
                      </p>
                  </div>
              );
          }
          if (selectedFile.file.type === 'text/plain') {
              return (
                  <div className="whitespace-pre-wrap text-cscx-gray-300 font-mono text-sm">
                      {atob(selectedFile.base64)}
                  </div>
              );
          }
          return <div className="text-center py-10 text-cscx-gray-400">File type preview not supported in browser.</div>;
      }

      return null;
  };

  if (showPreview) {
    return (
        <div className="bg-cscx-gray-900 border border-cscx-gray-700 rounded-xl p-6 animate-fadeIn shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-cscx-accent">Contract</span>
                    {inputMode === 'sample' ? 'Sample' : selectedFile?.file.name}
                </h3>
                <button
                    onClick={() => setShowPreview(false)}
                    className="text-cscx-gray-400 hover:text-white transition-colors text-xl"
                >
                    &times;
                </button>
            </div>

            <div className="bg-black/50 border border-cscx-gray-800 rounded-lg p-4 mb-6 h-[500px] overflow-y-auto">
                {renderPreviewContent()}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-cscx-gray-800 pt-6">
                <p className="text-sm text-cscx-gray-400">
                    Review the document content before proceeding with AI extraction.
                </p>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowPreview(false)}
                        className="flex-1 sm:flex-none px-4 py-2 border border-cscx-gray-700 text-cscx-gray-300 rounded-lg hover:bg-cscx-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 sm:flex-none bg-cscx-accent text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-accent-glow"
                    >
                        Confirm & Analyze
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
        {/* Upload Box - Full Width */}
        <div
            className="w-full max-w-md bg-cscx-gray-900 border-2 border-dashed border-cscx-gray-700 rounded-xl p-12 text-center transition-all hover:border-cscx-accent hover:shadow-accent-glow group cursor-pointer flex flex-col items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.txt,image/png,image/jpeg,image/webp"
            />
            <div className="w-20 h-20 mx-auto bg-cscx-gray-800 rounded-full flex items-center justify-center mb-6 border border-cscx-gray-700 group-hover:border-cscx-accent group-hover:bg-cscx-accent/10 transition-colors">
                <UploadIcon className="w-10 h-10 text-cscx-accent" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Upload Contract</h2>
            <p className="text-sm text-cscx-gray-400 mb-4">Drag & drop or click to select</p>
            <p className="text-xs text-cscx-gray-500">Supports PDF, Images, Text files</p>
        </div>

        {/* Use Sample Button */}
        <button
            onClick={handleUseSample}
            className="mt-6 px-6 py-2 bg-cscx-gray-800 text-cscx-gray-300 border border-cscx-gray-700 rounded-lg hover:bg-cscx-gray-700 hover:text-white text-sm font-medium transition-colors"
        >
            Or use sample contract
        </button>
    </div>
  );
};
