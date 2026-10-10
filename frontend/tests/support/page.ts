import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type Theme = "light" | "dark";

/** Opens a route in a given theme and collects console errors and warnings. */
export async function open(page: Page, path: string, theme: Theme = "dark", { intro = false, idle = true } = {}): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  await page.addInitScript(
    ([t, showIntro]) => {
      window.localStorage.setItem("theme", t as string);
      // Most tests are about the page itself, so the intro film counts as already seen.
      if (!showIntro) window.sessionStorage.setItem("omnidoc-intro-seen", "1");
    },
    [theme, intro] as const,
  );
  // The film is a large binary that tests don't need: serve a stand-in unless the test routes it itself.
  if (!intro) await page.route("**/film/*.mp4", (r) => r.fulfill({ status: 200, contentType: "video/mp4", body: "" }));
  await page.goto(path);
  if (idle) await page.waitForLoadState("networkidle");
  return problems;
}

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Let entrance fades finish: axe measures contrast at the current, partly transparent, opacity.
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** No scroll region may scroll sideways either (tables and code blocks have their own labelled containers). */
export async function expectNoSidewaysRegions(page: Page): Promise<void> {
  const offenders = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="region"]'))
      .filter((el) => !el.closest("[data-wide]") && el.scrollWidth - el.clientWidth > 1)
      .map((el) => el.getAttribute("aria-label") ?? el.tagName),
  );
  expect(offenders).toEqual([]);
}
