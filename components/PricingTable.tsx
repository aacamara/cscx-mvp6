import React from 'react';
import { PricingItem } from '../types';

interface Props {
  pricing?: PricingItem[] | PricingItem;
}

export const PricingTable: React.FC<Props> = ({ pricing }) => {
  // Normalize pricing to always be an array
  const pricingArray = !pricing ? [] : Array.isArray(pricing) ? pricing : [pricing];
  return (
    <div className="h-full">
        <div className="table-container">
        <table className="w-full text-sm text-left">
            <thead>
            <tr className="table-header">
                <th className="table-cell font-medium">Item</th>
                <th className="table-cell font-medium">Description</th>
                <th className="table-cell font-medium">Qty</th>
                <th className="table-cell font-medium">Unit Price</th>
                <th className="table-cell font-medium">Total</th>
                <th className="table-cell font-medium">Payment Terms</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
            {pricingArray.map((item, index) => (
                <tr key={index} className="table-row">
                <td className="table-cell text-white font-bold">{item.item}</td>
                <td className="table-cell text-cscx-gray-400">{item.description}</td>
                <td className="table-cell text-white font-mono">{item.quantity}</td>
                <td className="table-cell text-cscx-gray-300 font-mono">{item.unit_price}</td>
                <td className="table-cell text-cscx-accent font-mono font-bold">{item.total}</td>
                <td className="table-cell text-cscx-gray-300 text-xs">{item.payment_terms}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    </div>
  );
};
