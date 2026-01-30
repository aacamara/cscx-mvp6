# PRD-270: Accessibility Compliance (WCAG)

## Metadata
- **PRD ID**: PRD-270
- **Title**: Accessibility Compliance (WCAG)
- **Category**: J - Mobile & Accessibility
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: All UI components

---

## Problem Statement

CSCX.AI must be accessible to all users, including those with visual, motor, auditory, or cognitive disabilities. Many enterprise customers require WCAG 2.1 AA compliance for procurement. Current UI components may not meet accessibility standards, excluding users who rely on assistive technologies.

## User Story

> As a user with disabilities, I want CSCX.AI to work with my assistive technology so that I can perform my job effectively regardless of my abilities.

---

## Functional Requirements

### FR-1: WCAG 2.1 Level AA Compliance
- **FR-1.1**: All images have alternative text
- **FR-1.2**: Color is not sole means of conveying information
- **FR-1.3**: Text contrast ratio minimum 4.5:1
- **FR-1.4**: Content readable at 200% zoom
- **FR-1.5**: Time limits can be extended or disabled

### FR-2: Perceivable Content
- **FR-2.1**: Captions for audio/video content
- **FR-2.2**: Audio descriptions for video
- **FR-2.3**: Consistent visual presentation
- **FR-2.4**: Text alternatives for non-text content
- **FR-2.5**: Distinguishable content (spacing, sizing)

### FR-3: Operable Interface
- **FR-3.1**: Full keyboard accessibility
- **FR-3.2**: No keyboard traps
- **FR-3.3**: Skip navigation links
- **FR-3.4**: Focus indicators visible
- **FR-3.5**: Adequate time for interactions

### FR-4: Understandable Content
- **FR-4.1**: Consistent navigation patterns
- **FR-4.2**: Clear error identification
- **FR-4.3**: Labels and instructions provided
- **FR-4.4**: Predictable behavior
- **FR-4.5**: Help documentation accessible

### FR-5: Robust Implementation
- **FR-5.1**: Valid, semantic HTML
- **FR-5.2**: ARIA landmarks and roles
- **FR-5.3**: Assistive technology compatibility
- **FR-5.4**: Status messages announced
- **FR-5.5**: Custom components accessible

---

## Non-Functional Requirements

### NFR-1: Standards
- WCAG 2.1 Level AA compliance

### NFR-2: Testing
- Automated accessibility testing in CI/CD

### NFR-3: Documentation
- Accessibility statement published

---

## Technical Approach

### Component Accessibility Patterns

```typescript
// Accessible button component
const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  ariaLabel,
  ariaDescribedBy,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant}`}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      aria-disabled={disabled}
    >
      {loading ? (
        <>
          <span className="sr-only">Loading...</span>
          <Spinner aria-hidden="true" />
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Accessible modal/dialog
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  initialFocusRef,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;

      // Focus initial element or first focusable
      const focusTarget = initialFocusRef?.current ||
        modalRef.current?.querySelector<HTMLElement>('[tabindex="-1"], button, input, a');
      focusTarget?.focus();

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
        if (e.key === 'Tab') {
          trapFocus(e, modalRef.current);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else {
      // Restore focus
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
      className="modal"
    >
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-content">
        <h2 id="modal-title">{title}</h2>
        {children}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="modal-close"
        >
          <CloseIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

// Accessible form field
const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  type = 'text',
  required,
  error,
  description,
  value,
  onChange,
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const ariaDescribedBy = [errorId, descriptionId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {description && (
        <p id={descriptionId} className="field-description">
          {description}
        </p>
      )}

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={ariaDescribedBy}
      />

      {error && (
        <p id={errorId} className="field-error" role="alert">
          <AlertIcon aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};
```

### Skip Navigation

```typescript
// Skip links for keyboard users
const SkipLinks: React.FC = () => {
  return (
    <div className="skip-links">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#main-navigation" className="skip-link">
        Skip to navigation
      </a>
      <a href="#search" className="skip-link">
        Skip to search
      </a>
    </div>
  );
};

// CSS for skip links
const skipLinkStyles = `
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 100;
  }

  .skip-link:focus {
    top: 0;
  }
`;
```

### Live Regions for Announcements

```typescript
// Accessible announcer for dynamic content
const Announcer: React.FC = () => {
  const { message } = useAnnouncements();

  return (
    <>
      {/* Polite announcements (non-urgent) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message.polite}
      </div>

      {/* Assertive announcements (urgent) */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {message.assertive}
      </div>
    </>
  );
};

// Hook for making announcements
const useAnnounce = () => {
  const setMessage = useAnnouncerStore((state) => state.setMessage);

  return {
    announce: (text: string, priority: 'polite' | 'assertive' = 'polite') => {
      setMessage({ [priority]: text });
      // Clear after announcement
      setTimeout(() => setMessage({ [priority]: '' }), 1000);
    },
  };
};

// Usage in components
const CustomerList: React.FC = () => {
  const { announce } = useAnnounce();
  const { data: customers, isLoading } = useCustomers();

  useEffect(() => {
    if (!isLoading && customers) {
      announce(`Loaded ${customers.length} customers`);
    }
  }, [isLoading, customers]);

  return (/* ... */);
};
```

### Color Contrast Utilities

```typescript
// Contrast checking utilities
const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

const meetsWCAGAA = (foreground: string, background: string, isLargeText = false): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
};

// Design tokens with accessibility
const colors = {
  // Primary colors with compliant contrast
  primary: {
    main: '#e63946',
    onMain: '#ffffff', // 4.5:1 contrast
    dark: '#c41d2b',
    onDark: '#ffffff',
  },
  // Status colors
  success: {
    main: '#2e7d32', // Not #00ff00 (fails contrast)
    onMain: '#ffffff',
  },
  error: {
    main: '#c62828',
    onMain: '#ffffff',
  },
  // Text colors
  text: {
    primary: '#1a1a1a', // High contrast on white
    secondary: '#5a5a5a', // 7:1 on white
    disabled: '#767676', // 4.5:1 minimum
  },
};
```

### Automated Testing

```typescript
// Jest-axe integration
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('CustomerDetail accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<CustomerDetail customerId="123" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// Cypress-axe for e2e tests
describe('Accessibility', () => {
  beforeEach(() => {
    cy.injectAxe();
  });

  it('Customer list page should be accessible', () => {
    cy.visit('/customers');
    cy.checkA11y();
  });

  it('Chat interface should be accessible', () => {
    cy.visit('/chat');
    cy.checkA11y(null, {
      rules: {
        // Configure specific rules
        'color-contrast': { enabled: true },
        'aria-allowed-role': { enabled: true },
      },
    });
  });
});

// CI/CD integration (GitHub Actions)
// .github/workflows/a11y.yml
/*
name: Accessibility Tests
on: [push, pull_request]
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:a11y
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: a11y-report
          path: a11y-report.html
*/
```

### ARIA Implementation

```typescript
// Data table with proper ARIA
const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  sortColumn,
  sortDirection,
  onSort,
}) => {
  return (
    <table role="grid" aria-label="Customer data">
      <thead>
        <tr role="row">
          {columns.map((col) => (
            <th
              key={col.key}
              role="columnheader"
              aria-sort={
                sortColumn === col.key
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
              onClick={() => onSort(col.key)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSort(col.key)}
            >
              {col.label}
              {sortColumn === col.key && (
                <span aria-hidden="true">
                  {sortDirection === 'asc' ? ' ▲' : ' ▼'}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={row.id} role="row" aria-rowindex={index + 1}>
            {columns.map((col) => (
              <td key={col.key} role="gridcell">
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| WCAG 2.1 AA compliance | 100% | Automated testing + audit |
| Accessibility bugs | 0 critical | Issue tracking |
| Screen reader success rate | 95%+ | User testing |
| Keyboard task completion | 100% | Manual testing |

---

## Acceptance Criteria

- [ ] All images have appropriate alt text
- [ ] Color contrast meets 4.5:1 minimum
- [ ] All functionality accessible via keyboard
- [ ] Focus indicators visible on all interactive elements
- [ ] Skip navigation links present
- [ ] Forms have proper labels and error messages
- [ ] Modals trap focus correctly
- [ ] Status updates announced to screen readers
- [ ] Content readable at 200% zoom
- [ ] Automated tests pass in CI/CD

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Audit existing components | 3 days |
| Remediate critical issues | 5 days |
| Implement ARIA patterns | 3 days |
| Keyboard navigation fixes | 3 days |
| Color contrast fixes | 2 days |
| Automated testing setup | 2 days |
| Documentation | 1 day |
| Testing with screen readers | 3 days |
| **Total** | **22 days** |

---

## Notes

- Partner with accessibility consultants for audit
- Include users with disabilities in testing
- Future: WCAG 2.2 compliance
- Future: Cognitive accessibility improvements
- Future: Accessibility training for developers
