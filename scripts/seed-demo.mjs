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
