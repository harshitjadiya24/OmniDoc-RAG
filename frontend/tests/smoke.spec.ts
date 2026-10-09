import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, open, type Theme } from "./support/page";

const ROUTES = [
  { path: "/", heading: /answers that/i },
  { path: "/app", heading: /workspace/i },
];
const THEMES: Theme[] = ["dark", "light"];

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`${route.path} renders cleanly in ${theme}`, async ({ page }) => {
      const problems = await open(page, route.path, theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expectNoAxeViolations(page);
      expect(problems).toEqual([]);
    });
  }
}

test("unknown routes show the 404 page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/no evidence/i);
});

test("theme toggle switches the theme", async ({ page }) => {
  await open(page, "/", "dark");
  await page.getByRole("button", { name: /switch to light theme/i }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("skip link moves focus to main content", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
