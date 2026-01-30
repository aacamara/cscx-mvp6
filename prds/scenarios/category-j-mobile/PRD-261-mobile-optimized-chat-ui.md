# PRD-261: Mobile-Optimized Chat UI

## Metadata
- **PRD ID**: PRD-261
- **Title**: Mobile-Optimized Chat UI
- **Category**: J - Mobile & Accessibility
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: AI Chat system, Responsive design framework

---

## Problem Statement

CSMs are frequently away from their desks - traveling to customer sites, attending conferences, or working remotely. The current desktop-optimized chat interface is difficult to use on mobile devices, limiting their ability to leverage AI assistance when they need it most.

## User Story

> As a CSM on the go, I want to use the AI assistant effectively on my mobile device so that I can get quick answers and take actions on customer accounts from anywhere.

---

## Functional Requirements

### FR-1: Responsive Layout
- **FR-1.1**: Full-width chat interface on mobile (no side panels)
- **FR-1.2**: Collapsible customer context header
- **FR-1.3**: Bottom-anchored input area
- **FR-1.4**: Touch-friendly message bubbles
- **FR-1.5**: Swipe gestures for navigation

### FR-2: Touch-Optimized Input
- **FR-2.1**: Large touch targets (min 44px)
- **FR-2.2**: Native keyboard integration
- **FR-2.3**: Voice input support
- **FR-2.4**: Quick action chips for common requests
- **FR-2.5**: Paste support for screenshots/images

### FR-3: Optimized Display
- **FR-3.1**: Readable font sizes (min 16px)
- **FR-3.2**: Truncated tables with horizontal scroll
- **FR-3.3**: Expandable code blocks
- **FR-3.4**: Image preview with tap to expand
- **FR-3.5**: Link previews with external app support

### FR-4: Performance
- **FR-4.1**: Fast initial load (< 3 seconds on 4G)
- **FR-4.2**: Efficient message streaming
- **FR-4.3**: Lazy loading of history
- **FR-4.4**: Offline message queue
- **FR-4.5**: Reduced data usage mode

### FR-5: Context Switching
- **FR-5.1**: Quick customer search/switch
- **FR-5.2**: Recent conversations list
- **FR-5.3**: Deep linking from notifications
- **FR-5.4**: State preservation on app switch
- **FR-5.5**: Seamless handoff to desktop

---

## Non-Functional Requirements

### NFR-1: Performance
- Time to interactive < 3 seconds
- Smooth 60fps scrolling

### NFR-2: Compatibility
- iOS Safari 15+
- Chrome for Android 90+
- Progressive Web App (PWA) support

### NFR-3: Bandwidth
- Initial payload < 500KB
- Efficient real-time connection

---

## Technical Approach

### Responsive Design System

```typescript
// Breakpoint definitions
const breakpoints = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)'
};

// Mobile-specific components
interface MobileChatProps {
  customerId?: string;
  initialContext?: CustomerContext;
}

const MobileChat: React.FC<MobileChatProps> = ({ customerId, initialContext }) => {
  const [isContextExpanded, setContextExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle virtual keyboard
  useEffect(() => {
    const handleResize = () => {
      // Adjust viewport when keyboard appears
      if (window.visualViewport) {
        document.body.style.height = `${window.visualViewport.height}px`;
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="mobile-chat flex flex-col h-full">
      {/* Collapsible context header */}
      <MobileContextHeader
        customer={customer}
        expanded={isContextExpanded}
        onToggle={() => setContextExpanded(!isContextExpanded)}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <MessageList
          messages={messages}
          renderMessage={(msg) => <MobileMessageBubble message={msg} />}
        />
      </div>

      {/* Quick actions */}
      <QuickActionChips
        actions={['Check health', 'Draft email', 'Find docs']}
        onSelect={handleQuickAction}
      />

      {/* Input area - sticky to bottom */}
      <div className="sticky bottom-0 bg-white border-t safe-area-bottom">
        <MobileInput
          ref={inputRef}
          onSend={handleSend}
          onVoice={handleVoiceInput}
        />
      </div>
    </div>
  );
};
```

### Touch Gestures

```typescript
// Swipe gesture handler
const useSwipeGestures = (options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    const threshold = options.threshold || 100;

    if (distance > threshold && options.onSwipeLeft) {
      options.onSwipeLeft();
    } else if (distance < -threshold && options.onSwipeRight) {
      options.onSwipeRight();
    }
    setTouchStart(null);
  };

  return { handleTouchStart, handleTouchEnd };
};

// Usage in chat
const gestures = useSwipeGestures({
  onSwipeLeft: () => navigateToCustomerDetail(),
  onSwipeRight: () => navigateBack()
});
```

### Voice Input Integration

```typescript
const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;

      recognition.current.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        setTranscript(result[0].transcript);
      };
    }
  }, []);

  const startListening = () => {
    if (recognition.current) {
      recognition.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition.current) {
      recognition.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, transcript, startListening, stopListening };
};
```

### PWA Configuration

```json
// manifest.json
{
  "name": "CSCX.AI",
  "short_name": "CSCX",
  "description": "Customer Success AI Platform",
  "start_url": "/chat",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#e63946",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### CSS Optimizations

```css
/* Mobile-specific styles */
@media (max-width: 767px) {
  .mobile-chat {
    /* Use safe area insets for notched devices */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .message-bubble {
    /* Touch-friendly sizing */
    min-height: 44px;
    padding: 12px 16px;
    font-size: 16px; /* Prevents iOS zoom on focus */
  }

  .input-area {
    /* Larger touch target */
    min-height: 56px;
  }

  /* Disable hover states on touch */
  @media (hover: none) {
    .interactive:hover {
      background-color: initial;
    }
  }

  /* Momentum scrolling */
  .scrollable {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mobile usage rate | 30% of chat sessions | Analytics |
| Mobile completion rate | 90% (vs desktop) | Session tracking |
| Mobile load time | < 3 seconds | Performance monitoring |
| User satisfaction | 4/5+ | Mobile-specific feedback |

---

## Acceptance Criteria

- [ ] Chat loads and is fully usable on mobile browsers
- [ ] Touch targets are minimum 44px
- [ ] Virtual keyboard doesn't obscure input
- [ ] Messages readable without zooming
- [ ] Quick actions accessible with one tap
- [ ] Voice input works on supported devices
- [ ] Swipe navigation functional
- [ ] PWA installable on iOS and Android
- [ ] State preserved on app switch
- [ ] Deep links from notifications work

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Responsive layout refactor | 4 days |
| Mobile-specific components | 3 days |
| Touch gesture system | 2 days |
| Voice input integration | 2 days |
| PWA configuration | 1 day |
| Performance optimization | 2 days |
| Cross-browser testing | 3 days |
| **Total** | **17 days** |

---

## Notes

- Consider React Native for native app in future
- Test on various device sizes and orientations
- Future: Offline-first architecture
- Future: Native sharing integration
- Future: Haptic feedback for interactions
