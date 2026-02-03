const { chromium } = require('playwright');

async function testNewViews() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const screenshotDir = '/Users/azizcamara/CSCX V7/test-screenshots';
  const frontendUrl = 'http://localhost:3000';

  console.log('=== Testing New PRD Views ===\n');

  // Go to app and check navigation
  await page.goto(frontendUrl);
  await page.waitForTimeout(3000);

  // Take screenshot of landing page with new nav
  await page.screenshot({ path: `${screenshotDir}/new-01-landing.png`, fullPage: true });
  console.log('1. Landing page screenshot taken\n');

  // The new views require authentication, but we can test that the routes exist
  // by checking the navigation buttons appear after the code changes

  // Check page HTML for the new nav buttons
  const pageContent = await page.content();
  const hasActionsNav = pageContent.includes('Actions') || pageContent.includes('agent-actions');
  const hasSupportNav = pageContent.includes('Support') || pageContent.includes('support');
  const hasAdminNav = pageContent.includes('Admin') || pageContent.includes('admin');

  console.log('Navigation check:');
  console.log(`  - Actions nav: ${hasActionsNav ? '✓' : '✗'}`);
  console.log(`  - Support nav: ${hasSupportNav ? '✓' : '✗'}`);
  console.log(`  - Admin nav: ${hasAdminNav ? '✓' : '✗'}\n`);

  // Check if components were imported correctly by looking for any errors
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', err => consoleLogs.push(`Error: ${err.message}`));

  await page.reload();
  await page.waitForTimeout(2000);

  const errors = consoleLogs.filter(log => log.toLowerCase().includes('error'));
  if (errors.length > 0) {
    console.log('Console errors found:');
    errors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log('No console errors detected ✓\n');
  }

  await browser.close();

  console.log('=== Test Complete ===');
  console.log('\nNew components created:');
  console.log('  - components/AdminDashboard.tsx (PRD-5 UI)');
  console.log('  - components/SupportTickets.tsx (PRD-4 UI)');
  console.log('  - components/AgentActionsView.tsx (PRD-3 UI)');
  console.log('\nTo test the views:');
  console.log('  1. Open http://localhost:3000');
  console.log('  2. Log in with Google');
  console.log('  3. Click Admin, Support, or Actions in the nav bar');
}

testNewViews().catch(console.error);
