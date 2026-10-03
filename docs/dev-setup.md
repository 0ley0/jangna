# Dev setup

## ต้องมี
.NET SDK 10 · Node.js 20+ (เครื่องนี้ 24) · Docker Desktop

## รัน (ดู skill `run-dev` สำหรับขั้นตอนเต็ม + ปัญหาที่เจอบ่อย)
```bash
docker compose -f docker/docker-compose.yml up -d     # Postgres :5433, Redis :6380
cd backend && dotnet run --project src/Jangna.Api     # http://localhost:5099 — migrate + seed อัตโนมัติ (Development)
cd frontend && npm run dev                            # http://localhost:3000 (ครั้งแรก: cp .env.example .env.local)
node scripts/seed-demo.mjs                            # บัญชีตัวอย่าง demo@jangna.local / demo1234
```

## Config
| key | dev (`appsettings.Development.json`) | prod (env) |
|---|---|---|
| `ConnectionStrings:Default` | `Host=127.0.0.1;Port=5433;Database=jangna;Username=jangna;Password=jangna` | Neon pooled |
| `Jwt:SigningKey` | dev key ในไฟล์ | สุ่ม ≥ 32 ตัว (`Jwt__SigningKey`) |
| `Line:LoginChannelId`, `Line:LiffId` | ว่าง → **โหมดทดสอบ** (token `dev:{id}:{ชื่อ}`) | ค่าจาก LINE Developers (LIFF endpoint = `https://<frontend>/liff`) |
| `Frontend:Origin` | `http://localhost:3000` | เช่น `https://jangna.com` (CORS + ลิงก์เชิญ) |
| `Database:MigrateOnStartup` | `true` | `false` (migrate แยก) |

Frontend env: `NEXT_PUBLIC_API_URL` (default `http://localhost:5099`), `NEXT_PUBLIC_LIFF_ID` (ว่าง = โหมดทดสอบ)

## เทสต์
```bash
cd backend && dotnet test                  # engine + tenant + API flow (InMemory)
cd frontend && npm run lint && npx tsc --noEmit && npm run build
node scripts/smoke-test.mjs                # ยิง API จริงกับ Postgres (ต้องรัน API อยู่)
cd frontend && npm run e2e                 # Playwright กับ Chrome ในเครื่อง (ต้องรัน API :5099 + เว็บ :3000 อยู่)
```
**E2E (`frontend/e2e/`)**: ทุกเทสต์สมัครร้านใหม่เอง (อีเมลสุ่ม ไม่แตะบัญชีตัวอย่าง) เตรียมข้อมูลผ่าน API แล้วทดสอบหน้าจริง — ใช้ `openAs()` (ใส่ token + รอ hydrate) ไม่ใช่ `page.goto` ตรงๆ ไม่งั้นคลิกแรกอาจหาย · ตอนมี dialog เปิดอยู่ หน้าหลังถูก `aria-hidden` → `getByRole` มองไม่เห็น ใช้ `locator(...)` แทน · `--headed` ดูหน้าจอ, `npx playwright show-report` ดูรายงาน
**บั๊กที่เทสต์กลุ่ม `CrudBoundaryTests` + smoke ขั้นสุดท้ายป้องกัน**: ข้อมูลใหญ่/ยาวเกินคอลัมน์ต้องได้ 400 ไม่ใช่ 500 (กฎอยู่ที่ `Limits.cs` + validation ของแต่ละ endpoint), enum รับเฉพาะชื่อ (ไม่รับตัวเลข), JSON ที่ไม่ครบ field ต้องไม่ NullReferenceException
InMemory **ไม่** ตรวจ unique index, decimal scale, SQL จริง → ฟีเจอร์ที่แตะ DB ให้รัน smoke test กับ Postgres ด้วยเสมอ (ดู [gotchas.md](gotchas.md))

## Migration
ดู skill `add-migration` — สรุป:
```bash
cd backend
dotnet ef migrations add <Name> --project src/Jangna.Infrastructure --startup-project src/Jangna.Api --output-dir Persistence/Migrations
```
Neon: `JANGNA_DIRECT_DB="<direct connection>" dotnet ef database update --project src/Jangna.Infrastructure --startup-project src/Jangna.Api`

## Git
remote: https://github.com/0ley0/jangna (branch `main`) · ไฟล์ `powerd_bese_desinge/*(offline).html` (~2MB) ไม่ควร commit
