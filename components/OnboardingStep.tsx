import React, { ReactNode } from 'react';
import { WorkflowState } from '../types';
import { CheckIcon } from './icons/CheckIcon';

interface Props {
  title: string;
  state: WorkflowState;
  successState: WorkflowState;
  children: ReactNode;
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-cscx-gray-700 border-t-cscx-accent"></div>
);

export const OnboardingStep: React.FC<Props> = ({ title, state, successState, children }) => {
    const isProcessing = state > 0 && state < successState;
    const isComplete = state >= successState;

    return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-cscx-gray-900 border-b border-cscx-gray-800">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <div className="flex items-center gap-2">
                {isProcessing && (
                    <>
                        <LoadingSpinner />
                        <span className="text-sm text-cscx-accent">Processing...</span>
                    </>
                )}
                {isComplete && (
                     <div className="flex items-center gap-2 text-cscx-success">
                        <CheckIcon />
                        <span className="text-sm">Complete</span>
                    </div>
                )}
            </div>
        </div>
        {isComplete && (
            <div className="p-4 sm:p-6 bg-cscx-black/20">
                {children}
            </div>
        )}
    </div>
  );
};
