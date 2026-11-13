/**
 * Browser-level registration verification.
 *
 * Tests the actual rendered registration page via Playwright + Chromium.
 * The dev server must be started manually before running tests:
 *   set NODE_OPTIONS=--max-old-space-size=8192
 *   node node_modules\next\dist\bin\next dev -p 3010
 * Then run:
 *   node node_modules/@playwright/test/cli.js test --config playwright.config.ts
 *
 * webServer auto-start is disabled in the config because the Next.js webpack
 * worker requires a larger heap that cannot be inherited via webServer env.
 */

import { test, expect, Page } from '@playwright/test'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait for the Marketplace model button to register as selected (violet border). */
async function selectMarketplace(page: Page) {
  await page.waitForSelector('text=DriveBook Marketplace')
  await page.getByRole('button', { name: /DriveBook Marketplace/i }).click()
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('DriveBook Marketplace'))
    return btn?.className?.includes('border-violet-500')
  })
}

/** Wait for the SaaS model button to register as selected (violet border). */
async function selectSaas(page: Page) {
  await page.waitForSelector('text=DriveBook SaaS')
  await page.getByRole('button', { name: /DriveBook SaaS/i }).click()
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('DriveBook SaaS'))
    return btn?.className?.includes('border-violet-500')
  })
}

/** Fill the required form fields with test values. */
async function fillForm(page: Page, overrides: Record<string, string> = {}) {
  const ts = Date.now()
  await page.getByLabel(/Full Name/i).fill(overrides.name ?? 'BW Test User')
  await page.getByLabel(/Email/i).fill(overrides.email ?? `bw-test-${ts}@bw.test`)
  await page.getByLabel(/Password/i).fill(overrides.password ?? 'TestPass1234!')
  await page.getByLabel(/Mobile Number/i).fill(overrides.phone ?? '0411111199')
}

// ── BW-1: Marketplace checkbox gating ─────────────────────────────────────────

test.describe('Registration page — Marketplace driving instructor', () => {
  test('BW-1 | Marketplace checkbox visible + submit gated by both terms and privacy', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectMarketplace(page)

    // Instructor Terms label must appear after selecting Marketplace
    await expect(page.getByText(/I agree to the.*Instructor Terms/i)).toBeVisible()

    const submitBtn = page.getByRole('button', { name: /Create account/i })

    // Disabled: neither accepted yet
    await expect(submitBtn).toBeDisabled()

    // Accept privacy only — still disabled (Instructor Terms not accepted)
    await page.locator('input[type="checkbox"]').last().check()
    await expect(submitBtn).toBeDisabled()

    // Accept Instructor Terms — now enabled
    await page.locator('input[type="checkbox"]').first().check()
    await expect(submitBtn).toBeEnabled()
  })
})

// ── BW-2: SaaS unpublished notice ─────────────────────────────────────────────

test.describe('Registration page — SaaS driving instructor', () => {
  test('BW-2 | SaaS shows unpublished notice, not terms checkbox; privacy alone enables submit', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectSaas(page)

    // Unpublished notice must be visible
    await expect(page.getByText(/SaaS Terms are being finalised/i)).toBeVisible()
    // Instructor Terms label must NOT appear
    await expect(page.getByText(/I agree to the.*Instructor Terms/i)).not.toBeVisible()

    // Accept privacy — submit should be enabled (no SaaS terms required yet)
    await page.locator('input[type="checkbox"]').first().check()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeEnabled()
  })
})

// ── BW-3: Non-driving structure selector ─────────────────────────────────────

test.describe('Registration page — Non-driving (Plumber)', () => {
  test('BW-3 | Business structure selector present; model selector absent; SaaS notice shown', async ({ page }) => {
    await page.goto('/register?businessType=plumber')

    await expect(page.getByText(/What is your business structure/i)).toBeVisible()
    await expect(page.getByText(/Sole trader/i)).toBeVisible()
    await expect(page.getByText(/Registered company or business/i)).toBeVisible()
    await expect(page.getByText(/SaaS Terms are being finalised/i)).toBeVisible()

    // Non-driving never sees the Marketplace/SaaS model selector
    await expect(page.getByText(/How would you like to use DriveBook/i)).not.toBeVisible()

    // Privacy only — submit enabled
    await page.locator('input[type="checkbox"]').first().check()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeEnabled()
  })
})

// ── BW-4: Driving School disabled ────────────────────────────────────────────

test.describe('Registration page — Driving School disabled', () => {
  test('BW-4 | Driving School option is aria-disabled and shows Coming Soon badge', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectSaas(page)

    // Locate the Driving School option specifically by its containing element
    const schoolContainer = page.locator('[aria-disabled="true"]').filter({ hasText: /Driving school/i })
    await expect(schoolContainer).toBeVisible()
    await expect(schoolContainer.getByText(/Coming soon/i)).toBeVisible()

    // The Independent instructor option must NOT be aria-disabled
    const instructorOption = page.locator('text=Independent instructor').first()
    await expect(instructorOption).toBeVisible()
    // Its closest [aria-disabled] container should not exist
    await expect(page.locator('[aria-disabled="true"]').filter({ hasText: /Independent instructor/i })).toHaveCount(0)
  })
})

// ── BW-5: Privacy always required ────────────────────────────────────────────

test.describe('Registration page — Privacy required', () => {
  test('BW-5 | Instructor Terms alone does not enable submit — privacy is independently required', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectMarketplace(page)

    // Accept Instructor Terms only
    await page.locator('input[type="checkbox"]').first().check()

    const submitBtn = page.getByRole('button', { name: /Create account/i })
    // Still disabled — privacy not accepted
    await expect(submitBtn).toBeDisabled()

    // Accept privacy — now enabled
    await page.locator('input[type="checkbox"]').last().check()
    await expect(submitBtn).toBeEnabled()
  })
})

// ── BW-6: Independent instructor pre-selected ────────────────────────────────

test.describe('Registration page — Independent instructor pre-selected', () => {
  test('BW-6 | Independent instructor option is rendered as selected (violet border)', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectSaas(page)

    // The Independent instructor option must carry the selected style (violet border)
    const instructorOption = page.locator('div').filter({ hasText: /^Independent instructor/ }).first()
    await expect(instructorOption).toBeVisible()
    // The parent card for this option should have the selected border class
    const selectedCard = page.locator('.border-violet-500').filter({ hasText: /Independent instructor/i })
    await expect(selectedCard).toBeVisible()
  })
})

// ── BW-7: Marketplace submission sends correct payload ───────────────────────

test.describe('Registration submission — Marketplace', () => {
  test('BW-7 | Marketplace form submits with termsAccepted and privacyAccepted; reaches /login', async ({ page }) => {
    test.setTimeout(60000)  // Marketplace registration includes more email side effects
    await page.goto('/register?businessType=driving')
    await selectMarketplace(page)
    await fillForm(page)

    // Intercept the registration POST to verify the request body
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/register', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>
      capturedBody = body
      await route.continue()
    })

    // Accept both checkboxes
    await page.locator('input[type="checkbox"]').first().check()   // Instructor Terms
    await page.locator('input[type="checkbox"]').last().check()    // Privacy

    // Submit
    await page.getByRole('button', { name: /Create account/i }).click()

    // Wait for redirect — successful registration goes to /login?registered=1
    await page.waitForURL(/\/login/, { timeout: 55000 })

    // Verify the intercepted request body
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.businessType).toBe('driving')
    expect(capturedBody!.businessModel).toBe('MARKETPLACE')
    expect(capturedBody!.termsAccepted).toBe(true)
    expect(capturedBody!.privacyAccepted).toBe(true)
    expect(capturedBody!.saasTermsAccepted).toBeUndefined()
  })
})

// ── BW-8: SaaS submission does NOT send termsAccepted ────────────────────────

test.describe('Registration submission — SaaS unpublished', () => {
  test('BW-8 | SaaS form submits without termsAccepted; privacyAccepted=true; reaches /login', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectSaas(page)
    await fillForm(page)

    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/register', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>
      capturedBody = body
      await route.continue()
    })

    // Accept privacy only
    await page.locator('input[type="checkbox"]').first().check()

    // Submit
    await page.getByRole('button', { name: /Create account/i }).click()
    await page.waitForURL(/\/login/, { timeout: 30000 })

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.businessType).toBe('driving')
    expect(capturedBody!.businessModel).toBe('SAAS')
    expect(capturedBody!.termsAccepted).toBeUndefined()   // must NOT be sent
    expect(capturedBody!.saasTermsAccepted).toBeUndefined()  // terms not published
    expect(capturedBody!.privacyAccepted).toBe(true)
  })
})

// ── BW-9: Non-driving submission includes organisationType ───────────────────

test.describe('Registration submission — Non-driving', () => {
  test('BW-9 | Plumber submits with SOLE_TRADER organisationType and no termsAccepted', async ({ page }) => {
    await page.goto('/register?businessType=plumber')
    await fillForm(page)

    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/register', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>
      capturedBody = body
      await route.continue()
    })

    // Accept privacy
    await page.locator('input[type="checkbox"]').first().check()

    await page.getByRole('button', { name: /Create account/i }).click()
    await page.waitForURL(/\/login/, { timeout: 30000 })

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.businessType).toBe('plumber')
    expect(capturedBody!.organisationType).toBe('SOLE_TRADER')
    expect(capturedBody!.privacyAccepted).toBe(true)
    expect(capturedBody!.termsAccepted).toBeUndefined()
    expect(capturedBody!.saasTermsAccepted).toBeUndefined()
  })
})

// ── BW-10: Driving School cannot be selected ────────────────────────────────

test.describe('Registration page — Driving School interaction prevention', () => {
  test('BW-10 | Clicking Driving School option does not change selected organisation type', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await selectSaas(page)

    // Independent instructor must be the active selection (violet border)
    const instructorCard = page.locator('.border-violet-500').filter({ hasText: /Independent instructor/i })
    await expect(instructorCard).toBeVisible()

    // Attempt to click the Driving School option
    const schoolOption = page.locator('[aria-disabled="true"]').filter({ hasText: /Driving school/i })
    await expect(schoolOption).toBeVisible()

    // Click the school option — it should have no effect
    await schoolOption.click({ force: true })

    // Wait a moment for any state change that might have occurred
    await page.waitForTimeout(500)

    // Independent instructor must STILL be the selected option
    await expect(instructorCard).toBeVisible()

    // Driving School must NOT have the selected border style
    const schoolSelected = page.locator('.border-violet-500').filter({ hasText: /Driving school/i })
    await expect(schoolSelected).toHaveCount(0)
  })
})

// ── BW-11: Published SaaS browser flow ───────────────────────────────────────
//
// Requires the dev server running with SaaS Terms published. Start the server with:
//   set NODE_OPTIONS=--max-old-space-size=8192
//   set SAAS_TERMS_PUBLISHED_OVERRIDE=true
//   set SAAS_TERMS_VERSION_OVERRIDE=1.0
//   node node_modules\next\dist\bin\next dev -p 3010
//
// This test will SKIP automatically if the published checkbox is not found.

test.describe('Registration page — Published SaaS Terms', () => {
  test('BW-11 | Published SaaS shows checkbox, requires acceptance, submits with saasTermsAccepted', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('/register?businessType=driving')
    await selectSaas(page)

    // When SaaS Terms are published, the page should show a SaaS Terms checkbox
    // (not the "being finalised" notice). If the notice is still showing, the
    // server is running with unpublished terms — skip this test.
    const saasNotice = page.getByText(/SaaS Terms are being finalised/i)
    if (await saasNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip(true, 'SaaS Terms are not published on this server — run with SAAS_TERMS_PUBLISHED_OVERRIDE=true')
      return
    }

    // SaaS Terms acceptance checkbox must be visible
    const saasTermsLabel = page.getByText(/I agree to the.*DriveBook SaaS Terms/i)
    await expect(saasTermsLabel).toBeVisible()

    // Submit should be disabled (neither privacy nor SaaS terms accepted yet)
    const submitBtn = page.getByRole('button', { name: /Create account/i })
    await expect(submitBtn).toBeDisabled()

    // Accept privacy only — still disabled (SaaS terms not accepted)
    await page.locator('input[type="checkbox"]').last().check()
    await expect(submitBtn).toBeDisabled()

    // Accept SaaS Terms — now enabled
    await page.locator('input[type="checkbox"]').first().check()
    await expect(submitBtn).toBeEnabled()

    // Fill form and submit
    await fillForm(page)

    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/api/register', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>
      capturedBody = body
      await route.continue()
    })

    await submitBtn.click()
    await page.waitForURL(/\/login/, { timeout: 55000 })

    // Verify request payload includes saasTermsAccepted=true
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.businessType).toBe('driving')
    expect(capturedBody!.businessModel).toBe('SAAS')
    expect(capturedBody!.saasTermsAccepted).toBe(true)
    expect(capturedBody!.privacyAccepted).toBe(true)
    expect(capturedBody!.termsAccepted).toBeUndefined()  // Marketplace terms not sent
  })
})
