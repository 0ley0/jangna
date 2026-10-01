# Jangna (จ้างนะ)

ลงเวลา ค่าแพ็ค และเงินเดือน ผ่าน LINE — ดูแผนทั้งหมดที่ [PLAN.md](PLAN.md)

## ต้องมี
- .NET SDK 10
- Node.js 20+
- Docker Desktop (สำหรับ Postgres/Redis ตอน dev)

## รันตอน dev
```bash
# 1) ฐานข้อมูล (Postgres :5433, Redis :6380)
docker compose -f docker/docker-compose.yml up -d

# 2) Backend → http://localhost:5099  (migrate + seed ข้อมูลกฎหมายอัตโนมัติตอนเริ่ม)
cd backend
dotnet run --project src/Jangna.Api

# 3) Frontend → http://localhost:3000
cd frontend
cp .env.example .env.local   # ครั้งแรก
npm run dev
```

ลองใช้: สมัครที่ `/register` → เพิ่มสาขา → เพิ่มพนักงาน → กด "ส่งลิงก์ผูก LINE" → เปิดลิงก์ (`/liff/join?code=...`)
ถ้ายังไม่ได้ตั้ง LINE channel จะเป็น **โหมดทดสอบ**: กรอกชื่อแทนการ login LINE (backend รับ token `dev:...` เฉพาะ Development)

## ทดสอบ
```bash
cd backend && dotnet test
cd frontend && npm run lint && npm run build
```

## Migration
```bash
cd backend
dotnet ef migrations add <Name> --project src/Jangna.Infrastructure --startup-project src/Jangna.Api --output-dir Persistence/Migrations
# apply กับ Neon: ใช้ direct connection (ไม่ใช่ -pooler)
JANGNA_DIRECT_DB="Host=...;Database=...;Username=...;Password=...;SSL Mode=Require" dotnet ef database update --project src/Jangna.Infrastructure --startup-project src/Jangna.Api
```

## ตั้งค่า production (env)
| key | ค่า |
|---|---|
| `ConnectionStrings__Default` | Neon pooled connection string |
| `Jwt__SigningKey` | สุ่มยาว ≥ 32 ตัว |
| `Line__LoginChannelId` | Channel ID ของ LINE Login channel |
| `Line__LiffId` | LIFF ID (endpoint URL = `https://<frontend>/liff`) |
| `Frontend__Origin` | เช่น `https://jangna.com` (CORS + ลิงก์เชิญ) |

## ⚠️ ข้อมูลกฎหมายที่ยังไม่ยืนยัน
`backend/src/Jangna.Infrastructure/Seed/minimum-wages.draft.json` สรุปจากบทความ ไม่ใช่ประกาศราชกิจจาฯ (`verified: false`) —
ต้องตรวจกับประกาศคณะกรรมการค่าจ้างก่อนใช้จ่ายเงินจริง (ดู `notes` ในไฟล์)
