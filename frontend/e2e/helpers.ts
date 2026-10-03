import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://127.0.0.1:5099";

export interface Shop {
  token: string;
  email: string;
}

/** สมัครร้านใหม่ผ่าน API (เร็วกว่าผ่านหน้าเว็บ และไม่ต้องผ่านหน้า login ทุกเทสต์) */
export async function registerShop(request: APIRequestContext, name = "ร้านทดสอบ E2E"): Promise<Shop> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const response = await request.post(`${API}/api/auth/register`, {
    data: { shopName: name, email, password: "password123", displayName: "เจ้าของ E2E" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { accessToken } = await response.json();
  return { token: accessToken, email };
}

/** ใส่ token ให้หน้าเว็บก่อนโหลด (เหมือนล็อกอินแล้ว) แล้วไปที่ path */
export async function openAs(page: Page, shop: Shop, path: string) {
  await page.addInitScript((token) => {
    localStorage.setItem("jangna.token", token);
    localStorage.setItem("jangna.lang", "th");
  }, shop.token);
  // รอจน hydrate เสร็จ (networkidle) ไม่งั้นคลิกแรกอาจหายเพราะ handler ยังไม่ถูกผูก
  await page.goto(path, { waitUntil: "networkidle" });
}

/** เรียก API ในนามของร้าน — ใช้เตรียมข้อมูลก่อนเทสต์ UI */
export async function api<T = unknown>(request: APIRequestContext, shop: Shop, method: "GET" | "POST" | "PUT" | "DELETE", path: string, data?: unknown): Promise<T> {
  const response = await request.fetch(`${API}${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${shop.token}` },
  });
  expect(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** เลือกค่าใน Select ของระบบ (ไม่ใช่ <select> จริง): คลิก combobox แล้วเลือก option ตามข้อความ */
export async function choose(page: Page, combobox: Locator, optionText: string | RegExp) {
  await combobox.click();
  await page.getByRole("option", { name: optionText }).first().click();
}

/** dialog ที่เปิดอยู่ตอนนี้ (มีได้ซ้อนกัน: ตัวบนสุดคือตัวสุดท้าย) */
export const dialog = (page: Page) => page.getByRole("dialog").last();
export const alertDialog = (page: Page) => page.getByRole("alertdialog");

/** วันที่ ISO ของ "วันนี้ + n วัน" ตามเวลาไทย */
export function isoInDays(n: number) {
  const d = new Date(Date.now() + 7 * 3600_000 + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
