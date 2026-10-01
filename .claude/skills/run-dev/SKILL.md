---
name: run-dev
description: Start Jangna locally (Docker Postgres/Redis, .NET API on :5099, Next.js on :3000), seed the demo account, and smoke-test against real Postgres. Use when asked to run/start the app, "รันให้ที", test end-to-end, or when the API/web server stopped.
---

# Run Jangna locally

## 1. Database
```powershell
$env:Path = "C:\Users\Thana\AppData\Local\Programs\DockerDesktop\resources\bin;" + $env:Path   # shell เก่าหา docker ไม่เจอ
docker ps --format '{{.Names}} {{.Status}}'                      # มี jangna-postgres-1 (healthy) อยู่แล้วไหม
docker compose -f C:\Charp\jangna\docker\docker-compose.yml up -d
```
Postgres `127.0.0.1:5433` (user/pass/db = `jangna`) — **ใช้ 127.0.0.1 ไม่ใช่ localhost** (IPv6 ค้าง)

## 2. API + Web
รันผ่าน **PowerShell** (Bash tool เข้า localhost ไม่ได้บางครั้ง) แบบ background, `timeout: 7200000`:
```powershell
Set-Location C:\Charp\jangna\backend; dotnet run --project src/Jangna.Api --launch-profile http
Set-Location C:\Charp\jangna\frontend; npm run dev
```
แล้วรอ health (foreground):
```powershell
for ($i = 0; $i -lt 45; $i++) { try { Invoke-RestMethod http://127.0.0.1:5099/health -TimeoutSec 2 | Out-Null; "api up"; break } catch { Start-Sleep 2 } }
```
- API migrate + seed กฎหมายอัตโนมัติตอนเริ่ม (Development) — log `Failed executing DbCommand ... __EFMigrationsHistory` ครั้งแรกเป็นเรื่องปกติ
- port ชน (5099/3000 ถูกใช้) → มี process เก่าค้าง: `Get-CimInstance Win32_Process -Filter "Name='dotnet.exe'" | ? CommandLine -match 'Jangna.Api'`
- frontend ครั้งแรก: `cp .env.example .env.local`

## 3. ข้อมูลตัวอย่าง + ตรวจ
```powershell
Set-Location C:\Charp\jangna; node scripts/seed-demo.mjs      # demo@jangna.local / demo1234 (รันซ้ำได้)
node scripts/smoke-test.mjs                                    # 11 ขั้น กับ Postgres จริง — ต้องผ่านก่อนบอกว่า "ใช้ได้"
```

## 4. บอกผู้ใช้
- URL: http://localhost:3000 + บัญชีตัวอย่าง
- server ที่ Claude รัน background จะถูกหยุดเมื่อครบเวลา → บอกคำสั่งรันเองใน terminal ไว้ด้วย
- ถ้าไม่ได้เปิดเบราว์เซอร์ดูหน้าจอจริง ให้บอกตรงๆ ว่าเช็กแค่ HTTP 200
