/**
 * DesignPartnerWelcome - Welcome modal for first-time design partners
 * Shows on first login, explains what they can explore
 */

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'dp_welcome_dismissed';

interface DesignPartnerWelcomeProps {
  isDesignPartner: boolean;
}

export function DesignPartnerWelcome({ isDesignPartner }: DesignPartnerWelcomeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show for design partners who haven't dismissed
    if (isDesignPartner) {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setIsVisible(true);
      }
    }
  }, [isDesignPartner]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 max-w-lg w-full p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome to CSCX.AI
          </h2>
          <p className="text-gray-400">
            Design Partner Preview
          </p>
        </div>

        {/* What you can explore */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            What you can explore
          </h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="text-white font-medium">Explore Demo Customers</p>
                <p className="text-gray-400 text-sm">View sample customer data, health scores, and 360° views</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <p className="text-white font-medium">Start Mock Onboarding</p>
                <p className="text-gray-400 text-sm">Experience the AI-powered onboarding workflow</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-white font-medium">Chat with AI Assistant</p>
                <p className="text-gray-400 text-sm">Ask questions and see how agents generate emails, documents, and more</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-white font-medium">Review Agent Actions</p>
                <p className="text-gray-400 text-sm">Approve or reject AI-generated content before it's sent</p>
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
