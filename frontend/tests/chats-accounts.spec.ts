import { expect, test } from "@playwright/test";
import { mockApi } from "./support/mock-api";
import { expectNoAxeViolations, open } from "./support/page";

const ask = async (page: import("@playwright/test").Page, q: string) => {
  await page.getByLabel("Ask a question about your documents").fill(q);
  await page.keyboard.press("Enter");
};

test("answers are saved to a chat that can be reopened", async ({ page }) => {
  const api = await mockApi(page);
  await open(page, "/app");
  await ask(page, "When is the deposit refunded?");
  await expect(page.getByRole("button", { name: /Chat history\. Current: When is the deposit refunded\?/ })).toBeVisible();
  expect(api.chats[0].messages).toHaveLength(1);

  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByRole("button", { name: /Current: New chat/ })).toBeVisible();
  await expect(page.getByRole("article", { name: "Current answer" })).toHaveCount(0);

  await page.getByRole("button", { name: /Chat history/ }).click();
  await page.getByRole("list", { name: "Saved chats" }).getByRole("button", { name: /^When is the deposit refunded/ }).click();
  const saved = page.getByRole("article", { name: "Earlier answer: When is the deposit refunded?" });
  await expect(saved.getByRole("button", { name: /page 2\. Supported/ })).toBeVisible();

  // The next question continues the same chat.
  await ask(page, "Are pets allowed?");
  await expect.poll(() => api.asked.at(-1)?.chat_id).toBe("chat_1");
});

test("accounts: the workspace asks for sign-in and sends the token", async ({ page }) => {
  const api = await mockApi(page, { authEnabled: true });
  await open(page, "/app", "light");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByLabel("Email").fill("officer@example.com");
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is wrong.");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Sample lease/ })).toBeChecked();
  await ask(page, "When is the deposit refunded?");
  await expect(page.getByRole("article", { name: "Current answer" }).getByText(/refundable/)).toBeVisible();
  expect(api.asked).toHaveLength(1);
  await page.getByRole("button", { name: "Account: officer@example.com" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("an unreachable API gets a clear screen, not a broken workspace", async ({ page }) => {
  await page.route("http://localhost:8000/**", (r) => r.abort("connectionrefused"));
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "The API isn’t answering." })).toBeVisible();
  await expect(page.getByText("uvicorn src.api.main:app")).toBeVisible();
});

test("the command palette runs actions and finds documents", async ({ page }) => {
  await mockApi(page);
  const problems = await open(page, "/app");
  await expect(page.getByRole("checkbox", { name: /Sample lease/ })).toBeChecked();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder("Search actions, chats and documents…").fill("sample");
  await palette.getByRole("option", { name: /Sample lease/ }).click();
  await expect(page.getByRole("dialog", { name: "Sample lease" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByRole("option", { name: "Ask a question" }).click();
  await expect(page.getByLabel("Ask a question about your documents")).toBeFocused();
  expect(problems).toEqual([]);
});
