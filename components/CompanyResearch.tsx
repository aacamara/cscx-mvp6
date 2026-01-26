import React from 'react';
import { CompanyResearch } from '../types';
import { GlobeAltIcon } from './icons/GlobeAltIcon';

interface Props {
  research: CompanyResearch;
}

const InfoPill: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2">
        <p className="text-xs text-cscx-accent uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
    </div>
);

export const CompanyResearchView: React.FC<Props> = ({ research }) => {
  return (
    <div className="bg-cscx-gray-900/50 border border-cscx-gray-800 rounded-lg p-4 h-full">
      <h3 className="text-md font-semibold text-cscx-accent mb-3 flex items-center gap-2"><GlobeAltIcon /> Company Research</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
            <InfoPill label="Industry" value={research.industry} />
            <InfoPill label="Employees" value={research.employee_count} />
        </div>
        <div>
            <h4 className="font-semibold text-white text-sm mb-1">Overview</h4>
            <p className="text-sm text-cscx-gray-400">{research.overview}</p>
        </div>
        <div>
            <h4 className="font-semibold text-white text-sm mb-2">Tech Stack</h4>
            <div className="flex flex-wrap gap-2">
                {research.tech_stack.map((tech, i) => (
                    <span key={i} className="text-xs font-mono bg-cscx-gray-800 text-cscx-accent px-2 py-1 rounded">{tech}</span>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
