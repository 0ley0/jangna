import { defineConfig } from "@playwright/test";

/**
 * E2E กับระบบจริง: ต้องรัน API (:5099, Postgres) และเว็บ (:3000) ก่อน — ดู skill run-dev
 *   npx playwright test            รันทั้งหมด
 *   npx playwright test employees  รันไฟล์เดียว   (เพิ่ม --headed เพื่อดูหน้าจอ)
 * ใช้ Chrome ที่ติดตั้งในเครื่อง (channel "chrome") จึงไม่ต้องดาวน์โหลดเบราว์เซอร์ของ Playwright
 * ทุกเทสต์สมัครร้านใหม่ของตัวเอง (อีเมลสุ่ม) ไม่แตะบัญชีตัวอย่าง จึงรันขนานกันได้
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
