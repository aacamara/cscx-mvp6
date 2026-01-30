# PRD-272: Keyboard Navigation

## Metadata
- **PRD ID**: PRD-272
- **Title**: Keyboard Navigation
- **Category**: J - Mobile & Accessibility
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-270 (WCAG Compliance)

---

## Problem Statement

Users who cannot use a mouse (due to motor disabilities, RSI, or preference) must be able to navigate and use all CSCX.AI features with a keyboard alone. Currently, some features may be inaccessible or difficult to use without a mouse.

## User Story

> As a keyboard-only user, I want to navigate all features and take all actions using only my keyboard so that I can use CSCX.AI without a mouse.

---

## Functional Requirements

### FR-1: Focus Management
- **FR-1.1**: Visible focus indicator on all elements
- **FR-1.2**: Logical tab order matching visual flow
- **FR-1.3**: No focus traps (except modals)
- **FR-1.4**: Focus returns appropriately after actions
- **FR-1.5**: Skip links to main content

### FR-2: Keyboard Shortcuts
- **FR-2.1**: Global shortcuts for common actions
- **FR-2.2**: Context-specific shortcuts
- **FR-2.3**: Shortcut help overlay (?)
- **FR-2.4**: Customizable shortcuts
- **FR-2.5**: Conflict detection with browser/OS

### FR-3: Component Navigation
- **FR-3.1**: Arrow keys for menu navigation
- **FR-3.2**: Tab/Shift+Tab between groups
- **FR-3.3**: Enter/Space for activation
- **FR-3.4**: Escape to close/cancel
- **FR-3.5**: Type-ahead in lists

### FR-4: Complex Interactions
- **FR-4.1**: Drag-and-drop alternatives
- **FR-4.2**: Keyboard-accessible tooltips
- **FR-4.3**: Context menus via keyboard
- **FR-4.4**: Multi-select with keyboard
- **FR-4.5**: Date picker navigation

### FR-5: Roving Focus Patterns
- **FR-5.1**: Single tab stop for toolbars
- **FR-5.2**: Arrow navigation within groups
- **FR-5.3**: Remember last focused item
- **FR-5.4**: Grid navigation for data tables

---

## Non-Functional Requirements

### NFR-1: Discoverability
- Shortcuts discoverable without documentation

### NFR-2: Consistency
- Same keys do same things everywhere

### NFR-3: Efficiency
- Power users can work faster with keyboard

---

## Technical Approach

### Focus Indicator Styles

```css
/* Global focus indicator styles */
:root {
  --focus-ring-color: #005fcc;
  --focus-ring-width: 3px;
  --focus-ring-offset: 2px;
}

/* Reset browser defaults and apply custom focus */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* Invert focus for dark backgrounds */
.dark-bg *:focus-visible {
  outline-color: #ffffff;
}

/* High contrast mode */
@media (prefers-contrast: more) {
  *:focus-visible {
    outline-width: 4px;
    outline-color: currentColor;
  }
}

/* Skip link */
.skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--focus-ring-color);
  color: white;
  text-decoration: none;
  font-weight: bold;
  border-radius: 4px;
}

.skip-link:focus {
  top: 16px;
}
```

### Keyboard Shortcut System

```typescript
// Global keyboard shortcut manager
interface ShortcutDefinition {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  description: string;
  action: () => void;
  context?: string; // Page or component context
  enabled?: () => boolean;
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private isHelpOpen = false;

  constructor() {
    // Register default shortcuts
    this.register({
      key: '?',
      modifiers: ['shift'],
      description: 'Show keyboard shortcuts',
      action: () => this.showHelp(),
    });

    this.register({
      key: '/',
      description: 'Focus search',
      action: () => document.getElementById('global-search')?.focus(),
    });

    this.register({
      key: 'g',
      description: 'Go to... (then c for customers, t for tasks)',
      action: () => this.activateGoToMode(),
    });

    window.addEventListener('keydown', this.handleKeyDown);
  }

  register(shortcut: ShortcutDefinition): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  private getShortcutKey(shortcut: ShortcutDefinition): string {
    const mods = shortcut.modifiers?.sort().join('+') || '';
    return mods ? `${mods}+${shortcut.key}` : shortcut.key;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Don't trigger in input fields (unless it's a global shortcut)
    if (this.isInputElement(e.target as Element)) {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
    }

    const key = this.buildKeyString(e);
    const shortcut = this.shortcuts.get(key);

    if (shortcut && (!shortcut.enabled || shortcut.enabled())) {
      e.preventDefault();
      shortcut.action();
    }
  };

  private buildKeyString(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey && e.key.length > 1) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  showHelp(): void {
    const shortcuts = Array.from(this.shortcuts.values());
    // Render help modal
    renderShortcutHelp(shortcuts);
  }
}

// Hook for component-specific shortcuts
const useKeyboardShortcuts = (shortcuts: ShortcutDefinition[]) => {
  useEffect(() => {
    const manager = getShortcutManager();
    shortcuts.forEach((s) => manager.register(s));

    return () => {
      shortcuts.forEach((s) => manager.unregister(s));
    };
  }, [shortcuts]);
};
```

### Roving Tab Index Pattern

```typescript
// Roving tabindex for toolbars/menus
const useRovingTabIndex = <T extends HTMLElement>(
  itemCount: number,
  options?: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
  }
) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(T | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const { orientation = 'horizontal', loop = true } = options || {};

    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        if (orientation !== 'vertical') {
          nextIndex = loop
            ? (index + 1) % itemCount
            : Math.min(index + 1, itemCount - 1);
        }
        break;
      case 'ArrowLeft':
        if (orientation !== 'vertical') {
          nextIndex = loop
            ? (index - 1 + itemCount) % itemCount
            : Math.max(index - 1, 0);
        }
        break;
      case 'ArrowDown':
        if (orientation !== 'horizontal') {
          nextIndex = loop
            ? (index + 1) % itemCount
            : Math.min(index + 1, itemCount - 1);
        }
        break;
      case 'ArrowUp':
        if (orientation !== 'horizontal') {
          nextIndex = loop
            ? (index - 1 + itemCount) % itemCount
            : Math.max(index - 1, 0);
        }
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = itemCount - 1;
        break;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      setFocusedIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    }
  };

  const getTabIndex = (index: number) => (index === focusedIndex ? 0 : -1);
  const setRef = (index: number) => (el: T | null) => {
    itemRefs.current[index] = el;
  };

  return { handleKeyDown, getTabIndex, setRef, focusedIndex };
};

// Usage in toolbar
const Toolbar: React.FC<{ items: ToolbarItem[] }> = ({ items }) => {
  const { handleKeyDown, getTabIndex, setRef } = useRovingTabIndex<HTMLButtonElement>(
    items.length,
    { orientation: 'horizontal' }
  );

  return (
    <div role="toolbar" aria-label="Actions">
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={setRef(index)}
          tabIndex={getTabIndex(index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onClick={item.onClick}
          aria-label={item.label}
        >
          <item.Icon />
        </button>
      ))}
    </div>
  );
};
```

### Focus Management

```typescript
// Focus trap for modals
const useFocusTrap = (containerRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef]);
};

// Restore focus after action
const useFocusRestore = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    previousFocusRef.current?.focus();
  };

  return { saveFocus, restoreFocus };
};
```

### Accessible Dropdown

```typescript
// Accessible dropdown with full keyboard support
const Dropdown: React.FC<DropdownProps> = ({ trigger, items, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(items.length - 1);
        break;
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(items[activeIndex]);
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Escape':
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      default:
        // Type-ahead
        if (e.key.length === 1) {
          const char = e.key.toLowerCase();
          const matchIndex = items.findIndex(
            (item, i) =>
              i > activeIndex && item.label.toLowerCase().startsWith(char)
          );
          if (matchIndex !== -1) setActiveIndex(matchIndex);
        }
    }
  };

  useEffect(() => {
    if (isOpen) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [isOpen, activeIndex]);

  return (
    <div className="dropdown">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {trigger}
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          onKeyDown={handleListKeyDown}
          aria-activedescendant={`option-${activeIndex}`}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`option-${index}`}
              ref={(el) => (itemRefs.current[index] = el)}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onClick={() => {
                onSelect(item);
                setIsOpen(false);
              }}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Keyboard-only task completion | 100% | Manual testing |
| Tab order issues | 0 | Automated testing |
| Focus visibility | 100% of elements | Visual audit |
| Shortcut usage | Track adoption | Analytics |

---

## Acceptance Criteria

- [ ] All interactive elements focusable
- [ ] Focus indicator visible on all elements
- [ ] Logical tab order on all pages
- [ ] Skip links functional
- [ ] Global shortcuts implemented
- [ ] Context menus keyboard accessible
- [ ] Modals trap focus correctly
- [ ] Date pickers navigable with keyboard
- [ ] Dropdown menus support arrow keys
- [ ] Shortcuts help overlay accessible

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Focus indicator styles | 1 day |
| Tab order audit & fixes | 3 days |
| Shortcut system | 3 days |
| Roving tabindex patterns | 2 days |
| Focus management utilities | 2 days |
| Component fixes | 4 days |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Document all shortcuts in help
- Test with actual keyboard-only users
- Future: Vim-style navigation mode
- Future: Custom shortcut configuration
- Future: Shortcut recording/macros
