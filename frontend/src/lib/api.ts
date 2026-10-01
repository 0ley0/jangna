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

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  // token หมดอายุ/ไม่ถูกต้อง → ทิ้ง token แล้วให้ AppLayout พาไปหน้า login
  if (response.status === 401 && token) setToken(null);

  if (!response.ok) {
    // ASP.NET ProblemDetails: { title, detail, errors }
    const problem = await response.json().catch(() => ({}));
    const fieldErrors: Record<string, string[]> = problem.errors ?? {};
    const message =
      problem.detail ?? Object.values(fieldErrors).flat()[0] ?? problem.title ?? `เกิดข้อผิดพลาด (${response.status})`;
    throw new ApiError(message, response.status, fieldErrors);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
