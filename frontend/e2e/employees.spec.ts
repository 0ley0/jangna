import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { alertDialog, api, choose, dialog, isoInDays, openAs, registerShop } from "./helpers";

interface Employee {
  id: string;
  firstName: string;
}

test.describe("พนักงาน — เพิ่ม / แก้ไข", () => {
  test("เพิ่มพนักงานรายวันใน dialog → อยู่ในตาราง พร้อมอัตราค่าจ้าง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");

    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await expect(dialog(page)).toContainText("เพิ่มพนักงาน");
    await dialog(page).locator("[name=firstName]").fill("สมชาย");
    await dialog(page).getByLabel("นามสกุล").fill("ใจดี");
    await choose(page, dialog(page).getByRole("combobox", { name: "รูปแบบค่าจ้าง" }), "รายวัน");
    await dialog(page).getByLabel(/^อัตรา/).fill("450");
    await dialog(page).getByRole("button", { name: "เพิ่มพนักงาน" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = page.getByRole("row", { name: /สมชาย ใจดี/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("450");
  });

  test("ไม่กรอกชื่อ → ส่งไม่ได้ (browser กัน) และไม่เกิดพนักงาน", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await dialog(page).getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1); // แถว "ยังไม่มีพนักงาน" แถวเดียว (getByRole ใช้ไม่ได้ตอนมี dialog เพราะหน้าหลังถูก aria-hidden)
    expect(await api<Employee[]>(request, shop, "GET", "/api/employees")).toHaveLength(0);
  });

  test("เลขบัตรประชาชนผิด check digit → แสดง error ที่ช่อง และ dialog ไม่ปิด", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await dialog(page).locator("[name=firstName]").fill("เลขผิด");
    await dialog(page).getByLabel("เลขประจำตัวประชาชน").fill("1101700203451");
    await dialog(page).getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await expect(dialog(page)).toContainText("เลขประจำตัวประชาชนไม่ถูกต้อง");
    expect(await api<Employee[]>(request, shop, "GET", "/api/employees")).toHaveLength(0);
  });

  test("เลขบัตรซ้ำกับพนักงานอื่น → ปฏิเสธ", async ({ page, request }) => {
    const shop = await registerShop(request);
    await api(request, shop, "POST", "/api/employees", {
      firstName: "คนแรก", payType: "Daily", baseRate: 400, workerType: "Employee", nationalId: "1101700203450",
    });
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await dialog(page).locator("[name=firstName]").fill("คนที่สอง");
    await choose(page, dialog(page).getByRole("combobox", { name: "รูปแบบค่าจ้าง" }), "รายวัน");
    await dialog(page).getByLabel(/^อัตรา/).fill("400");
    await dialog(page).getByLabel("เลขประจำตัวประชาชน").fill("1-1017-00203-45-0");
    await dialog(page).getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await expect(dialog(page)).toContainText("ใช้กับพนักงานคนอื่นแล้ว");
  });

  test("แก้ไขพนักงาน: ค่าเดิมถูกเติมในฟอร์ม, บันทึกแล้วตารางอัปเดต, ปิดแล้วเปิด 'เพิ่ม' ต้องว่าง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await api(request, shop, "POST", "/api/employees", { firstName: "ก่อนแก้", lastName: "นามสกุล", payType: "Daily", baseRate: 400, workerType: "Employee" });
    await openAs(page, shop, "/app/employees");

    await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
    await expect(dialog(page).locator("[name=firstName]")).toHaveValue("ก่อนแก้");
    await dialog(page).locator("[name=firstName]").fill("หลังแก้");
    await dialog(page).getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /หลังแก้/ })).toBeVisible();

    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    await expect(dialog(page).locator("[name=firstName]")).toHaveValue("");
  });
});

test.describe("พนักงาน — เอกสาร (แรงงานต่างด้าว)", () => {
  test("เอกสารใกล้หมดอายุ/หมดอายุแล้ว แสดงในการ์ดแจ้งเตือน ส่วนที่ยังอีกไกลไม่แสดง", async ({ page, request }) => {
    const shop = await registerShop(request);
    const employee = await api<Employee>(request, shop, "POST", "/api/employees", { firstName: "มินท์", lastName: "แรงงาน", payType: "Daily", baseRate: 400, workerType: "Employee" });
    await api(request, shop, "POST", "/api/employee-documents", { employeeId: employee.id, type: "Passport", expiresOn: isoInDays(-3) });
    await api(request, shop, "POST", "/api/employee-documents", { employeeId: employee.id, type: "Visa", expiresOn: isoInDays(20) });
    await api(request, shop, "POST", "/api/employee-documents", { employeeId: employee.id, type: "WorkPermit", expiresOn: isoInDays(300) });

    await openAs(page, shop, "/app/employees");
    const card = page.locator("[data-slot=card]", { hasText: "เอกสารใกล้หมดอายุ" });
    await expect(card).toContainText("(2)");
    await expect(card).toContainText("พาสปอร์ต");
    await expect(card).toContainText("หมดอายุแล้ว 3 วัน");
    await expect(card).toContainText("วีซ่า");
    await expect(card).toContainText("อีก 20 วัน");
    await expect(card).not.toContainText("ใบอนุญาตทำงาน");
  });

  test("เพิ่มเอกสารจาก dialog (ไม่มีวันหมดอายุ) แล้วลบด้วย dialog เตือน", async ({ page, request }) => {
    const shop = await registerShop(request);
    await api(request, shop, "POST", "/api/employees", { firstName: "ลิน", payType: "Daily", baseRate: 400, workerType: "Employee" });
    await openAs(page, shop, "/app/employees");

    await page.getByRole("button", { name: "เอกสาร", exact: true }).click();
    await expect(dialog(page)).toContainText("ยังไม่มีเอกสาร");
    await dialog(page).getByRole("button", { name: "เพิ่มเอกสาร" }).click();
    await dialog(page).getByLabel("เลขที่เอกสาร").fill("PK-001");
    await dialog(page).getByRole("button", { name: "เพิ่มเอกสาร" }).last().click();
    await expect(dialog(page).getByRole("listitem")).toContainText("PK-001");
    await expect(dialog(page).getByRole("listitem")).toContainText("ไม่มีวันหมดอายุ");

    await dialog(page).getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(alertDialog(page)).toContainText("ลบเอกสารนี้");
    await alertDialog(page).getByRole("button", { name: "ลบ" }).click();
    await expect(dialog(page)).toContainText("ยังไม่มีเอกสาร");
  });
});

test.describe("พนักงาน — นำเข้าจาก Excel", () => {
  const HEADER = ["ชื่อ", "นามสกุล", "ชื่อเล่น", "เบอร์โทร", "สาขา", "รูปแบบค่าจ้าง", "อัตรา", "สถานะการจ้าง", "ภาษา", "คำนำหน้า", "เลขบัตร", "ที่อยู่", "ตำบล", "อำเภอ", "จังหวัด", "ไปรษณีย์", "นโยบาย"];

  async function workbook(rows: (string | number)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("พนักงาน");
    ws.addRow(HEADER);
    rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  test("ไฟล์ถูกต้อง → ตรวจผ่าน → นำเข้าทั้งหมด และพนักงานโผล่ในตาราง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "นำเข้าจาก Excel" }).click();

    const buffer = await workbook([
      ["นำเข้าหนึ่ง", "ทดสอบ", "", "0812345678", "", "รายวัน", 400, "ลูกจ้าง", "th", "นาย", "1101700203450"],
      ["นำเข้าสอง", "ทดสอบ", "", "", "", "ต่อชิ้น", "", "", "", "", ""],
    ]);
    await dialog(page).locator("input[type=file]").setInputFiles({ name: "employees.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await expect(dialog(page)).toContainText("ทั้งหมด 2 แถว");
    await expect(dialog(page)).toContainText("ผ่าน 2");
    await dialog(page).getByRole("button", { name: "นำเข้า 2 คน" }).click();

    await expect(dialog(page)).toContainText("นำเข้าพนักงาน 2 คนเรียบร้อย");
    await dialog(page).getByRole("button", { name: "เสร็จสิ้น" }).click();
    await expect(page.getByRole("row", { name: /นำเข้าหนึ่ง/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /นำเข้าสอง/ })).toBeVisible();
  });

  test("มีแถวผิด → แสดงแถว/ข้อความที่ต้องแก้ ปุ่มนำเข้ากดไม่ได้ และไม่มีใครถูกเพิ่ม", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "นำเข้าจาก Excel" }).click();

    const buffer = await workbook([
      ["ดีหนึ่ง", "", "", "", "", "รายวัน", 400, "", "", "", "1101700203450"],
      ["", "", "", "", "สาขาลวง", "รายปี", "abc", "", "", "", "1101700203450"], // ชื่อว่าง/สาขาไม่มี/ค่าจ้างผิด/เลขซ้ำในไฟล์
    ]);
    await dialog(page).locator("input[type=file]").setInputFiles({ name: "bad.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await expect(dialog(page)).toContainText("ต้องแก้ 1");
    await expect(dialog(page)).toContainText("ไม่พบสาขา");
    await expect(dialog(page)).toContainText("รูปแบบค่าจ้าง");
    await expect(dialog(page)).toContainText("ซ้ำกับแถว");
    await expect(dialog(page).getByRole("button", { name: "นำเข้า", exact: true })).toBeDisabled();
    expect(await api<Employee[]>(request, shop, "GET", "/api/employees")).toHaveLength(0);
  });

  test("ไฟล์ที่ไม่ใช่ Excel → แจ้งข้อผิดพลาดอ่านง่าย ไม่ค้าง", async ({ page, request }) => {
    const shop = await registerShop(request);
    await openAs(page, shop, "/app/employees");
    await page.getByRole("button", { name: "นำเข้าจาก Excel" }).click();
    await dialog(page).locator("input[type=file]").setInputFiles({ name: "x.xlsx", mimeType: "text/plain", buffer: Buffer.from("not excel") });
    await expect(dialog(page).getByRole("alert")).toContainText("Excel");
  });
});
