import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type Theme = "light" | "dark";

/** Opens a route in a given theme and collects console errors and warnings. */
export async function open(page: Page, path: string, theme: Theme = "dark"): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  await page.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return problems;
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
