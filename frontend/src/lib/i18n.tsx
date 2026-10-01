"use client";

/**
 * สองภาษา ไทย/อังกฤษ แบบเดียวกับ L(en, th) ของ Hearth: เขียนข้อความคู่ไว้ตรงที่ใช้
 *   const { t } = useLang();  t("พนักงาน", "Employees")
 * ภาษาที่เลือกเก็บใน localStorage (เฉพาะเครื่องนี้) — ค่าเริ่มต้นภาษาไทย
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Lang = "th" | "en";

const STORAGE_KEY = "jangna.lang";

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** เลือกข้อความตามภาษา */
  t: (th: string, en: string) => string;
  /** locale สำหรับ Intl (ตัวเลข/วันที่) */
  locale: string;
}

const Ctx = createContext<LangContext | null>(null);

// ภาษาเก็บใน localStorage → อ่านผ่าน useSyncExternalStore (server render เป็นไทยเสมอ)
const listeners = new Set<() => void>();
let memoryLang: Lang | null = null; // ใช้แทนเมื่อ localStorage ใช้ไม่ได้ (private mode ฯลฯ)

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "th") return saved;
  } catch {
    // ใช้ค่าในหน่วยความจำ
  }
  return memoryLang ?? "th";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "th" as Lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    memoryLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ไม่เป็นไร — จำไม่ได้แค่รอบหน้า
    }
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<LangContext>(
    () => ({
      lang,
      setLang,
      t: (th, en) => (lang === "en" ? en : th),
      locale: lang === "en" ? "en-GB" : "th-TH",
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang ต้องอยู่ใน LangProvider");
  return ctx;
}
