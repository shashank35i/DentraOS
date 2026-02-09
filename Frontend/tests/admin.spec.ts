import { test, expect } from "@playwright/test";
import { setAuth } from "./helpers";

test.describe("Admin routes", () => {
  test("overview loads", async ({ page }) => {
    await setAuth(page, "Admin");
    await page.goto("/admin/overview");
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page).toHaveURL(/\/admin\/overview$/);
  });

  test("key admin pages load", async ({ page }) => {
    await setAuth(page, "Admin");
    const routes = [
      "/admin/clinic",
      "/admin/schedule",
      "/admin/patients",
      "/admin/cases",
      "/admin/case-ops",
      "/admin/alerts",
      "/admin/inventory",
      "/admin/revenue",
      "/admin/support",
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/") + "$"));
    }
  });
});
