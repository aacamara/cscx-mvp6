import React from 'react';
import { DocumentTextIcon } from './icons/DocumentTextIcon';

interface Props {
  summary: string;
}

const formatSummary = (text: string) => {
    return text
        .split('\n')
        .map((line, index) => {
            if (line.startsWith('- ')) {
                return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
            }
            if (line.trim().length === 0) {
                return <br key={index} />;
            }
            // A simple way to detect headers
            if (!line.includes(':') && line.length < 30 && !line.startsWith(' ')) {
                 return <h4 key={index} className="font-bold text-cscx-accent mt-4 mb-1">{line}</h4>;
            }
            return <p key={index}>{line}</p>;
        });
};


export const ExecutiveSummary: React.FC<Props> = ({ summary }) => {
  return (
    <div className="bg-cscx-gray-900/50 border border-cscx-gray-800 rounded-lg p-4 h-full">
      <h3 className="text-md font-semibold text-cscx-accent mb-3 flex items-center gap-2"><DocumentTextIcon/> Executive Summary</h3>
      <div className="text-sm text-cscx-gray-300 space-y-2 prose">
          {formatSummary(summary)}
      </div>
    </div>
  );
};
