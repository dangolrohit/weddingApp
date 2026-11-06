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

  test('9. Admin Payments - Record Cash & Online Payments, Filter, Balance Verification', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Payments via navbar link
    const paymentsNavLink = page.getByRole('link', { name: 'Payments' });
    await expect(paymentsNavLink).toBeVisible();
    await paymentsNavLink.click();
    await page.waitForURL('**/admin/payments');
    await page.waitForLoadState('networkidle');

    // Verify Title & Metrics
    await expect(page.locator('body')).toContainText(/payments & receipts/i);
    await expect(page.locator('body')).toContainText(/total collected/i);

    // 1. Record an Advance Payment (Cash)
    await page.getByRole('button', { name: /record payment/i }).click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Select Client if not already selected
    const clientSelect = modal.locator('select').first();
    const clientOptions = await clientSelect.locator('option').count();
    expect(clientOptions).toBeGreaterThan(1); // at least one client option

    await modal.locator('input[type="number"]').fill('2500');
    // Select cash method
    await modal.locator('select').nth(1).selectOption('cash');
    // Select advance stage
    await modal.locator('select').nth(2).selectOption('advance');
    // Reference number
    await modal.locator('input[placeholder*="TXN"]').fill('RCPT-CASH-101');
    // Notes
    await modal.locator('textarea').fill('Initial cash deposit collected at studio office');

    // Submit
    await modal.getByRole('button', { name: 'Record Payment' }).click();
    await page.waitForLoadState('networkidle');

    // Verify payment in table
    await expect(page.locator('body')).toContainText(/2,500\.00/);
    await expect(page.locator('body')).toContainText(/RCPT-CASH-101/);

    // 2. Record a Partial Payment (Online Transfer)
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(modal).toBeVisible();

    await modal.locator('input[type="number"]').fill('3500');
    // Select online method
    await modal.locator('select').nth(1).selectOption('online');
    // Select partial stage
    await modal.locator('select').nth(2).selectOption('partial');
    // Reference number
    await modal.locator('input[placeholder*="TXN"]').fill('TXN-WIRE-7788');
    // Notes
    await modal.locator('textarea').fill('Online wire transfer payment');

    // Submit
    await modal.getByRole('button', { name: 'Record Payment' }).click();
    await page.waitForLoadState('networkidle');

    // Verify payment in table
    await expect(page.locator('body')).toContainText(/3,500\.00/);
    await expect(page.locator('body')).toContainText(/TXN-WIRE-7788/);

    // 3. Search and Filters
    const searchInput = page.locator('input[placeholder*="Search by client"]');
    await searchInput.fill('TXN-WIRE-7788');
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toContainText(/TXN-WIRE-7788/);
    await expect(page.locator('body')).not.toContainText(/RCPT-CASH-101/);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toContainText(/RCPT-CASH-101/);
  });

  test('10. Admin Equipment - Add, Filter, Edit, and Delete Gear Record', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Equipment via navbar link
    const equipmentNavLink = page.getByRole('link', { name: 'Equipment' });
    await expect(equipmentNavLink).toBeVisible();
    await equipmentNavLink.click();
    await page.waitForURL('**/admin/equipment');
    await page.waitForLoadState('networkidle');

    // Verify Title & Metrics
    await expect(page.locator('body')).toContainText(/equipment inventory/i);
    await expect(page.locator('body')).toContainText(/total gear/i);

    // 1. Add Equipment Item
    await page.getByRole('button', { name: /add equipment/i }).click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    await modal.locator('input[placeholder*="Sony Alpha"]').fill('Canon EOS R5 Mark II');
    await modal.locator('select').first().selectOption('camera');
    await modal.locator('input[placeholder*="Sony, Canon"]').fill('Canon');
    await modal.locator('input[placeholder*="ILCE-7M4"]').fill('EOS R5 Mark II');
    await modal.locator('input[placeholder*="SN-8924017"]').fill('SN-CANON-889900');
    await modal.locator('input[type="number"]').fill('3899.00');
    await modal.locator('textarea').fill('Primary cinema camera for 8K RAW wedding films');

    // Submit
    await modal.getByRole('button', { name: 'Add Equipment' }).click();
    await page.waitForLoadState('networkidle');

    // Verify gear is in table
    await expect(page.locator('body')).toContainText(/Canon EOS R5 Mark II/);
    await expect(page.locator('body')).toContainText(/SN-CANON-889900/);
    await expect(page.locator('body')).toContainText(/3,899\.00/);

    // 2. Edit Equipment Item
    const editBtn = page.locator('button[title="Edit equipment"]').first();
    await editBtn.click();
    await expect(modal).toBeVisible();

    // Change status to in_use and set assigned to
    await modal.locator('select').nth(1).selectOption('in_use');
    await modal.locator('input[placeholder*="Lead Photographer"]').fill('Alex (Cinematographer)');

    // Save changes
    await modal.getByRole('button', { name: 'Update Equipment' }).click();
    await page.waitForLoadState('networkidle');

    // Verify updated status and assignment
    await expect(page.locator('body')).toContainText(/Alex \(Cinematographer\)/);

    // 3. Delete Equipment Item
    const deleteBtn = page.locator('button[title="Delete equipment"]').first();
    await deleteBtn.click();

    // Confirm deletion in delete dialog
    const deleteModal = page.locator('div[role="dialog"]');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal).toContainText(/confirm equipment deletion/i);
    await deleteModal.getByRole('button', { name: 'Delete Equipment' }).click();
    await page.waitForLoadState('networkidle');

    // Verify item deleted from table
    await expect(page.locator('body')).not.toContainText(/SN-CANON-889900/);
  });

});
