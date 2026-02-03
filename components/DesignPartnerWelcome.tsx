/**
 * DesignPartnerWelcome - Welcome modal for first-time design partners
 * PRD: Compound Product Launch (CP-005)
 * Shows on first login, explains what they can explore with time estimates
 */

import React, { useState, useEffect, useRef } from 'react';
import { trackWelcomeModalShown, trackWelcomeModalDismissed } from '../src/services/analytics';

const STORAGE_KEY = 'dp_welcome_dismissed';

interface DesignPartnerWelcomeProps {
  isDesignPartner: boolean;
}

export function DesignPartnerWelcome({ isDesignPartner }: DesignPartnerWelcomeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const showTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only show for design partners who haven't dismissed
    if (isDesignPartner) {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setIsVisible(true);
        showTimeRef.current = Date.now();
        trackWelcomeModalShown();
      }
    }
  }, [isDesignPartner]);

  const handleDismiss = () => {
    const timeOnModal = Date.now() - showTimeRef.current;
    trackWelcomeModalDismissed(timeOnModal);
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 max-w-lg w-full p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome to CSCX<span className="text-cscx-accent">.</span>AI!
          </h2>
          <p className="text-gray-400">
            You're now a Design Partner with full access to explore our AI-powered
            Customer Success platform.
          </p>
        </div>

        {/* What You Can Try */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            What You Can Try
          </h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-cscx-accent/20 rounded-full flex items-center justify-center">
                <span className="text-cscx-accent font-bold">1</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Mock Onboarding</p>
                  <span className="text-xs text-gray-500 bg-cscx-gray-800 px-2 py-1 rounded">~5 min</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Start a simulated customer onboarding to see our AI agents in action.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-cscx-accent/20 rounded-full flex items-center justify-center">
                <span className="text-cscx-accent font-bold">2</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Import Your Data</p>
                  <span className="text-xs text-gray-500 bg-cscx-gray-800 px-2 py-1 rounded">~2 min</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Upload a contract or import customers via CSV to test with real data.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-cscx-accent/20 rounded-full flex items-center justify-center">
                <span className="text-cscx-accent font-bold">3</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">Explore Demo Customers</p>
                  <span className="text-xs text-gray-500 bg-cscx-gray-800 px-2 py-1 rounded">~3 min</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Browse our sample customers to see health scores, AI insights, and more.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Note */}
        <div className="bg-cscx-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300">
            <span className="text-cscx-accent font-medium">Note:</span> All actions in this preview are simulated.
            No real emails will be sent or meetings scheduled.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleDismiss}
          className="w-full bg-cscx-accent hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Start Exploring
        </button>
      </div>
    </div>
  );
}

export default DesignPartnerWelcome;
