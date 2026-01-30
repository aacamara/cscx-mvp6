# PRD-268: Location-Based Reminders

## Metadata
- **PRD ID**: PRD-268
- **Title**: Location-Based Reminders
- **Category**: J - Mobile & Accessibility
- **Priority**: P3
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-262 (Push Notifications), Geolocation API, Customer addresses

---

## Problem Statement

CSMs visiting customer sites miss preparation opportunities. They arrive without reviewing recent account activity or forget to log visit notes afterward. Time-based reminders don't work well for variable schedules, but location awareness could trigger contextually relevant prompts.

## User Story

> As a CSM, I want to receive contextual reminders when I arrive at or leave a customer's location so that I'm prepared for meetings and capture notes while context is fresh.

---

## Functional Requirements

### FR-1: Location Configuration
- **FR-1.1**: Store customer office addresses
- **FR-1.2**: Set geofence radius (default 500m)
- **FR-1.3**: Enable/disable per customer
- **FR-1.4**: Multiple locations per customer
- **FR-1.5**: Detect home/office for CSM (exclude)

### FR-2: Arrival Triggers
- **FR-2.1**: Trigger reminder when entering geofence
- **FR-2.2**: Show customer brief/key info
- **FR-2.3**: Display pending action items
- **FR-2.4**: Show stakeholder contact info
- **FR-2.5**: Quick call/message shortcuts

### FR-3: Departure Triggers
- **FR-3.1**: Trigger prompt when leaving geofence
- **FR-3.2**: Prompt to log visit notes
- **FR-3.3**: Create follow-up tasks
- **FR-3.4**: Update last contact date
- **FR-3.5**: Schedule next meeting

### FR-4: Privacy Controls
- **FR-4.1**: Opt-in for location tracking
- **FR-4.2**: Pause location tracking
- **FR-4.3**: View/delete location history
- **FR-4.4**: Precise vs approximate location
- **FR-4.5**: Battery optimization options

### FR-5: Smart Features
- **FR-5.1**: Detect frequent visit patterns
- **FR-5.2**: Travel time estimation
- **FR-5.3**: Nearby customer suggestions
- **FR-5.4**: Calendar integration for visits
- **FR-5.5**: Auto-detect unplanned visits

---

## Non-Functional Requirements

### NFR-1: Battery
- Minimal battery impact from geofencing

### NFR-2: Privacy
- Location data encrypted, not stored long-term

### NFR-3: Reliability
- Geofence triggers within 5 minutes of crossing

---

## Technical Approach

### Geofencing Setup

```typescript
// Geofence configuration
interface Geofence {
  id: string;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
  is_active: boolean;
}

// Native geofencing (React Native)
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';

class GeofenceManager {
  private activeGeofences: Map<string, Geofence> = new Map();

  async initialize(): Promise<void> {
    // Configure background location
    await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 100, // meters
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,

      // Geofencing
      geofenceProximityRadius: 1000,
      geofenceInitialTriggerEntry: true,
    });

    // Listen for geofence events
    BackgroundGeolocation.onGeofence(this.handleGeofenceEvent);
  }

  async addGeofence(geofence: Geofence): Promise<void> {
    await BackgroundGeolocation.addGeofence({
      identifier: geofence.id,
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radius: geofence.radius,
      notifyOnEntry: geofence.trigger_on_enter,
      notifyOnExit: geofence.trigger_on_exit,
      extras: {
        customer_id: geofence.customer_id,
        customer_name: geofence.customer_name,
      },
    });

    this.activeGeofences.set(geofence.id, geofence);
  }

  private handleGeofenceEvent = async (event: GeofenceEvent) => {
    const { identifier, action, extras } = event;

    if (action === 'ENTER') {
      await this.handleArrival(extras.customer_id);
    } else if (action === 'EXIT') {
      await this.handleDeparture(extras.customer_id);
    }
  };

  private async handleArrival(customerId: string): Promise<void> {
    // Get customer brief
    const brief = await getCustomerBrief(customerId);

    // Show notification
    await showLocalNotification({
      title: `Arriving at ${brief.customer_name}`,
      body: `Health: ${brief.health_score} | ${brief.open_tasks} tasks pending`,
      data: { type: 'arrival', customer_id: customerId },
      actions: [
        { id: 'view', title: 'View Brief' },
        { id: 'dismiss', title: 'Dismiss' },
      ],
    });

    // Log arrival (for visit tracking)
    await logVisitEvent({
      customer_id: customerId,
      event_type: 'arrival',
      timestamp: new Date(),
    });
  }

  private async handleDeparture(customerId: string): Promise<void> {
    const visit = await getActiveVisit(customerId);
    if (!visit) return;

    // Show departure prompt
    await showLocalNotification({
      title: `Leaving ${visit.customer_name}`,
      body: 'Tap to log visit notes',
      data: { type: 'departure', customer_id: customerId, visit_id: visit.id },
      actions: [
        { id: 'log_notes', title: 'Log Notes' },
        { id: 'skip', title: 'Skip' },
      ],
    });

    // Auto-update last contact
    await updateLastContactDate(customerId);
  }
}
```

### Data Model

```sql
-- customer_locations table
CREATE TABLE customer_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  label VARCHAR(200), -- 'HQ', 'NYC Office', etc.
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geofence_radius INTEGER DEFAULT 500, -- meters
  is_primary BOOLEAN DEFAULT false,
  geofence_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- csm_location_preferences
CREATE TABLE csm_location_preferences (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  location_tracking_enabled BOOLEAN DEFAULT false,
  arrival_notifications BOOLEAN DEFAULT true,
  departure_notifications BOOLEAN DEFAULT true,
  geofence_radius_default INTEGER DEFAULT 500,
  excluded_locations JSONB DEFAULT '[]', -- Home, personal locations
  battery_optimization VARCHAR(20) DEFAULT 'balanced', -- 'low', 'balanced', 'high'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- visit_logs table
CREATE TABLE visit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  location_id UUID REFERENCES customer_locations(id),
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  follow_up_tasks JSONB DEFAULT '[]',
  is_planned BOOLEAN DEFAULT false, -- Was it on calendar?
  calendar_event_id VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_locations ON customer_locations(customer_id);
CREATE INDEX idx_visit_logs_user ON visit_logs(user_id, arrival_time DESC);
CREATE INDEX idx_visit_logs_customer ON visit_logs(customer_id);
```

### Visit Notes Flow

```typescript
// Visit notes capture UI
const VisitNotesModal: React.FC<{
  customerId: string;
  visitId: string;
  onComplete: () => void;
}> = ({ customerId, visitId, onComplete }) => {
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [voiceRecording, setVoiceRecording] = useState<string | null>(null);

  const handleSave = async () => {
    // Save visit log
    await updateVisitLog(visitId, {
      notes,
      follow_up_tasks: tasks,
      departure_time: new Date(),
    });

    // Create tasks
    for (const task of tasks) {
      await createTask({
        customer_id: customerId,
        title: task.title,
        due_date: task.due_date,
        created_from: 'visit_notes',
        visit_log_id: visitId,
      });
    }

    // Transcribe voice if recorded
    if (voiceRecording) {
      const transcription = await transcribeAudio(voiceRecording);
      await appendToVisitNotes(visitId, transcription);
    }

    onComplete();
  };

  return (
    <Modal>
      <View style={styles.container}>
        <Text style={styles.title}>Visit to {customer.name}</Text>
        <Text style={styles.duration}>Duration: {formatDuration(visit.duration)}</Text>

        <TextInput
          multiline
          placeholder="How did the visit go?"
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
        />

        <VoiceNoteButton
          onRecording={setVoiceRecording}
          label="Or record voice notes"
        />

        <QuickTaskAdder
          tasks={tasks}
          onAddTask={(task) => setTasks([...tasks, task])}
          onRemoveTask={(index) => setTasks(tasks.filter((_, i) => i !== index))}
        />

        <Button title="Save & Close" onPress={handleSave} />
        <Button title="Skip" onPress={onComplete} variant="secondary" />
      </View>
    </Modal>
  );
};
```

### Privacy Controls

```typescript
// Location privacy settings
const LocationPrivacySettings: React.FC = () => {
  const [preferences, setPreferences] = useState<LocationPreferences>();
  const [locationHistory, setLocationHistory] = useState<LocationEvent[]>([]);

  const handleToggleTracking = async (enabled: boolean) => {
    if (enabled) {
      // Request permission
      const status = await requestLocationPermission();
      if (status !== 'granted') return;

      await GeofenceManager.start();
    } else {
      await GeofenceManager.stop();
    }

    setPreferences({ ...preferences, location_tracking_enabled: enabled });
    await savePreferences(preferences);
  };

  const handleClearHistory = async () => {
    await api.deleteLocationHistory();
    setLocationHistory([]);
  };

  return (
    <View>
      <SectionHeader>Location-Based Reminders</SectionHeader>

      <SettingRow
        label="Enable Location Tracking"
        description="Receive reminders when arriving/leaving customer sites"
        value={preferences?.location_tracking_enabled}
        onToggle={handleToggleTracking}
      />

      <SettingRow
        label="Arrival Notifications"
        value={preferences?.arrival_notifications}
        onToggle={(v) => updatePreference('arrival_notifications', v)}
        disabled={!preferences?.location_tracking_enabled}
      />

      <SettingRow
        label="Departure Prompts"
        value={preferences?.departure_notifications}
        onToggle={(v) => updatePreference('departure_notifications', v)}
        disabled={!preferences?.location_tracking_enabled}
      />

      <TouchableOpacity onPress={handleClearHistory}>
        <Text style={styles.link}>Clear Location History</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Your location is only used to trigger reminders and is not stored on our servers.
      </Text>
    </View>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature opt-in rate | 30% of mobile users | Preference tracking |
| Visit notes logged | 70% of detected visits | Visit log completion |
| Prep time improvement | 50% view brief on arrival | Notification clicks |
| Battery impact | < 5% additional drain | User reports |

---

## Acceptance Criteria

- [ ] Customer locations can be added/edited
- [ ] Geofences trigger on arrival/departure
- [ ] Arrival notification shows customer brief
- [ ] Departure prompts for visit notes
- [ ] Visit notes can be logged easily
- [ ] Quick tasks created from notes
- [ ] Location tracking is opt-in
- [ ] Location history can be deleted
- [ ] Works with app in background
- [ ] Minimal battery impact

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Geofencing setup | 3 days |
| Background location | 2 days |
| Arrival notifications | 2 days |
| Visit notes UI | 2 days |
| Privacy controls | 2 days |
| API endpoints | 2 days |
| Testing | 3 days |
| **Total** | **16 days** |

---

## Notes

- Requires native app for reliable background geofencing
- Consider significant location changes API for lower battery
- Future: Predict visit duration based on history
- Future: Suggest optimal visit times
- Future: Route optimization for multiple visits
