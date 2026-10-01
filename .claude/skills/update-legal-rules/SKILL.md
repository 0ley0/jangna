---
name: update-legal-rules
description: Update Thai labour/tax/social-security rules used by Jangna payroll — social security base/rate, minimum wage per province/district, income tax brackets, OT multipliers. Use when a law changes, when verifying the draft minimum wage, or when the user mentions ประกาศค่าแรงขั้นต่ำ / ฐานประกันสังคม / อัตราภาษี.
---

# Update legal rules

กฎหมายเป็น **ข้อมูลแบบ effective-dated** — ไม่แก้ค่าของช่วงเก่า ให้เพิ่มช่วงใหม่ (รอบจ่ายที่ปิดแล้วเก็บ snapshot ไว้อยู่แล้ว)

## หาข้อมูล
- ใช้แหล่งทางการก่อน (ราชกิจจานุเบกษา, กระทรวงแรงงาน, สปส., กรมสรรพากร) — บทความใช้ได้แค่เป็น draft
- เก็บ URL แหล่งที่มาไว้ใน `Source`
- ตัวเลขที่ไม่แน่ใจ → **ห้ามเดา** บอกผู้ใช้ และเก็บเป็น `verified: false`

## สปส. / เวลาทำงาน / OT / ภาษี
ไฟล์: `backend/src/Jangna.Infrastructure/Seed/LegalDataSeeder.cs` → `RuleSets()` (+ `IncomeTax`, `Overtime`, `WorkingTime`)
- เพิ่ม `new() { EffectiveFrom = ..., Payload = ..., Source = "..." }` — **seeder sync จากโค้ดทุกครั้งที่ API เริ่ม** (จับคู่ด้วย EffectiveFrom)
- field ใหม่ใน `LegalRules` (`backend/src/Jangna.Payroll.Engine/Rules/LegalRules.cs`) ต้องเป็น nullable/มี default — แถวเก่าใน DB ไม่มี field นั้น

## ค่าแรงขั้นต่ำ
ไฟล์: `backend/src/Jangna.Infrastructure/Seed/minimum-wages.draft.json` (tiers ตามอัตรา + areas = อำเภอพิเศษ, รหัสจังหวัด ISO 3166-2:TH, อำเภอ = รหัสกรมการปกครอง 4 หลัก)
- seed ใส่ **เฉพาะตอนตาราง `minimum_wages` ว่าง** → ประกาศใหม่ = ต้องเพิ่มแถวใหม่ (effective_from ใหม่) ไม่ใช่แก้ JSON เดิมอย่างเดียว:
  ทำ seeder ให้เพิ่มแถวที่ยังไม่มี (province, area, effective_from) หรือเพิ่มไฟล์ JSON ชุดใหม่ แล้วให้ seeder อ่านทุกไฟล์
- ตรวจกับประกาศจริงแล้ว → `verified: true` (หน้าเว็บจะเลิกขึ้นป้าย "ยังไม่ยืนยัน" และ warning ในรอบจ่ายจะหายไป)
- ต้องครบ 77 จังหวัด ไม่ซ้ำ — เทสต์ `MinimumWageSeedTests` ตรวจให้

## ตรวจ
```bash
cd /c/Charp/jangna/backend && dotnet test
```
- เพิ่มเคสใน `RuleResolverTests` (วันก่อน/วันมีผล) และ `PayrollCalculatorTests` ถ้าตัวเลขเปลี่ยนผลเงินเดือน — **คิดตัวเลขคาดหวังด้วยมือ เขียนวิธีคิดไว้ในคอมเมนต์**
- รัน API แล้ว `GET /api/legal/rules?date=<วันมีผล>` ว่าได้ค่าใหม่
- อัปเดตตารางกฎหมายใน `docs/payroll.md`
