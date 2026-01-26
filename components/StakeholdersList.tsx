import React from 'react';
import { Stakeholder } from '../types';

interface Props {
  stakeholders: Stakeholder[];
}

export const StakeholdersList: React.FC<Props> = ({ stakeholders }) => {
  return (
    <div className="h-full">
      <div className="table-container">
        <table className="w-full text-sm text-left">
            <thead>
            <tr className="table-header">
                <th className="table-cell font-medium">Name & Role</th>
                <th className="table-cell font-medium">Department</th>
                <th className="table-cell font-medium">Contact</th>
                <th className="table-cell font-medium">Responsibilities</th>
                <th className="table-cell font-medium text-center">Approval</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
            {stakeholders.map((stakeholder, index) => (
                <tr key={index} className="table-row">
                <td className="table-cell">
                    <div className="text-white font-bold">{stakeholder.name}</div>
                    <div className="text-cscx-gray-400 text-xs">{stakeholder.role}</div>
                </td>
                <td className="table-cell text-cscx-gray-300">{stakeholder.department}</td>
                <td className="table-cell text-cscx-accent font-mono text-xs">{stakeholder.contact}</td>
                <td className="table-cell text-cscx-gray-300 text-xs max-w-xs">{stakeholder.responsibilities}</td>
                <td className="table-cell text-center">
                    {stakeholder.approval_required && (
                        <span className="badge badge-accent">
                        Required
                        </span>
                    )}
                </td>
                </tr>
            ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
