/**
 * User Profile Component
 * Shows user info and Google Workspace connection status
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';

export function UserProfile() {
  const { user, hasGoogleAccess, signOut, connectGoogleWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      await connectGoogleWorkspace();
    } catch (error) {
      console.error('Failed to connect Google:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    const name = user.user_metadata?.full_name || user.email || '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-cscx-accent flex items-center justify-center text-white text-sm font-medium">
            {getInitials()}
          </div>
        )}

        {/* Name & Status */}
        <div className="hidden md:block text-left">
          <div className="text-sm text-white font-medium">{displayName}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            {hasGoogleAccess ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-yellow-500" />
                <span>Limited</span>
              </>
            )}
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-cscx-gray-900 rounded-xl border border-gray-800 shadow-xl z-50">
          {/* User Info Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-cscx-accent flex items-center justify-center text-white text-lg font-medium">
                  {getInitials()}
                </div>
              )}
              <div>
                <div className="text-white font-medium">{displayName}</div>
                <div className="text-sm text-gray-400">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Google Workspace Status */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Google Workspace</span>
              {hasGoogleAccess ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertCircle className="w-3 h-3" />
                  Not Connected
                </span>
              )}
            </div>

            {hasGoogleAccess ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Gmail access enabled
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Calendar access enabled
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Drive access enabled
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-gray-900"></div>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Connect Google Workspace
              </button>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfile;
