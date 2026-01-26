import React, { useState } from 'react';
import { MeetingAgenda } from '../types';
import { CalendarIcon } from './icons/CalendarIcon';

interface Props {
  agenda: MeetingAgenda | null;
  onCreate: () => void;
}

export const KickoffMeeting: React.FC<Props> = ({ agenda, onCreate }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    await onCreate();
    setIsCreating(false);
  }

  return (
    <div className="bg-cscx-gray-900/50 border border-cscx-gray-800 rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-md font-semibold text-cscx-accent mb-3 flex items-center gap-2"><CalendarIcon/> Internal Kickoff</h3>

      {!agenda && (
        <div className="flex-grow flex flex-col items-center justify-center text-center">
            <p className="text-sm text-cscx-gray-500 mb-4">Generate an AI-powered agenda for the internal kickoff meeting.</p>
            <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-4 py-2 bg-cscx-accent text-white text-sm font-bold rounded-md disabled:opacity-50 hover:opacity-90 hover:-translate-y-0.5 transition-all"
            >
                {isCreating ? 'Generating...' : 'Create Agenda'}
            </button>
        </div>
      )}

      {agenda && (
        <div className="text-sm space-y-3 overflow-y-auto pr-2">
            <h4 className="font-bold text-white">{agenda.meeting_title}</h4>
            <div>
                <p className="font-semibold text-cscx-accent text-xs uppercase mb-1">Objectives</p>
                <ul className="list-disc list-inside text-cscx-gray-300">
                    {agenda.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                </ul>
            </div>
             <div>
                <p className="font-semibold text-cscx-accent text-xs uppercase mb-1">Agenda Items</p>
                <ul className="space-y-1 text-cscx-gray-300">
                    {agenda.agenda_items.map((item, i) =>
                        <li key={i} className="flex justify-between items-center font-mono">
                            <span>{item.time}: {item.topic}</span>
                            <span className="text-cscx-accent">{item.owner}</span>
                        </li>
                    )}
                </ul>
            </div>
        </div>
      )}
    </div>
  );
};
