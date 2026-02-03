# Context - Agent Instructions

## Overview

React Context providers for global state management.

## Available Contexts

| Context | Purpose | Key Values |
|---------|---------|------------|
| `AuthContext` | Authentication state | `user`, `signIn`, `signOut`, `loading` |
| `CustomerContext` | Current customer selection | `customer`, `setCustomer` |
| `AgentContext` | Agent session state | `session`, `messages`, `agent` |

## AuthContext

```typescript
// context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Usage Pattern

```tsx
// App.tsx - Wrap entire app
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>...</Routes>
      </Router>
    </AuthProvider>
  );
}

// Component - Use the context
import { useAuth } from './context/AuthContext';

function Header() {
  const { user, signOut, loading } = useAuth();

  if (loading) return <Spinner />;

  return (
    <header>
      {user ? (
        <>
          <span>{user.email}</span>
          <button onClick={signOut}>Sign Out</button>
        </>
      ) : (
        <Link to="/login">Sign In</Link>
      )}
    </header>
  );
}
```

## Best Practices

### 1. Always check context exists
```typescript
// ❌ BAD - crashes if outside provider
export function useAuth() {
  return useContext(AuthContext);
}

// ✅ GOOD - helpful error message
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 2. Memoize context value
```typescript
// ❌ BAD - new object every render
<AuthContext.Provider value={{ user, signIn, signOut }}>

// ✅ GOOD - stable reference
const value = useMemo(() => ({ user, signIn, signOut }), [user]);
<AuthContext.Provider value={value}>
```

### 3. Split contexts by update frequency
```typescript
// ❌ BAD - everything in one context
// All consumers re-render when ANY value changes

// ✅ GOOD - separate contexts
// AuthContext: user, signIn, signOut (changes rarely)
// UIContext: theme, sidebar (changes often)
```

### 4. Handle loading states
```typescript
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}
```
