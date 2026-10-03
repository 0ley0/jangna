// Smoke test กับ API จริง (Postgres) — ตรวจสิ่งที่เทสต์ InMemory จับไม่ได้ (unique index, decimal scale, SQL จริง)
//   node scripts/smoke-test.mjs
// สร้างร้านใหม่ทุกครั้ง (อีเมลสุ่ม) ใช้เดือน ต.ค. ของปีหน้าเพื่อไม่ชนข้อมูลเดิม
import { writeFileSync } from "node:fs";
import { call, download, expectStatus, iso, waitForApi } from "./lib.mjs";

await waitForApi();
const Y = new Date().getFullYear() + 1;
const oct = (d) => iso(Y, 10, d);
let step = 0;
const ok = (msg) => console.log(`✓ ${String(++step).padStart(2)} ${msg}`);
const eq = (actual, expected, label) => {
  if (Number(actual) !== Number(expected)) throw new Error(`${label}: คาด ${expected} ได้ ${actual}`);
};

const email = `smoke-${Date.now()}@test.local`;
const { accessToken: t } = await call("POST", "/api/auth/register", { shopName: "ร้านทดสอบ smoke", displayName: "เจ้าของ", email, password: "password123" });
const me = await call("GET", "/api/me", undefined, t);
if (me.tenantName !== "ร้านทดสอบ smoke") throw new Error("ภาษาไทยเพี้ยนใน DB");
ok("สมัคร + /me (ภาษาไทยถูกต้อง)");

const branch = await call("POST", "/api/branches", { name: "สาขาหาดใหญ่", provinceCode: "TH-90", areaCode: "9011" }, t);
eq((await call("GET", "/api/legal/minimum-wage?province=TH-90&area=9011", undefined, t)).dailyRate, 380, "ค่าแรงขั้นต่ำหาดใหญ่");
ok("สาขา + ค่าแรงขั้นต่ำตามอำเภอ (380)");

const rules = await call("GET", `/api/legal/rules?date=${Y}-10-01`, undefined, t);
if (!rules.rules.incomeTax) throw new Error("rule set ไม่มีข้อมูลภาษี (seeder ไม่ sync?)");
ok("rule set มีข้อมูลภาษี");

const packer = await call("POST", "/api/employees", { firstName: "แพ็คเกอร์", payType: "Piece", baseRate: 0, workerType: "Employee", branchId: branch.id }, t);
const admin = await call("POST", "/api/employees", { firstName: "แอดมิน", payType: "Monthly", baseRate: 50000, workerType: "Employee", branchId: branch.id }, t);
ok("เพิ่มพนักงาน 2 คน");

const invite = await call("POST", `/api/employees/${packer.id}/invites`, undefined, t);
await call("POST", "/api/liff/join", { code: invite.code, idToken: "dev:smoke:แพ็คเกอร์" });
await expectStatus(404, call("POST", "/api/liff/join", { code: invite.code, idToken: "dev:other" }), "ใช้ลิงก์เชิญซ้ำ");
ok("ผูก LINE (โหมดทดสอบ) + ลิงก์ใช้ซ้ำไม่ได้");

await call("PUT", "/api/opening-balances", { employeeId: admin.id, year: Y, taxableIncome: 450000, taxWithheld: 0, socialSecurity: 7875 }, t);
await call("PUT", "/api/work-days", [1, 2].map((d) => ({ employeeId: packer.id, date: oct(d), kind: "Workday", normalHours: 8, overtimeHours: 0, leave: "None" })), t);
await call("POST", "/api/piece-work", { employeeId: packer.id, date: oct(1), description: "แพ็คกล่อง", quantity: 100, rate: 5, overtime: false }, t);
await call("POST", "/api/piece-work", { employeeId: packer.id, date: oct(2), description: "แพ็คกล่อง", quantity: 50, rate: 5, overtime: false }, t);
ok("บันทึกยอดยกมา + วันทำงาน + ผลงาน");

const run = await call("POST", "/api/pay-runs", { periodStart: oct(1), periodEnd: oct(31) }, t);
const item = (name) => run.items.find((i) => i.employeeName === name);
eq(item("แพ็คเกอร์").gross, 880, "คนแพ็ค gross (500 + 250 + เติมขั้นต่ำหาดใหญ่ 130)");
eq(item("แพ็คเกอร์").socialSecurityEmployee, 83, "คนแพ็ค สปส. (ฐานขั้นต่ำ)");
eq(item("แอดมิน").withholdingTax, 6816.67, "แอดมิน ภาษี (มียอดยกมา)");
ok("สร้างรอบจ่าย: คนแพ็ค 880 / สปส. 83, แอดมินภาษี 6,816.67");

await call("POST", "/api/piece-work", { employeeId: packer.id, date: oct(2), description: "แพ็คกล่อง", quantity: 30, rate: 5, overtime: true }, t);
const re = await call("POST", `/api/pay-runs/${run.summary.id}/recalculate`, undefined, t);
eq(re.items.find((i) => i.employeeName === "แพ็คเกอร์").gross, 1105, "คำนวณใหม่หลังเพิ่ม OT (+30 × 5 × 1.5)");
ok("คำนวณใหม่ (ลบแล้วเพิ่ม item ไม่ชน unique index)");

const locked = await call("POST", `/api/pay-runs/${run.summary.id}/lock`, undefined, t);
if (locked.summary.status !== "Locked") throw new Error("lock ไม่สำเร็จ");
ok("ปิดรอบ (ไม่ติดปัญหา decimal scale)");

await expectStatus(409, call("PUT", "/api/work-days", [{ employeeId: packer.id, date: oct(3), kind: "Workday", normalHours: 8, overtimeHours: 0, leave: "None" }], t), "แก้ข้อมูลในรอบที่ปิด");
ok("แก้ข้อมูลในช่วงที่ปิดรอบแล้วไม่ได้ (409)");

const nov = await call("POST", "/api/pay-runs", { periodStart: iso(Y, 11, 1), periodEnd: iso(Y, 11, 30) }, t);
eq(nov.items.find((i) => i.employeeName === "แอดมิน").withholdingTax, 6816.67, "ภาษี พ.ย. จากยอดสะสม");
ok("รอบถัดไปใช้ยอดสะสมจากรอบที่ปิด");

// ---------- เอกสารนำส่ง + สลิป ----------

await call("PUT", "/api/shop", {
  name: "ร้านทดสอบ smoke", legalName: "บริษัท ทดสอบ จำกัด", address: "1 ถนนเพชรเกษม หาดใหญ่ สงขลา",
  taxId: "1234567890121", taxBranchNo: "000000", ssoAccountNo: "1234567890", ssoBranchNo: "000000",
}, t);
const filing = { workerType: "Employee", branchId: branch.id, language: "th", district: "หาดใหญ่", province: "สงขลา", postalCode: "90110" };
await call("PUT", `/api/employees/${packer.id}`, { ...filing, firstName: "แพ็คเกอร์", lastName: "ขยัน", payType: "Piece", baseRate: 0, title: "Miss", nationalId: "3100500123458" }, t);
await call("PUT", `/api/employees/${admin.id}`, { ...filing, firstName: "แอดมิน", lastName: "ใจดี", payType: "Monthly", baseRate: 50000, title: "Mr", nationalId: "1101700203450", addressLine: "12/3 หมู่ 4" }, t);
const summary = await call("GET", `/api/exports/summary?year=${Y}&month=10`, undefined, t);
eq(summary.sso.wages, 19150, "ค่าจ้าง สปส. (คนแพ็ค 1,105 → ฐานขั้นต่ำ 1,650 + แอดมิน เพดาน 17,500)");
eq(summary.sso.employeeContribution, 958, "เงินสมทบลูกจ้าง (83 + 875)");
if (summary.sso.issues.length || summary.pnd1.issues.length) throw new Error("ยังมีข้อมูลขาด: " + JSON.stringify(summary));
ok("สรุปเอกสารนำส่งเดือน ต.ค. ครบ ไม่มีข้อมูลขาด");

const sso = await download(`/api/exports/sso?year=${Y}&month=10&paymentDate=${iso(Y, 11, 15)}`, t);
const ssoLines = new TextDecoder("windows-874").decode(sso.bytes).split("\r\n").filter(Boolean);
if (sso.bytes.length !== 3 * 137 || ssoLines.some((l) => l.length !== 135)) throw new Error("สปส.1-10 ต้องยาว 135 ตัวต่อแถว");
// อัตรา 5.00% | 2 คน | ค่าจ้าง 19,150.00 | สมทบรวม 1,916.00 | ลูกจ้าง 958.00 | นายจ้าง 958.00
if (!ssoLines[0].endsWith("0500" + "000002" + "000000001915000" + "00000000191600" + "000000095800" + "000000095800"))
  throw new Error("header สปส. ผิด: " + ssoLines[0]);
ok("ไฟล์ สปส.1-10 (TIS-620, 135 ตัว/แถว, ยอดตรง)");

const pnd = new TextDecoder().decode((await download(`/api/exports/pnd1?year=${Y}&month=10`, t)).bytes).split("\r\n").filter(Boolean);
if (pnd.length !== 2 || !pnd[1].includes("|นาย|แอดมิน|ใจดี|") || !pnd[1].includes("|50000.00|6816.67|1|1|||||12-3 หมู่ 4||||"))
  throw new Error("ภ.ง.ด.1 ผิด:\n" + pnd.join("\n"));
ok("ไฟล์ ภ.ง.ด.1 (แอดมินคนเดียว ภาษี 6,816.67)");

const slips = await download(`/api/pay-runs/${run.summary.id}/payslips`, t);
if (new TextDecoder().decode(slips.bytes.slice(0, 4)) !== "%PDF") throw new Error("สลิปไม่ใช่ PDF");
if (process.env.JANGNA_SLIP_OUT) writeFileSync(process.env.JANGNA_SLIP_OUT, slips.bytes); // เปิดดูหน้าตาสลิป
await expectStatus(409, call("GET", `/api/pay-runs/${nov.summary.id}/payslips`, undefined, t), "สลิปรอบร่าง");
ok("สลิป PDF (เฉพาะรอบที่ปิดแล้ว)");

// ---------- กะงาน ----------

const mon = iso(Y, 10, 5);
const morning = await call("POST", "/api/shift-templates", { name: "กะเช้า", startTime: "08:00:00", endTime: "17:00:00", breakMinutes: 60, color: "sage" }, t);
await call("PUT", "/api/shifts", [packer.id, admin.id].map((employeeId) => ({ employeeId, date: mon, templateId: morning.id })), t);
await call("POST", "/api/shifts/copy-week", { from: mon, to: iso(Y, 10, 12), overwrite: false }, t);
const copied = await call("POST", "/api/shifts/copy-week", { from: mon, to: iso(Y, 10, 12), overwrite: true }, t);
eq(copied.copied, 2, "คัดลอกทับ (แก้แถวเดิม ไม่ชน unique index)");
const week = await call("GET", `/api/shifts?from=${iso(Y, 10, 12)}&to=${iso(Y, 10, 18)}`, undefined, t);
eq(week.length, 2, "กะสัปดาห์ถัดไป");
eq(week[0].hours, 8, "ชั่วโมงกะเช้า (9 ชม. − พัก 1)");
ok("กะงาน: แม่แบบ + จัดกะ + คัดลอกสัปดาห์");

// ---------- เอกสารพนักงาน (แรงงานต่างด้าว) ----------

const bangkokNow = Date.now() + 7 * 3600 * 1000;
const inDays = (n) => new Date(bangkokNow + n * 86400000).toISOString().slice(0, 10);
await call("POST", "/api/employee-documents", { employeeId: packer.id, type: "Passport", number: "AA123", expiresOn: inDays(-2) }, t);
await call("POST", "/api/employee-documents", { employeeId: packer.id, type: "WorkPermit", expiresOn: inDays(20) }, t);
await call("POST", "/api/employee-documents", { employeeId: packer.id, type: "Visa", expiresOn: inDays(300) }, t);
const soon = await call("GET", "/api/employee-documents/expiring", undefined, t);
eq(soon.length, 2, "เอกสารหมดแล้ว + ใกล้หมด (ไม่รวมที่ยังอีกไกล)");
eq(soon[0].daysLeft, -2, "เรียงตามเร่งด่วน");
ok("เอกสารพนักงาน + แจ้งเตือนวันหมดอายุ (enum/วันที่ใน Postgres)");

// ---------- นโยบายการทำงาน (Work Policy) ----------

const evening = await call("POST", "/api/shift-templates", { name: "กะบ่าย", startTime: "14:00:00", endTime: "23:00:00", breakMinutes: 60, color: "amber" }, t);
const week2 = iso(Y, 10, 19); // จันทร์ ไม่ซ้ำกับสัปดาห์ที่จัดกะไว้ด้านบน
const rotation = await call("POST", "/api/work-policies", {
  name: "หมุนเวียนเช้า/บ่าย", cycleWeeks: 2, anchorDate: iso(Y, 10, 5),
  days: [0, 1, 2, 3, 4].flatMap((d) => [{ weekIndex: 0, dayIndex: d, templateId: morning.id }, { weekIndex: 1, dayIndex: d, templateId: evening.id }]),
}, t);
eq(rotation.days.length, 10, "แพทเทิร์น 2 สัปดาห์ x 5 วัน");
await call("POST", "/api/work-policies/assign", { policyId: rotation.id, employeeIds: [packer.id] }, t);
const generated = await call("POST", "/api/shifts/generate", { from: week2, to: iso(Y, 10, 25) }, t);
eq(generated.created, 5, "สร้างกะสัปดาห์ที่ 3 ของรอบ (= สัปดาห์ที่ 1 → เช้า) 5 วัน");
eq(generated.employeesWithoutPolicy, 1, "แอดมินยังไม่มีนโยบาย");
const planned = await call("GET", `/api/shifts?from=${week2}&to=${iso(Y, 10, 25)}`, undefined, t);
if (planned[0].startTime !== "08:00:00") throw new Error(`สัปดาห์ที่ 1 ของรอบต้องเป็นกะเช้า ได้ ${planned[0].startTime}`);
eq((await call("POST", "/api/shifts/generate", { from: week2, to: iso(Y, 10, 25) }, t)).created, 0, "สร้างซ้ำไม่เพิ่ม (unique index)");
// แก้แพทเทิร์นแบบแก้แถวเดิม/ลบ/เพิ่ม ไม่ชน unique (policy, week, day)
const edited = await call("PUT", `/api/work-policies/${rotation.id}`, {
  name: "หมุนเวียนเช้า/บ่าย", cycleWeeks: 1, anchorDate: iso(Y, 10, 5),
  days: [{ weekIndex: 0, dayIndex: 0, templateId: evening.id }, { weekIndex: 0, dayIndex: 5, templateId: morning.id }],
}, t);
eq(edited.days.length, 2, "แก้แพทเทิร์นเหลือ 2 วัน");
ok("นโยบายการทำงาน: สร้าง/กำหนด/สร้างกะ/แก้แพทเทิร์น (unique index ใน Postgres)");

// ---------- ค่าใหญ่เกินคอลัมน์ต้องได้ 400 (InMemory ไม่เห็น — Postgres จะ 500 ถ้า validation หลุด) ----------

const huge = 99_999_999_999_999;
const shopNow = await call("GET", "/api/shop", undefined, t);
await expectStatus(400, call("POST", "/api/advances", { employeeId: packer.id, date: oct(1), amount: huge }, t), "เงินเบิกใหญ่เกิน numeric(12,2)");
await expectStatus(400, call("POST", "/api/piece-work", { employeeId: packer.id, date: oct(1), description: "x", quantity: huge, rate: 5, overtime: false }, t), "จำนวนชิ้นใหญ่เกิน");
await expectStatus(400, call("PUT", "/api/shop", { ...shopNow, address: "ก".repeat(501) }, t), "ที่อยู่ร้านยาวเกิน varchar(500)");
await expectStatus(400, call("PUT", "/api/shop", { ...shopNow, rdUserId: "x".repeat(21) }, t), "RD user ยาวเกิน varchar(20)");
await expectStatus(400, call("POST", "/api/branches", { name: "lat เกิน", provinceCode: "TH-10", geoLat: 91, geoLng: 100 }, t), "ละติจูดเกิน 90");
await expectStatus(400, call("POST", "/api/employees", { firstName: "ก", payType: "Daily", baseRate: huge, workerType: "Employee" }, t), "ค่าจ้างใหญ่เกิน numeric(12,2)");
await expectStatus(400, call("POST", "/api/employees", { firstName: "ก", payType: "Daily", baseRate: 400, workerType: "Employee", province: "ก".repeat(51) }, t), "จังหวัดยาวเกิน varchar(50)");
await expectStatus(400, call("PUT", "/api/opening-balances", { employeeId: packer.id, year: 1, taxableIncome: 1, taxWithheld: 0, socialSecurity: 0 }, t), "ปียอดยกมาไม่สมเหตุสมผล");
await expectStatus(400, call("POST", "/api/auth/register", {}, undefined), "สมัครโดยไม่ส่ง field");
ok("ค่าใหญ่เกิน/ยาวเกิน/JSON ไม่ครบ → 400 ไม่ใช่ 500 (กฎ validation ตรงกับขนาดคอลัมน์ใน Postgres)");

console.log(`\nผ่านทั้งหมด ${step} ขั้น (${email})`);
