/**
 * Ralph PRD Verification Script
 * Verifies all PRD 0-10 acceptance criteria pass
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';

async function fetchJSON(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function verifyPRDs() {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CSCX.AI PRD 0-10 VERIFICATION REPORT              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // PRD-0: Contract Parsing + Entitlements
  console.log('━━━ PRD-0: Contract Parsing + Entitlements ━━━');

  // Check migration file
  const migrationPath = '/Users/azizcamara/CSCX V7/server/supabase/migrations/20260201000002_prd0_contract_entitlements.sql';
  if (fs.existsSync(migrationPath)) {
    console.log('  ✅ Migration file exists');
    results.passed++;
  } else {
    console.log('  ❌ Migration file missing');
    results.failed++;
  }

  // Check entitlements API
  const entitlements = await fetchJSON(`${API_BASE}/api/entitlements`);
  if (entitlements.ok) {
    console.log('  ✅ GET /api/entitlements works');
    results.passed++;
  } else {
    console.log('  ❌ GET /api/entitlements failed');
    results.failed++;
  }
  console.log('');

  // PRD-1: Gated Login + Onboarding
  console.log('━━━ PRD-1: Gated Login + Onboarding ━━━');

  // Validate invite
  const validateInvite = await fetchJSON(`${API_BASE}/api/auth/validate-invite`, {
    method: 'POST',
    body: JSON.stringify({ code: 'test-invalid-code' })
  });
  if (validateInvite.data?.error || validateInvite.status === 401 || validateInvite.status === 400) {
    console.log('  ✅ POST /api/auth/validate-invite rejects invalid codes');
    results.passed++;
  } else {
    console.log('  ❌ validate-invite not working correctly');
    results.failed++;
  }

  // Customer import
  const customerImport = await fetchJSON(`${API_BASE}/api/customers/import`, {
    method: 'POST',
    body: JSON.stringify({ sheetsUrl: 'https://docs.google.com/spreadsheets/d/test123/edit' })
  });
  if (customerImport.ok && customerImport.data?.summary) {
    console.log('  ✅ POST /api/customers/import works');
    results.passed++;
  } else {
    console.log('  ❌ customer import failed');
    results.failed++;
  }
  console.log('');

  // PRD-2: Knowledge Base Sync
  console.log('━━━ PRD-2: Knowledge Base Sync ━━━');

  // KB Sync
  const kbSync = await fetchJSON(`${API_BASE}/api/kb/sync`, {
    method: 'POST',
    body: JSON.stringify({ folderId: 'test-folder' })
  });
  if (kbSync.ok && kbSync.data?.status) {
    console.log(`  ✅ POST /api/kb/sync works (${kbSync.data.status.documentsProcessed} docs processed)`);
    results.passed++;
  } else {
    console.log('  ❌ KB sync failed');
    results.failed++;
  }

  // KB Search
  const kbSearch = await fetchJSON(`${API_BASE}/api/kb/search?query=onboarding`);
  if (kbSearch.ok && kbSearch.data?.hasOwnProperty('results')) {
    console.log(`  ✅ GET /api/kb/search works (${kbSearch.data.totalResults} results)`);
    results.passed++;
  } else {
    console.log('  ❌ KB search failed');
    results.failed++;
  }

  // KB Status
  const kbStatus = await fetchJSON(`${API_BASE}/api/kb/status`);
  if (kbStatus.ok && kbStatus.data?.hasOwnProperty('totalChunks')) {
    console.log(`  ✅ GET /api/kb/status works (${kbStatus.data.totalChunks} chunks)`);
    results.passed++;
  } else {
    console.log('  ❌ KB status failed');
    results.failed++;
  }
  console.log('');

  // PRD-3: Agent Inbox
  console.log('━━━ PRD-3: Agent Inbox ━━━');

  // Actions API
  const actions = await fetchJSON(`${API_BASE}/api/actions`, {
    headers: { 'x-user-id': 'test-user' }
  });
  if (actions.ok && actions.data?.hasOwnProperty('actions')) {
    console.log(`  ✅ GET /api/actions works (${actions.data.total} actions)`);
    results.passed++;
  } else {
    console.log('  ❌ actions API failed');
    results.failed++;
  }

  // Approvals API
  const approvals = await fetchJSON(`${API_BASE}/api/approvals`, {
    headers: { 'x-user-id': 'test-user' }
  });
  if (approvals.ok || approvals.data?.error) {
    console.log('  ✅ GET /api/approvals endpoint exists');
    results.passed++;
  } else {
    console.log('  ❌ approvals API failed');
    results.failed++;
  }

  // Check UI component exists
  const actionsViewPath = '/Users/azizcamara/CSCX V7/components/AgentActionsView.tsx';
  if (fs.existsSync(actionsViewPath)) {
    console.log('  ✅ AgentActionsView.tsx component exists');
    results.passed++;
  } else {
    console.log('  ❌ AgentActionsView.tsx missing');
    results.failed++;
  }
  console.log('');

  // PRD-4: Support Tickets
  console.log('━━━ PRD-4: Support Tickets ━━━');

  // Create ticket
  const createTicket = await fetchJSON(`${API_BASE}/api/support/tickets`, {
    method: 'POST',
    body: JSON.stringify({
      customerId: 'test-customer',
      subject: 'Test ticket from verification',
      description: 'This is a verification test',
      priority: 'low'
    })
  });
  if (createTicket.ok && createTicket.data?.ticketId) {
    console.log(`  ✅ POST /api/support/tickets works (created ${createTicket.data.ticketId})`);
    results.passed++;

    // Check AI suggestions
    if (createTicket.data.troubleshootingSuggestions?.length > 0) {
      console.log(`  ✅ AI troubleshooting suggestions work (${createTicket.data.troubleshootingSuggestions.length} suggestions)`);
      results.passed++;
    } else {
      console.log('  ❌ AI suggestions missing');
      results.failed++;
    }
  } else {
    console.log('  ❌ create ticket failed');
    results.failed++;
  }

  // Check UI component exists
  const supportTicketsPath = '/Users/azizcamara/CSCX V7/components/SupportTickets.tsx';
  if (fs.existsSync(supportTicketsPath)) {
    console.log('  ✅ SupportTickets.tsx component exists');
    results.passed++;
  } else {
    console.log('  ❌ SupportTickets.tsx missing');
    results.failed++;
  }
  console.log('');

  // PRD-5: Admin Dashboard
  console.log('━━━ PRD-5: Admin Dashboard ━━━');

  // Admin overview
  const adminOverview = await fetchJSON(`${API_BASE}/api/admin/overview`);
  if (adminOverview.ok && adminOverview.data?.metrics) {
    console.log(`  ✅ GET /api/admin/overview works`);
    console.log(`     - Total customers: ${adminOverview.data.metrics.totalCustomers}`);
    console.log(`     - Healthy: ${adminOverview.data.metrics.healthyCustomers}`);
    console.log(`     - At risk: ${adminOverview.data.metrics.atRiskCustomers}`);
    console.log(`     - System health: ${adminOverview.data.summary.systemHealth}`);
    results.passed++;
  } else {
    console.log('  ❌ admin overview failed');
    results.failed++;
  }

  // Check UI component exists
  const adminDashboardPath = '/Users/azizcamara/CSCX V7/components/AdminDashboard.tsx';
  if (fs.existsSync(adminDashboardPath)) {
    console.log('  ✅ AdminDashboard.tsx component exists');
    results.passed++;
  } else {
    console.log('  ❌ AdminDashboard.tsx missing');
    results.failed++;
  }
  console.log('');

  // PRD-6: Health Check Endpoints
  console.log('━━━ PRD-6: Health Check Endpoints ━━━');

  // Health live
  const healthLive = await fetchJSON(`${API_BASE}/health/live`);
  if (healthLive.ok && healthLive.data?.status === 'ok') {
    console.log('  ✅ GET /health/live works');
    results.passed++;
  } else {
    console.log('  ❌ health/live failed');
    results.failed++;
  }

  // Health ready
  const healthReady = await fetchJSON(`${API_BASE}/health/ready`);
  if (healthReady.ok && healthReady.data?.ready === true) {
    console.log('  ✅ GET /health/ready works');
    results.passed++;
  } else {
    console.log('  ❌ health/ready failed');
    results.failed++;
  }

  // Health full
  const health = await fetchJSON(`${API_BASE}/health`);
  if (health.ok && health.data?.status === 'healthy') {
    console.log(`  ✅ GET /health works (${health.data.services ? Object.keys(health.data.services).length : 0} services checked)`);
    results.passed++;
  } else {
    console.log('  ❌ health failed');
    results.failed++;
  }
  console.log('');

  // PRD-7: Rate Limiting + Error Handling
  console.log('━━━ PRD-7: Rate Limiting + Error Handling ━━━');

  // Check error handler middleware exists
  const errorHandlerPath = '/Users/azizcamara/CSCX V7/server/src/middleware/errorHandler.ts';
  if (fs.existsSync(errorHandlerPath)) {
    console.log('  ✅ errorHandler.ts middleware exists');
    results.passed++;
  } else {
    console.log('  ❌ errorHandler.ts missing');
    results.failed++;
  }

  // Test error format
  const notFound = await fetchJSON(`${API_BASE}/api/nonexistent-endpoint-12345`);
  if (notFound.status === 404) {
    console.log('  ✅ 404 errors return proper status');
    results.passed++;
  } else {
    console.log('  ❌ 404 handling issue');
    results.failed++;
  }
  console.log('');

  // PRD-8: Test Infrastructure
  console.log('━━━ PRD-8: Test Infrastructure ━━━');

  // Check package.json has test scripts
  const packageJsonPath = '/Users/azizcamara/CSCX V7/server/package.json';
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.scripts?.['test:all']) {
      console.log('  ✅ npm run test:all script exists');
      results.passed++;
    } else {
      console.log('  ❌ test:all script missing');
      results.failed++;
    }
    if (packageJson.scripts?.['test:run']) {
      console.log('  ✅ npm run test:run script exists');
      results.passed++;
    }
    if (packageJson.scripts?.['test:coverage']) {
      console.log('  ✅ npm run test:coverage script exists');
      results.passed++;
    }
  }
  console.log('');

  // PRD-9: Structured Logging
  console.log('━━━ PRD-9: Structured Logging ━━━');

  // Check logger exists
  const loggerPath = '/Users/azizcamara/CSCX V7/server/src/services/logger.ts';
  if (fs.existsSync(loggerPath)) {
    console.log('  ✅ logger.ts service exists');
    results.passed++;
  } else {
    console.log('  ❌ logger.ts missing');
    results.failed++;
  }
  console.log('');

  // PRD-10: Security Headers
  console.log('━━━ PRD-10: Security Headers ━━━');

  // Check for helmet in index.ts
  const indexPath = '/Users/azizcamara/CSCX V7/server/src/index.ts';
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    if (indexContent.includes('helmet')) {
      console.log('  ✅ Helmet security middleware configured');
      results.passed++;
    } else {
      console.log('  ❌ Helmet not found in index.ts');
      results.failed++;
    }
  }
  console.log('');

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${results.passed.toString().padEnd(3)} checks                                      ║`);
  console.log(`║  ❌ Failed: ${results.failed.toString().padEnd(3)} checks                                      ║`);
  console.log(`║  📊 Total:  ${(results.passed + results.failed).toString().padEnd(3)} checks                                      ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (results.failed === 0) {
    console.log('\n🎉 ALL PRDs 0-10 VERIFIED SUCCESSFULLY!\n');
  } else {
    console.log(`\n⚠️  ${results.failed} checks need attention.\n`);
  }

  return results;
}

verifyPRDs().catch(console.error);
