# AI Analysis Feature - Debug Log

**Date:** 2026-01-24
**Updated:** 2026-01-26
**Status:** ✅ RESOLVED - All features working

---

## Overview

Added Claude-powered AI analysis as an alternative to AppScript for analyzing Google Sheets data. The feature allows users to run various analysis types (health score, renewal risk, usage trends, etc.) on their spreadsheets.

---

## What Was Built

### Backend Files Created

1. **`/server/src/services/ai/sheet-analyzer.ts`**
   - Claude-powered sheet analysis service
   - Fetches data from Google Sheets via `sheetsService`
   - Sends data to Claude for analysis
   - Returns structured insights, recommendations, alerts, metrics

2. **`/server/src/routes/ai-analysis.ts`**
   - API endpoints for AI analysis
   - `GET /api/ai-analysis/types` - List available analysis types
   - `POST /api/ai-analysis/analyze` - Run analysis on a spreadsheet
   - `POST /api/ai-analysis/quick` - Quick analysis from URL
   - Uses demo user fallback: `df2dc7be-ece0-40b2-a9d7-0f6c45b75131`

### Frontend Files Created

1. **`/components/AIAnalysis/index.tsx`**
   - Main analysis UI component
   - Analysis type selector
   - Spreadsheet URL input
   - Results display (summary, insights, alerts, recommendations, metrics)
   - Workspace status check (shows warning if sheets scope missing)

2. **`/components/AgentControlCenter/AgentAnalysisActions.tsx`**
   - Agent-specific analysis actions per specialist type
   - Sheet picker modal for selecting data source
   - Context-aware: shows customer sheets or URL input

### Files Modified

1. **`/server/src/index.ts`** - Added ai-analysis route
2. **`/components/AgentControlCenter/index.tsx`** - Added AgentAnalysisActions, showAnalysisPanel state
3. **`/components/AgentControlCenter/WorkspaceDataPanel.tsx`** - Added "Analyze" button on documents

---

## Analysis Types Supported

| Type | Description |
|------|-------------|
| `health_score` | Analyze customer health scores, identify at-risk accounts |
| `renewal_risk` | Identify upcoming renewals, assess risk levels |
| `usage_trends` | Analyze product usage patterns |
| `qbr_prep` | Generate QBR insights and talking points |
| `nps_analysis` | Analyze NPS scores and feedback themes |
| `weekly_digest` | Weekly portfolio summary |
| `adoption_metrics` | Feature adoption analysis |
| `churn_prediction` | Identify churn risk signals |
| `custom` | Custom analysis with user prompt |

---

## What Works (Verified via curl)

### 1. Analysis Types Endpoint
```bash
curl -s http://localhost:3001/api/ai-analysis/types
# Returns list of 9 analysis types with descriptions
```

### 2. Full Analysis Flow (via curl)
```bash
curl -s -X POST http://localhost:3001/api/ai-analysis/analyze \
  -H "Content-Type: application/json" \
  -H "x-user-id: df2dc7be-ece0-40b2-a9d7-0f6c45b75131" \
  -d '{"spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", "analysisType": "health_score"}'
```

**Result:** Successfully returned analysis with:
- `success: true`
- `summary`: Claude's analysis summary
- `insights`: Array of insights with impact levels
- `recommendations`: Array of actionable items
- `alerts`: Array with severity levels
- `metrics`: Key metrics extracted
- `dataPoints`: 30 (rows analyzed)

### 3. Google Sheets Connection
- User `df2dc7be-ece0-40b2-a9d7-0f6c45b75131` IS connected to Google
- Email: azizcamara2@gmail.com
- Services: gmail ✓, calendar ✓, drive ✓

---

## What's NOT Working

### Browser UI Analysis Failing

The analysis works via curl but fails in the browser UI. Possible causes:

1. **User ID not being sent correctly from frontend**
   - Frontend uses `localStorage.getItem('userId')`
   - May be empty or different from demo user ID

2. **CORS or headers issue**
   - Browser may be stripping headers differently than curl

3. **Different spreadsheet being tested**
   - curl test used a public Google sample sheet
   - Browser may be using a different/inaccessible sheet

---

## Bugs Fixed During Session

### 1. Wrong Method Name
**File:** `/server/src/services/ai/sheet-analyzer.ts`
**Issue:** Called `sheetsService.getSheetData()` which doesn't exist
**Fix:** Changed to `sheetsService.getValues()`

```javascript
// Before (wrong)
const data = await sheetsService.getSheetData(userId, spreadsheetId, range);

// After (correct)
const sheetData = await sheetsService.getValues(userId, spreadsheetId, range);
```

### 2. Wrong Property Access for Sheet Name
**File:** `/server/src/services/ai/sheet-analyzer.ts`
**Issue:** Accessed `s.properties?.title` but sheets array has `title` directly
**Fix:** Changed to `s.title`

```javascript
// Before (wrong)
const targetSheet = sheets.find((s: any) => s.properties?.title === sheetName);
const actualSheetName = targetSheet?.properties?.title || 'Sheet1';

// After (correct)
const targetSheet = sheets.find((s: any) => s.title === sheetName);
const actualSheetName = targetSheet?.title || 'Sheet1';
```

### 3. Better Error Messages
Added helpful error messages for common issues:
- "Google Workspace not connected"
- "Spreadsheet not found"
- "Permission denied"

---

## How to Debug Further

### 1. Check Browser Console
Open DevTools and look for:
- Network tab: Check the POST to `/api/ai-analysis/analyze`
- Request headers: Verify `x-user-id` is present
- Response: Check exact error message

### 2. Check What User ID is Being Sent
```javascript
// In browser console
console.log(localStorage.getItem('userId'));
```

### 3. Test with Browser's User ID
```bash
# Replace USER_ID with value from browser console
curl -s -X POST http://localhost:3001/api/ai-analysis/analyze \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_ID" \
  -d '{"spreadsheetId": "SPREADSHEET_ID", "analysisType": "health_score"}'
```

### 4. Check Server Logs
```bash
tail -f /tmp/backend.log
```

---

## Files to Review

1. `/components/AIAnalysis/index.tsx` - Lines 120-153 (handleAnalyze function)
2. `/server/src/routes/ai-analysis.ts` - Lines 24-82 (analyze endpoint)
3. `/server/src/services/ai/sheet-analyzer.ts` - Lines 151-195 (fetchSheetData)

---

## Environment Notes

- **Frontend Port:** 3000
- **Backend Port:** 3001
- **Demo User ID:** `df2dc7be-ece0-40b2-a9d7-0f6c45b75131`
- **Test Spreadsheet:** `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` (Google sample)

---

## Quick Start Commands

```bash
# Start backend
cd /Users/azizcamara/cscx-v5/server && npm run dev

# Start frontend (from root)
cd /Users/azizcamara/cscx-v5 && npx vite --port 3000

# Or use separate terminals
```

---

## Next Steps to Fix

1. Add console.log in frontend to see what user ID is being sent
2. Add console.log in backend to see what's being received
3. Compare browser request vs curl request
4. Check if the spreadsheet ID from the UI is valid
5. Possibly need to ensure localStorage has the correct userId set
