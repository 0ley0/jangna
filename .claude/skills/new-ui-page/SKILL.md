---
name: new-ui-page
description: Build or change a Jangna frontend page/component in the Hearth design with Thai/English text. Use for any work in frontend/src (new page under app/app, forms, tables, date inputs, nav items, styling).
---

# Frontend page in Jangna style

อ่าน `docs/frontend.md` (token, component, i18n) ก่อน และดูตัวอย่างใช้งานจริงที่ `frontend/src/app/ui/page.tsx` (หน้า `/ui`) — ไม่ต้องเปิดไฟล์ดีไซน์ Hearth ต้นฉบับ เว้นแต่ต้องการ component ใหม่ที่ยังไม่มี

**ใช้ component ที่มีก่อนเสมอ** — ห้ามเขียน `<select>`, `<input>`, `<textarea>`, ปุ่ม หรือ pill ด้วย class เองในหน้า; ถ้าต้องการแบบใหม่ ให้เพิ่มใน `components/ui/` + ตัวอย่างใน `/ui`

## Checklist
1. **Next.js 16**: API ที่ไม่แน่ใจ → อ่าน `frontend/node_modules/next/dist/docs/` ก่อน (params เป็น Promise, `useSearchParams` ต้องอยู่ใต้ Suspense)
2. หน้าใหม่ใต้ `src/app/app/<name>/page.tsx` เป็น `"use client"` — ไม่ต้องใส่ `<h1>` (header ใน layout แสดงชื่อหน้าให้)
   แล้วเพิ่มเมนูใน `nav` ของ `src/app/app/layout.tsx` (`label`/`sub` เป็น `[ไทย, อังกฤษ]`, ไอคอนจาก `Icon.*`)
3. **ทุกข้อความผ่าน `t("ไทย", "English")`** จาก `useLang()`; label ของ enum เป็น `Bi` ใน `lib/types.ts` → `t(...labels[x])`
4. วันที่: `DateField` / `DateRangeField` (ห้าม `<input type="date">`), แสดงด้วย `fmtDate(iso, lang)`, ค่าเป็น `yyyy-mm-dd`, วันนี้ = `todayIso()`
5. สี/เงา/มุม ใช้ token class (`bg-brand`, `text-muted-foreground`, `shadow-card`, `border`...) — **ไม่ใส่ hex ใหม่ในหน้า**
   CTA หลัก = `<Button variant="accent">`, สถานะ = `Badge variant="success" | "warning" | "outline"`
6. ข้อมูล: `useQuery` + `api<T>()` (`lib/api.ts`), key ร่วมไว้ใน `lib/queries.ts`, ฟอร์มใช้ `<form action>` + `FormData` + `TextField` / `SelectField` / `TextareaField` (`errors={error.fieldErrors}`), ปุ่ม submit ใช้ `loading={mutation.isPending}`, ตัวกรองใช้ `ChipGroup`, ตารางว่างใช้ `TableEmpty`
7. มือถือ: เลย์เอาต์ต้องใช้ได้ที่ 360px (grid `sm:`/`md:`), popover ไม่ถูกตัด (อย่าใส่ `overflow-hidden` ให้ Card)

## ตรวจก่อนบอกว่าเสร็จ
```bash
cd /c/Charp/jangna/frontend && npx next typegen && npx tsc --noEmit && npm run lint && npm run build
```
- ไล่หาข้อความไทยที่ไม่ผ่าน `t()`:
  `LC_ALL=C.UTF-8 grep -rnP '[\x{0E00}-\x{0E7F}]' src/app src/components | grep -v 't('` (ที่เหลือควรเป็นคอมเมนต์/คู่ Bi)
- เปิดหน้าใน dev server (HTTP 200) — ถ้าไม่ได้ดูหน้าจอจริง ให้บอกผู้ใช้ตรงๆ
