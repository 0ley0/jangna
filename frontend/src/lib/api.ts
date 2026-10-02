const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5099";
const TOKEN_KEY = "jangna.token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private mode ฯลฯ — ไม่ต้องทำอะไร ผู้ใช้จะต้อง login ใหม่
  }
}

/** ภาษาหน้าจอ (lib/i18n.tsx เก็บไว้ที่ key เดียวกัน) → backend ตอบ error เป็นภาษาเดียวกัน */
function currentLang(): "th" | "en" {
  try {
    return localStorage.getItem("jangna.lang") === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

function headersFor(json: boolean, extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    "Accept-Language": currentLang(),
    ...(json && { "Content-Type": "application/json" }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extra,
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  // ASP.NET ProblemDetails: { title, detail, errors }
  const problem = await response.json().catch(() => ({}));
  const fieldErrors: Record<string, string[]> = problem.errors ?? {};
  const fallback = currentLang() === "en" ? `Something went wrong (${response.status})` : `เกิดข้อผิดพลาด (${response.status})`;
  const message = problem.detail ?? Object.values(fieldErrors).flat()[0] ?? problem.title ?? fallback;
  return new ApiError(message, response.status, fieldErrors);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const hadToken = !!getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: headersFor(json !== undefined, headers),
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  // token หมดอายุ/ไม่ถูกต้อง → ทิ้ง token แล้วให้ AppLayout พาไปหน้า login
  if (response.status === 401 && hadToken) setToken(null);
  if (!response.ok) throw await toApiError(response);

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * ดาวน์โหลดไฟล์จาก API (PDF สลิป, ไฟล์ สปส./ภ.ง.ด.) — แนบ token ให้ แล้วบันทึกด้วยชื่อจาก Content-Disposition
 * (ลิงก์ <a href> ธรรมดาแนบ Authorization header ไม่ได้)
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: headersFor(false) });
  if (response.status === 401) setToken(null);
  if (!response.ok) throw await toApiError(response);

  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameOf(response.headers.get("Content-Disposition")) ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** filename*=UTF-8''... (ชื่อภาษาไทย) ก่อน แล้วค่อย filename=... */
function fileNameOf(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null;
}
