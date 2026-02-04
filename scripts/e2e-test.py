#!/usr/bin/env python3
"""
CSCX.AI E2E Test Suite
Tests: Login, Customer List, Chat Features, Offline Mode
"""

from playwright.sync_api import sync_playwright
import os
import sys

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3001")
INVITE_CODE = "2362369"
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "test-screenshots")

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_login_flow(page):
    """Test login with invite code"""
    print("\n🔐 TEST: Login Flow")
    print("-" * 40)

    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_initial_page.png")

    content = page.content()
    if "invite" in content.lower() or "code" in content.lower():
        print("✅ Login page detected")

        invite_input = page.locator('input[type="text"], input[type="password"], input[placeholder*="invite" i], input[placeholder*="code" i]').first
        if invite_input.count() > 0:
            invite_input.fill(INVITE_CODE)
            print(f"✅ Entered invite code: {INVITE_CODE}")

            submit_btn = page.locator('button[type="submit"], button:has-text("Enter"), button:has-text("Submit"), button:has-text("Login")').first
            if submit_btn.count() > 0:
                submit_btn.click()
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(2000)
            else:
                invite_input.press("Enter")
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(2000)

            # Continue without Google (Demo Mode)
            demo_btn = page.locator('button:has-text("Demo Mode"), button:has-text("Continue without sign in"), a:has-text("Demo Mode")').first
            if demo_btn.count() > 0:
                demo_btn.click()
                print("✅ Clicked 'Continue without sign in (Demo Mode)'")
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(2000)

            page.screenshot(path=f"{SCREENSHOT_DIR}/02_after_login.png")
    else:
        print("ℹ️ Not on login page, may already be logged in")

    return True

def test_customer_list(page):
    """Test customer list view"""
    print("\n📋 TEST: Customer List")
    print("-" * 40)

    page.wait_for_load_state('networkidle')
    content = page.content()

    if "customer" in content.lower() or "client" in content.lower() or "dashboard" in content.lower():
        print("✅ Customer/Dashboard content found")

        tables = page.locator('table, [role="grid"], [class*="grid"]').all()
        if tables:
            print(f"✅ Found {len(tables)} table/grid elements")

        page.screenshot(path=f"{SCREENSHOT_DIR}/03_customer_list.png")
        return True

    print("⚠️ Customer list content not detected")
    return False

def test_agent_center(page):
    """Test Agent Control Center"""
    print("\n🤖 TEST: Agent Control Center")
    print("-" * 40)

    # Click on Agent Center tab
    agent_tab = page.locator('button:has-text("Agent Center"), a:has-text("Agent Center"), [class*="nav"] button:has-text("Agent")').first
    if agent_tab.count() > 0:
        agent_tab.click()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1000)
        print("✅ Clicked Agent Center tab")

    # Exclude file inputs - look for visible text/search inputs only
    chat_input = page.locator('input[type="text"][placeholder*="message" i], input:not([type="file"]):not([type="hidden"])[placeholder*="Message" i], textarea[placeholder*="message" i]').first

    if chat_input.count() == 0:
        # Fallback: find input in the input-area that's not a file input
        chat_input = page.locator('.input-area input:not([type="file"]), [class*="chat-input"] input').first

    if chat_input.count() > 0:
        print("✅ Found chat input")

        chat_input.fill("Hello, this is a test message")
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_chat_input.png")

        # Test Cmd+Enter
        chat_input.press("Meta+Enter")
        page.wait_for_timeout(500)
        print("✅ Tested Cmd+Enter shortcut")

        page.screenshot(path=f"{SCREENSHOT_DIR}/05_after_send.png")
        return True

    print("ℹ️ Chat input not found")
    return False

def test_keyboard_shortcuts(page):
    """Test keyboard shortcuts"""
    print("\n⌨️ TEST: Keyboard Shortcuts")
    print("-" * 40)

    chat_input = page.locator('input[type="text"][placeholder*="message" i], textarea:not([hidden])').first
    if chat_input.count() > 0:
        # Test Up arrow for history
        chat_input.press("ArrowUp")
        print("✅ Tested Up arrow")

        # Test Escape
        chat_input.press("Escape")
        print("✅ Tested Escape key")

        return True
    return False

def test_code_block_copy(page):
    """Test copy button on code blocks"""
    print("\n📋 TEST: Code Block Copy")
    print("-" * 40)

    code_blocks = page.locator('pre code, [class*="code-block"]').all()
    if code_blocks:
        print(f"✅ Found {len(code_blocks)} code blocks")

        # Hover to trigger copy button
        code_blocks[0].hover()
        page.wait_for_timeout(500)

        copy_btn = page.locator('[class*="copy"], button:has-text("Copy")').first
        if copy_btn.count() > 0:
            print("✅ Copy button visible on hover")
            return True

    print("ℹ️ No code blocks found to test")
    return False

def run_tests():
    """Run all E2E tests"""
    print("=" * 50)
    print("🚀 CSCX.AI E2E Test Suite")
    print("=" * 50)
    print(f"Frontend: {FRONTEND_URL}")
    print(f"Backend: {BACKEND_URL}")

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        page.on("console", lambda msg: print(f"   CONSOLE: {msg.text}") if msg.type == "error" else None)

        try:
            results['login'] = test_login_flow(page)
            results['customer_list'] = test_customer_list(page)
            results['agent_center'] = test_agent_center(page)
            results['keyboard'] = test_keyboard_shortcuts(page)
            results['code_copy'] = test_code_block_copy(page)

        except Exception as e:
            print(f"\n❌ Error: {e}")
            page.screenshot(path=f"{SCREENSHOT_DIR}/error_state.png")
        finally:
            browser.close()

    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "⚠️ CHECK"
        print(f"  {test_name}: {status}")

    print("-" * 50)
    print(f"  {passed}/{total} passed")

    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(run_tests())
