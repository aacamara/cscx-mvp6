import React from 'react';
import { TechnicalRequirement } from '../types';

interface Props {
  requirements: TechnicalRequirement[];
}

export const TechnicalRequirementsTable: React.FC<Props> = ({ requirements }) => {
    const getPriorityColor = (p: string) => {
        switch(p.toLowerCase()) {
            case 'high': return 'text-cscx-error';
            case 'medium': return 'text-cscx-warning';
            default: return 'text-blue-400';
        }
    }

  return (
    <div className="h-full">
        <div className="table-container">
        <table className="w-full text-sm text-left">
            <thead>
            <tr className="table-header">
                <th className="table-cell font-medium">Requirement</th>
                <th className="table-cell font-medium">Type</th>
                <th className="table-cell font-medium">Priority</th>
                <th className="table-cell font-medium">Owner</th>
                <th className="table-cell font-medium">Status</th>
                <th className="table-cell font-medium">Due Date</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
            {requirements.map((req, index) => (
                <tr key={index} className="table-row">
                <td className="table-cell text-white font-medium">{req.requirement}</td>
                <td className="table-cell text-cscx-gray-400">{req.type}</td>
                <td className={`table-cell font-bold ${getPriorityColor(req.priority)}`}>{req.priority}</td>
                <td className="table-cell text-cscx-gray-300">{req.owner}</td>
                <td className="table-cell text-cscx-gray-300">
                    <span className="bg-cscx-gray-800 px-2 py-1 rounded text-xs border border-cscx-gray-700">
                        {req.status}
                    </span>
                </td>
                <td className="table-cell text-cscx-accent font-mono text-xs">{req.due_date}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    </div>
  );
};
