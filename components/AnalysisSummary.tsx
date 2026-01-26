import React from 'react';
import { ListBulletIcon } from './icons/ListBulletIcon';

interface Props {
    missingInfo?: string[];
    nextSteps?: string | string[];
}

export const AnalysisSummary: React.FC<Props> = ({ missingInfo, nextSteps }) => {
    // Normalize nextSteps to display properly
    const nextStepsDisplay = !nextSteps
        ? ''
        : Array.isArray(nextSteps)
            ? nextSteps.join('\n')
            : nextSteps;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-cscx-error/10 border border-cscx-error/30 p-4 rounded-lg">
                <h4 className="text-cscx-error font-bold mb-2 text-sm uppercase tracking-wide">Missing Info / Flags</h4>
                {missingInfo && missingInfo.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-cscx-error/80 space-y-1">
                        {missingInfo.map((info, i) => <li key={i}>{info}</li>)}
                    </ul>
                ) : (
                    <p className="text-sm text-cscx-gray-500">No critical missing information detected.</p>
                )}
            </div>
            <div className="bg-cscx-success/10 border border-cscx-success/30 p-4 rounded-lg">
                <h4 className="text-cscx-success font-bold mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                    <ListBulletIcon className="w-4 h-4"/> Recommended Next Steps
                </h4>
                <p className="text-sm text-cscx-success/80 whitespace-pre-line">{nextStepsDisplay}</p>
            </div>
        </div>
    )
}
