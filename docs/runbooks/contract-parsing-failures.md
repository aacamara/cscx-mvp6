# Contract Parsing Failures Runbook

**Version**: 1.0
**Last Updated**: 2026-02-02

## Overview

Contract parsing uses Claude/Gemini AI to extract entitlements from uploaded documents (PDF, DOCX, Google Docs). This runbook covers common failure scenarios.

## Architecture

```
Upload → Text Extraction → AI Parsing → Entitlements → HITL Review
         ↓                  ↓
      pdf-parse          Claude (primary)
      mammoth           Gemini (fallback)
```

## Common Failures

### 1. File Upload Fails

**Symptoms**: User sees upload error immediately

**Diagnosis**:
```bash
# Check upload endpoint
curl -X POST https://cscx-api-.../api/contracts/upload \
  -F "file=@test.pdf"
```

**Causes**:
- File too large (>10MB limit)
- Invalid file type (only PDF, DOCX, TXT)
- Storage bucket full/unavailable

**Resolution**:
1. Check Supabase Storage bucket status
2. Verify file size limits in multer config
3. Check storage quotas

### 2. Text Extraction Fails

**Symptoms**: Contract record created but `extracted_text` is empty

**Diagnosis**:
```sql
-- Check contract status
SELECT id, status, error_message
FROM contracts
WHERE status = 'error'
ORDER BY created_at DESC LIMIT 10;
```

**Causes**:
- Corrupted PDF
- Password-protected document
- Scanned PDF with poor OCR quality
- DOCX with complex formatting

**Resolution**:
1. Try re-uploading the file
2. For scanned PDFs, suggest higher quality scan
3. For DOCX, save as plain DOCX without macros
4. Manual text entry as fallback

### 3. AI Parsing Fails

**Symptoms**: Text extracted but no entitlements created

**Diagnosis**:
```bash
# Check circuit breaker status
curl https://cscx-api-.../health | jq '.circuitBreakers'
```

**Causes**:
- Claude API rate limited
- Gemini API unavailable
- Contract text too long (>100k tokens)
- Unusual contract format

**Resolution**:
1. System auto-retries with fallback AI
2. If both fail, check API quotas
3. For very long contracts, split into sections
4. Review AI parsing prompts if format is unusual

### 4. Low Confidence Scores

**Symptoms**: Entitlements extracted but confidence < 0.5

**Causes**:
- Ambiguous contract language
- Missing standard sections
- Non-standard formatting
- Multiple currencies/regions

**Resolution**:
1. Flag for HITL review (automatic)
2. User manually corrects in review UI
3. Consider adding contract type to training data

### 5. Entitlement Save Fails

**Symptoms**: Parsing succeeds but entitlements not in database

**Diagnosis**:
```sql
-- Check entitlements for contract
SELECT * FROM entitlements WHERE contract_id = 'xxx';

-- Check contract parsed_data
SELECT parsed_data FROM contracts WHERE id = 'xxx';
```

**Causes**:
- Database connection error
- Schema mismatch
- Constraint violation

**Resolution**:
1. Check Supabase logs
2. Verify entitlements table schema
3. Reparse contract: `POST /api/contracts/:id/reparse`

## Monitoring

### Key Metrics
- Contract parsing success rate (target: >95%)
- Average parsing time (target: <30s for 50-page doc)
- Confidence score distribution
- HITL review rate

### Alerts
- Parsing failure rate > 10% in 1 hour
- Circuit breaker open for > 5 minutes
- Queue depth > 50 contracts

## Recovery Procedures

### Mass Reprocessing
```bash
# Get failed contracts
curl "https://cscx-api-.../api/contracts?status=error" | jq '.contracts[].id'

# Reparse each
for id in $(contracts); do
  curl -X POST "https://cscx-api-.../api/contracts/$id/reparse"
  sleep 2
done
```

### Schema Migration Issues
1. Check migration status in Supabase
2. Verify all columns exist
3. Run pending migrations
4. Restart Cloud Run service

## Escalation

1. **L1**: Check logs, retry failed contracts
2. **L2**: Review AI prompts, check API quotas
3. **L3**: Schema changes, prompt engineering
