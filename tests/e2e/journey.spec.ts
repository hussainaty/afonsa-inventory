import { expect, type Page, test } from "@playwright/test";

const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function signUp(page: Page, name: string, email: string, next?: string) {
  await page.goto(next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
}

function stockPanel(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: "Stock by location" }) });
}

async function stockDialog(page: Page, action: "Add" | "Subtract" | "Move" | "Count") {
  await stockPanel(page).getByRole("button", { name: action, exact: true }).click();
  return page.getByRole("dialog");
}

test("owner sets up inventory, moves stock and invites a teammate", async ({ page, browser }, info) => {
  const ownerEmail = `owner-${run}-${info.project.name}@example.com`;
  const teammateEmail = `mate-${run}-${info.project.name}@example.com`;

  // Protected pages redirect to sign-in.
  await page.goto("/products");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fproducts/);

  // Sign up -> onboarding -> workspace.
  await signUp(page, "Afonsa Owner", ownerEmail);
  await expect(page.getByRole("heading", { name: /Welcome, Afonsa/ })).toBeVisible();
  await page.getByLabel("Workspace name").fill(`Afonsa Store ${info.project.name}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Add your first product" })).toBeVisible();

  // Category.
  await page.goto("/categories");
  await page.getByLabel("Name").first().fill("Power tools");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Category saved")).toBeVisible();

  // Section inside the default warehouse.
  await page.goto("/locations");
  await page.getByLabel("Section name").fill("Shelf A");
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByText("Created WH/Stock/Shelf A")).toBeVisible();

  // Product with opening stock in Shelf A.
  await page.goto("/products/new");
  await page.getByLabel("Name").fill("Cordless drill");
  await page.getByLabel("Size / variant").fill("18 inch");
  await page.getByLabel("Category").selectOption({ label: "Power tools" });
  await page.getByLabel("SKU / internal reference").fill(`DRL-${run}`);
  await page.getByLabel("Sale price").fill("129.90");
  await page.getByLabel("Quantity").fill("10");
  await page.getByLabel("Location / section").selectOption({ label: "WH/Stock/Shelf A" });
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("heading", { name: "Cordless drill" })).toBeVisible();
  await expect(stockPanel(page).getByText("Total on hand: 10 pcs")).toBeVisible();

  // Photo upload (resized in the browser, stored, served back through the auth-gated route).
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 96, height: 72 } });
  await page.getByLabel("Choose photos").setInputFiles({ name: "drill.png", mimeType: "image/png", buffer: png });
  const photo = page.getByRole("img", { name: "Cordless drill photo 1" });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("Main photo")).toBeVisible();

  // Add 5.
  let dialog = await stockDialog(page, "Add");
  await dialog.getByLabel("Location / section").selectOption({ label: "WH/Stock/Shelf A · 10 pcs" });
  await dialog.getByLabel("Amount (pcs)").fill("5");
  await dialog.getByRole("button", { name: "Add to stock" }).click();
  await expect(dialog.getByText(/Added 5 · IN\/\d{5}/)).toBeVisible();
  await expect(stockPanel(page).getByText("Total on hand: 15 pcs")).toBeVisible();

  // Subtract 3.
  dialog = await stockDialog(page, "Subtract");
  await dialog.getByLabel("Amount (pcs)").fill("3");
  await dialog.getByRole("button", { name: "Subtract from stock" }).click();
  await expect(dialog.getByText(/Subtracted 3 · OUT\/\d{5}/)).toBeVisible();
  await expect(stockPanel(page).getByText("Total on hand: 12 pcs")).toBeVisible();

  // Subtracting more than available is refused and nothing changes.
  dialog = await stockDialog(page, "Subtract");
  await dialog.getByLabel("Amount (pcs)").fill("500");
  await dialog.getByRole("button", { name: "Subtract from stock" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Not enough");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(stockPanel(page).getByText("Total on hand: 12 pcs")).toBeVisible();

  // Move 2 to the parent Stock location.
  dialog = await stockDialog(page, "Move");
  await dialog.getByLabel("To", { exact: true }).selectOption({ label: "WH/Stock" });
  await dialog.getByLabel("Amount (pcs)").fill("2");
  await dialog.getByRole("button", { name: "Move stock" }).click();
  await expect(dialog.getByText(/Moved 2 · INT\/\d{5}/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  const rows = stockPanel(page).locator(":scope > ul > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "WH/Stock/Shelf A" })).toContainText("10 pcs");
  await expect(rows.filter({ hasNotText: "Shelf A" })).toContainText("2 pcs");
  await expect(stockPanel(page).getByText("Total on hand: 12 pcs")).toBeVisible();

  // History records every move.
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "History" }) }).locator("li")).toHaveCount(4);

  // Another size of the same part gets its own stock.
  await page.getByRole("link", { name: "Add another size" }).click();
  await expect(page.getByRole("heading", { name: "Add another size of Cordless drill" })).toBeVisible();
  await page.getByLabel("Size / variant").fill("15 inch");
  await page.getByLabel("Quantity").fill("4");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(stockPanel(page).getByText("Total on hand: 4 pcs")).toBeVisible();
  const sizes = page.locator("section", { has: page.getByRole("heading", { name: "Sizes of this part" }) });
  await expect(sizes.locator("ul > li")).toHaveCount(2);
  await expect(sizes.getByRole("link", { name: /18 inch/ })).toContainText("12 pcs");
  await page.goto("/products?q=Cordless");
  await expect(page.getByText(/18 inch/).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText(/15 inch/).filter({ visible: true })).toHaveCount(1);

  // Product list search + location filter.
  await page.goto(`/products?q=DRL-${run}`);
  await expect(page.getByRole("link", { name: /Cordless drill/ }).first()).toBeVisible();

  // Invite a teammate; they join via the link and see the same stock.
  await page.goto("/team");
  await page.getByLabel("Email").fill(teammateEmail);
  await page.getByRole("button", { name: "Create invite" }).click();
  const link = await page.getByLabel("Invitation link").first().inputValue();
  expect(link).toMatch(/\/invite\//);
  const invitePath = new URL(link).pathname;

  const mateContext = await browser.newContext(info.project.use);
  const mate = await mateContext.newPage();
  await mate.goto(invitePath);
  await expect(mate.getByRole("heading", { name: /Join Afonsa Store/ })).toBeVisible();
  await mate.getByRole("link", { name: /Create an account/ }).click();
  await mate.getByLabel("Full name").fill("Team Mate");
  await mate.getByLabel("Email").fill(teammateEmail);
  await mate.getByLabel("Password").fill("correct-horse-battery");
  await mate.getByRole("button", { name: "Create account" }).click();
  await expect(mate).toHaveURL(new RegExp(invitePath));
  await mate.getByRole("button", { name: "Accept and join" }).click();
  await expect(mate).toHaveURL(/\/dashboard/);
  await mate.goto(`/products?q=DRL-${run}`);
  await mate.getByRole("link", { name: /Cordless drill/ }).first().click();
  await expect(stockPanel(mate).getByText("Total on hand: 12 pcs")).toBeVisible();

  // Members cannot manage the team.
  await mate.goto("/team");
  await expect(mate.getByRole("heading", { name: "Invite someone" })).toHaveCount(0);

  await page.screenshot({ path: `test-results/${info.project.name}-team.png`, fullPage: true });
  await mate.goto("/dashboard");
  await mate.screenshot({ path: `test-results/${info.project.name}-mate-dashboard.png`, fullPage: true });
  await mateContext.close();
});
