import { expect, test } from "@playwright/test";
import { alertDialog, api, choose, dialog, openAs, registerShop, type Shop } from "./helpers";
import type { APIRequestContext } from "@playwright/test";

interface Id {
  id: string;
}

/** แม่แบบกะ + พนักงานรายวัน 1 คน เตรียมผ่าน API */
async function seed(request: APIRequestContext, shop: Shop) {
  const morning = await api<Id>(request, shop, "POST", "/api/shift-templates", { name: "กะเช้า", startTime: "08:00:00", endTime: "17:00:00", breakMinutes: 60, color: "sage" });
  const evening = await api<Id>(request, shop, "POST", "/api/shift-templates", { name: "กะบ่าย", startTime: "14:00:00", endTime: "23:00:00", breakMinutes: 60, color: "amber" });
  const employee = await api<Id>(request, shop, "POST", "/api/employees", { firstName: "ทดสอบกะ", payType: "Daily", baseRate: 400, workerType: "Employee" });
  return { morning, evening, employee };
}

test.describe("นโยบายการทำงาน", () => {
  test("สร้างนโยบายซ้ำทุกสัปดาห์ → กำหนดให้พนักงาน → สร้างกะที่หน้ากะงาน (จ-ศ 5 กะ) และสร้างซ้ำไม่เพิ่ม", async ({ page, request }) => {
    const shop = await registerShop(request);
    await seed(request, shop);
    await openAs(page, shop, "/app/work-policies");

    await page.getByRole("button", { name: "สร้างนโยบาย" }).click();
    await dialog(page).getByLabel("ชื่อนโยบาย").fill("แพ็คเกอร์กะเช้า");
    await choose(page, dialog(page).getByRole("combobox", { name: "เติม จ-ศ ด้วยกะเดียวกัน" }), /กะเช้า/);
    await dialog(page).getByRole("button", { name: "สร้างนโยบาย" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const card = page.locator("[data-slot=card]", { hasText: "แพ็คเกอร์กะเช้า" });
    await expect(card).toContainText("ซ้ำทุกสัปดาห์");
    await expect(card).toContainText("0 คน");

    await card.getByRole("button", { name: "กำหนดให้พนักงาน" }).click();
    await dialog(page).getByRole("checkbox", { name: /ทดสอบกะ/ }).check();
    await dialog(page).getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toContainText("1 คน");

    await page.goto("/app/shifts");
    await page.getByRole("button", { name: "สร้างจากนโยบายงาน" }).click();
    await expect(page.getByText(/สร้างจากนโยบาย 5 กะ/)).toBeVisible();
    await page.getByRole("button", { name: "สร้างจากนโยบายงาน" }).click();
    await expect(page.getByText(/สร้างจากนโยบาย 0 กะ \(ข้ามช่องที่มีกะอยู่แล้ว 5/)).toBeVisible();
  });

  test("รอบหมุนเวียน 2 สัปดาห์: ฟอร์มแสดงสองสัปดาห์ และตั้งชื่อซ้ำถูกปฏิเสธ", async ({ page, request }) => {
    const shop = await registerShop(request);
    await seed(request, shop);
    await api(request, shop, "POST", "/api/work-policies", { name: "ชื่อซ้ำ", cycleWeeks: 1, anchorDate: "2026-10-05", days: [] });
    await openAs(page, shop, "/app/work-policies");

    await page.getByRole("button", { name: "สร้างนโยบาย" }).click();
    await dialog(page).getByLabel("ชื่อนโยบาย").fill("ชื่อซ้ำ");
    await choose(page, dialog(page).getByRole("combobox", { name: "รอบของแพทเทิร์น" }), "หมุนเวียน 2 สัปดาห์");
    await expect(dialog(page).getByText("สัปดาห์ที่ 1", { exact: true })).toBeVisible();
    await expect(dialog(page).getByText("สัปดาห์ที่ 2", { exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "สร้างนโยบาย" }).click();
    await expect(dialog(page)).toContainText("มีนโยบายชื่อนี้แล้ว");
  });

  test("ลบนโยบายที่มีคนใช้ → เก็บเข้าคลัง (ไม่หาย) และเลือกให้คนอื่นไม่ได้", async ({ page, request }) => {
    const shop = await registerShop(request);
    const { morning, employee } = await seed(request, shop);
    const policy = await api<Id>(request, shop, "POST", "/api/work-policies", {
      name: "นโยบายที่มีคนใช้", cycleWeeks: 1, anchorDate: "2026-10-05", days: [{ weekIndex: 0, dayIndex: 0, templateId: morning.id }],
    });
    await api(request, shop, "POST", "/api/work-policies/assign", { policyId: policy.id, employeeIds: [employee.id] });
    await openAs(page, shop, "/app/work-policies");

    await page.getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(alertDialog(page)).toContainText("จะถูกเก็บเข้าคลัง");
    await alertDialog(page).getByRole("button", { name: "เก็บเข้าคลัง" }).click();
    await expect(page.getByText("เลิกใช้แล้ว")).toBeVisible();
    await expect(page.locator("[data-slot=card]", { hasText: "นโยบายที่มีคนใช้" })).toBeVisible();
    await expect(page.getByRole("button", { name: "กำหนดให้พนักงาน" })).toHaveCount(0);
  });

  test("ไม่มีแม่แบบกะ → ปุ่มสร้างนโยบายกดไม่ได้ พร้อมคำอธิบาย", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/work-policies");
    await expect(page.getByRole("button", { name: "สร้างนโยบาย" })).toBeDisabled();
    await expect(page.getByText("ต้องมีแม่แบบกะอย่างน้อย 1 อัน")).toBeVisible();
  });
});

test.describe("รอบจ่าย", () => {
  test("สร้างรอบจ่ายใน dialog → ไปหน้ารายละเอียด → ปิดรอบ: ยกเลิกได้ → ลบรอบร่างด้วย dialog เตือน", async ({ page, request }) => {
    const shop = await registerShop(request);
    await api(request, shop, "POST", "/api/employees", { firstName: "เงินเดือน", payType: "Monthly", baseRate: 30000, workerType: "Employee" });
    await openAs(page, shop, "/app/pay-runs");

    await page.getByRole("button", { name: "สร้างรอบจ่าย" }).click();
    await dialog(page).getByRole("button", { name: "คำนวณเงินเดือน" }).click();
    await page.waitForURL(/\/app\/pay-runs\/[0-9a-f-]{36}/);
    await expect(page.getByText("เงินเดือน").first()).toBeVisible();

    await page.getByRole("button", { name: "ปิดรอบ", exact: true }).click();
    await expect(alertDialog(page)).toContainText("แก้ข้อมูลงานในช่วงวันนี้ไม่ได้อีก");
    await alertDialog(page).getByRole("button", { name: "ยกเลิก" }).click();
    await expect(alertDialog(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ปิดรอบ", exact: true })).toBeVisible(); // ยังเป็นรอบร่าง

    await page.getByRole("button", { name: "ลบ", exact: true }).click();
    await alertDialog(page).getByRole("button", { name: "ลบรอบร่าง" }).click();
    await page.waitForURL(/\/app\/pay-runs$/);
    await expect(page.getByText("ยังไม่มีรอบจ่าย")).toBeVisible();
  });

  test("ปิดรอบแล้ว: ปุ่มแก้/ลบหาย และสร้างรอบทับช่วงเดิมถูกปฏิเสธ", async ({ page, request }) => {
    const shop = await registerShop(request);
    await api(request, shop, "POST", "/api/employees", { firstName: "ปิดรอบ", payType: "Monthly", baseRate: 30000, workerType: "Employee" });
    await openAs(page, shop, "/app/pay-runs");

    await page.getByRole("button", { name: "สร้างรอบจ่าย" }).click();
    await dialog(page).getByRole("button", { name: "คำนวณเงินเดือน" }).click();
    await page.waitForURL(/\/app\/pay-runs\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "ปิดรอบ", exact: true }).click();
    await alertDialog(page).getByRole("button", { name: "ปิดรอบ", exact: true }).click();
    await expect(page.getByText("ปิดรอบแล้ว").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ลบ", exact: true })).toHaveCount(0);

    await page.goto("/app/pay-runs");
    await page.getByRole("button", { name: "สร้างรอบจ่าย" }).click();
    await dialog(page).getByRole("button", { name: "คำนวณเงินเดือน" }).click();
    await expect(dialog(page).getByRole("alert")).toBeVisible(); // ช่วงเดียวกับรอบที่ปิดแล้ว
  });
});
