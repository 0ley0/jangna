// ตัวช่วยเรียก API ร่วมกันของ scripts (Node 20+, ใช้ fetch ในตัว)
export const API = process.env.JANGNA_API ?? "http://127.0.0.1:5099";

export async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${data?.detail ?? data?.title ?? text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function expectStatus(status, promise, label) {
  try {
    await promise;
  } catch (e) {
    if (e.status === status) return;
    throw new Error(`${label}: คาด ${status} แต่ได้ ${e.status ?? e.message}`);
  }
  throw new Error(`${label}: คาด ${status} แต่สำเร็จ`);
}

export async function waitForApi(seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) return;
    } catch {
      // ยังไม่ขึ้น
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API ที่ ${API} ไม่ตอบ — รัน backend ก่อน (ดู skill run-dev)`);
}

export const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** ดาวน์โหลดไฟล์ (PDF/txt) — คืน bytes + header ไม่ parse JSON */
export async function download(path, token) {
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${new TextDecoder().decode(bytes)}`);
  return { bytes, type: res.headers.get("content-type"), disposition: res.headers.get("content-disposition") };
}
