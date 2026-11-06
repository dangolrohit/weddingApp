import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/admin/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill('admin@weddingstudio.com');
  await page.locator('input[type="password"]').fill('AdminSecurePassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin**');
  await expect(page.locator('body')).toContainText(/welcome back/i);
}

test.describe('Wedding Photo Delivery Platform - End to End Verification', () => {

  test('1. Public Portfolio Showcase & Inquiry Submission', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verify Branding & Navigation
    await expect(page.locator('body')).toContainText(/Lumina|Wedding/i);
    await expect(page.getByRole('link', { name: 'Get My Image', exact: true }).first()).toBeVisible();

    // 2. Verify Category Filter Tabs
    const allTab = page.getByRole('button', { name: /all work/i });
    await expect(allTab).toBeVisible();
    await expect(page.getByRole('button', { name: /weddings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /engagements/i })).toBeVisible();

    // 3. Verify Showcase Photo Cards & Lightbox Modal
    const photoCards = page.locator('div.group.relative.cursor-pointer');
    const photoCount = await photoCards.count();
    expect(photoCount).toBeGreaterThanOrEqual(1);

    // Open lightbox on first photo
    await photoCards.first().click();
    await expect(page.locator('button[title*="Close"]')).toBeVisible();
    // Close lightbox
    await page.keyboard.press('Escape');

    // 4. Test Category Filter Click
    const engagementsTab = page.getByRole('button', { name: /engagements/i });
    await engagementsTab.click();
    await page.waitForTimeout(500);

    // 5. Submit Contact Inquiry Form
    await page.locator('input[placeholder*="Rachel"]').fill('David & Jessica');
    await page.locator('input[type="date"]').fill('2027-06-25');
    await page.locator('input[type="email"]').fill('david.jessica@example.com');
    await page.locator('input[type="tel"]').fill('+1 555-987-6543');
    await page.locator('textarea').fill('Looking for wedding photography coverage for our Napa Valley celebration.');

    await page.getByRole('button', { name: /send inquiry/i }).click();

    // Verify success banner
    await expect(page.locator('body')).toContainText(/thank you for reaching out/i);
  });

  test('2. Get My Image - Client Verification & Preview Gallery', async ({ page }) => {
    await page.goto('/get-my-image');
    await page.waitForLoadState('networkidle');

    // 1. Test invalid passkey verification failure
    const inputs = page.locator('form input');
    await inputs.nth(0).fill('WrongGroom');
    await inputs.nth(1).fill('WrongBride');
    await inputs.nth(2).fill('BAD-PASSKEY');
    await page.getByRole('button', { name: /unlock my gallery/i }).click();

    // Verify error message
    await expect(page.locator('body')).toContainText(/could not be verified/i);

    // 2. Test valid verification for Ethan & Sophia (LOVE-2026)
    await inputs.nth(0).fill('Ethan');
    await inputs.nth(1).fill('Sophia');
    await inputs.nth(2).fill('LOVE-2026');
    await page.getByRole('button', { name: /unlock my gallery/i }).click();

    // 3. Verify private gallery view
    await expect(page.locator('body')).toContainText(/Ethan & Sophia/i);
    await expect(page.locator('body')).toContainText(/Private Collection/i);
    await expect(page.getByRole('button', { name: /exit gallery/i })).toBeVisible();

    // 4. Verify request link button for locked email
    const sendLinkBtn = page.getByRole('button', { name: /send me the download link/i });
    await expect(sendLinkBtn).toBeVisible();
    await sendLinkBtn.click();
    await expect(page.locator('body')).toContainText(/secure download link has been sent/i);
  });

  test('3. Delivery Download Portal (/d/:token)', async ({ page }) => {
    await page.goto('/d/demo-download-token-liam');
    await page.waitForLoadState('networkidle');

    // Verify couple names and download package status
    await expect(page.locator('body')).toContainText(/Liam & Olivia/i);
    await expect(page.locator('body')).toContainText(/Part 1/i);
    await expect(page.locator('body')).toContainText(/Download Part 1/i);
  });

  test('4. Admin Authentication - Invalid & Valid Login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');

    // 1. Invalid credentials
    await page.locator('input[type="email"]').fill('admin@weddingstudio.com');
    await page.locator('input[type="password"]').fill('WrongPassword999!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('body')).toContainText(/invalid email or password/i);

    // 2. Valid credentials
    await page.locator('input[type="password"]').fill('AdminSecurePassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify redirect to admin dashboard
    await page.waitForURL('**/admin**');
    await expect(page.locator('body')).toContainText(/welcome back/i);
  });

  test('5. Admin Core - Categories Management', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to categories
    await page.goto('/admin/categories');
    await page.waitForLoadState('networkidle');

    // Verify existing categories
    await expect(page.locator('body')).toContainText(/Weddings/i);
    await expect(page.locator('body')).toContainText(/Engagements/i);

    // Add new category
    await page.getByRole('button', { name: /new category/i }).click();
    await page.locator('input[placeholder*="Wedding, Reception"]').fill('Portraits');
    await page.getByRole('button', { name: /create category/i }).click();

    // Verify new category in list
    await expect(page.locator('body')).toContainText(/Portraits/i);
  });

  test('6. Admin Core - Client Creation, Passkey & Soft Delete', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to clients
    await page.goto('/admin/clients');
    await page.waitForLoadState('networkidle');

    // Verify Ethan & Sophia is present
    await expect(page.locator('body')).toContainText(/Ethan & Sophia/i);

    // Create a new client with unique names
    const uniqueGroom = `Lucas${Date.now() % 1000}`;
    const uniqueBride = `Chloe${Date.now() % 1000}`;

    await page.getByRole('button', { name: /new client/i }).click();

    // Fill form inside modal
    const modal = page.locator('div[role="dialog"]');
    await modal.locator('input[placeholder*="David Miller"]').fill(uniqueGroom);
    await modal.locator('input[placeholder*="Emily Watson"]').fill(uniqueBride);
    await modal.locator('input[type="date"]').fill('2026-11-20');
    await modal.locator('select').selectOption({ index: 1 });
    await modal.locator('input[type="radio"][value="published"]').check();
    
    await modal.getByRole('button', { name: /create & generate passkey/i }).click();

    // Passkey modal should appear with auto-generated passkey
    await expect(page.locator('body')).toContainText(/client passkey generated/i);
    await page.getByRole('button', { name: /done & close/i }).click();

    // Verify newly created couple appears in client list
    const coupleText = `${uniqueGroom} & ${uniqueBride}`;
    await expect(page.locator('body')).toContainText(coupleText);

    // Soft delete the couple
    const row = page.locator(`tr:has-text("${coupleText}")`).first();
    await row.locator('button[title*="Move to trash"]').click();
    
    // Confirm in delete modal
    const deleteModal = page.locator('div[role="dialog"]');
    await deleteModal.getByRole('button', { name: 'Move to Trash', exact: true }).click();

    // Switch to Trash tab
    await page.getByRole('button', { name: 'Trash (30 Days)' }).click();
    await expect(page.locator('body')).toContainText(coupleText);

    // Restore client
    const trashRow = page.locator(`tr:has-text("${coupleText}")`).first();
    await trashRow.getByRole('button', { name: 'Restore' }).click();

    // Switch back to Active Galleries
    await page.getByRole('button', { name: 'Active Galleries' }).click();
    await expect(page.locator('body')).toContainText(coupleText);
  });

  test('7. Admin Storage Management & Maintenance', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to storage
    await page.goto('/admin/storage');
    await page.waitForLoadState('networkidle');

    // Verify Disk Usage & Variant cards
    await expect(page.locator('body')).toContainText(/storage overview/i);
    await expect(page.locator('body')).toContainText(/originals/i);
    await expect(page.locator('body')).toContainText(/previews/i);

    // Click recalculate storage
    const recalcBtn = page.getByRole('button', { name: /recalculate storage/i });
    await expect(recalcBtn).toBeVisible();
    await recalcBtn.click();
    await expect(page.locator('body')).toContainText(/storage recalculated/i);

    // Accept window.confirm automatically
    page.on('dialog', dialog => dialog.accept());

    // Click clear zip cache
    const clearZipBtn = page.getByRole('button', { name: /clear expired zips/i });
    await expect(clearZipBtn).toBeVisible();
    await clearZipBtn.click();
    await expect(page.locator('body')).toContainText(/cleared/i);
  });

  test('8. Admin Settings - Watermark, Branding & Delivery Rules', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to settings
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Verify Watermark tab
    await expect(page.locator('body')).toContainText(/watermark/i);

    // Switch to Branding tab
    const brandingTab = page.getByRole('button', { name: /branding/i });
    await brandingTab.click();
    await expect(page.locator('body')).toContainText(/studio details/i);

    // Switch to Delivery Rules tab
    const deliveryTab = page.getByRole('button', { name: /delivery rules/i });
    await deliveryTab.click();
    await expect(page.locator('body')).toContainText(/link validity/i);

    // Save Settings
    await page.getByRole('button', { name: /save settings/i }).click();
    await expect(page.locator('body')).toContainText(/settings saved successfully/i);
  });

});
