// Smoke test กับ API จริง (Postgres) — ตรวจสิ่งที่เทสต์ InMemory จับไม่ได้ (unique index, decimal scale, SQL จริง)
//   node scripts/smoke-test.mjs
// สร้างร้านใหม่ทุกครั้ง (อีเมลสุ่ม) ใช้เดือน ต.ค. ของปีหน้าเพื่อไม่ชนข้อมูลเดิม
import { call, expectStatus, iso, waitForApi } from "./lib.mjs";

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

console.log(`\nผ่านทั้งหมด ${step} ขั้น (${email})`);
