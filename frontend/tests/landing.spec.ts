import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalScroll, open, type Theme } from "./support/page";

/** Scroll through once so every scroll-triggered reveal has run before checking. */
async function revealAll(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
}

for (const theme of ["dark", "light"] as Theme[]) {
  test(`landing is accessible and clean in ${theme}`, async ({ page }) => {
    const problems = await open(page, "/", theme);
    await revealAll(page);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    expect(problems).toEqual([]);
  });
}

test("every scripted demo is labelled as such", async ({ page }) => {
  await open(page, "/");
  await expect(page.getByText("Sample replay · scripted, not your documents")).toBeVisible();
  await revealAll(page);
  for (const label of ["Illustrative ranks · real formula", "Live scoring · fictional page", "Illustration · fictional documents"]) {
    await expect(page.getByText(label)).toHaveCount(1);
  }
});

test("the verification demo scores claims like the backend, including its blind spot", async ({ page }) => {
  await open(page, "/");
  const section = page.locator("#verification");
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("radio", { name: /photo inventory/ }).check();
  await expect(section.getByText("4 of 7 key words")).toBeVisible();
  await section.getByRole("radio", { name: /Interest is payable/ }).check();
  await expect(section.getByText(/Word overlap cannot see negation/)).toBeVisible();
  await expect(section.getByRole("img", { name: "100% word coverage" })).toBeVisible();
});

test("reduced motion shows the finished replay without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/");
  await expect(page.getByText("Citations resolved 3 of 3")).toBeVisible();
});

test("the header links to the workspace and in-page sections", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Verification" }).click();
  await expect(page.locator("#verification-title")).toBeInViewport();
  await page.getByRole("banner").getByRole("link", { name: "Open workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("the mobile menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, "/", "light");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "FAQ" }).click();
  await expect(menu).toBeHidden();
  await expectNoHorizontalScroll(page);
});
