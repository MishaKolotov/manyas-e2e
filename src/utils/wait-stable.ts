import type { Page } from '@playwright/test';

/**
 * Waits until the page is visually stable: fonts loaded, images decoded,
 * scroll at top. Use before pixel snapshots.
 */
export async function waitForVisualStability(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await (document as Document).fonts?.ready;
  });
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalHeight !== 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = img.onerror = () => resolve();
            }),
      ),
    );
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}
