import React from 'react';
import { Entitlement } from '../types';

interface Props {
  entitlements: Entitlement[];
}

export const EntitlementsTable: React.FC<Props> = ({ entitlements }) => {
  return (
    <div className="h-full">
        <div className="table-container">
        <table className="w-full text-sm text-left">
            <thead>
            <tr className="table-header">
                <th className="table-cell font-medium">Entitlement Type</th>
                <th className="table-cell font-medium">Description/Deps</th>
                <th className="table-cell font-medium">Qty</th>
                <th className="table-cell font-medium">Start</th>
                <th className="table-cell font-medium">End</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
            {entitlements.map((ent, index) => (
                <tr key={index} className="table-row">
                <td className="table-cell text-white font-medium">{ent.type}</td>
                <td className="table-cell text-cscx-gray-300">
                    {ent.description && <div className="mb-1">{ent.description}</div>}
                    {ent.dependencies && (
                        <div className="text-xs text-cscx-accent bg-cscx-accent/10 px-2 py-1 rounded inline-block">
                            Dep: {ent.dependencies}
                        </div>
                    )}
                </td>
                <td className="table-cell text-white font-mono">{ent.quantity}</td>
                <td className="table-cell text-cscx-gray-400 text-xs">{ent.start_date}</td>
                <td className="table-cell text-cscx-gray-400 text-xs">{ent.end_date}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    </div>
  );
};
