# PRD-274: Font Size Customization

## Metadata
- **PRD ID**: PRD-274
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: PRD-270 (WCAG Compliance)

## Scenario Description
Users need the ability to adjust font sizes throughout the application to improve readability. The system should support multiple size presets and maintain proper layout at all sizes.

## User Story
**As a** user with visual needs,
**I want** to adjust the font size,
**So that** I can read content comfortably.

## Trigger
- User adjusts font size in settings
- User uses keyboard shortcuts (Ctrl++ / Ctrl+-)
- System detects OS font size preference

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Tailwind typography | `tailwind.config.js` | Implemented | Size utilities |
| CSS variables | Theme system | Implemented | Can be modified |
| Responsive design | Components | Implemented | Adapts to screens |

### What's Missing
- [ ] Font size scale system
- [ ] User preference storage
- [ ] Layout adjustments for larger fonts
- [ ] Zoom level persistence
- [ ] OS preference detection

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `tailwind.config.js` | Modify | Add font size scale |
| `context/FontSizeContext.tsx` | Create | Font size management |
| `components/Settings/FontSettings.tsx` | Create | Font settings UI |
| `styles/typography.css` | Create | Typography variables |

### Font Size Scale
```css
:root {
  --font-scale: 1; /* Default */
}

.font-scale-small { --font-scale: 0.875; }
.font-scale-normal { --font-scale: 1; }
.font-scale-large { --font-scale: 1.125; }
.font-scale-xlarge { --font-scale: 1.25; }
.font-scale-xxlarge { --font-scale: 1.5; }

body {
  font-size: calc(16px * var(--font-scale));
}
```

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `PUT /api/users/preferences/font-size` | PUT | Save font size pref |

### Database Changes
```sql
-- Uses existing accessibility_preferences JSONB column
-- { "fontSize": "large", "fontScale": 1.25 }
```

## Implementation

```tsx
// FontSizeContext.tsx
const fontScales = {
  small: 0.875,
  normal: 1,
  large: 1.125,
  xlarge: 1.25,
  xxlarge: 1.5
};

export const FontSizeProvider: React.FC = ({ children }) => {
  const [fontSize, setFontSize] = useState<keyof typeof fontScales>('normal');

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScales[fontSize]));
  }, [fontSize]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, fontScales }}>
      {children}
    </FontSizeContext.Provider>
  );
};
```

## Chat UI Flow
```
User: Make the text larger
System: Font size increased to Large.

Current setting: Large (125%)

Available options:
- Small (87.5%)
- Normal (100%)
- Large (125%) ← Current
- Extra Large (150%)
- Maximum (175%)

Keyboard shortcuts:
- Ctrl + Plus: Increase size
- Ctrl + Minus: Decrease size
- Ctrl + 0: Reset to normal

[Make Larger] [Make Smaller] [Reset]
```

## Acceptance Criteria
- [ ] 5 font size presets available
- [ ] Keyboard shortcuts for quick adjustment
- [ ] Layout remains usable at all sizes
- [ ] User preference persisted
- [ ] Real-time preview of changes
- [ ] Minimum font size of 12px maintained
- [ ] All text scales proportionally
- [ ] Icons and buttons scale appropriately

## Testing Matrix

| Size | Scale | Body Text | Headers | Buttons |
|------|-------|-----------|---------|---------|
| Small | 87.5% | 14px | 21px | 12px |
| Normal | 100% | 16px | 24px | 14px |
| Large | 125% | 20px | 30px | 18px |
| X-Large | 150% | 24px | 36px | 21px |
| XX-Large | 175% | 28px | 42px | 24px |

## Ralph Loop Notes
- **Learning**: Track which font sizes are most commonly used
- **Optimization**: Identify UI elements that break at large sizes
- **Personalization**: Suggest optimal size based on usage patterns

### Completion Signal
```
<promise>PRD-274-COMPLETE</promise>
```
