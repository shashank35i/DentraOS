import { test, expect } from "@playwright/test";
import { setAuth } from "./helpers";

test.describe("Patient routes", () => {
  test("overview loads", async ({ page }) => {
    await setAuth(page, "Patient");
    await page.goto("/patient/overview");
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page).toHaveURL(/\/patient\/overview$/);
  });

  test("key patient pages load", async ({ page }) => {
    await setAuth(page, "Patient");
    const routes = [
      "/patient/appointments",
      "/patient/treatments",
      "/patient/billing",
      "/patient/alerts",
      "/patient/support",
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/") + "$"));
    }
  });
});
