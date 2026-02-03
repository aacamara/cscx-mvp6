const { chromium } = require('playwright');

async function runUITests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const screenshotDir = '/Users/azizcamara/CSCX V7/test-screenshots';
  const frontendUrl = 'http://localhost:3000';

  console.log('=== CSCX.AI UI Test Suite ===\n');

  // Simulate logged in state by setting localStorage
  await page.goto(frontendUrl);
  await page.evaluate(() => {
    localStorage.setItem('cscx_user', JSON.stringify({
      id: 'test-user-123',
      email: 'demo@cscx.ai',
      name: 'Demo User',
      role: 'admin'
    }));
    localStorage.setItem('cscx_token', 'demo-token');
  });
  await page.reload();
  await page.waitForTimeout(3000);

  // Test 1: Main Dashboard / Observability
  console.log('1. Testing Observability Dashboard...');
  await page.screenshot({ path: `${screenshotDir}/ui-01-dashboard.png`, fullPage: true });
  console.log('   ✓ Screenshot: ui-01-dashboard.png\n');

  // Test 2: Look for customers list
  console.log('2. Looking for Customers...');
  try {
    // Try to find customer cards or list
    const customerElements = await page.$$('[class*="customer"], [class*="Customer"], .grid > div, table tbody tr');
    console.log(`   Found ${customerElements.length} potential customer elements`);

    if (customerElements.length > 0) {
      await customerElements[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/ui-02-customer-clicked.png`, fullPage: true });
      console.log('   ✓ Screenshot: ui-02-customer-clicked.png\n');
    }
  } catch (e) {
    console.log('   ⚠ ' + e.message + '\n');
  }

  // Test 3: Navigate to different sections via URL hash or nav
  console.log('3. Testing Navigation Items...');

  // Look for nav items
  const navItems = await page.$$('nav a, nav button, [role="navigation"] a, header button, aside a, aside button');
  console.log(`   Found ${navItems.length} nav items`);

  for (let i = 0; i < Math.min(navItems.length, 5); i++) {
    try {
      const text = await navItems[i].textContent();
      console.log(`   Nav item ${i}: "${text?.trim()}"`);
    } catch (e) {}
  }

  await page.screenshot({ path: `${screenshotDir}/ui-03-with-nav.png`, fullPage: true });
  console.log('   ✓ Screenshot: ui-03-with-nav.png\n');

  // Test 4: Try to access Agent Center
  console.log('4. Testing Agent Center...');
  try {
    // Look for agent/mission control links
    const agentLink = await page.$('text=Agent, text=Mission Control, text=Agents, [href*="agent"]');
    if (agentLink) {
      await agentLink.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${screenshotDir}/ui-04-agent-center.png`, fullPage: true });
    console.log('   ✓ Screenshot: ui-04-agent-center.png\n');
  } catch (e) {
    console.log('   ⚠ Agent center: ' + e.message + '\n');
  }

  // Test 5: Try Knowledge Base
  console.log('5. Testing Knowledge Base...');
  try {
    const kbLink = await page.$('text=Knowledge, text=KB, [href*="knowledge"]');
    if (kbLink) {
      await kbLink.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${screenshotDir}/ui-05-knowledge-base.png`, fullPage: true });
    console.log('   ✓ Screenshot: ui-05-knowledge-base.png\n');
  } catch (e) {
    console.log('   ⚠ Knowledge base: ' + e.message + '\n');
  }

  // Test 6: Try Onboarding
  console.log('6. Testing Onboarding...');
  try {
    const onboardingLink = await page.$('text=Onboarding, text=New, [href*="onboarding"]');
    if (onboardingLink) {
      await onboardingLink.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${screenshotDir}/ui-06-onboarding.png`, fullPage: true });
    console.log('   ✓ Screenshot: ui-06-onboarding.png\n');
  } catch (e) {
    console.log('   ⚠ Onboarding: ' + e.message + '\n');
  }

  // Test 7: Full page scroll capture
  console.log('7. Full Page Capture...');
  await page.goto(frontendUrl);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${screenshotDir}/ui-07-full-page.png`, fullPage: true });
  console.log('   ✓ Screenshot: ui-07-full-page.png\n');

  // Test 8: Check for any modals or overlays
  console.log('8. Checking for Settings/Modals...');
  try {
    const settingsBtn = await page.$('text=Settings, [aria-label*="settings"], button:has-text("⚙")');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${screenshotDir}/ui-08-settings.png`, fullPage: true });
      console.log('   ✓ Screenshot: ui-08-settings.png\n');
    }
  } catch (e) {
    console.log('   ⚠ Settings: ' + e.message + '\n');
  }

  await browser.close();

  console.log('=== UI Test Complete ===\n');
  console.log(`Screenshots saved to: ${screenshotDir}/\n`);
}

runUITests().catch(console.error);
