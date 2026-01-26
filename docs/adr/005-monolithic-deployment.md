# ADR-005: Monolithic Frontend+Backend Deployment

## Status
Accepted

## Context

Modern web apps often separate frontend and backend deployments:
- Frontend on Vercel/Netlify (static hosting)
- Backend on Cloud Run/Railway (API server)

This adds complexity: CORS configuration, multiple deployments, environment sync.

For an MVP, we optimized for simplicity.

## Decision

We chose **monolithic deployment**: Express serves both API and static frontend.

**Structure:**
```
server/
├── src/           # Backend TypeScript
├── public/        # Built frontend (copied from dist/)
└── Dockerfile     # Single container
```

**Build process:**
1. `npm run build` in root - Builds React frontend to `dist/`
2. Copy `dist/*` to `server/public/`
3. Deploy `server/` to Cloud Run

**Express configuration:**
```typescript
// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/agents', agentRoutes);
app.use('/api/ai', langchainRoutes);
// ...

// SPA fallback - serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
```

## Consequences

**Benefits:**
- Single deployment (one Cloud Run service)
- No CORS issues (same origin)
- Simpler CI/CD (one build, one deploy)
- Easier local development
- Lower cost (one service vs two)

**Drawbacks:**
- Frontend changes require full redeploy
- Can't scale frontend/backend independently
- Static assets served by Node (not edge CDN)
- Build process requires copying files

**When to split:**
- Traffic exceeds single Cloud Run instance capacity
- Need edge caching for static assets globally
- Frontend and backend teams work independently

**For MVP, monolithic is correct.** Don't split prematurely.

## Metadata
- **Subsystem:** deployment
- **Key files:**
  - `server/src/index.ts` (static serving config)
  - `server/public/` (built frontend)
  - `cloudbuild.yaml` (deployment config)
- **Related ADRs:** ADR-006
