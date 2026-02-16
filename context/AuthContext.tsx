/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 * Supports Google OAuth via Supabase + Google Workspace scopes
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Demo user ID with connected Google account (for development/demo mode)
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

// Admin emails with full platform access
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];

// Google Workspace scopes needed for full integration
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  role: 'admin' | 'csm' | 'viewer';
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDesignPartner: boolean;
  googleTokens: GoogleTokens | null;
  hasGoogleAccess: boolean;
  userId: string; // Always available - uses demo ID when not authenticated
  organizationId: string | null;
  userRole: string | null;
  orgMembership: OrgMembership | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  connectGoogleWorkspace: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleTokens, setGoogleTokens] = useState<GoogleTokens | null>(null);
  const [orgMembership, setOrgMembership] = useState<OrgMembership | null>(null);

  // Check for Google tokens in session
  const extractGoogleTokens = useCallback((session: Session | null): GoogleTokens | null => {
    if (!session?.provider_token) return null;

    return {
      accessToken: session.provider_token,
      refreshToken: session.provider_refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : undefined
    };
  }, []);

  // Fetch org membership for the authenticated user
  const fetchOrgMembership = useCallback(async (userId: string, accessToken: string) => {
    const API_URL = import.meta.env.VITE_API_URL || '';
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      // Use first workspace as org context (multi-org support can come later)
      const firstWorkspace = data.workspaces?.[0];
      if (firstWorkspace) {
        setOrgMembership({
          organizationId: firstWorkspace.id,
          organizationName: firstWorkspace.name,
          role: firstWorkspace.role || 'csm',
        });
      }
    } catch (error) {
      console.warn('Failed to fetch org membership:', error);
      // Non-fatal — org context just won't be available
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setGoogleTokens(extractGoogleTokens(session));
      // Fetch org membership if we have a session
      if (session?.user && session.access_token) {
        await fetchOrgMembership(session.user.id, session.access_token);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setGoogleTokens(extractGoogleTokens(session));

        // If user just signed in with Google, sync tokens to backend
        if (event === 'SIGNED_IN' && session?.provider_token) {
          await syncGoogleTokensToBackend(session);
        }

        // Fetch org membership on sign in
        if (event === 'SIGNED_IN' && session?.user && session.access_token) {
          await fetchOrgMembership(session.user.id, session.access_token);
        }

        // Clear org membership on sign out
        if (event === 'SIGNED_OUT') {
          setOrgMembership(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [extractGoogleTokens, fetchOrgMembership]);

  // Sync Google tokens to backend for server-side API access
  const syncGoogleTokensToBackend = async (session: Session) => {
    if (!session.provider_token) return;

    const API_URL = import.meta.env.VITE_API_URL || '';

    try {
      await fetch(`${API_URL}/api/google/auth/sync-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-id': session.user.id
        },
        body: JSON.stringify({
          accessToken: session.provider_token,
          refreshToken: session.provider_refresh_token,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          grantedScopes: GOOGLE_SCOPES.split(' ')
        })
      });
    } catch (error) {
      console.error('Failed to sync Google tokens:', error);
    }
  };

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.error('Supabase not configured');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GOOGLE_SCOPES,
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }, []);

  // Connect Google Workspace (for users who signed up differently)
  const connectGoogleWorkspace = useCallback(async () => {
    if (!supabase || !user) {
      console.error('Not authenticated');
      return;
    }

    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        scopes: GOOGLE_SCOPES,
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('Google connect error:', error);
      throw error;
    }
  }, [user]);

  // Sign out
  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }

    setUser(null);
    setSession(null);
    setGoogleTokens(null);
    setOrgMembership(null);
  }, []);

  // Get the current user ID (authenticated user or demo user)
  const userId = user?.id || DEMO_USER_ID;

  // Role detection based on email
  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail);
  const isDesignPartner = !!user && !isAdmin;

  // Get auth headers for API requests
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    // Always include user ID - use demo ID if not authenticated
    headers['x-user-id'] = user?.id || DEMO_USER_ID;
    // Include user email for role-based filtering
    if (user?.email) {
      headers['x-user-email'] = user.email;
    }
    // Include org context when available
    if (orgMembership?.organizationId) {
      headers['x-organization-id'] = orgMembership.organizationId;
    }

    return headers;
  }, [session, user, orgMembership]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    isDesignPartner,
    googleTokens,
    hasGoogleAccess: !!googleTokens?.accessToken,
    userId,
    organizationId: orgMembership?.organizationId ?? null,
    userRole: orgMembership?.role ?? null,
    orgMembership,
    signInWithGoogle,
    signOut,
    connectGoogleWorkspace,
    getAuthHeaders
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protected routes
export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, loading, redirectTo]);

  return { isAuthenticated, loading };
}
