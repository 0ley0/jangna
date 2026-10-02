# Jangna (จ้างนะ)

SaaS ลงเวลา + ค่าแพ็คต่อชิ้น + เงินเดือน ผ่าน LINE สำหรับ SME ไทย (กลุ่มแรก: ร้านออนไลน์ที่จ้างคนแพ็ค)
Backend .NET 10 (`backend/`) · Frontend Next.js 16 (`frontend/`) · Postgres · ตอบผู้ใช้เป็นภาษาไทย

## อ่านเฉพาะที่เกี่ยวกับงาน — อย่าอ่าน docs ทั้งหมด
| งาน | เปิด |
|---|---|
| เริ่มงานใหม่ / อะไรเสร็จแล้ว | `docs/roadmap.md` |
| ธุรกิจ ราคา คู่แข่ง ชื่อ/โดเมน | `docs/product.md` |
| โครง repo, endpoint, multi-tenant, กฎออกแบบ | `docs/architecture.md` |
| ตาราง DB | `docs/data-model.md` |
| คำนวณเงินเดือน, รอบจ่าย, กฎหมาย | `docs/payroll.md` |
| หน้าเว็บ, theme, สองภาษา | `docs/frontend.md` |
| รัน/ตั้งค่า/เทสต์ | `docs/dev-setup.md` |
| debug — เคยเจอแล้วหรือยัง | `docs/gotchas.md` |

## Skills (`.claude/skills/`)
- `run-dev` — รัน Docker + API + เว็บ, seed บัญชีตัวอย่าง, smoke test
- `add-migration` — เพิ่ม/แก้ entity + EF migration
- `new-ui-page` — หน้าเว็บแบบ Hearth + ข้อความสองภาษา
- `update-legal-rules` — สปส. / ค่าแรงขั้นต่ำ / ภาษี / OT
- `payroll-change` — แก้วิธีคำนวณเงินเดือนหรือรอบจ่าย
- `impeccable` — (ภายนอก, Apache 2.0) ตรวจ/ขัดเกลาดีไซน์หน้าเว็บ: `/impeccable audit|critique|polish ...` — ต้องคงธีม Hearth และกฎใน `new-ui-page`; ครั้งแรกดาวน์โหลด engine ไปที่ `~/.impeccable`

## กฎที่ห้ามพลาด
- เงิน `decimal`, วันที่ `DateOnly` / ISO `yyyy-mm-dd` (frontend ห้าม `toISOString()` กับวันที่)
- Payroll engine เป็น pure function; กฎหมายเป็นข้อมูล effective-dated; รอบจ่ายที่ lock ห้ามแก้
- ข้อมูลร้านต้องผ่าน tenant filter — `IgnoreQueryFilters()` เฉพาะที่ตั้งใจ (LIFF, login)
- ข้อความหน้าเว็บทุกข้อความผ่าน `t("ไทย", "English")`; สีใช้ token ของ Hearth ไม่ใส่ hex ใหม่
- ฟีเจอร์ที่แตะ DB: `dotnet test` **และ** `node scripts/smoke-test.mjs` กับ Postgres (InMemory ไม่จับ unique index / decimal scale)
- คิดตัวเลขคาดหวังในเทสต์ด้วยมือ — ถ้า fail ตรวจการคิดมือก่อนแก้โค้ด
- ห้ามแก้ไฟล์ที่มีภาษาไทยด้วย PowerShell `Get-Content`/`Set-Content` (encoding เพี้ยน)
- งานเสร็จ → อัปเดต `docs/roadmap.md` และ doc ของเรื่องนั้น; commit/push เมื่อผู้ใช้สั่ง
