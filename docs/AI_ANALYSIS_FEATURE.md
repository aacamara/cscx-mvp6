# AI Analysis Feature - Complete Documentation

**Version:** MVP6
**Date:** 2026-01-26
**Status:** WORKING

---

## Overview

Claude-powered AI analysis as an alternative to AppScript for analyzing Google Sheets data. Provides intelligent insights, recommendations, alerts, and metrics from customer success data.

---

## Features

### Analysis Types (9 types)

| Type | Description | Use Case |
|------|-------------|----------|
| `health_score` | Analyze customer health scores | Identify at-risk accounts, portfolio health |
| `renewal_risk` | Renewal risk assessment | Prioritize save plays, forecast ARR at risk |
| `usage_trends` | Usage pattern analysis | Spot declining engagement, expansion opportunities |
| `qbr_prep` | QBR preparation | Generate talking points, value summaries |
| `nps_analysis` | NPS score analysis | Identify themes, prioritize follow-ups |
| `weekly_digest` | Weekly portfolio summary | CSM team briefings |
| `adoption_metrics` | Feature adoption analysis | Training needs, power user identification |
| `churn_prediction` | Churn risk signals | Early warning, save play recommendations |
| `custom` | Custom analysis with prompt | Flexible analysis with user-defined questions |

### Export Options (4 formats)

1. **Print / PDF** 📄
   - Beautiful HTML report in new window
   - Browser print dialog for PDF save
   - Styled with CSCX branding
   - Includes all sections with proper formatting

2. **Download CSV** 📊
   - Instant file download
   - Structured sections (summary, insights, alerts, recommendations, metrics)
   - Compatible with Excel, Google Sheets

3. **Save to Google Drive** ☁️
   - Creates Google Doc in user's Drive
   - Full analysis content preserved
   - Direct link to open document

4. **Copy JSON** 📋
   - Raw JSON to clipboard
   - For developers or API integration

---

## Architecture

### Frontend Components

```
/components/AIAnalysis/
├── index.tsx          # Main analysis UI component
│   ├── AIAnalysis     # Full analysis panel with results
│   └── AIAnalysisButton # Modal trigger button

/components/AgentControlCenter/
├── AgentAnalysisActions.tsx  # Agent-specific analysis options
└── WorkspaceDataPanel.tsx    # "Analyze" button on documents
```

### Backend Services

```
/server/src/
├── services/ai/
│   └── sheet-analyzer.ts     # Core Claude analysis service
├── routes/
│   ├── ai-analysis.ts        # Analysis API endpoints
│   └── google/drive.ts       # Drive create-doc endpoint
```

---

## API Endpoints

### GET /api/ai-analysis/types
Returns available analysis types with descriptions and icons.

### POST /api/ai-analysis/analyze
Run AI analysis on a spreadsheet.

**Request:**
```json
{
  "spreadsheetId": "string",
  "sheetName": "string (optional)",
  "analysisType": "health_score|renewal_risk|...",
  "customPrompt": "string (for custom type)",
  "options": {
    "includeRecommendations": true,
    "includeAlerts": true,
    "includeTrends": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysisType": "health_score",
  "summary": "Executive summary...",
  "insights": [
    {
      "title": "Insight title",
      "description": "Details",
      "impact": "high|medium|low",
      "category": "Category"
    }
  ],
  "recommendations": ["Action 1", "Action 2"],
  "alerts": [
    {
      "severity": "critical|warning|info",
      "title": "Alert title",
      "description": "Details",
      "affectedItems": ["item1"],
      "recommendedAction": "What to do"
    }
  ],
  "metrics": {
    "metric_name": "value"
  },
  "generatedAt": "ISO date",
  "dataPoints": 100
}
```

### POST /api/ai-analysis/quick
Quick analysis from spreadsheet URL.

### POST /api/google/drive/create-doc
Create a Google Doc (used for Save to Drive).

---

## User Flow

1. **Access Analysis**
   - Click "🤖 Analyze Data" in Agent Control Center
   - Or click "🤖 Analyze" on any spreadsheet in Workspace panel

2. **Configure Analysis**
   - Enter Google Sheet URL (or use pre-selected sheet)
   - Select analysis type
   - For custom: enter prompt

3. **Run Analysis**
   - Click "Run AI Analysis"
   - Wait for Claude to process (10-30 seconds)

4. **View Results**
   - Summary section
   - Alerts (if any critical issues)
   - Key insights with impact levels
   - Recommendations
   - Metrics dashboard

5. **Export Results**
   - Print/PDF for reports
   - CSV for data
   - Save to Drive for collaboration
   - Copy JSON for integration

---

## Configuration

### Environment Variables

```env
VITE_API_URL=http://localhost:3001
ANTHROPIC_API_KEY=your-api-key
```

### Demo User ID
For development: `df2dc7be-ece0-40b2-a9d7-0f6c45b75131`

---

## Files Modified/Created

### Created
- `/server/src/services/ai/sheet-analyzer.ts`
- `/server/src/routes/ai-analysis.ts`
- `/components/AIAnalysis/index.tsx`
- `/components/AgentControlCenter/AgentAnalysisActions.tsx`

### Modified
- `/server/src/index.ts` - Added ai-analysis route
- `/server/src/routes/google/drive.ts` - Added create-doc endpoint
- `/components/AgentControlCenter/index.tsx` - Added analysis panel
- `/components/AgentControlCenter/WorkspaceDataPanel.tsx` - Added Analyze button

---

## Troubleshooting

### "Analysis failed" error
- Check Google connection status
- Verify spreadsheet ID is valid
- Ensure user has access to the sheet

### "Google Sheets not connected" warning
- Reconnect Google account with Sheets scope
- Check OAuth token validity

### Export issues
- PDF: Allow popups in browser
- Drive: Verify Google connection
- CSV: Check browser download settings

---

## Quick Start

```bash
# Start backend
cd /Users/azizcamara/cscx-v5/server && npm run dev

# Start frontend
cd /Users/azizcamara/cscx-v5 && npx vite --port 3000

# Test API
curl -X POST http://localhost:3001/api/ai-analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{"spreadsheetId": "YOUR_SHEET_ID", "analysisType": "health_score"}'
```

---

## Version History

- **MVP6** (2026-01-26): Added export features (PDF, CSV, Drive), fixed analysis bugs
- **MVP5** (2026-01-24): Initial AI analysis implementation
