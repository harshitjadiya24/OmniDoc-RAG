import { test } from "@playwright/test";
import { expectNoHorizontalScroll, open, type Theme } from "./support/page";

const WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920, 2560];
const ROUTES = ["/", "/app"];
const THEMES: Theme[] = ["dark", "light"];

for (const path of ROUTES) {
  for (const theme of THEMES) {
    test(`${path} has no sideways scroll at any width (${theme})`, async ({ page }) => {
      await open(page, path, theme);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoHorizontalScroll(page);
      }
      // 200% zoom at 1280px behaves like a 640px viewport.
      await page.setViewportSize({ width: 640, height: 450 });
      await expectNoHorizontalScroll(page);
    });
  }
}
