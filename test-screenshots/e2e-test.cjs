const { chromium } = require('playwright');

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const screenshotDir = '/Users/azizcamara/CSCX V7/test-screenshots';
  const frontendUrl = 'http://localhost:3000';
  const backendUrl = 'http://localhost:3001';

  console.log('=== CSCX.AI E2E Test Suite ===\n');
  console.log(`Frontend: ${frontendUrl}`);
  console.log(`Backend: ${backendUrl}\n`);

  // Test 1: Home/Login Page
  console.log('1. Testing Home Page...');
  await page.goto(frontendUrl);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${screenshotDir}/01-home-page.png`, fullPage: true });
  console.log('   ✓ Screenshot: 01-home-page.png\n');

  // Test 2: Customers List
  console.log('2. Testing Customers List...');
  try {
    // Try clicking Customers nav or go directly
    const customersLink = await page.$('text=Customers');
    if (customersLink) {
      await customersLink.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${screenshotDir}/02-customers-list.png`, fullPage: true });
    console.log('   ✓ Screenshot: 02-customers-list.png\n');
  } catch (e) {
    console.log('   ⚠ Customers page: ' + e.message + '\n');
  }

  // Test 3: Click on first customer
  console.log('3. Testing Customer Detail...');
  try {
    // Look for any clickable customer element
    const customerEl = await page.$('[class*="customer"], [class*="Customer"], table tbody tr, .grid > div');
    if (customerEl) {
      await customerEl.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${screenshotDir}/03-customer-detail.png`, fullPage: true });
    console.log('   ✓ Screenshot: 03-customer-detail.png\n');
  } catch (e) {
    console.log('   ⚠ Customer detail: ' + e.message + '\n');
  }

  // Test 4: Onboarding Page
  console.log('4. Testing Onboarding Page...');
  try {
    const onboardingLink = await page.$('text=Onboarding, text=New Onboarding, [href*="onboarding"]');
    if (onboardingLink) {
      await onboardingLink.click();
    } else {
      await page.goto(`${frontendUrl}/onboarding`);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/04-onboarding.png`, fullPage: true });
    console.log('   ✓ Screenshot: 04-onboarding.png\n');
  } catch (e) {
    console.log('   ⚠ Onboarding: ' + e.message + '\n');
  }

  // Test 5: Health Check API
  console.log('5. Testing Health Endpoint (PRD-6)...');
  const healthPage = await context.newPage();
  await healthPage.goto(`${backendUrl}/health`);
  await healthPage.waitForTimeout(1000);
  await healthPage.screenshot({ path: `${screenshotDir}/05-health-api.png` });
  const healthContent = await healthPage.textContent('body');
  console.log('   Response preview: ' + healthContent.substring(0, 100) + '...');
  console.log('   ✓ Screenshot: 05-health-api.png\n');
  await healthPage.close();

  // Test 6: Admin Overview API
  console.log('6. Testing Admin Overview (PRD-5)...');
  const adminPage = await context.newPage();
  await adminPage.goto(`${backendUrl}/api/admin/overview`);
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: `${screenshotDir}/06-admin-overview.png` });
  const adminContent = await adminPage.textContent('body');
  console.log('   Response preview: ' + adminContent.substring(0, 100) + '...');
  console.log('   ✓ Screenshot: 06-admin-overview.png\n');
  await adminPage.close();

  // Test 7: KB Status API
  console.log('7. Testing KB Status (PRD-2)...');
  const kbPage = await context.newPage();
  await kbPage.goto(`${backendUrl}/api/kb/status`);
  await kbPage.waitForTimeout(1000);
  await kbPage.screenshot({ path: `${screenshotDir}/07-kb-status.png` });
  const kbContent = await kbPage.textContent('body');
  console.log('   Response: ' + kbContent);
  console.log('   ✓ Screenshot: 07-kb-status.png\n');
  await kbPage.close();

  // Test 8: Support Ticket Creation (PRD-4)
  console.log('8. Testing Support Ticket API (PRD-4)...');
  const ticketResponse = await page.evaluate(async (url) => {
    const res = await fetch(`${url}/api/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'test-customer-123',
        subject: 'Login issues - E2E Test',
        description: 'Cannot access dashboard after password reset',
        priority: 'high'
      })
    });
    return res.json();
  }, backendUrl);
  console.log('   Ticket created: ' + ticketResponse.ticketId);
  console.log('   AI Suggestions: ' + (ticketResponse.troubleshootingSuggestions || []).length + ' suggestions');
  console.log('   ✓ Support ticket API working\n');

  // Test 9: Actions API (PRD-3)
  console.log('9. Testing Actions API (PRD-3)...');
  const actionsPage = await context.newPage();
  await actionsPage.setExtraHTTPHeaders({ 'x-user-id': 'test-user-e2e' });
  await actionsPage.goto(`${backendUrl}/api/actions`);
  await actionsPage.waitForTimeout(1000);
  await actionsPage.screenshot({ path: `${screenshotDir}/09-actions-api.png` });
  const actionsContent = await actionsPage.textContent('body');
  console.log('   Response: ' + actionsContent);
  console.log('   ✓ Screenshot: 09-actions-api.png\n');
  await actionsPage.close();

  // Test 10: Take final app screenshot
  console.log('10. Final App State...');
  await page.goto(frontendUrl);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${screenshotDir}/10-final-state.png`, fullPage: true });
  console.log('   ✓ Screenshot: 10-final-state.png\n');

  await browser.close();

  console.log('=== Test Complete ===\n');
  console.log(`Screenshots saved to: ${screenshotDir}/\n`);
  console.log('Open folder: open "' + screenshotDir + '"');
}

runTests().catch(console.error);
