import { expect, test } from "@playwright/test";
import { ANSWER_EVENTS, DEPOSIT_SOURCE, doc, LEASE, mockApi, POLICY, sse } from "./support/mock-api";
import { expectNoAxeViolations, expectNoHorizontalScroll, expectNoSidewaysRegions, open } from "./support/page";

const ask = async (page: import("@playwright/test").Page, q: string) => {
  await page.getByLabel("Ask a question about your documents").fill(q);
  await page.keyboard.press("Enter");
};

test.describe("workspace", () => {
  test("answers with page-checked citation chips and evidence", async ({ page }) => {
    const api = await mockApi(page);
    const problems = await open(page, "/app", "dark");
    await expect(page.getByText("Sample lease").first()).toBeVisible();
    await ask(page, "When is the deposit refunded?");

    const answer = page.getByRole("article", { name: "Current answer" });
    await expect(answer.getByText(/refundable within 30 days/)).toBeVisible();
    await expect(answer.getByRole("button", { name: /Citation: Sample lease, page 2\. Supported by the cited page/ })).toBeVisible();
    await expect(answer.getByRole("button", { name: /Citation: Sample lease, page 3\. Not found on the cited page/ })).toBeVisible();
    await expect(answer.getByText("1 of 2")).toBeVisible();
    await expect(answer.getByRole("list", { name: "Page check results" })).toContainText("1 supported");
    await expect(answer.getByRole("list", { name: "Page check results" })).toContainText("1 unsupported");
    await expect(page.getByRole("status").filter({ hasText: "Answer complete" })).toHaveCount(1);

    expect(api.asked[0]).toMatchObject({ question: "When is the deposit refunded?", document_ids: [LEASE], task: "ask", mode: "hybrid", rerank: true });
    const evidence = page.getByRole("region", { name: "Evidence content" });
    await expect(evidence.getByRole("article", { name: "Passage 1, page 2" })).toContainText("Supported");

    await expectNoAxeViolations(page);
    await expectNoSidewaysRegions(page);
    expect(problems).toEqual([]);
  });

  test("a chip opens its check, and the cited page renders with the passage highlighted", async ({ page }) => {
    await mockApi(page);
    await open(page, "/app", "light");
    await ask(page, "When is the deposit refunded?");
    await page.getByRole("button", { name: /Citation: Sample lease, page 2/ }).click();
    const pop = page.getByRole("dialog").filter({ hasText: "86% of the statement" });
    await expect(pop).toBeVisible();
    await expect(pop.getByRole("img", { name: "86% word coverage" })).toBeVisible();
    await pop.getByRole("button", { name: "View page 2" }).click();
    await expect(page.getByRole("img", { name: "Page 2 of Sample lease, passage highlighted" })).toBeVisible({ timeout: 15_000 });
    await expectNoAxeViolations(page);
  });

  test("refusals are calm and offer suggestions", async ({ page }) => {
    const api = await mockApi(page, {
      stream: sse([
        { type: "stage", name: "understanding" },
        { type: "done", refused: true, usage: { latency_ms: 12 }, refusal: { title: "I couldn’t find this in your documents.", message: "Nothing answers this.", suggestions: ["Are pets allowed?"] } },
      ]),
    });
    await open(page, "/app");
    await ask(page, "What is the capital of France?");
    await expect(page.getByText("I couldn’t find this in your documents.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Are pets allowed?" }).click();
    await expect.poll(() => api.asked.length).toBe(2);
  });

  test("an early close keeps the partial answer and offers a retry", async ({ page }) => {
    await mockApi(page, { stream: sse(ANSWER_EVENTS.slice(0, 7)) });
    await open(page, "/app");
    await ask(page, "When is the deposit refunded?");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("The answer was cut short");
    await expect(page.getByRole("article", { name: "Current answer" }).getByText(/refundable within 30 days/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask again" })).toBeVisible();
  });

  test("a model failure shows the provider's reason", async ({ page }) => {
    await mockApi(page, { stream: sse([{ type: "stage", name: "drafting" }, { type: "error", message: "The answer model could not respond: model not found" }]) });
    await open(page, "/app");
    await ask(page, "When is the deposit refunded?");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("model not found");
  });

  test("compare needs exactly two documents and labels them A and B", async ({ page }) => {
    const docs = [doc(LEASE, "Sample lease", { doc_date: "2024-01-01" }), doc(POLICY, "Lease renewal", { doc_date: "2025-06-01" })];
    const api = await mockApi(page, {
      documents: docs,
      stream: sse([
        { type: "plan", mode: "compare", reason: "You chose Compare. A is the earlier document.", documents: [{ id: LEASE, title: "Sample lease", label: "A", passages: 2 }, { id: POLICY, title: "Lease renewal", label: "B", passages: 0 }], contributing: [LEASE] },
        { type: "sources", items: [DEPOSIT_SOURCE] },
        { type: "token", text: `## In both\n- Nothing found in the excerpts.\n\n## Differences\n- Deposit: A refunds in 30 days [${LEASE}, p. 2].` },
        { type: "done", refused: false, usage: { latency_ms: 900 }, citations: [] },
      ]),
    });
    await open(page, "/app");
    await page.getByRole("radio", { name: "Compare two" }).click();
    await expect(page.getByText("A is the earlier document")).toBeVisible();
    await page.getByRole("checkbox", { name: /Lease renewal/ }).uncheck({ force: true });
    await expect(page.getByLabel("Ask a question about your documents")).toBeVisible();
    await expect(page.getByText("Compare needs exactly two documents selected.")).toBeVisible();
    await page.getByRole("checkbox", { name: /Lease renewal/ }).check({ force: true });
    await ask(page, "What changed between them?");
    await expect(page.getByText("Comparison.")).toBeVisible();
    await expect(page.getByText(/Lease renewal contributed no passages/)).toBeVisible();
    expect(api.asked[0]).toMatchObject({ task: "compare", document_ids: [LEASE, POLICY] });
  });

  test("uploads report progress and the new document is selected", async ({ page }) => {
    await mockApi(page);
    await open(page, "/app");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "policy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByRole("checkbox", { name: /Uploaded policy/ })).toBeChecked();
  });

  test("document details can be corrected", async ({ page }) => {
    await mockApi(page);
    await open(page, "/app");
    await page.getByRole("button", { name: "Details for Sample lease" }).click();
    const sheet = page.getByRole("dialog", { name: "Sample lease" });
    await expect(sheet.getByText("this agreement")).toBeVisible();
    await sheet.getByRole("radio", { name: "Edit details" }).click();
    await sheet.getByLabel("Title").fill("Sample lease 2026");
    await expect(sheet.getByText("Edited")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Save changes" }).click();
    await expect(sheet.getByRole("status")).toHaveText("Saved.");
    await expect(sheet.getByText("Edited")).toHaveCount(1);
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("checkbox", { name: /Sample lease 2026/ })).toBeVisible();
  });

  test("on a phone the library and evidence open as sheets", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page);
    await open(page, "/app", "light");
    await ask(page, "When is the deposit refunded?");
    await expect(page.getByRole("article", { name: "Current answer" }).getByText(/refundable within 30 days/)).toBeVisible();
    await page.getByRole("button", { name: "Evidence" }).click();
    await expect(page.getByRole("dialog", { name: "Evidence" }).getByRole("article", { name: "Passage 1, page 2" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Library/ }).click();
    await expect(page.getByRole("dialog", { name: "Library" }).getByRole("checkbox", { name: /Sample lease/ })).toBeChecked();
    await page.keyboard.press("Escape");
    await expectNoHorizontalScroll(page);
    await expectNoSidewaysRegions(page);
  });
});
