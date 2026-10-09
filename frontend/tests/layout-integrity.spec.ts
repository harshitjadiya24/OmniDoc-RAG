import { test } from "@playwright/test";
import { mockApi } from "./support/mock-api";
import { expectNoHorizontalScroll, expectNoSidewaysRegions, open, type Theme } from "./support/page";

const WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920, 2560];
const ROUTES = ["/", "/app"];
const THEMES: Theme[] = ["dark", "light"];

for (const path of ROUTES) {
  for (const theme of THEMES) {
    test(`${path} has no sideways scroll at any width (${theme})`, async ({ page }) => {
      await mockApi(page);
      await open(page, path, theme);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoHorizontalScroll(page);
        await expectNoSidewaysRegions(page);
      }
      // 200% zoom at 1280px behaves like a 640px viewport.
      await page.setViewportSize({ width: 640, height: 450 });
      await expectNoHorizontalScroll(page);
    });
  }
}

for (const theme of THEMES) {
  test(`an answered workspace fits every width (${theme})`, async ({ page }) => {
    await mockApi(page);
    await open(page, "/app", theme);
    await page.getByLabel("Ask a question about your documents").fill("When is the deposit refunded?");
    await page.keyboard.press("Enter");
    await page.getByRole("article", { name: "Current answer" }).getByText("Page check").waitFor();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
      await expectNoSidewaysRegions(page);
    }
  });
}
