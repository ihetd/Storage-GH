import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "password123";
// Unique suffix so repeated runs don't collide on unique constraints.
const TAG = Date.now().toString().slice(-6);

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

test.describe.serial("shop inventory", () => {
  const categoryName = `E2E Cat ${TAG}`;
  const templateName = `E2E Sizes ${TAG}`;
  const productName = `E2E Tee ${TAG}`;

  test("admin can create a category", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/categories");
    await page.getByPlaceholder("e.g. Hoodies").fill(categoryName);
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText(categoryName)).toBeVisible();
  });

  test("admin can create a variant template", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/variant-templates");
    await page.getByPlaceholder("e.g. Clothing Sizes").fill(templateName);
    await page.getByPlaceholder("S, M, L, XL").fill("S, M, L");
    await page.getByRole("button", { name: "Add template" }).click();
    await expect(page.getByText(templateName)).toBeVisible();
  });

  test("admin can create a product using the template", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/products/new");
    await page.getByPlaceholder("e.g. Classic Logo Tee").fill(productName);
    await page
      .getByRole("combobox")
      .first()
      .selectOption({ label: categoryName });
    // Prefill variants from the template we created.
    await page
      .locator('select[name="variantTemplateId"]')
      .selectOption({ label: `${templateName} (S/M/L)` });
    // Template prefilled three variant rows.
    await expect(page.getByPlaceholder("e.g. M")).toHaveCount(3);
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL("**/dashboard/products");
    await expect(page.getByText(productName)).toBeVisible();
  });

  test("editor can adjust stock and it persists", async ({ page }) => {
    await login(page, "editor");
    await page.goto("/");
    // Expand our product's accordion.
    await page.getByRole("button", { name: new RegExp(productName) }).click();

    const inc = page.getByRole("button", { name: "Increase" }).first();
    const dec = page.getByRole("button", { name: "Decrease" }).first();
    await expect(inc).toBeVisible();

    // The first variant starts at 0; increment twice.
    await inc.click();
    await inc.click();
    // Quantity display sits between the two step buttons.
    const qty = page
      .locator("div", { has: dec })
      .locator("span")
      .filter({ hasText: /^\d+$/ })
      .first();
    await expect(qty).toHaveText("2");

    // Persist across a full reload.
    await page.reload();
    await page.getByRole("button", { name: new RegExp(productName) }).click();
    await expect(
      page
        .locator("div", { has: page.getByRole("button", { name: "Decrease" }).first() })
        .locator("span")
        .filter({ hasText: /^\d+$/ })
        .first(),
    ).toHaveText("2");
  });

  test("viewer sees quantities but no +/- controls", async ({ page }) => {
    await login(page, "viewer");
    await page.goto("/");
    await page.getByRole("button", { name: new RegExp(productName) }).click();
    await expect(
      page.getByRole("button", { name: "Increase" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Decrease" }),
    ).toHaveCount(0);
    // Quantity text still shows.
    await expect(page.getByText("in stock").first()).toBeVisible();
  });

  test("viewer is redirected away from the dashboard", async ({ page }) => {
    await login(page, "viewer");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
  });
});
