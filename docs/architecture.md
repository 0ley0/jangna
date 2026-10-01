# Architecture

## Stack
| ส่วน | ใช้ |
|---|---|
| Backend | ASP.NET Core **.NET 10**, minimal API, modular monolith |
| DB | PostgreSQL (dev: Docker `:5433`, prod: Neon — project แยกจาก Ruam Talad) + EF Core 10 (Npgsql, snake_case) |
| Cache / jobs | Redis (`:6380`, ยังไม่ได้ใช้), Hangfire (วางแผน) |
| Frontend | **Next.js 16** (App Router, client components) + TanStack Query + shadcn/ui (Base UI) + Tailwind v4 |
| พนักงาน | LINE LIFF (ไม่ต้องลงแอป) — LINE OA กลางของ Jangna ตัวเดียว |
| ไฟล์ | Cloudflare R2 (วางแผน: เซลฟี่, วิดีโอแพ็ค, presigned upload + ลบอัตโนมัติ) |

## Repo
```
jangna/
  CLAUDE.md                สารบัญสำหรับ Claude
  docs/                    เอกสารแยกเรื่อง (ไฟล์นี้)
  .claude/skills/          งานที่ทำซ้ำ (run-dev, add-migration, ...)
  scripts/                 seed-demo.mjs, smoke-test.mjs
  docker/docker-compose.yml
  powerd_bese_desinge/     ต้นฉบับดีไซน์ Hearth (อ้างอิงเท่านั้น)
  backend/
    Jangna.slnx
    src/Jangna.Payroll.Engine   pure: Rules/ (LegalRules, RuleResolver), Model/ (PayInput, PayResult), Calculators/
    src/Jangna.Core             Entities/, Tenancy/ITenantContext — อ้างอิง Engine อย่างเดียว
    src/Jangna.Infrastructure   Persistence/ (JangnaDbContext, Migrations), Seed/ (LegalDataSeeder + minimum-wages.draft.json)
    src/Jangna.Api              Program.cs, Auth/, Line/, Endpoints/*, PayRuns/PayRunService
    tests/Jangna.Tests          Payroll/ (engine), Infrastructure/ (tenant), Api/ (WebApplicationFactory + InMemory)
  frontend/src/
    app/(auth)/login|register   app/app/* (หลัง login)   app/liff/join (พนักงาน)
    components/ui/*  (shadcn ที่ปรับเป็น Hearth)   components/{date-picker,field,icons,lang-toggle}.tsx
    lib/{api,i18n,format,types,queries,provinces}.ts
```
ทิศ dependency: `Api → Infrastructure → Core → Payroll.Engine` (Engine ไม่พึ่งอะไรเลย)

## Endpoints (`/api`)
| กลุ่ม | ไฟล์ | สิทธิ์ |
|---|---|---|
| `/auth/register`, `/auth/login` | AuthEndpoints | anonymous |
| `/me`, `/branches` | OrgEndpoints | login (แก้สาขา = Owner) |
| `/employees`, `/employees/{id}/invites` | EmployeeEndpoints | Manager+ |
| `/liff/invites/{code}`, `/liff/join` | LiffEndpoints | anonymous (ยืนยันด้วย LINE ID token) |
| `/legal/rules`, `/legal/minimum-wage` | LegalEndpoints | login |
| `/work-days`, `/piece-work`, `/advances`, `/holidays`, `/opening-balances` | WorkEndpoints | Manager+ (วันหยุด/ยอดยกมา = Owner) |
| `/pay-runs`, `/{id}/recalculate`, `/{id}/lock` | PayRunEndpoints | Manager+ (lock = Owner) |

Fallback policy: ทุก endpoint ต้อง login + มี `tenant_id` claim ยกเว้นที่ `AllowAnonymous`

## Multi-tenant
- ทุก entity ที่เป็นของร้าน implement `ITenantOwned` (สืบจาก `TenantEntity`)
- `JangnaDbContext` ใส่ global query filter `TenantId == CurrentTenantId` อัตโนมัติ (reflection ตอน OnModelCreating)
- `SaveChanges` เติม `TenantId` ให้แถวใหม่ และ **throw ถ้าเขียนข้าม tenant** / บันทึกโดยไม่มี tenant
- tenant มาจาก JWT claim `tenant_id` (`HttpTenantContext`) — request anonymous = ไม่มี tenant = query ไม่เห็นอะไร
- endpoint anonymous ที่ต้องหาข้อมูลร้าน (LIFF) ใช้ `IgnoreQueryFilters()` อย่างตั้งใจ แล้วหาเองจาก invite code

## Audit log
entity ที่ implement `IAudited` (WorkDay, PieceWorkEntry, Advance, Holiday, Employee, PayRun, OpeningBalance)
ถูกบันทึกลง `audit_logs` อัตโนมัติใน `SaveChanges` (ใคร = `ITenantContext.UserId`, Added/Modified/Deleted + ค่าที่เปลี่ยน เป็น jsonb)

## กฎการออกแบบ
1. **Payroll engine เป็น pure function** — input + กฎหมาย → รายการเงินได้/หัก ไม่แตะ DB ไม่อ่านเวลาปัจจุบัน
2. **เงินใช้ `decimal` เสมอ** — ปัดเศษในที่เดียว (engine)
3. **กฎหมายเป็นข้อมูล ไม่ใช่โค้ด** — `legal_rule_sets.effective_from` + ค่าแรงขั้นต่ำมี `verified`
4. **Pay run ที่ lock แล้วห้ามแก้** — เก็บ snapshot ของกฎหมาย + input ทุกคน
5. **ทุกการแก้เวลา/ค่าแรงมี audit log**
6. Webhook idempotent (เก็บ event_id); ข้อมูลจาก Ruam Talad เป็น input เสริม ระบบต้องทำงานได้ถ้าไม่มี
7. รูป/วิดีโอ upload ตรงไป R2 ด้วย presigned URL + ลบอัตโนมัติ (PDPA)
8. LINE push แบบ batch เพื่อลดค่าส่ง; ใช้ reply token เมื่อทำได้

## แผน architecture เต็ม (เป้าหมาย)
```
[LINE LIFF (พนักงาน)] ─┐
[Next.js (เจ้าของ)] ───┼──REST / SignalR──> [ASP.NET Core API]
[Pack station] ────────┘                         │
                                                 ├─ Modules: Identity, Org, Employees, Time,
                                                 │           Pack, Payroll, Notifications, Billing
 LINE webhook ─────────> Webhook Receiver ─┐     │
 Ruam Talad webhook ───> (order events) ───┴─> webhook_events (raw) ─> Hangfire jobs
                                                 │
                    Workers: pay run calc, LINE push, video retention, doc expiry alerts
                                                 │
                     [PostgreSQL]  [Redis]  [R2: selfies, pack videos (presigned upload)]
```

## Neon (ตอน deploy)
- 2 connection string: **pooled** (`-pooler` host) สำหรับ API, **direct** สำหรับ migration (`JANGNA_DIRECT_DB`) และ Hangfire
- Hangfire poll DB ตลอด → compute ไม่ scale-to-zero (dev branch ควรปิด worker)
