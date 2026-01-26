import React from 'react';
import { ContractTask } from '../types';

interface Props {
  tasks: ContractTask[];
}

const AgentBadge: React.FC<{ agent: string }> = ({ agent }) => {
    const colors: Record<string, string> = {
        'Provisioning Agent': 'bg-blue-900/50 text-blue-300 border-blue-700',
        'Finance Agent': 'bg-cscx-success/20 text-cscx-success border-cscx-success/50',
        'Compliance Agent': 'bg-cscx-error/20 text-cscx-error border-cscx-error/50',
        'Onboarding Agent': 'bg-purple-900/50 text-purple-300 border-purple-700',
        'Success Agent': 'bg-cscx-warning/20 text-cscx-warning border-cscx-warning/50',
    };
    return (
        <span className={`text-xs px-2 py-1 rounded border ${colors[agent] || 'bg-cscx-gray-800 text-cscx-gray-300 border-cscx-gray-600'}`}>
            {agent.replace(' Agent', '')}
        </span>
    );
}

export const ContractTasksTable: React.FC<Props> = ({ tasks }) => {
  return (
    <div className="h-full">
        <div className="table-container">
        <table className="w-full text-sm text-left">
            <thead>
            <tr className="table-header">
                <th className="table-cell font-medium">Task</th>
                <th className="table-cell font-medium">Description</th>
                <th className="table-cell font-medium">Assigned Agent</th>
                <th className="table-cell font-medium">Priority</th>
                <th className="table-cell font-medium">Dependencies</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
            {tasks.map((task, index) => (
                <tr key={index} className="table-row">
                <td className="table-cell text-white font-medium">{task.task}</td>
                <td className="table-cell text-cscx-gray-400 text-xs">{task.description}</td>
                <td className="table-cell">
                    <AgentBadge agent={task.assigned_agent} />
                </td>
                <td className="table-cell text-cscx-gray-300">{task.priority}</td>
                <td className="table-cell text-cscx-accent text-xs">{task.dependencies}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    </div>
  );
};
