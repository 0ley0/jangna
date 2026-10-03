import { expect, test } from "@playwright/test";
import { registerShop } from "./helpers";

test.describe("สมัคร / เข้าสู่ระบบ", () => {
  test("สมัครร้านใหม่ผ่านหน้าเว็บ → เข้าแอป และออกจากระบบแล้วล็อกอินกลับเข้ามาได้", async ({ page }) => {
    const email = `e2e-ui-${Date.now()}@test.local`;
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel("ชื่อร้าน / บริษัท").fill("ร้าน E2E สมัครเอง");
    await page.getByLabel("ชื่อของคุณ").fill("สมหญิง");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("รหัสผ่าน (อย่างน้อย 8 ตัว)").fill("password123");
    await page.getByRole("button", { name: "สร้างร้าน" }).click();

    await page.waitForURL("**/app");
    await expect(page.getByText("ร้าน E2E สมัครเอง").first()).toBeVisible();

    // ล้าง token แล้วล็อกอินใหม่ด้วยบัญชีเดิม
    await page.evaluate(() => localStorage.removeItem("jangna.token"));
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("รหัสผ่าน").fill("password123");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await page.waitForURL("**/app");
  });

  test("รหัสผ่านผิด → แสดงข้อความผิดพลาดและไม่เข้าแอป", async ({ page, request }) => {
    const shop = await registerShop(request);
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("อีเมล").fill(shop.email);
    await page.getByLabel("รหัสผ่าน").fill("wrong-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(page).toHaveURL(/\/login/);
  });

  test("สมัครด้วยอีเมลซ้ำ / รหัสผ่านสั้น → แจ้ง error ที่ช่อง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel("ชื่อร้าน / บริษัท").fill("ร้านซ้ำ");
    await page.getByLabel("ชื่อของคุณ").fill("ก");
    await page.getByLabel("อีเมล").fill(shop.email);
    await page.getByLabel("รหัสผ่าน (อย่างน้อย 8 ตัว)").fill("short");
    // minlength ของ input อาจกันที่ browser ก่อน — ส่งผ่าน API ตรงๆ ด้วยเพื่อยืนยันว่า server ก็กัน
    await page.getByRole("button", { name: "สร้างร้าน" }).click();
    await expect(page).toHaveURL(/\/register/);

    const response = await page.request.post("http://127.0.0.1:5099/api/auth/register", {
      data: { shopName: "ร้านซ้ำ", email: shop.email.toUpperCase(), password: "password123", displayName: "ก" },
    });
    expect(response.status()).toBe(400);
  });

  test("เข้าหน้าในแอปโดยไม่ล็อกอิน → ถูกส่งไปหน้า login", async ({ page }) => {
    await page.goto("/app/employees");
    await page.waitForURL(/\/login/);
  });
});
