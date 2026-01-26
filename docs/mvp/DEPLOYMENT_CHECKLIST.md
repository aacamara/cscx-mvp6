# CSCX.AI MVP Deployment Checklist

Use this checklist to deploy the MVP to production with paying customers.

---

## Pre-Deployment

### Code Ready
- [ ] Test full flow locally (upload → parse → handoff → agents)
- [ ] Verify Gemini API works with your key
- [ ] Check no console errors in browser
- [ ] Backend health check returns OK: `curl http://localhost:3001/health`

### Environment
- [ ] Create production Gemini API key (not dev key)
- [ ] Set up Supabase project (optional but recommended)
- [ ] Choose hosting: Netlify + Railway (recommended) or GCP

---

## Deployment Steps

### Step 1: Backend Deployment

**Option A: Railway (Easiest)**
```bash
# 1. Push server folder to GitHub
# 2. Connect Railway to GitHub repo
# 3. Set environment variables in Railway dashboard:
#    - NODE_ENV=production
#    - PORT=8080
#    - GEMINI_API_KEY=xxx
#    - CORS_ORIGIN=https://your-frontend.netlify.app
# 4. Deploy
```

**Option B: Render**
```bash
# 1. Create new Web Service
# 2. Connect to GitHub
# 3. Build command: cd server && npm install && npm run build
# 4. Start command: cd server && npm start
# 5. Set environment variables
```

**Option C: Google Cloud Run**
```bash
cd server
gcloud run deploy cscx-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,GEMINI_API_KEY=xxx"
```

**Verify Backend:**
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"ok",...}
```

- [ ] Backend deployed and health check passes

### Step 2: Frontend Deployment

**Option A: Netlify (Easiest)**
```bash
# 1. Build
npm run build

# 2. Create .env.production
echo "VITE_API_URL=https://your-backend-url.com" > .env.production

# 3. Rebuild with production env
npm run build

# 4. Deploy
netlify deploy --prod --dir=dist
```

**Option B: Vercel**
```bash
vercel --prod
# Set VITE_API_URL in Vercel dashboard
```

**Verify Frontend:**
- [ ] Opens without errors
- [ ] Contract upload works
- [ ] Parsing completes
- [ ] Handoff screen appears
- [ ] Agents receive full context

### Step 3: Domain Setup (Optional)

```bash
# Netlify
netlify domains:add yourdomain.com

# Or use custom domain in dashboard
```

- [ ] Custom domain configured (optional)
- [ ] SSL certificate active

---

## Post-Deployment Verification

### Critical Path Test
1. [ ] Open production URL
2. [ ] Upload sample contract
3. [ ] Verify parsing extracts correct data
4. [ ] Verify plan generates
5. [ ] Click "Deploy Agents"
6. [ ] Send a message to agent
7. [ ] Verify agent responds with context
8. [ ] Test approval flow

### Edge Cases
- [ ] Test with large contract (10+ pages)
- [ ] Test with minimal contract
- [ ] Test network disconnection handling
- [ ] Test browser refresh during flow

---

## Production Monitoring

### Basic Monitoring (Free)
- [ ] Set up Netlify/Vercel error alerts
- [ ] Enable Railway/Render logs
- [ ] Add error tracking (optional: Sentry)

### Health Checks
```bash
# Add to cron or monitoring service
curl https://your-api.com/health
```

---

## Quick Reference

### Environment Variables

**Frontend (.env.production)**
```
VITE_API_URL=https://your-backend.railway.app
VITE_GEMINI_API_KEY=AIza...  # Only if using frontend parsing
```

**Backend (Railway/Render)**
```
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=AIza...
CORS_ORIGIN=https://your-frontend.netlify.app
SUPABASE_URL=https://xxx.supabase.co       # Optional
SUPABASE_SERVICE_KEY=xxx                    # Optional
```

### URLs to Configure

| Component | Local | Production |
|-----------|-------|------------|
| Frontend | http://localhost:5173 | https://cscx.netlify.app |
| Backend | http://localhost:3001 | https://cscx-api.railway.app |
| Supabase | - | https://xxx.supabase.co |

### Commands

```bash
# Local development
cd cscx-mvp && npm run dev          # Frontend
cd cscx-mvp/server && npm run dev   # Backend

# Build for production
npm run build                        # Frontend
cd server && npm run build          # Backend

# Deploy
netlify deploy --prod --dir=dist    # Frontend
git push railway main               # Backend (if using Railway CLI)
```

---

## Rollback Plan

If something goes wrong:

### Frontend (Netlify)
```bash
# List deploys
netlify deploys

# Rollback to previous
netlify rollback
```

### Backend (Railway)
- Use Railway dashboard to redeploy previous version

### Database (Supabase)
- Supabase has automatic backups
- Use dashboard to restore

---

## Launch Day Checklist

- [ ] All tests passing
- [ ] Backend deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Full user flow tested on production
- [ ] Error tracking enabled
- [ ] Team has access to monitoring
- [ ] Support channel ready (email/chat)

---

## Estimated Costs (Monthly)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Netlify | 100GB bandwidth | $19/mo |
| Railway | $5 credit | ~$5-20/mo |
| Supabase | 500MB, 50K auth | $25/mo |
| Gemini | Free tier | Pay per use |

**MVP Total: $0-50/month** depending on usage

---

## Getting Help

- Gemini API: https://ai.google.dev/docs
- Netlify: https://docs.netlify.com
- Railway: https://docs.railway.app
- Supabase: https://supabase.com/docs
