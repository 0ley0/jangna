import { expect, test } from "@playwright/test";
import { alertDialog, api, dialog, openAs, registerShop } from "./helpers";

test.describe("สาขา", () => {
  test("เพิ่มสาขาใน dialog → ปรากฏในตาราง และ dialog ปิดเอง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/branches");

    await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
    await dialog(page).getByLabel("ชื่อสาขา").fill("โกดังบางนา");
    await dialog(page).getByLabel("ละติจูด (ไม่บังคับ)").fill("13.66");
    await dialog(page).getByLabel("ลองจิจูด (ไม่บังคับ)").fill("100.6");
    await dialog(page).getByRole("button", { name: "เพิ่มสาขา" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "โกดังบางนา" })).toBeVisible();
  });

  test("พิกัดนอกช่วงที่เป็นไปได้ → server ปฏิเสธและ dialog ไม่ปิด", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/branches");

    await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
    await dialog(page).getByLabel("ชื่อสาขา").fill("พิกัดผิด");
    await dialog(page).getByLabel("ละติจูด (ไม่บังคับ)").fill("91");
    await dialog(page).getByLabel("ลองจิจูด (ไม่บังคับ)").fill("100");
    await dialog(page).getByRole("button", { name: "เพิ่มสาขา" }).click();

    await expect(dialog(page)).toContainText("ละติจูด");
    await expect(page.getByRole("cell", { name: "พิกัดผิด" })).toHaveCount(0);
  });

  test("ปิด dialog ด้วย Esc / ปุ่ม × แล้วเปิดใหม่ ฟอร์มต้องว่าง ไม่เหลือ error เก่า", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/branches");

    await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
    await dialog(page).getByLabel("ชื่อสาขา").fill("ค้างอยู่");
    await dialog(page).getByLabel("ละติจูด (ไม่บังคับ)").fill("999");
    await dialog(page).getByLabel("ลองจิจูด (ไม่บังคับ)").fill("100");
    await dialog(page).getByRole("button", { name: "เพิ่มสาขา" }).click();
    await expect(dialog(page)).toContainText("ละติจูด");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "เพิ่มสาขา" }).click();
    await expect(dialog(page).getByLabel("ชื่อสาขา")).toHaveValue("");
    await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("วันหยุด", () => {
  /** เลือกวันที่ 15 ในปฏิทินของ DateField ที่เปิดอยู่ (เดือนปัจจุบัน) */
  async function pickDay15(page: import("@playwright/test").Page) {
    await dialog(page).getByRole("button", { name: /^วันที่/ }).click();
    await dialog(page).getByRole("button", { name: "15", exact: true }).first().click();
  }

  test("เพิ่มวันหยุด → แสดงในรายการ, เพิ่มวันเดิมซ้ำถูกปฏิเสธ", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/holidays");

    for (const name of ["วันหยุดทดสอบ", "ซ้ำวันเดิม"]) {
      await page.getByRole("button", { name: "เพิ่มวันหยุด" }).first().click();
      await pickDay15(page);
      await dialog(page).getByLabel("ชื่อวันหยุด").fill(name);
      await dialog(page).getByRole("button", { name: "เพิ่มวันหยุด" }).click();
      if (name === "วันหยุดทดสอบ") await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(dialog(page).getByRole("alert")).toContainText("วันนี้เป็นวันหยุดอยู่แล้ว");
    await page.keyboard.press("Escape");
    await expect(page.getByText("วันหยุดทดสอบ")).toBeVisible();
    await expect(page.getByText("ซ้ำวันเดิม")).toHaveCount(0);
  });

  test("ลบวันหยุด: ยกเลิกใน dialog เตือน = ยังอยู่, ยืนยัน = หาย", async ({ page, request }) => {
    const shop = await registerShop(request);
    const year = new Date().getFullYear();
    await api(request, shop, "POST", "/api/holidays", { date: `${year}-05-01`, name: "วันแรงงานทดสอบ" });
    await openAs(page, shop, "/app/holidays");

    await page.getByRole("button", { name: "ลบ" }).click();
    await expect(alertDialog(page)).toContainText("วันแรงงานทดสอบ");
    await alertDialog(page).getByRole("button", { name: "ยกเลิก" }).click();
    await expect(alertDialog(page)).toHaveCount(0);
    await expect(page.getByText("วันแรงงานทดสอบ")).toBeVisible();

    await page.getByRole("button", { name: "ลบ" }).click();
    await alertDialog(page).getByRole("button", { name: "ลบ" }).click();
    await expect(page.getByText("วันแรงงานทดสอบ")).toHaveCount(0);
  });

  test("คลิกพื้นหลังไม่ปิด dialog เตือน (ต้องกดยกเลิก/ยืนยัน)", async ({ page, request }) => {
    const shop = await registerShop(request);
    const year = new Date().getFullYear();
    await api(request, shop, "POST", "/api/holidays", { date: `${year}-05-01`, name: "กันพลาด" });
    await openAs(page, shop, "/app/holidays");

    await page.getByRole("button", { name: "ลบ" }).click();
    await expect(alertDialog(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(alertDialog(page)).toBeVisible();
    await alertDialog(page).getByRole("button", { name: "ยกเลิก" }).click();
  });
});
