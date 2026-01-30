# PRD-271: Screen Reader Optimization

## Metadata
- **PRD ID**: PRD-271
- **Title**: Screen Reader Optimization
- **Category**: J - Mobile & Accessibility
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-270 (WCAG Compliance)

---

## Problem Statement

While basic accessibility may be in place, the experience for screen reader users (JAWS, NVDA, VoiceOver) is often poor. Complex interactions like the AI chat, data tables, and real-time updates may be difficult or impossible to use effectively with screen readers.

## User Story

> As a screen reader user, I want CSCX.AI to provide meaningful, well-structured content and announce important updates so that I can navigate and use the platform efficiently.

---

## Functional Requirements

### FR-1: Document Structure
- **FR-1.1**: Proper heading hierarchy (h1-h6)
- **FR-1.2**: Landmark regions (main, nav, aside, etc.)
- **FR-1.3**: Meaningful page titles
- **FR-1.4**: Skip to content links
- **FR-1.5**: Table of contents for long pages

### FR-2: Dynamic Content
- **FR-2.1**: Live regions for chat messages
- **FR-2.2**: Announce loading states
- **FR-2.3**: Alert important notifications
- **FR-2.4**: Progress indicators announced
- **FR-2.5**: Real-time data changes announced

### FR-3: Interactive Elements
- **FR-3.1**: Clear button/link purposes
- **FR-3.2**: Custom controls have proper roles
- **FR-3.3**: State changes announced (expanded, selected)
- **FR-3.4**: Form validation feedback
- **FR-3.5**: Menu navigation patterns

### FR-4: Data Visualization
- **FR-4.1**: Text alternatives for charts
- **FR-4.2**: Data tables with headers
- **FR-4.3**: Summary descriptions for complex visuals
- **FR-4.4**: Sortable table state announced
- **FR-4.5**: Health score verbal descriptions

### FR-5: AI Chat Optimization
- **FR-5.1**: New messages announced
- **FR-5.2**: Typing indicator accessible
- **FR-5.3**: Tool use/thinking states clear
- **FR-5.4**: Code blocks readable
- **FR-5.5**: Action buttons accessible

---

## Non-Functional Requirements

### NFR-1: Compatibility
- JAWS, NVDA, VoiceOver, TalkBack tested

### NFR-2: Efficiency
- Common tasks completable in reasonable time

### NFR-3: Training
- No special knowledge required

---

## Technical Approach

### Landmark Structure

```typescript
// App shell with proper landmarks
const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <SkipLinks />

      <header role="banner">
        <nav role="navigation" aria-label="Main navigation">
          <NavLinks />
        </nav>
      </header>

      <aside role="complementary" aria-label="Customer sidebar">
        <CustomerSidebar />
      </aside>

      <main role="main" id="main-content" tabIndex={-1}>
        {children}
      </main>

      <footer role="contentinfo">
        <FooterContent />
      </footer>

      <Announcer />
    </>
  );
};
```

### Chat Accessibility

```typescript
// Accessible chat component for screen readers
const AccessibleChat: React.FC = () => {
  const { messages, isTyping, sendMessage } = useChat();
  const { announce } = useAnnounce();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(messages.length);

  // Announce new messages
  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      const newMessage = messages[messages.length - 1];
      const announcement = newMessage.role === 'assistant'
        ? `Assistant says: ${newMessage.content.slice(0, 100)}${newMessage.content.length > 100 ? '...' : ''}`
        : 'Your message sent';
      announce(announcement, 'polite');
    }
    previousMessageCount.current = messages.length;
  }, [messages.length]);

  // Announce typing state
  useEffect(() => {
    if (isTyping) {
      announce('Assistant is typing...', 'polite');
    }
  }, [isTyping]);

  return (
    <div className="chat-container" role="region" aria-label="Chat with AI assistant">
      {/* Message list */}
      <div
        className="messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat messages"
      >
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            index={index}
            total={messages.length}
          />
        ))}

        {isTyping && (
          <div role="status" aria-label="Assistant is typing">
            <TypingIndicator aria-hidden="true" />
            <span className="sr-only">Assistant is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        role="form"
        aria-label="Send a message"
      >
        <label htmlFor="chat-input" className="sr-only">
          Type your message
        </label>
        <textarea
          id="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask me anything about your customers..."
          aria-describedby="chat-hint"
        />
        <p id="chat-hint" className="sr-only">
          Press Enter to send, Shift+Enter for new line
        </p>
        <button type="submit" aria-label="Send message">
          <SendIcon aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};

// Individual chat message
const ChatMessage: React.FC<{
  message: Message;
  index: number;
  total: number;
}> = ({ message, index, total }) => {
  const isUser = message.role === 'user';

  return (
    <article
      className={`message ${isUser ? 'user' : 'assistant'}`}
      aria-label={`Message ${index + 1} of ${total}, from ${isUser ? 'you' : 'assistant'}`}
    >
      <header className="sr-only">
        {isUser ? 'You said:' : 'Assistant responded:'}
      </header>

      <div className="message-content">
        {/* Handle code blocks specially */}
        {message.content.includes('```') ? (
          <CodeContent content={message.content} />
        ) : (
          <p>{message.content}</p>
        )}
      </div>

      {/* Tool use indicator */}
      {message.tool_calls?.map((tool) => (
        <div
          key={tool.id}
          role="status"
          aria-label={`Used tool: ${tool.name}`}
        >
          <ToolIcon aria-hidden="true" />
          <span className="sr-only">
            Executed {tool.name}: {tool.result || 'processing'}
          </span>
        </div>
      ))}

      <footer className="sr-only">
        <time dateTime={message.timestamp}>
          {formatRelativeTime(message.timestamp)}
        </time>
      </footer>
    </article>
  );
};
```

### Data Table Accessibility

```typescript
// Accessible data table with screen reader announcements
const AccessibleDataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  caption,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const { announce } = useAnnounce();

  const handleSort = (column: string) => {
    const newDirection =
      sortConfig?.column === column && sortConfig.direction === 'asc'
        ? 'desc'
        : 'asc';

    setSortConfig({ column, direction: newDirection });

    // Announce sort change
    const columnLabel = columns.find((c) => c.key === column)?.label;
    announce(`Sorted by ${columnLabel}, ${newDirection === 'asc' ? 'ascending' : 'descending'}`);
  };

  return (
    <div role="region" aria-label={caption}>
      <table aria-describedby="table-description">
        <caption id="table-description" className="sr-only">
          {caption}. {data.length} rows. Use arrow keys to navigate.
        </caption>

        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sortConfig?.column === col.key
                    ? sortConfig.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  onClick={() => handleSort(col.key)}
                  aria-label={`Sort by ${col.label}`}
                >
                  {col.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col, colIndex) => (
                <td
                  key={col.key}
                  headers={`col-${col.key}`}
                >
                  {/* Use row header for first column */}
                  {colIndex === 0 ? (
                    <th scope="row">{row[col.key]}</th>
                  ) : (
                    renderCell(col, row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div role="status" aria-live="polite" className="sr-only">
        Showing {data.length} results
      </div>
    </div>
  );
};
```

### Health Score Accessibility

```typescript
// Accessible health score display
const AccessibleHealthScore: React.FC<{ score: number; trend?: string }> = ({
  score,
  trend,
}) => {
  const getScoreDescription = (score: number): string => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'needs attention';
    return 'critical';
  };

  const getTrendDescription = (trend?: string): string => {
    switch (trend) {
      case 'up':
        return 'improving';
      case 'down':
        return 'declining';
      default:
        return 'stable';
    }
  };

  return (
    <div
      className="health-score"
      role="img"
      aria-label={`Health score: ${score} out of 100, ${getScoreDescription(score)}, ${getTrendDescription(trend)}`}
    >
      {/* Visual representation */}
      <svg aria-hidden="true" className="health-gauge">
        <circle cx="50" cy="50" r="45" className="gauge-bg" />
        <circle
          cx="50"
          cy="50"
          r="45"
          className="gauge-fill"
          style={{ strokeDashoffset: 283 - (283 * score) / 100 }}
        />
      </svg>

      <span className="score-number" aria-hidden="true">
        {score}
      </span>

      {trend && (
        <span className="trend-arrow" aria-hidden="true">
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
      )}
    </div>
  );
};
```

### Chart Accessibility

```typescript
// Accessible chart with data table alternative
const AccessibleChart: React.FC<ChartProps> = ({ data, type, title }) => {
  const [showTable, setShowTable] = useState(false);

  const generateSummary = (): string => {
    const max = Math.max(...data.map((d) => d.value));
    const min = Math.min(...data.map((d) => d.value));
    const avg = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    return `${type} chart showing ${title}. Data ranges from ${min} to ${max}, with an average of ${avg.toFixed(1)}. ${data.length} data points.`;
  };

  return (
    <figure role="figure" aria-label={title}>
      <figcaption id="chart-caption">
        <span className="chart-title">{title}</span>
        <span className="sr-only">{generateSummary()}</span>
      </figcaption>

      {/* Toggle between chart and table */}
      <button
        onClick={() => setShowTable(!showTable)}
        aria-pressed={showTable}
        aria-label={showTable ? 'Show chart' : 'Show data table'}
      >
        {showTable ? 'View Chart' : 'View as Table'}
      </button>

      {showTable ? (
        <table aria-labelledby="chart-caption">
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.label}>
                <th scope="row">{point.label}</th>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div aria-hidden="true" className="chart-visual">
          <Chart data={data} type={type} />
        </div>
      )}
    </figure>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Screen reader task completion | 95%+ | User testing |
| Average task time (vs sighted) | Within 2x | Task timing |
| User satisfaction (SR users) | 4/5+ | Surveys |
| Critical bugs for SR | 0 | Issue tracking |

---

## Acceptance Criteria

- [ ] All pages have proper heading hierarchy
- [ ] Landmark regions defined for all pages
- [ ] New chat messages announced
- [ ] Loading states announced
- [ ] Data tables fully navigable
- [ ] Charts have text alternatives
- [ ] Health scores verbally described
- [ ] Custom controls have proper roles
- [ ] Works with JAWS, NVDA, VoiceOver
- [ ] No content announced twice

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Document structure fixes | 2 days |
| Chat accessibility | 3 days |
| Data table improvements | 2 days |
| Chart alternatives | 2 days |
| Live regions setup | 2 days |
| Screen reader testing | 4 days |
| Bug fixes | 3 days |
| **Total** | **18 days** |

---

## Notes

- Recruit screen reader users for testing
- Test with multiple screen readers
- Future: Screen reader specific mode/verbosity
- Future: Braille display testing
- Future: Voice control optimization
