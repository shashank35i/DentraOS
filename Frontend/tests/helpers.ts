import { Page } from "@playwright/test";

export async function setAuth(page: Page, role: "Admin" | "Doctor" | "Patient") {
  await page.addInitScript(
    ({ token, roleValue }) => {
      localStorage.setItem("authToken", token);
      localStorage.setItem("role", roleValue);
      localStorage.setItem("userName", "E2E User");
      localStorage.setItem("userId", "1");
    },
    { token: "e2e-token", roleValue: role }
  );
}
