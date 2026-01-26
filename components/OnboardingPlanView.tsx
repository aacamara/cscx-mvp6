import React, { useState } from 'react';
import { OnboardingPlan, OnboardingPhase, OnboardingTask } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';

const OwnerBadge: React.FC<{ owner: string }> = ({ owner }) => {
    const colorClasses = {
        'CSM': 'bg-blue-500/20 text-blue-400',
        'AE': 'bg-purple-500/20 text-purple-400',
        'SA': 'bg-orange-500/20 text-orange-400',
        'Customer': 'bg-cscx-success/20 text-cscx-success',
    }[owner] || 'bg-cscx-gray-500/20 text-cscx-gray-400';
    return <span className={`text-xs font-bold px-2 py-1 rounded-full ${colorClasses}`}>{owner}</span>;
}

const TaskCard: React.FC<{ task: OnboardingTask }> = ({ task }) => (
    <div className="bg-cscx-gray-900/80 p-3 rounded-lg border border-cscx-gray-700">
        <div className="flex justify-between items-start">
            <p className="font-semibold text-white text-sm pr-4">{task.title}</p>
            <OwnerBadge owner={task.owner} />
        </div>
        <p className="text-xs text-cscx-gray-400 mt-1">{task.description}</p>
        <p className="text-xs font-mono text-cscx-accent mt-2">Due: Day {task.due_days}</p>
    </div>
);


const PhaseAccordion: React.FC<{ phase: OnboardingPhase; index: number }> = ({ phase, index }) => {
    const [isOpen, setIsOpen] = useState(index === 0);

    return (
        <div className="border border-cscx-gray-800 rounded-lg">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 bg-cscx-gray-900 hover:bg-cscx-gray-800/50 transition-colors">
                <span className="font-bold text-white text-lg">{phase.name}</span>
                <ChevronDownIcon className={`w-6 h-6 text-cscx-accent transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 bg-cscx-black/30">
                    <p className="text-cscx-gray-400 text-sm mb-4">{phase.description}</p>
                    <div className="space-y-3">
                        {phase.tasks.map((task, i) => <TaskCard key={i} task={task} />)}
                    </div>
                </div>
            )}
        </div>
    );
};


export const OnboardingPlanView: React.FC<{ plan: OnboardingPlan }> = ({ plan }) => {
  return (
    <div className="space-y-4">
      {plan.phases.map((phase, index) => (
        <PhaseAccordion key={index} phase={phase} index={index} />
      ))}
    </div>
  );
};
