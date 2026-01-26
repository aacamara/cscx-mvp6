import React, { useState } from 'react';
import { EmailDraft, Stakeholder } from '../types';
import { EnvelopeIcon } from './icons/EnvelopeIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface Props {
  stakeholders: Stakeholder[];
  drafts: EmailDraft[];
  onGenerate: (stakeholder: Stakeholder) => void;
}

export const WelcomeEmail: React.FC<Props> = ({ stakeholders, drafts, onGenerate }) => {
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder>(stakeholders[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentDraft = drafts.find(d => d.stakeholderName === selectedStakeholder.name);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await onGenerate(selectedStakeholder);
    setIsGenerating(false);
  }

  const copyToClipboard = () => {
      if(currentDraft) {
          navigator.clipboard.writeText(currentDraft.body);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  }

  return (
    <div className="bg-cscx-gray-900/50 border border-cscx-gray-800 rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-md font-semibold text-cscx-accent mb-3 flex items-center gap-2"><EnvelopeIcon /> Welcome Email</h3>

      <div className="flex items-center gap-2 mb-3">
        <select
            className="flex-grow bg-cscx-gray-800 border border-cscx-gray-700 rounded-md px-3 py-2 text-sm text-white focus:ring-cscx-accent focus:border-cscx-accent"
            value={selectedStakeholder.name}
            onChange={(e) => setSelectedStakeholder(stakeholders.find(s => s.name === e.target.value) || stakeholders[0])}
        >
          {stakeholders.map(s => <option key={s.name}>{s.name}</option>)}
        </select>
        <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-cscx-accent text-white text-sm font-bold rounded-md disabled:opacity-50 hover:opacity-90 hover:-translate-y-0.5 transition-all"
        >
          {isGenerating ? '...' : (currentDraft ? 'Regenerate' : 'Draft Email')}
        </button>
      </div>

      {currentDraft ? (
        <div className="bg-cscx-black/50 border border-cscx-gray-800 rounded-md p-3 flex-grow flex flex-col text-sm">
            <div className="flex justify-between items-center mb-2">
                 <p className="font-mono text-cscx-gray-400 truncate"><span className="font-bold text-cscx-gray-200">Sub:</span> {currentDraft.subject}</p>
                 <button onClick={copyToClipboard} className="text-cscx-gray-400 hover:text-cscx-accent transition-colors text-xs flex items-center gap-1">
                    <ClipboardIcon /> {copied ? 'Copied!' : 'Copy'}
                 </button>
            </div>
          <textarea
            readOnly
            className="w-full h-48 bg-transparent resize-none text-cscx-gray-300 focus:outline-none"
            value={currentDraft.body}
          />
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center text-center bg-cscx-black/50 border border-cscx-gray-800 rounded-md p-3">
          <p className="text-sm text-cscx-gray-500">Select a stakeholder and click 'Draft Email' to generate a personalized welcome message.</p>
        </div>
      )}
    </div>
  );
};
