# Gotchas — ปัญหาที่เคยเจอแล้ว

## เครื่อง dev (Windows)
- **`localhost:5433` ต่อ Postgres ใน Docker แล้ว timeout** — `localhost` resolve เป็น IPv6 ก่อน port forward ของ Docker Desktop ค้าง → ใช้ `127.0.0.1` เสมอ
- **คำสั่ง `docker` ไม่เจอ** ใน shell ที่เปิดก่อนติดตั้ง Docker → เพิ่ม PATH: `C:\Users\Thana\AppData\Local\Programs\DockerDesktop\resources\bin`
- **PowerShell 5.1 อ่าน/เขียนไฟล์เป็น ANSI** → ภาษาไทยเพี้ยน (`à¹ƒ...`) ห้ามแก้ไฟล์โค้ดด้วย `Get-Content`/`Set-Content` — ใช้ Edit tool หรือ bash/sed
  และส่ง JSON ภาษาไทยจาก PowerShell ต้องเป็น bytes UTF-8 (`[Text.Encoding]::UTF8.GetBytes(...)`) — สคริปต์ที่มีไทยเขียนเป็น Node (`scripts/*.mjs`)
- **`!` ในแชทรันผ่าน bash** → path Windows ใช้ `/c/Charp/...` ไม่ใช่ `C:\Charp\...` (backslash หาย)
- **Bash tool เข้า localhost ไม่ได้บางครั้ง** → ยิง API ทดสอบผ่าน PowerShell หรือ Node
- **งาน background ถูกหยุดตามเวลา** (dev server ที่ Claude รันให้) → รันเองใน terminal ถ้าจะใช้นาน

- **แก้ไฟล์ด้วย `node -e` / heredoc ใน Bash แล้วพัง** เมื่อโค้ดมี backtick หรือ `${...}` (template string ของ TS/C#) → bash ตีความก่อน
  ใช้ Edit/Write tool หรือเขียนสคริปต์ลงไฟล์ก่อนแล้วค่อย `node file.mjs`

## Export / PDF
- **TIS-620 (code page 874)** ไม่มีใน .NET โดย default → `Encoding.RegisterProvider(CodePagesEncodingProvider.Instance)` ก่อน `GetEncoding(874)` (ทำใน `SsoFile.Encode`)
- QuestPDF: ฟอนต์ฝังเป็น EmbeddedResource (`Fonts/*.ttf`) แล้ว register ตอนสร้าง PDF ครั้งแรก — Noto Sans Thai ไม่มีตัวละติน จึงใช้ `FontFamily("Noto Sans", "Noto Sans Thai")` (fallback)
- QuestPDF **Community license ใช้ฟรีเมื่อรายได้บริษัท < 1 ล้าน USD/ปี** — เกินแล้วต้องซื้อ license
- `RegisterFont(Stream)` ถูก obsolete ตั้งแต่ 2026.9 → `RegisterFontFromStream`

## EF Core
- **id สร้างฝั่งแอป (Guid v7) + เพิ่มผ่าน navigation อย่างเดียว → EF คิดว่าแถวมีอยู่แล้ว แล้ว UPDATE** (DbUpdateConcurrencyException)
  → ต้อง `db.X.Add(entity)` ตรงๆ; และ **อย่า `Add` ซ้ำเข้า navigation** — relationship fixup ใส่ให้เองจาก FK (จะได้รายการซ้ำ)
  - อาการอีกแบบ: guard tenant โยน `ห้ามเขียน X ข้าม tenant (state Modified, tenant ของข้อมูล 0000…)` = แถวใหม่ที่ถูกมองเป็น Modified จึงไม่ถูก stamp TenantId (เจอตอน PUT แก้ลูกของนโยบายการทำงานที่ track อยู่; **InMemory ผ่านแต่ Postgres พัง** → ต้องมีขั้นใน smoke-test)
  - แก้ลูกของ parent ที่ track อยู่ (PUT แทนที่ชุดลูก): แก้แถวเดิม / `Remove` ที่หาย / `db.Child.Add` ที่ใหม่ — ไม่ลบทั้งชุดแล้วเพิ่มใหม่ (unique index ชน) ดู `WorkPolicyEndpoints.Apply`
- **decimal scale**: ค่าจาก `numeric(14,2)` ได้ `900.00` แต่ค่าที่คำนวณได้ `900` → เทียบด้วย `ToString()` ไม่เท่ากัน
  → format `"F2"` (InvariantCulture) ก่อนเทียบ (เคยทำให้ lock รอบจ่ายไม่ได้เลยบน Postgres)
- **InMemory provider ไม่รองรับ `SelectMany` บาง pattern** (NotImplementedException) และ `ExecuteUpdate` → เขียน query แบบ 2 ขั้น (ids ก่อนแล้ว `Contains`)
- InMemory ไม่ตรวจ unique index → ลำดับ delete-before-insert ต้องทดสอบบน Postgres
- **migration ที่ apply ลง DB ในเครื่องแล้ว ลบ/แก้ไม่ได้** → เพิ่ม migration ใหม่
- `LegalRules.IncomeTax` เป็น nullable เพราะแถวเก่าใน DB ไม่มี field นี้ — deserialize `required` ที่ขาดจะ throw

## JSON
- System.Text.Json escape ภาษาไทยเป็น `\uXXXX` โดย default → DbContext ใช้ `JavaScriptEncoder.Create(UnicodeRanges.All)` ให้ jsonb อ่านได้ตรงๆ
- enum ส่งเป็น string (`JsonStringEnumConverter` ทั้ง API และ jsonb)

## เทสต์ API (WebApplicationFactory)
- config ที่ Program อ่านตอน `CreateBuilder` (เช่น `Database:MigrateOnStartup`) ต้องตั้งผ่าน **env var** ก่อนสร้าง host
- เปลี่ยน provider เป็น InMemory ต้อง `RemoveAll<IDbContextOptionsConfiguration<JangnaDbContext>>()` ด้วย
- test host ไม่ migrate → `ApiFactory.CreateHost` เรียก `LegalDataSeeder` เอง (ไม่งั้นสร้างรอบจ่ายแล้ว 500)
- Development แนบ exception ใน ProblemDetails `detail` → ดู error จริงได้จาก response

## Frontend
- shadcn รุ่นนี้ใช้ **Base UI** ไม่ใช่ Radix — `components/ui/select.tsx` เขียนเอง (popover + hidden input ส่งค่ากับ FormData) ไม่ได้ใช้ Select ของ Base UI
- Select ใช้ `onValueChange(value)` ไม่ใช่ `onChange(event)`; popover อยู่ใน portal → โค้ดปิดเมื่อคลิกข้างนอกต้องเช็กทั้งช่องกดและ panel
- `cn` มาจากแพ็กเกจ `cn` ของ shadcn (re-export ที่ `lib/utils.ts`)
- ห้าม `setState` ใน effect (lint `react-hooks/set-state-in-effect`) → ค่าจาก localStorage อ่านด้วย `useSyncExternalStore`
- `Card` เดิมมี `overflow-hidden` ทำให้ popover ปฏิทินโดนตัด → เอาออกแล้ว อย่าใส่กลับ
- ช่อง `required` ที่ซ่อนอยู่ต้องไม่เป็น `readOnly`/`type=hidden` (browser ไม่ตรวจ) — ดู `DateField`
