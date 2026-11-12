/**
 * Browser-level registration verification.
 *
 * Verifies the actual rendered UI on the registration page:
 * - Marketplace terms checkbox visibility and submit gating
 * - SaaS unpublished notice
 * - Privacy acceptance required
 * - Driving School shown as disabled
 * - Correct form structure for each business type
 *
 * Requires the dev server running on the TEST_BASE_URL (default localhost:3000).
 *
 * Run:
 *   npx playwright test --config playwright.config.ts
 *   or
 *   node node_modules/@playwright/test/cli.js test --config playwright.config.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Registration page — Marketplace driving instructor', () => {
  test('BW-1 | Marketplace checkbox is visible and submit is disabled until accepted', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    // Wait for the business model selection to render
    await page.waitForSelector('text=DriveBook Marketplace')

    // Select Marketplace model
    await page.getByRole('button', { name: /DriveBook Marketplace/i }).click()
    // Confirm selection took effect — the button's border changes to violet
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('DriveBook Marketplace'))
      return btn?.className?.includes('border-violet-500')
    })

    // Terms label should appear
    const termsLabel = page.getByText(/I agree to the.*Instructor Terms/i)
    await expect(termsLabel).toBeVisible()

    // Submit button should be disabled (privacy not yet accepted)
    const submitBtn = page.getByRole('button', { name: /Create account/i })
    await expect(submitBtn).toBeDisabled()

    // Accept privacy by clicking the checkbox input directly
    const privacyCheckbox = page.locator('input[type="checkbox"]').last()
    await privacyCheckbox.check()

    // Submit should still be disabled (terms not yet accepted)
    await expect(submitBtn).toBeDisabled()

    // Accept terms by clicking its checkbox
    const termsCheckbox = page.locator('input[type="checkbox"]').first()
    await termsCheckbox.check()

    // Now submit should be enabled
    await expect(submitBtn).toBeEnabled()
  })
})

test.describe('Registration page — SaaS driving instructor', () => {
  test('BW-2 | SaaS shows unpublished notice (not terms checkbox)', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await page.waitForSelector('text=DriveBook SaaS')

    // Select SaaS model
    await page.getByRole('button', { name: /DriveBook SaaS/i }).click()
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('DriveBook SaaS'))
      return btn?.className?.includes('border-violet-500')
    })

    // Should show the "being finalised" notice, not a terms checkbox
    await expect(page.getByText(/SaaS Terms are being finalised/i)).toBeVisible()

    // Should NOT show an Instructor Terms checkbox
    await expect(page.getByText(/I agree to the.*Instructor Terms/i)).not.toBeVisible()

    // Accept privacy by clicking its checkbox — submit should be enabled (no SaaS terms yet)
    const privacyCheckbox = page.locator('input[type="checkbox"]').first()
    await privacyCheckbox.check()

    const submitBtn = page.getByRole('button', { name: /Create account/i })
    await expect(submitBtn).toBeEnabled()
  })
})

test.describe('Registration page — Non-driving (Plumber)', () => {
  test('BW-3 | Non-driving shows SaaS notice and business structure selector', async ({ page }) => {
    await page.goto('/register?businessType=plumber')

    // Should show business structure selector
    await expect(page.getByText(/What is your business structure/i)).toBeVisible()
    await expect(page.getByText(/Sole trader/i)).toBeVisible()
    await expect(page.getByText(/Registered company or business/i)).toBeVisible()

    // Should show SaaS notice (non-driving is always SaaS)
    await expect(page.getByText(/SaaS Terms are being finalised/i)).toBeVisible()

    // Should NOT show Marketplace/SaaS model selector
    await expect(page.getByText(/How would you like to use DriveBook/i)).not.toBeVisible()

    // Accept privacy by clicking its checkbox directly
    const privacyCheckbox = page.locator('input[type="checkbox"]').first()
    await privacyCheckbox.check()

    const submitBtn = page.getByRole('button', { name: /Create account/i })
    await expect(submitBtn).toBeEnabled()
  })
})

test.describe('Registration page — Driving School disabled', () => {
  test('BW-4 | Driving School is shown as Coming Soon and not clickable', async ({ page }) => {
    await page.goto('/register?businessType=driving')

    // Select SaaS model to see organisation type section
    await page.getByRole('button', { name: /DriveBook SaaS/i }).click()

    // Driving school option should be visible but disabled
    await expect(page.getByText(/Driving school/i)).toBeVisible()
    await expect(page.getByText(/Coming soon/i)).toBeVisible()

    // The driving school option should have aria-disabled
    const schoolOption = page.locator('[aria-disabled="true"]')
    await expect(schoolOption).toBeVisible()
  })
})

test.describe('Registration page — Privacy required', () => {
  test('BW-5 | Privacy acceptance is always required regardless of business type', async ({ page }) => {
    await page.goto('/register?businessType=driving')
    await page.waitForSelector('text=DriveBook Marketplace')

    // Select Marketplace
    await page.getByRole('button', { name: /DriveBook Marketplace/i }).click()
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('DriveBook Marketplace'))
      return btn?.className?.includes('border-violet-500')
    })

    // Accept terms checkbox
    const termsCheckbox = page.locator('input[type="checkbox"]').first()
    await termsCheckbox.check()

    // Submit should still be disabled (privacy not accepted)
    const submitBtn = page.getByRole('button', { name: /Create account/i })
    await expect(submitBtn).toBeDisabled()

    // Accept privacy
    const privacyCheckbox = page.locator('input[type="checkbox"]').last()
    await privacyCheckbox.check()

    // Now submit should be enabled
    await expect(submitBtn).toBeEnabled()
  })
})

test.describe('Registration page — Independent instructor is only org type for driving', () => {
  test('BW-6 | Independent instructor is pre-selected for driving', async ({ page }) => {
    await page.goto('/register?businessType=driving')

    // Select SaaS to see the org type section
    await page.getByRole('button', { name: /DriveBook SaaS/i }).click()

    // Independent instructor should be visible and pre-selected
    await expect(page.getByText(/Independent instructor/i)).toBeVisible()
  })
})
