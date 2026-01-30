# PRD-265: Quick Actions Widget

## Metadata
- **PRD ID**: PRD-265
- **Title**: Quick Actions Widget
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), PRD-262 (Push Notifications)

---

## Problem Statement

When CSMs need to quickly take an action (check a customer's health, log a note, or respond to an alert), they must open the full app, navigate to the right place, and then act. This friction reduces mobile adoption and slows response times.

## User Story

> As a CSM, I want quick action shortcuts on my mobile home screen so that I can take common actions with minimal taps and without opening the full app.

---

## Functional Requirements

### FR-1: Widget Types
- **FR-1.1**: Single customer quick view widget
- **FR-1.2**: Portfolio overview widget
- **FR-1.3**: Tasks due today widget
- **FR-1.4**: Quick compose widget
- **FR-1.5**: Notification summary widget

### FR-2: Quick Actions
- **FR-2.1**: Log quick note (one tap)
- **FR-2.2**: Check customer health
- **FR-2.3**: Create task
- **FR-2.4**: Start voice note
- **FR-2.5**: Call customer contact

### FR-3: Widget Configuration
- **FR-3.1**: Select which customers to show
- **FR-3.2**: Choose default action
- **FR-3.3**: Widget size options
- **FR-3.4**: Refresh interval setting
- **FR-3.5**: Theme matching (light/dark)

### FR-4: Data Display
- **FR-4.1**: Health score with trend
- **FR-4.2**: Upcoming tasks count
- **FR-4.3**: Pending approvals badge
- **FR-4.4**: Recent activity preview
- **FR-4.5**: At-risk account indicator

### FR-5: Platform Integration
- **FR-5.1**: iOS Home Screen Widgets
- **FR-5.2**: iOS Lock Screen Widgets
- **FR-5.3**: Android Home Screen Widgets
- **FR-5.4**: Android Quick Settings Tile
- **FR-5.5**: PWA shortcut support

---

## Non-Functional Requirements

### NFR-1: Performance
- Widget updates within 15 minutes (background)
- Action launches within 500ms

### NFR-2: Battery
- Minimal background refresh impact

### NFR-3: Offline
- Show cached data when offline

---

## Technical Approach

### iOS Widget Implementation (SwiftUI)

```swift
// iOS Widget Extension
import WidgetKit
import SwiftUI

struct CustomerHealthWidget: Widget {
    let kind: String = "CustomerHealthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HealthProvider()) { entry in
            CustomerHealthView(entry: entry)
        }
        .configurationDisplayName("Customer Health")
        .description("Quick view of customer health scores")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct HealthEntry: TimelineEntry {
    let date: Date
    let customers: [CustomerSummary]
}

struct HealthProvider: TimelineProvider {
    func placeholder(in context: Context) -> HealthEntry {
        HealthEntry(date: Date(), customers: [.placeholder])
    }

    func getSnapshot(in context: Context, completion: @escaping (HealthEntry) -> ()) {
        let entry = HealthEntry(date: Date(), customers: getCachedCustomers())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HealthEntry>) -> ()) {
        Task {
            let customers = await fetchPriorityCustomers()
            let entry = HealthEntry(date: Date(), customers: customers)

            // Refresh every 15 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct CustomerHealthView: View {
    let entry: HealthEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Customer Health")
                .font(.caption)
                .foregroundColor(.secondary)

            ForEach(entry.customers.prefix(3)) { customer in
                HStack {
                    Text(customer.name)
                        .font(.system(.body, design: .rounded))
                        .lineLimit(1)

                    Spacer()

                    HealthScoreBadge(score: customer.healthScore)
                }
            }
        }
        .padding()
        .widgetURL(URL(string: "cscx://customers"))
    }
}

struct HealthScoreBadge: View {
    let score: Int

    var color: Color {
        switch score {
        case 0..<40: return .red
        case 40..<70: return .yellow
        default: return .green
        }
    }

    var body: some View {
        Text("\(score)")
            .font(.caption)
            .fontWeight(.bold)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(4)
    }
}
```

### Android Widget Implementation

```kotlin
// Android AppWidget
class CustomerHealthWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        internal fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.customer_health_widget)

            // Fetch data
            val customers = CachedDataStore.getPriorityCustomers()

            // Update widget views
            views.setTextViewText(R.id.customer_1_name, customers.getOrNull(0)?.name ?: "")
            views.setTextViewText(R.id.customer_1_score, customers.getOrNull(0)?.healthScore?.toString() ?: "")

            // Set click handlers
            val intent = Intent(context, MainActivity::class.java).apply {
                action = "OPEN_CUSTOMERS"
            }
            val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            // Quick action buttons
            val quickNoteIntent = Intent(context, QuickNoteActivity::class.java)
            val quickNotePending = PendingIntent.getActivity(context, 1, quickNoteIntent, PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.quick_note_button, quickNotePending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

// Widget refresh worker
class WidgetRefreshWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val customers = apiService.getPriorityCustomers()
            CachedDataStore.savePriorityCustomers(customers)

            // Update all widgets
            val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
            val ids = appWidgetManager.getAppWidgetIds(
                ComponentName(applicationContext, CustomerHealthWidget::class.java)
            )
            ids.forEach { id ->
                CustomerHealthWidget.updateAppWidget(applicationContext, appWidgetManager, id)
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
```

### PWA Shortcuts (Web)

```json
// manifest.json shortcuts
{
  "shortcuts": [
    {
      "name": "Quick Note",
      "short_name": "Note",
      "description": "Log a quick note",
      "url": "/quick/note?source=shortcut",
      "icons": [{ "src": "/icons/note-96.png", "sizes": "96x96" }]
    },
    {
      "name": "My Tasks",
      "short_name": "Tasks",
      "description": "View today's tasks",
      "url": "/tasks?filter=today&source=shortcut",
      "icons": [{ "src": "/icons/tasks-96.png", "sizes": "96x96" }]
    },
    {
      "name": "Health Check",
      "short_name": "Health",
      "description": "Check portfolio health",
      "url": "/dashboard/health?source=shortcut",
      "icons": [{ "src": "/icons/health-96.png", "sizes": "96x96" }]
    }
  ]
}
```

### Quick Action Handler

```typescript
// Quick action routing
const handleQuickAction = async (action: string, params: Record<string, string>) => {
  switch (action) {
    case 'quick_note':
      return showQuickNoteModal(params.customer_id);

    case 'check_health':
      const health = await getCustomerHealth(params.customer_id);
      return showHealthToast(health);

    case 'create_task':
      return showQuickTaskModal(params.customer_id);

    case 'voice_note':
      return startVoiceNote(params.customer_id);

    case 'call_contact':
      const contact = await getPrimaryContact(params.customer_id);
      return initiateCall(contact.phone);
  }
};

// Quick note modal
const QuickNoteModal: React.FC<{ customerId: string }> = ({ customerId }) => {
  const [note, setNote] = useState('');
  const { mutate: saveNote, isLoading } = useSaveNote();

  const handleSave = () => {
    saveNote({ customer_id: customerId, content: note });
    closeModal();
  };

  return (
    <div className="quick-note-modal">
      <select
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      >
        {priorityCustomers.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Quick note..."
        autoFocus
      />

      <button onClick={handleSave} disabled={isLoading}>
        Save Note
      </button>
    </div>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Widget installation rate | 40% of mobile users | Install tracking |
| Quick action usage | 5+ per user per week | Action tracking |
| Time to action | 50% reduction vs full app | Session comparison |
| User retention | 20% lift for widget users | Cohort analysis |

---

## Acceptance Criteria

- [ ] iOS Home Screen widget installable
- [ ] iOS Lock Screen widget works (iOS 16+)
- [ ] Android widget installable
- [ ] Widget shows real-time customer health
- [ ] Quick note action works from widget
- [ ] Widget respects system theme
- [ ] Data refreshes in background
- [ ] Cached data shown when offline
- [ ] PWA shortcuts configured
- [ ] Deep links open correct views

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| iOS widget extension | 4 days |
| Android widget | 4 days |
| Background refresh | 2 days |
| Quick action handlers | 2 days |
| PWA shortcuts | 1 day |
| Data caching | 2 days |
| Testing | 3 days |
| **Total** | **18 days** |

---

## Notes

- Requires native app for iOS/Android widgets
- Consider widget gallery for user discovery
- Future: Configurable widget sizes
- Future: Interactive widgets (iOS 17+)
- Future: Siri Shortcuts integration
