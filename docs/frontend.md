# Frontend

Next.js **16** — ต่างจากที่คุ้นเคย: อ่าน `frontend/node_modules/next/dist/docs/` ก่อนใช้ API ที่ไม่แน่ใจ (ดู `frontend/AGENTS.md`)
- `params` / `searchParams` ของ page เป็น Promise; `useSearchParams` ต้องอยู่ใต้ `<Suspense>`
- `middleware` เปลี่ยนชื่อเป็น `proxy`; route types มาจาก `npx next typegen` (`LayoutProps<"/app">`, `PageProps<...>`)
- หน้าใน `app/app/*` เป็น client component ทั้งหมด (token อยู่ใน localStorage, ดึงข้อมูลด้วย TanStack Query)

## ดีไซน์: Hearth
ต้นฉบับ: `powerd_bese_desinge/Hearth.html` + `DatePicker-standalone-src.html` (อ้างอิงเท่านั้น ไม่ได้ import)
Token อยู่ใน `src/app/globals.css` — **ใช้ class จาก token เสมอ อย่าใส่สี hex ในหน้า**

| ความหมาย | class |
|---|---|
| พื้นครีม / การ์ด | `bg-background` / `bg-card`, `bg-surface` |
| เบจ (hover, muted) | `bg-muted`, `bg-secondary`, `bg-beige-2`, `bg-cream-2` |
| ตัวอักษร | `text-foreground` (หมึก), `text-ink-2`, `text-muted-foreground` |
| แบรนด์ เทอร์ราคอตต้า | `bg-brand` / `border-brand` / `ring-brand` (ตกแต่ง, ขอบ, โฟกัส — คอนทราสต์กับครีมแค่ ~3:1 **ห้ามใช้เป็นพื้นของตัวอักษร**), `text-brand-strong` (ตัวอักษรเล็กบนพื้นสว่าง), `bg-brand-action` + `text-brand-foreground` (พื้นปุ่ม/ช่วงวันที่ที่มีตัวอักษรทับ), `bg-brand-soft text-brand-ink` |
| แท็กสี Chip | `bg-plum-soft text-plum-ink`, `bg-blue-soft text-blue-ink` (สลับตามโหมดมืดเอง) |
| แท็ก | `bg-sage-soft text-sage-ink` (สำเร็จ), `bg-amber-soft text-amber-ink` (เตือน) |
| เส้นขอบ | `border` (= hairline `#E6D9BF`) |
| เงา | `shadow-card`, `shadow-pop` (popover), `shadow-ink` (ปุ่มหมึก), `shadow-brand` |
| พิเศษ | `.card-warm` (การ์ดไล่สีอุ่น), `.glass` (header โปร่ง), `.tabular` (ตัวเลขเท่ากัน), `animate-pop-in`, `animate-fade-up` |
| โหมดมืด | class `.dark` = palette "dusk" (ยังไม่มีปุ่มสลับ) |

ฟอนต์: **Noto Sans Thai** ฟอนต์เดียว (มีตัวละตินในตัว, variable weight — `next/font` ใน `app/layout.tsx`) · การ์ดมุม 18px · ปุ่ม/อินพุต `rounded-xl`

**คอนทราสต์ (WCAG 2.1 AA — เป้าหมายของโปรดักต์):** ตัวอักษรปกติ ≥ 4.5:1, ใหญ่/ไอคอน ≥ 3:1 — `text-muted-foreground` ผ่านแล้วทั้งโหมดสว่าง/มืด; สีอวาตาร์ใช้ `avatarColors` จาก `components/icons.tsx`
**จอสัมผัส:** `globals.css` ขยายพื้นที่กด Button / Select / Chip เป็น ≥ 44px อัตโนมัติด้วย `(pointer: coarse)` · **ลด motion:** `prefers-reduced-motion` เหลือแค่ fade (ไม่เลื่อน/ซูม)

## Component (`src/components/`) — ดูตัวอย่างทุกตัวที่ **http://localhost:3000/ui**
| component | ไฟล์ | ใช้ |
|---|---|---|
| `Button` | ui/button | variant: `default` (หมึก), **`accent`** (เทอร์ราคอตต้า — CTA หลัก), `outline`, `ghost`, `secondary`, `destructive`, `link`; size `sm`/`lg`/`icon`; **`loading`** (วงหมุน + กดซ้ำไม่ได้); `Spinner` |
| `TextField`, `SelectField`, `TextareaField`, `FormField`, `FormError` | ui/form-field | ฟิลด์ฟอร์ม = label (+ `*` ถ้า required) + control + `hint` + error (`error=` หรือ `errors={apiError.fieldErrors}` ใช้ key = `name`) |
| `Input`, `Textarea` | ui/input, ui/textarea | control เปล่า (ไม่มี label) |
| `Select` | ui/select | **popover แบบ DatePicker** (ตัวที่เลือก = พื้นหมึก + ถูก), รับ `<option>` children หรือ `options=[{value,label,hint,disabled}]`, `value`+`onValueChange` หรือ `defaultValue`, `name`/`required` ส่งกับฟอร์มได้, ค้นหาอัตโนมัติเมื่อเกิน 8 รายการ (`searchable`), คีย์บอร์ด ↑↓ Enter Esc, render ผ่าน portal (ใช้ในตารางได้ไม่โดนตัด), `size="sm"` |
| `Chip`, `ChipGroup` | ui/chip | pill แบบ `.chip`/`.tag` ของ Hearth: `tone` neutral/brand/sage/amber/plum/blue, `selected` + `onClick` (ตัวกรอง), `onRemove`; `ChipGroup` = เลือกค่าเดียวพร้อม `count` |
| `Badge` | ui/badge | สถานะเล็ก: `default`, **`success`**, **`warning`**, `outline`, `destructive` |
| `Table`, `TableEmpty` | ui/table | ตาราง (หัวตาราง uppercase เล็ก, hover เบจ); `<TableEmpty colSpan>` = แถว "ยังไม่มีข้อมูล" |
| `Card` | ui/card | การ์ด Hearth (border + shadow-card), `size="sm"`; ห้ามใส่ `overflow-hidden` (popover ถูกตัด) |
| `DateField` | date-picker.tsx | แทน `<input type="date">` **ทุกที่** — ส่งค่า `yyyy-mm-dd` ผ่าน `name` ใน FormData, รองรับ `required`, `min`, `max`, `marked` (จุด) |
| `DateRangeField` | date-picker.tsx | ช่วงวันที่ 2 เดือน + `presets` (ใช้ที่รอบจ่าย) |
| `Calendar` | date-picker.tsx | ปฏิทิน inline (`size="mini"`) |
| `Icon.*`, `BrandMark`, `Avatar` | icons.tsx | ไอคอนเส้นชุด Hearth (stroke 1.6) — เพิ่มไอคอนใหม่ในสไตล์เดียวกัน |
| `LangToggle` | lang-toggle.tsx | ปุ่มสลับภาษา ไทย / EN |

เพิ่ม component ใหม่ → ใส่ใน `components/ui/` และเพิ่มตัวอย่างที่ `src/app/ui/page.tsx` ด้วย

วันที่ทั้งระบบเป็น ISO string `yyyy-mm-dd` (ตรงกับ `DateOnly`) — **อย่าใช้ `toISOString()`** (เพี้ยน timezone) ใช้ `todayIso()` / `toIso()`

## สองภาษา (ไทย / อังกฤษ)
```tsx
const { t, lang } = useLang();          // lib/i18n.tsx
t("พนักงาน", "Employees")                // ข้อความคู่ ไทยก่อน
t(...payTypeLabels[e.payType])           // label map เป็น Bi = [th, en] ใน lib/types.ts
fmtDate(iso, lang) / fmtMonth / fmtDateTime / displayYear(year, lang)   // lib/format.ts (ไทย = พ.ศ.)
provinceName(code, lang)                 // lib/provinces.ts มีชื่ออังกฤษครบ 77 จังหวัด
```
- ข้อความใหม่ทุกข้อความต้องผ่าน `t()` — อย่าเขียนไทยลอยๆ ใน JSX
- ภาษาเก็บใน localStorage (`jangna.lang`), server render เป็นไทย
- ข้อความจาก backend: error/validation มาตามภาษาหน้าจอ (`api()` ส่ง `Accept-Language` ให้เอง); คำเตือนรอบจ่าย/ข้อมูลที่ขาดเป็น `LocalizedText` → `t(w.th, w.en)`; รายการในสลิปแปลจากรหัส `code`
- ข้อความที่ส่งให้พนักงาน (เช่น ลิงก์เชิญ) ใช้ `employee.language` ไม่ใช่ภาษาหน้าจอ

## API client
`lib/api.ts`: `api<T>(path, { method, json })` แนบ token + `Accept-Language` อัตโนมัติ, error → `ApiError(message, status, fieldErrors)`
`downloadFile(path, fallbackName)` = ดาวน์โหลดไฟล์ (PDF/txt) พร้อม token แล้วตั้งชื่อตาม `Content-Disposition` (CORS expose header นี้แล้ว)
401 → ล้าง token แล้ว `app/app/layout.tsx` พาไปหน้า login · query keys รวมใน `lib/queries.ts`
