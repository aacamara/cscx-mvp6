# PRD-266: Apple Watch Integration

## Metadata
- **PRD ID**: PRD-266
- **Title**: Apple Watch Integration
- **Category**: J - Mobile & Accessibility
- **Priority**: P3
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-262 (Push Notifications), PRD-264 (Voice Commands), iOS native app

---

## Problem Statement

CSMs in meetings or on the go can't always pull out their phone to check notifications or take quick actions. Important alerts may be missed when the phone is in a bag or on silent. A wearable interface would provide discreet, glanceable access to critical information.

## User Story

> As a CSM, I want to receive critical alerts on my Apple Watch and take quick actions without reaching for my phone so that I can stay responsive during meetings and on the move.

---

## Functional Requirements

### FR-1: Notifications
- **FR-1.1**: Rich notifications with customer context
- **FR-1.2**: Quick reply from notification
- **FR-1.3**: Actionable buttons (approve/dismiss)
- **FR-1.4**: Complication for unread count
- **FR-1.5**: Haptic alerts for critical items

### FR-2: Glanceable Information
- **FR-2.1**: Today's tasks complication
- **FR-2.2**: Portfolio health summary
- **FR-2.3**: Next meeting with customer
- **FR-2.4**: Pending approvals count
- **FR-2.5**: Quick customer lookup

### FR-3: Quick Actions
- **FR-3.1**: Dictate quick note
- **FR-3.2**: Approve/reject pending items
- **FR-3.3**: Mark task complete
- **FR-3.4**: Snooze reminder
- **FR-3.5**: Call customer contact

### FR-4: Watch Complications
- **FR-4.1**: Circular - unread count
- **FR-4.2**: Rectangular - next task preview
- **FR-4.3**: Corner - portfolio health indicator
- **FR-4.4**: Inline - quick status
- **FR-4.5**: Graphic - health trend chart

### FR-5: Siri Integration
- **FR-5.1**: "Hey Siri, check on [customer]"
- **FR-5.2**: "Hey Siri, add note for [customer]"
- **FR-5.3**: "Hey Siri, what's my next meeting?"
- **FR-5.4**: Siri Shortcuts for common actions
- **FR-5.5**: Watch face shortcuts

---

## Non-Functional Requirements

### NFR-1: Performance
- App launch < 2 seconds
- Complication updates every 15 minutes

### NFR-2: Battery
- Minimal battery impact
- Background refresh optimized

### NFR-3: Connectivity
- Works with or without iPhone nearby

---

## Technical Approach

### WatchOS App Architecture

```swift
// Main Watch App
import SwiftUI
import WatchKit

@main
struct CSCXWatchApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var viewModel = WatchViewModel()

    var body: some View {
        NavigationView {
            List {
                // Today's priority
                Section("Priority") {
                    ForEach(viewModel.priorityCustomers) { customer in
                        NavigationLink(destination: CustomerDetailView(customer: customer)) {
                            CustomerRow(customer: customer)
                        }
                    }
                }

                // Tasks due
                Section("Tasks Due") {
                    ForEach(viewModel.tasksDue) { task in
                        TaskRow(task: task)
                    }
                }

                // Quick actions
                Section("Quick Actions") {
                    Button(action: viewModel.startVoiceNote) {
                        Label("Voice Note", systemImage: "mic.fill")
                    }

                    Button(action: viewModel.showApprovals) {
                        Label("Approvals (\(viewModel.pendingCount))", systemImage: "checkmark.circle")
                    }
                }
            }
            .navigationTitle("CSCX")
        }
    }
}

struct CustomerRow: View {
    let customer: CustomerSummary

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(customer.name)
                    .font(.headline)
                    .lineLimit(1)
                Text(customer.stage)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            HealthIndicator(score: customer.healthScore)
        }
    }
}

struct HealthIndicator: View {
    let score: Int

    var color: Color {
        switch score {
        case 0..<40: return .red
        case 40..<70: return .yellow
        default: return .green
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(color)
                .frame(width: 30, height: 30)
            Text("\(score)")
                .font(.caption2)
                .fontWeight(.bold)
                .foregroundColor(.white)
        }
    }
}
```

### Watch Complications

```swift
import ClockKit
import WidgetKit

// Complication provider
struct CSCXComplicationProvider: TimelineProvider {
    typealias Entry = CSCXEntry

    func placeholder(in context: Context) -> CSCXEntry {
        CSCXEntry(date: Date(), pendingCount: 0, nextTask: nil, healthTrend: .stable)
    }

    func getSnapshot(in context: Context, completion: @escaping (CSCXEntry) -> Void) {
        let entry = CSCXEntry(
            date: Date(),
            pendingCount: CachedData.pendingCount,
            nextTask: CachedData.nextTask,
            healthTrend: CachedData.healthTrend
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CSCXEntry>) -> Void) {
        Task {
            let data = await fetchComplicationData()

            let entry = CSCXEntry(
                date: Date(),
                pendingCount: data.pendingCount,
                nextTask: data.nextTask,
                healthTrend: data.healthTrend
            )

            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct CSCXEntry: TimelineEntry {
    let date: Date
    let pendingCount: Int
    let nextTask: TaskSummary?
    let healthTrend: HealthTrend
}

// Complication views for different families
struct CircularComplicationView: View {
    let entry: CSCXEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack {
                Image(systemName: "bell.fill")
                    .font(.caption)
                Text("\(entry.pendingCount)")
                    .font(.headline)
            }
        }
    }
}

struct RectangularComplicationView: View {
    let entry: CSCXEntry

    var body: some View {
        VStack(alignment: .leading) {
            Text("Next Task")
                .font(.caption2)
                .foregroundColor(.secondary)
            if let task = entry.nextTask {
                Text(task.title)
                    .font(.caption)
                    .lineLimit(2)
            } else {
                Text("No tasks due")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}
```

### Notification Handling

```swift
import UserNotifications
import WatchKit

class NotificationController: WKUserNotificationHostingController<NotificationView> {

    var notification: UNNotification?

    override var body: NotificationView {
        NotificationView(notification: notification)
    }

    override func didReceive(_ notification: UNNotification) {
        self.notification = notification

        // Haptic feedback for critical
        if notification.request.content.categoryIdentifier == "CRITICAL" {
            WKInterfaceDevice.current().play(.notification)
        }
    }
}

struct NotificationView: View {
    let notification: UNNotification?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(notification?.request.content.title ?? "")
                .font(.headline)

            Text(notification?.request.content.body ?? "")
                .font(.caption)

            if let customer = extractCustomer(from: notification) {
                HStack {
                    Text(customer.name)
                    Spacer()
                    HealthIndicator(score: customer.healthScore)
                }
                .padding(.top, 4)
            }
        }
    }
}

// Notification category actions
let approvalCategory = UNNotificationCategory(
    identifier: "APPROVAL",
    actions: [
        UNNotificationAction(identifier: "APPROVE", title: "Approve", options: .authenticationRequired),
        UNNotificationAction(identifier: "REJECT", title: "Reject", options: .destructive)
    ],
    intentIdentifiers: []
)
```

### Siri Integration

```swift
import Intents

// Custom intent for checking customer
class CheckCustomerIntentHandler: NSObject, CheckCustomerIntentHandling {

    func handle(intent: CheckCustomerIntent, completion: @escaping (CheckCustomerIntentResponse) -> Void) {
        guard let customerName = intent.customerName else {
            completion(CheckCustomerIntentResponse(code: .failure, userActivity: nil))
            return
        }

        Task {
            if let customer = await findCustomer(name: customerName) {
                let response = CheckCustomerIntentResponse(code: .success, userActivity: nil)
                response.healthScore = customer.healthScore as NSNumber
                response.status = customer.stage
                completion(response)
            } else {
                completion(CheckCustomerIntentResponse(code: .customerNotFound, userActivity: nil))
            }
        }
    }
}

// Intent definition (CheckCustomer.intentdefinition)
// - Parameter: customerName (String)
// - Response: healthScore (Integer), status (String)
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Watch app installs | 30% of iOS users | Install tracking |
| Complication adoption | 50% of watch users | Complication data |
| Quick action usage | 3+ per user per week | Action tracking |
| Notification response time | 30% faster | Response timestamps |

---

## Acceptance Criteria

- [ ] Watch app launches and shows priority customers
- [ ] Complications display on all supported watch faces
- [ ] Notifications appear with customer context
- [ ] Quick approve/reject from notification
- [ ] Voice note dictation works
- [ ] Task completion from watch
- [ ] Siri commands functional
- [ ] Works independently of iPhone
- [ ] Haptic alerts for critical notifications
- [ ] Data syncs with iPhone app

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| WatchOS app structure | 3 days |
| Complications | 3 days |
| Notifications | 2 days |
| Quick actions | 2 days |
| Siri integration | 2 days |
| Data sync | 2 days |
| Testing | 3 days |
| **Total** | **17 days** |

---

## Notes

- Requires iOS native app first
- Consider Wear OS for Android users
- Future: Always-on display optimization
- Future: Fitness integration (meeting step reminders)
- Future: Heart rate alerts during stressful calls
