# PRD-275: Reduced Motion Option

## Metadata
- **PRD ID**: PRD-275
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: PRD-270 (WCAG Compliance)

## Scenario Description
Users with vestibular disorders, motion sensitivity, or those who simply prefer less animation need an option to reduce or eliminate motion in the UI. The system should respect OS preferences and provide granular control over animation levels.

## User Story
**As a** user with motion sensitivity,
**I want** to reduce animations and transitions,
**So that** I can use the application comfortably without disorientation.

## Trigger
- User enables reduced motion in settings
- System detects OS prefers-reduced-motion preference
- User disables specific animation types

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Tailwind animations | `tailwind.config.js` | Implemented | Animation utilities |
| CSS transitions | Components | Implemented | Various transitions |
| Loading spinners | UI components | Implemented | Animated indicators |

### What's Missing
- [ ] Reduced motion CSS utilities
- [ ] OS preference detection
- [ ] Animation toggle controls
- [ ] Alternative static indicators
- [ ] User preference persistence

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `styles/reduced-motion.css` | Create | Reduced motion styles |
| `hooks/useReducedMotion.ts` | Create | Motion preference hook |
| `components/Settings/MotionSettings.tsx` | Create | Motion settings UI |

### CSS Implementation
```css
/* reduced-motion.css */

/* Respect OS preference by default */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* User preference classes */
.reduce-motion {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.reduce-motion-partial {
  * {
    animation-duration: 0.2s !important;
    transition-duration: 0.15s !important;
  }
}

/* Alternative loading indicator */
.reduce-motion .loading-spinner {
  animation: none;
  border-style: dotted;
}

.reduce-motion .loading-spinner::after {
  content: "Loading...";
}
```

### Hook Implementation
```tsx
// useReducedMotion.ts
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [userPreference, setUserPreference] = useState<'system' | 'reduce' | 'no-preference'>('system');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const shouldReduceMotion =
    userPreference === 'reduce' ||
    (userPreference === 'system' && prefersReducedMotion);

  return { shouldReduceMotion, userPreference, setUserPreference };
}
```

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `PUT /api/users/preferences/motion` | PUT | Save motion pref |

### Database Changes
```sql
-- Uses existing accessibility_preferences JSONB column
-- { "reducedMotion": "reduce" | "partial" | "system" | "full" }
```

## Motion Levels

| Level | Description | Animation Duration | Use Case |
|-------|-------------|-------------------|----------|
| Full | All animations | Default | Default experience |
| Partial | Reduced animations | 150-200ms max | Mild sensitivity |
| Minimal | Essential only | Instant | Moderate sensitivity |
| None | No animation | 0ms | Severe sensitivity |

## Chat UI Flow
```
User: Disable animations
System: Reduced motion mode enabled.

Your motion settings:
- **Current**: Reduced (minimal animations)

Options:
- Full Motion: All animations enabled
- Partial: Subtle, quick animations only
- Reduced: Minimal essential animations ← Current
- None: No animations at all

Your system preference (prefers-reduced-motion) is: Enabled
We're currently respecting your system setting.

[Keep Reduced] [Try Partial] [Full Motion]
```

## Elements Affected

| Element | Full Motion | Reduced Motion |
|---------|-------------|----------------|
| Page transitions | Slide/fade | Instant |
| Loading spinners | Continuous rotation | Static + text |
| Dropdown menus | Slide down | Instant appear |
| Modal dialogs | Fade + scale | Instant appear |
| Toast notifications | Slide in | Instant appear |
| Hover effects | Smooth transition | Instant |
| Charts/graphs | Animated drawing | Static display |

## Acceptance Criteria
- [ ] Detect and respect prefers-reduced-motion OS setting
- [ ] Provide manual override in settings
- [ ] 4 motion levels available (full, partial, reduced, none)
- [ ] All spinners have static alternatives
- [ ] Page transitions respect setting
- [ ] Charts render without animation
- [ ] User preference persisted
- [ ] No layout shift when motion disabled

## Ralph Loop Notes
- **Learning**: Track reduced motion usage rates
- **Optimization**: Identify animations causing issues
- **Personalization**: Remember user's motion preferences

### Completion Signal
```
<promise>PRD-275-COMPLETE</promise>
```
