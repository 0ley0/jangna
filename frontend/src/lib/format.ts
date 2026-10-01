import type { Lang } from "./i18n";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const baht = (v: number) => money.format(v);

const localeOf = (lang: Lang) => (lang === "en" ? "en-GB" : "th-TH");

/** "2026-10-05" → "5 ต.ค. 69" (ไทย, พ.ศ.) / "5 Oct 26" (อังกฤษ) */
export const fmtDate = (iso: string, lang: Lang = "th") =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", year: "2-digit" });

/** "ตุลาคม 2569" / "October 2026" */
export const fmtMonth = (year: number, month: number, lang: Lang = "th") =>
  new Date(year, month - 1, 1).toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });

export const fmtDateTime = (iso: string, lang: Lang = "th") =>
  new Date(iso).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" });

/** ปีที่แสดง: พ.ศ. สำหรับไทย */
export const displayYear = (year: number, lang: Lang = "th") => (lang === "en" ? year : year + 543);

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** 0 = อาทิตย์ */
export const weekday = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

export const weekdayShort = (iso: string, lang: Lang = "th") =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(localeOf(lang), { weekday: "short" });
