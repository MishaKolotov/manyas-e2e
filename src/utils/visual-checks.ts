import { expect, type Locator, type Page } from '@playwright/test';

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal page scroll detected (long string broke layout?)').toBe(false);
}

export async function assertNoTextClipping(locator: Locator): Promise<void> {
  const clipped = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const hides = style.overflow === 'hidden' || style.textOverflow === 'ellipsis';
    if (!hides) return false;
    return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
  });
  expect(clipped, 'text appears clipped inside overflow:hidden').toBe(false);
}

export async function assertButtonInViewport(button: Locator): Promise<void> {
  await expect(button).toBeInViewport();
}
