const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const baht = (v: number) => money.format(v);

/** "2026-10-05" → "5 ต.ค. 69" */
export const thaiDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export const thaiMonth = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** 0 = อาทิตย์ */
export const weekday = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

export const weekdayShort = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short" });
