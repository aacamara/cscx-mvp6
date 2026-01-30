# PRD-263: Offline Access

## Metadata
- **PRD ID**: PRD-263
- **Title**: Offline Access
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), Service Worker, IndexedDB

---

## Problem Statement

CSMs often work in environments with poor or no connectivity - airplanes, conference centers, customer sites with restricted networks. Currently, CSCX.AI is completely unusable offline, preventing access to critical customer information when it's needed most.

## User Story

> As a CSM, I want to access essential customer information and draft communications offline so that I can prepare for meetings and stay productive during travel, with changes syncing when I'm back online.

---

## Functional Requirements

### FR-1: Offline Data Availability
- **FR-1.1**: Customer profiles cached locally
- **FR-1.2**: Contact information available
- **FR-1.3**: Recent notes and discussions cached
- **FR-1.4**: Upcoming tasks and meetings
- **FR-1.5**: Key documents downloadable for offline

### FR-2: Offline Actions
- **FR-2.1**: Create/edit notes (queue for sync)
- **FR-2.2**: Draft emails (queue for send)
- **FR-2.3**: Add tasks (queue for sync)
- **FR-2.4**: Update contact info (queue for sync)
- **FR-2.5**: Mark tasks complete (queue for sync)

### FR-3: Sync Management
- **FR-3.1**: Automatic background sync when online
- **FR-3.2**: Conflict resolution UI for edits
- **FR-3.3**: Sync status indicator
- **FR-3.4**: Manual sync trigger
- **FR-3.5**: Sync error handling

### FR-4: Storage Management
- **FR-4.1**: Selective sync (priority accounts)
- **FR-4.2**: Storage usage indicator
- **FR-4.3**: Clear cache option
- **FR-4.4**: Auto-cleanup of old data
- **FR-4.5**: Low storage warnings

### FR-5: Offline Indicators
- **FR-5.1**: Clear online/offline status
- **FR-5.2**: Pending changes indicator
- **FR-5.3**: Last sync timestamp
- **FR-5.4**: Data freshness warnings
- **FR-5.5**: Feature availability in offline mode

---

## Non-Functional Requirements

### NFR-1: Performance
- Offline data loads within 500ms

### NFR-2: Storage
- Efficient storage use (< 50MB for typical usage)

### NFR-3: Reliability
- No data loss during offline/online transitions

---

## Technical Approach

### Service Worker Strategy

```typescript
// sw.js - Service Worker
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/offline.html'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // API requests - network first with cache fallback
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful GET responses
          if (event.request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Static assets - cache first
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges());
  }
});
```

### IndexedDB Schema

```typescript
// Database schema for offline storage
const DB_NAME = 'cscx-offline';
const DB_VERSION = 1;

interface OfflineDB {
  customers: {
    key: string;
    value: Customer;
    indexes: { last_synced: Date };
  };
  contacts: {
    key: string;
    value: Stakeholder;
    indexes: { customer_id: string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { customer_id: string; synced: boolean };
  };
  pending_changes: {
    key: string;
    value: PendingChange;
    indexes: { created_at: Date };
  };
  cached_documents: {
    key: string;
    value: { id: string; name: string; blob: Blob; cached_at: Date };
  };
}

interface PendingChange {
  id: string;
  entity_type: 'note' | 'task' | 'contact' | 'email_draft';
  entity_id?: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  created_at: Date;
  sync_status: 'pending' | 'syncing' | 'error';
  error_message?: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Customers store
      const customersStore = db.createObjectStore('customers', { keyPath: 'id' });
      customersStore.createIndex('last_synced', 'last_synced');

      // Contacts store
      const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
      contactsStore.createIndex('customer_id', 'customer_id');

      // Notes store
      const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('customer_id', 'customer_id');
      notesStore.createIndex('synced', 'synced');

      // Pending changes store
      const changesStore = db.createObjectStore('pending_changes', { keyPath: 'id' });
      changesStore.createIndex('created_at', 'created_at');

      // Cached documents store
      db.createObjectStore('cached_documents', { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
```

### Offline Data Manager

```typescript
class OfflineDataManager {
  private db: IDBDatabase;
  private syncInProgress = false;

  // Check online status
  get isOnline(): boolean {
    return navigator.onLine;
  }

  // Initialize offline storage for priority customers
  async initializeOfflineData(userId: string): Promise<void> {
    const priorityCustomers = await this.fetchPriorityCustomers(userId);

    for (const customer of priorityCustomers) {
      await this.cacheCustomer(customer);
      await this.cacheContacts(customer.id);
      await this.cacheNotes(customer.id);
    }
  }

  // Cache customer data
  async cacheCustomer(customer: Customer): Promise<void> {
    const tx = this.db.transaction('customers', 'readwrite');
    await tx.objectStore('customers').put({
      ...customer,
      last_synced: new Date()
    });
  }

  // Get customer (offline-capable)
  async getCustomer(id: string): Promise<Customer | null> {
    if (this.isOnline) {
      try {
        const customer = await api.getCustomer(id);
        await this.cacheCustomer(customer);
        return customer;
      } catch (error) {
        // Fall through to cached data
      }
    }

    const tx = this.db.transaction('customers', 'readonly');
    return tx.objectStore('customers').get(id);
  }

  // Queue change for sync
  async queueChange(change: Omit<PendingChange, 'id' | 'sync_status'>): Promise<void> {
    const pendingChange: PendingChange = {
      ...change,
      id: crypto.randomUUID(),
      sync_status: 'pending'
    };

    const tx = this.db.transaction('pending_changes', 'readwrite');
    await tx.objectStore('pending_changes').add(pendingChange);

    // Request background sync
    if ('serviceWorker' in navigator && 'sync' in registration) {
      await registration.sync.register('sync-pending-changes');
    }
  }

  // Sync pending changes
  async syncPendingChanges(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: false, reason: 'Sync not possible' };
    }

    this.syncInProgress = true;
    const errors: SyncError[] = [];

    try {
      const tx = this.db.transaction('pending_changes', 'readonly');
      const changes = await tx.objectStore('pending_changes').getAll();

      for (const change of changes.sort((a, b) => a.created_at - b.created_at)) {
        try {
          await this.applyChange(change);
          await this.deletePendingChange(change.id);
        } catch (error) {
          errors.push({ change_id: change.id, error: error.message });
          await this.markChangeError(change.id, error.message);
        }
      }

      return { success: errors.length === 0, errors };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Handle conflicts
  async resolveConflict(changeId: string, resolution: 'local' | 'server'): Promise<void> {
    if (resolution === 'local') {
      const change = await this.getPendingChange(changeId);
      await this.forceApplyChange(change);
    }
    await this.deletePendingChange(changeId);
  }
}
```

### UI Components

```typescript
// Offline indicator component
const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`offline-indicator ${isOnline ? 'syncing' : 'offline'}`}>
      {!isOnline && (
        <span>Offline - Changes will sync when connected</span>
      )}
      {isOnline && pendingCount > 0 && (
        <span>Syncing {pendingCount} changes...</span>
      )}
    </div>
  );
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Offline session completion | 80%+ | Session tracking |
| Sync success rate | 99%+ | Sync logs |
| Data freshness acceptance | < 24 hours old | Cache age |
| Conflict resolution rate | 95% auto-resolved | Conflict logs |

---

## Acceptance Criteria

- [ ] Customer profiles accessible offline
- [ ] Notes can be created offline
- [ ] Pending changes visible with count
- [ ] Auto-sync when coming online
- [ ] Conflict resolution UI works
- [ ] Storage usage shown
- [ ] Selective sync configurable
- [ ] Clear cache option works
- [ ] Offline indicator visible
- [ ] No data loss during transitions

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Service worker implementation | 3 days |
| IndexedDB schema & operations | 3 days |
| Offline data manager | 4 days |
| Sync engine | 3 days |
| Conflict resolution | 2 days |
| UI components | 2 days |
| Testing | 3 days |
| **Total** | **20 days** |

---

## Notes

- Consider storage quotas on different browsers
- Add telemetry for offline usage patterns
- Future: AI assistant with limited offline capability
- Future: Predictive caching based on calendar
- Future: Selective document download manager
