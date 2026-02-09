import { test, expect } from "@playwright/test";
import { setAuth } from "./helpers";

test.describe("Doctor routes", () => {
  test("overview loads", async ({ page }) => {
    await setAuth(page, "Doctor");
    await page.goto("/doctor/overview");
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page).toHaveURL(/\/doctor\/overview$/);
  });

  test("key doctor pages load", async ({ page }) => {
    await setAuth(page, "Doctor");
    const routes = [
      "/doctor/schedule",
      "/doctor/cases",
      "/doctor/patients",
      "/doctor/insights",
      "/doctor/alerts",
      "/doctor/support",
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/") + "$"));
    }
  });
});
