# Components - Agent Instructions

## Overview

React 19 components using TypeScript, Tailwind CSS, and Lucide icons. All components are functional with hooks.

## Directory Structure

```
components/
├── AgentControlCenter/    # Main agent chat interface
│   ├── index.tsx         # Orchestrator
│   ├── ChatPanel.tsx     # Message history + input
│   ├── PendingApprovals.tsx
│   └── WorkspacePanel.tsx
├── AgentStudio/          # Advanced agent configuration
├── AgentTraceViewer/     # Observability UI
├── AIPanel/              # Embedded context-aware assistant
├── ErrorLog/             # Error tracking display
├── CustomerDetail.tsx    # 360° customer view
├── CustomerList.tsx      # Customer grid with health
├── ContractUpload.tsx    # Onboarding contract parsing
├── EntitlementsTable.tsx # Contract items display
├── UnifiedOnboarding.tsx # Two-column onboarding layout
└── WorkspacePanel.tsx    # Per-customer Google workspace
```

## Component Patterns

### Standard Component Template
```tsx
import { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';

interface MyComponentProps {
  customerId: string;
  onUpdate?: (data: UpdateData) => void;
}

export function MyComponent({ customerId, onUpdate }: MyComponentProps) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/data/${customerId}`);
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse">Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      {/* Component content */}
    </div>
  );
}
```

### Styling Conventions

```tsx
// Brand colors (defined in tailwind.config.js)
className="bg-cscx-accent"     // Primary red: #e63946
className="bg-cscx-black"      // Pure black: #000000
className="bg-cscx-gray-900"   // Near black: #0a0a0a
className="bg-cscx-gray-800"   // Dark gray: #222222

// Common patterns
className="flex items-center gap-4"           // Flexbox with gap
className="grid grid-cols-1 md:grid-cols-3"   // Responsive grid
className="p-4 rounded-lg border border-gray-700"  // Card style
className="hover:bg-gray-800 transition-colors"    // Hover state
```

### State Management

```tsx
// Local state for component-specific data
const [isOpen, setIsOpen] = useState(false);

// Context for global state
import { useAuth } from '../context/AuthContext';
const { user, signOut } = useAuth();

// URL state for shareable views
import { useSearchParams } from 'react-router-dom';
const [searchParams, setSearchParams] = useSearchParams();
```

## Key Components Reference

### CustomerList
- Displays all customers in a grid
- Shows health score badges (color-coded)
- Supports search and filtering
- Click navigates to CustomerDetail

### CustomerDetail
- 360° view of single customer
- Tabs: Overview, Stakeholders, Activity, Workspace
- Embedded WorkspacePanel for Google integration
- Health score breakdown (PROVE framework)

### AgentControlCenter
- Main interface for agent interaction
- Agent selector (5 specialists + auto)
- Real-time chat with streaming
- Inline approval cards
- Tool call visualization

### AIPanel
- Embedded assistant for workflows
- Context-aware (knows current customer/phase)
- 30% width in two-column layouts
- Collapsible for more main content space

### UnifiedOnboarding
- Two-column layout: 70% content, 30% AI
- Phase-based workflow state machine
- Contract upload and parsing
- Stakeholder mapping
- Success plan generation

## Common Gotchas

### 1. Import Icons Correctly
```tsx
// ❌ BAD - imports entire library
import * as Icons from 'lucide-react';

// ✅ GOOD - tree-shakeable
import { User, Settings, ChevronRight } from 'lucide-react';
```

### 2. Tailwind Dynamic Classes
```tsx
// ❌ BAD - purged in production
const color = isActive ? 'green' : 'gray';
className={`bg-${color}-500`}

// ✅ GOOD - explicit classes
className={isActive ? 'bg-green-500' : 'bg-gray-500'}
```

### 3. React 19 Promise Handling
```tsx
// ❌ OLD WAY - useEffect + useState
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// ✅ NEW WAY - use() hook (React 19)
import { use } from 'react';
const data = use(fetchDataPromise);
```

### 4. Key Props in Lists
```tsx
// ❌ BAD - index as key
{items.map((item, i) => <Item key={i} {...item} />)}

// ✅ GOOD - stable unique ID
{items.map(item => <Item key={item.id} {...item} />)}
```

### 5. Event Handler Types
```tsx
// ❌ BAD - any type
const handleClick = (e: any) => { ... }

// ✅ GOOD - proper React types
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
```

## Testing Approach

1. **Manual testing**: Run `npm run dev` and verify in browser
2. **Type checking**: `npx tsc --noEmit` catches type errors
3. **Console errors**: Check browser console for React warnings
4. **Mobile**: Test responsive layouts at 375px width

## File Naming

- `PascalCase.tsx` for components: `CustomerDetail.tsx`
- `camelCase.ts` for utilities: `formatDate.ts`
- `index.tsx` for directory main exports
- `AGENTS.md` for agent instructions (this file)
