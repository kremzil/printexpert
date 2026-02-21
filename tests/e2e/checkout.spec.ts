import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv();

async function getFirstActiveProductId(
): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query<{ id: string }>(`
      SELECT p.id
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE p."isActive" = true
        AND c."isActive" = true
      ORDER BY p."createdAt" ASC
      LIMIT 1
    `);

    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function seedCheckoutCart(
  request: APIRequestContext,
  productId: string
): Promise<void> {
  const clearResponse = await request.post("/api/cart/clear");
  expect(clearResponse.ok()).toBeTruthy();

  const addResponse = await request.post("/api/cart/add", {
    data: {
      productId,
      quantity: 1,
      priceSnapshot: {
        net: 10,
        vatAmount: 2,
        gross: 12,
        currency: "EUR",
      },
    },
  });

  expect(addResponse.ok()).toBeTruthy();
}

test.describe("Checkout flow", () => {
  test("redirects to cart when checkout is opened with empty cart", async ({
    page,
  }) => {
    await page.goto("/checkout");

    await expect(page).toHaveURL(/\/cart$/);
  });

  test("validates required fields and proceeds to payment step", async ({
    page,
  }) => {
    const productId = await getFirstActiveProductId();
    test.skip(!productId, "Nebolo možné nájsť aktívny produkt pre checkout test.");

    await seedCheckoutCart(page.request, productId as string);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Pokladňa" })).toBeVisible();

    await page.getByRole("button", { name: "Pokračovať" }).click();
    await expect(page.getByText("Vyplňte povinné údaje.")).toBeVisible();

    await page.getByLabel(/Meno/i).fill("Ján");
    await page.getByLabel(/Priezvisko/i).fill("Novák");
    await page.getByLabel(/Email/i).fill("jan.novak@example.com");
    await page.getByLabel(/Telefón/i).fill("+421900123456");
    await page.getByLabel(/Ulica a číslo/i).fill("Hlavná 1");
    await page.getByLabel(/Mesto/i).fill("Košice");
    await page.getByLabel(/PSČ/i).fill("04001");

    await page.getByRole("button", { name: "Pokračovať" }).click();
    await expect(page.getByRole("heading", { name: "Platba" })).toBeVisible();
  });
});
