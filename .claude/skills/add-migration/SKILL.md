---
name: add-migration
description: Change the Jangna database schema — add/modify an entity, configure it in JangnaDbContext, create an EF Core migration, and verify on Postgres. Use whenever a task adds a table/column/index or changes an entity in backend/src/Jangna.Core/Entities.
---

# Add a schema change + migration

## 1. Entity (`backend/src/Jangna.Core/Entities/`)
- ของร้าน → สืบจาก `TenantEntity` (ได้ tenant filter + stamp อัตโนมัติ); ข้อมูลระบบ (กฎหมาย) → `Entity`
- ต้องมีประวัติการแก้ (เวลา/ค่าแรง/เงิน) → implement `IAudited`
- เงิน = `decimal`, วันที่ = `DateOnly`, เวลา = `DateTimeOffset`, enum เก็บเป็น string

## 2. DbContext (`backend/src/Jangna.Infrastructure/Persistence/JangnaDbContext.cs`)
- เพิ่ม `DbSet<T>`
- ใน `OnModelCreating`: `HasPrecision` ทุก decimal (เงิน `14,2`), `HasConversion<string>().HasMaxLength(20)` ทุก enum,
  unique index ที่ขึ้นต้นด้วย `TenantId`, object/list → `Json(e.Property(...))` (jsonb + comparer)
- filtered index ใช้ชื่อคอลัมน์ snake_case: `.HasFilter("line_user_id IS NOT NULL")`

## 3. Migration
```bash
cd /c/Charp/jangna/backend
dotnet ef migrations add <PascalCaseName> --project src/Jangna.Infrastructure --startup-project src/Jangna.Api --output-dir Persistence/Migrations
```
- เปิดไฟล์ที่ได้ดูว่าสร้าง/แก้แค่ที่ตั้งใจ
- **ห้าม `migrations remove` / แก้ migration ที่ apply ลง DB แล้ว** (เครื่อง dev apply อัตโนมัติตอนรัน API) → สร้างตัวใหม่แทน
- ถ้า EF Relational version ชนกัน: pin `Microsoft.EntityFrameworkCore(.Relational)` ให้ตรงกับ Design ใน Infrastructure

## 4. ตรวจ
```bash
dotnet build && dotnet test
```
แล้วรัน API (skill `run-dev`) ให้ migration apply กับ Postgres + `node scripts/smoke-test.mjs`
InMemory ไม่ตรวจ unique index / decimal scale — ดู `docs/gotchas.md` หัวข้อ EF Core

## 5. เอกสาร
อัปเดตตารางใน `docs/data-model.md` (ย้ายจาก "วางแผน" → "มีแล้ว" ถ้าเกี่ยว)
