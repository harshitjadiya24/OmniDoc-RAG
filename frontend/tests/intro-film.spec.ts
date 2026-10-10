import { expect, test } from "@playwright/test";
import { open } from "./support/page";

// The film itself is a large binary; these tests hold its request open so the player stays up, or fail it to check recovery.
test("the intro film covers the page on a first visit and can be skipped", async ({ page }) => {
  await page.route("**/film/*.mp4", () => undefined);
  await open(page, "/", "dark", { intro: true, idle: false });
  const film = page.getByRole("dialog", { name: "OmniDoc intro film" });
  await expect(film).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await expect(page.locator("main")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(film).toBeHidden();
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => sessionStorage.getItem("omnidoc-intro-seen"))).toBe("1");
});

test("the intro plays once per session", async ({ page }) => {
  await page.route("**/film/*.mp4", () => undefined);
  await open(page, "/", "dark", { intro: true, idle: false });
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "OmniDoc intro film" })).toHaveCount(0);
});

test("reduced motion skips the intro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/film/*.mp4", () => undefined);
  await open(page, "/", "dark", { intro: true, idle: false });
  await expect(page.getByRole("dialog", { name: "OmniDoc intro film" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a missing film never blocks the site", async ({ page }) => {
  await page.route("**/film/*.mp4", (r) => r.fulfill({ status: 404, body: "" }));
  await open(page, "/", "light", { intro: true });
  await expect(page.getByRole("dialog", { name: "OmniDoc intro film" })).toBeHidden();
  await expect(page.getByRole("heading", { name: /From upload/ })).toHaveCount(0);
  await page.getByRole("banner").getByRole("link", { name: "Open workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("the workspace never shows the intro", async ({ page }) => {
  await page.route("http://localhost:8000/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "access-control-allow-origin": "*" } }));
  await open(page, "/app", "dark", { intro: true });
  await expect(page.getByRole("dialog", { name: "OmniDoc intro film" })).toHaveCount(0);
});
