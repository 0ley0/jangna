// สร้างบัญชีตัวอย่างพร้อมข้อมูลเดือนปัจจุบัน (รันซ้ำได้ — ถ้ามีข้อมูลแล้วจะไม่เพิ่มซ้ำ)
//   node scripts/seed-demo.mjs            → demo@jangna.local / demo1234
//   JANGNA_API=http://... node scripts/seed-demo.mjs
import { call, iso, waitForApi } from "./lib.mjs";

const EMAIL = process.env.DEMO_EMAIL ?? "demo@jangna.local";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";

await waitForApi();

let token;
try {
  token = (await call("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD })).accessToken;
  console.log(`พบบัญชี ${EMAIL} แล้ว`);
} catch {
  token = (
    await call("POST", "/api/auth/register", {
      shopName: "ร้านแพ็คไว (ตัวอย่าง)",
      displayName: "เจ้าของร้าน",
      email: EMAIL,
      password: PASSWORD,
    })
  ).accessToken;
  console.log(`สร้างบัญชี ${EMAIL}`);
}

if ((await call("GET", "/api/employees", undefined, token)).length > 0) {
  console.log("มีพนักงานอยู่แล้ว — ไม่เพิ่มข้อมูลซ้ำ");
} else {
  await seed(token);
}
await seedFilingAndShifts(token);

/** ข้อมูลยื่นแบบ + กะงาน — เติมเฉพาะที่ยังไม่มี (บัญชี demo เก่าก็ได้ด้วย) */
async function seedFilingAndShifts(token) {
  const shop = await call("GET", "/api/shop", undefined, token);
  if (!shop.taxId)
    await call("PUT", "/api/shop", {
      ...shop, legalName: "ร้านแพ็คไว", address: "99 ถนนบางนา-ตราด แขวงบางนา เขตบางนา กรุงเทพฯ 10260",
      taxId: "1234567890121", ssoAccountNo: "1000000001",
    }, token);

  // เลขบัตรตัวอย่าง (check digit ถูก แต่ไม่ใช่ของคนจริง)
  const ids = { สมชาย: ["Mr", "1101700203450"], Aung: ["Mr", "3100500123458"], มาลี: ["Miss", "1100100100012"] };
  for (const e of await call("GET", "/api/employees", undefined, token)) {
    const [title, nationalId] = ids[e.firstName] ?? [];
    if (e.nationalId || !nationalId) continue;
    await call("PUT", `/api/employees/${e.id}`, {
      ...e, title, nationalId, addressLine: "99", subdistrict: "บางนา", district: "บางนา", province: "กรุงเทพมหานคร", postalCode: "10260",
    }, token);
  }

  if ((await call("GET", "/api/shift-templates", undefined, token)).length === 0) {
    const morning = await call("POST", "/api/shift-templates", { name: "กะเช้า", startTime: "08:00:00", endTime: "17:00:00", breakMinutes: 60, color: "sage" }, token);
    await call("POST", "/api/shift-templates", { name: "กะบ่าย", startTime: "13:00:00", endTime: "22:00:00", breakMinutes: 60, color: "amber" }, token);
    // จัดกะเช้า จ.–ส. ของสัปดาห์นี้ให้ทุกคน
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const dates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
    });
    const staff = await call("GET", "/api/employees", undefined, token);
    await call("PUT", "/api/shifts", staff.flatMap((e) => dates.map((date) => ({ employeeId: e.id, date, templateId: morning.id }))), token);
  }
  console.log("ข้อมูลยื่นแบบ + กะงานตัวอย่าง พร้อมแล้ว");
}

// ไม่ใช้ process.exit() — บน Windows ทำให้ Node crash (libuv assertion) ตอนยังมี handle ของ fetch ค้าง
async function seed(token) {
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth() + 1;
const day = (d) => iso(y, m, d);

const branch = await call("POST", "/api/branches", { name: "โกดังบางนา", provinceCode: "TH-10", geoLat: 13.668, geoLng: 100.604, geoRadiusMeters: 150 }, token);
const packer = await call("POST", "/api/employees", { firstName: "สมชาย", nickname: "ชาย", payType: "Piece", baseRate: 0, workerType: "Employee", branchId: branch.id, language: "th" }, token);
const daily = await call("POST", "/api/employees", { firstName: "Aung", payType: "Daily", baseRate: 400, workerType: "Employee", branchId: branch.id, language: "my" }, token);
await call("POST", "/api/employees", { firstName: "มาลี", payType: "Monthly", baseRate: 18000, workerType: "Employee", branchId: branch.id, language: "th" }, token);

// วันที่ 1–10 ของเดือน: อาทิตย์หยุด นอกนั้นทำงาน 8 ชม.
const days = Array.from({ length: 10 }, (_, i) => {
  const date = day(i + 1);
  const sunday = new Date(y, m - 1, i + 1).getDay() === 0;
  return { date, kind: sunday ? "WeeklyHoliday" : "Workday", normalHours: sunday ? 0 : 8 };
});
await call("PUT", "/api/work-days", [packer, daily].flatMap((e) => days.map((d) => ({ employeeId: e.id, ...d, overtimeHours: 0, leave: "None" }))), token);

// ผลงานแพ็ค — บางวันน้อยจนต้องเติมขั้นต่ำ + OT 1 วัน
const boxes = [120, 95, 60, 140, 110, 0, 130, 85, 150, 100];
for (const [i, d] of days.entries()) {
  if (d.kind === "Workday" && boxes[i] > 0)
    await call("POST", "/api/piece-work", { employeeId: packer.id, date: d.date, description: "แพ็คกล่อง", quantity: boxes[i], rate: 4, overtime: false }, token);
}
await call("POST", "/api/piece-work", { employeeId: packer.id, date: day(9), description: "แพ็คกล่อง", quantity: 40, rate: 4, overtime: true }, token);
await call("POST", "/api/advances", { employeeId: daily.id, date: day(5), amount: 1000, note: "ค่ารถ" }, token);
await call("POST", "/api/holidays", { date: day(13), name: "วันหยุดตัวอย่าง" }, token).catch(() => {});

console.log(`เพิ่มข้อมูลตัวอย่างเดือน ${m}/${y} แล้ว: สาขา 1, พนักงาน 3, วันทำงาน/ผลงาน/เงินเบิก`);
}
