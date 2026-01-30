# PRD-242: Shared Account Views

## Metadata
- **PRD ID**: PRD-242
- **Title**: Shared Account Views
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Customer data model, User permissions

---

## Problem Statement

When multiple team members need to collaborate on an account (primary CSM, backup CSM, solutions architect, manager), they often work from inconsistent views of the data. There's no way to create a shared, customized view of an account that multiple team members can access with the same filters, columns, and layout.

## User Story

> As a CSM team lead, I want to create and share custom account views with my team so that we can all work from the same context and quickly access the most relevant information for our workflow.

---

## Functional Requirements

### FR-1: View Creation
- **FR-1.1**: Create custom views with selected data fields/columns
- **FR-1.2**: Apply filters (health score range, ARR tier, renewal date, etc.)
- **FR-1.3**: Configure sort order and grouping
- **FR-1.4**: Set default date ranges for metrics
- **FR-1.5**: Name and describe views for easy identification

### FR-2: View Sharing
- **FR-2.1**: Share view with specific team members
- **FR-2.2**: Share view with entire team/department
- **FR-2.3**: Set view permissions (view-only, can edit, can delete)
- **FR-2.4**: Generate shareable link for view
- **FR-2.5**: Transfer view ownership

### FR-3: View Management
- **FR-3.1**: List all views user has access to (owned + shared)
- **FR-3.2**: Favorite/pin frequently used views
- **FR-3.3**: Duplicate existing views as starting point
- **FR-3.4**: Edit shared view (with appropriate permissions)
- **FR-3.5**: Archive/delete views

### FR-4: Real-time Sync
- **FR-4.1**: Changes to shared view reflect for all users
- **FR-4.2**: Show "last updated by" information
- **FR-4.3**: Conflict resolution for simultaneous edits
- **FR-4.4**: Version history for view configurations

---

## Non-Functional Requirements

### NFR-1: Performance
- View loading time < 2 seconds for up to 1000 accounts
- Real-time sync within 1 second

### NFR-2: Scalability
- Support up to 100 custom views per user
- Support sharing with up to 50 team members per view

### NFR-3: Data Consistency
- All shared view users see identical data (no stale cache)

---

## Technical Approach

### Data Model Extensions

```sql
-- account_views table
CREATE TABLE account_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) NOT NULL,
  configuration JSONB NOT NULL, -- columns, filters, sort, grouping
  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  view_type VARCHAR(50) DEFAULT 'custom', -- 'system', 'custom', 'template'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- view_shares table
CREATE TABLE view_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID REFERENCES account_views(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id),
  shared_with_team_id UUID REFERENCES teams(id),
  permission VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
  shared_by_user_id UUID REFERENCES users(id),
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- view_favorites table
CREATE TABLE view_favorites (
  user_id UUID REFERENCES users(id),
  view_id UUID REFERENCES account_views(id),
  favorited_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, view_id)
);

-- view_history table (for version control)
CREATE TABLE view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID REFERENCES account_views(id) ON DELETE CASCADE,
  configuration JSONB NOT NULL,
  changed_by_user_id UUID REFERENCES users(id),
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_view_shares_user ON view_shares(shared_with_user_id);
CREATE INDEX idx_view_shares_team ON view_shares(shared_with_team_id);
```

### Configuration Schema

```typescript
interface ViewConfiguration {
  columns: {
    field: string;
    width?: number;
    visible: boolean;
    order: number;
  }[];
  filters: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: any;
  }[];
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  groupBy?: string;
  dateRange?: {
    preset: 'today' | '7d' | '30d' | '90d' | 'custom';
    start?: string;
    end?: string;
  };
}
```

### API Endpoints

```typescript
// CRUD for views
GET    /api/views
POST   /api/views
GET    /api/views/:id
PATCH  /api/views/:id
DELETE /api/views/:id

// Sharing
POST   /api/views/:id/share
DELETE /api/views/:id/share/:shareId
GET    /api/views/:id/shares

// Favorites
POST   /api/views/:id/favorite
DELETE /api/views/:id/favorite

// History
GET    /api/views/:id/history
POST   /api/views/:id/restore/:historyId
```

### UI Components

```typescript
// ViewBuilder.tsx - Create/edit view configuration
// ViewSelector.tsx - Dropdown to switch between views
// ShareViewModal.tsx - Share view with team members
// ViewPermissions.tsx - Manage view access
// ViewHistory.tsx - View version history
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Shared view adoption | 40% of CSMs use shared views | Analytics |
| Views created per user | Average 3+ views | Database |
| Collaboration improvement | 25% more cross-user account activity | Activity logs |
| Time to find information | 30% reduction | User surveys |

---

## Acceptance Criteria

- [ ] User can create custom view with columns, filters, and sort
- [ ] User can save and name their view
- [ ] User can share view with specific team members
- [ ] Shared users see same data in same layout
- [ ] User can set permissions (view/edit) on shares
- [ ] User can favorite views for quick access
- [ ] User can duplicate existing view
- [ ] Changes to shared views sync in real-time
- [ ] View history shows who made changes and when

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 1 day |
| API endpoints | 3 days |
| View builder UI | 4 days |
| Sharing system | 2 days |
| Real-time sync | 2 days |
| Testing | 2 days |
| **Total** | **14 days** |

---

## Notes

- Consider pre-built view templates for common use cases
- Add "view as" feature for managers to see team member perspectives
- Future: AI-suggested views based on role and portfolio
- Future: Embed views in external dashboards
