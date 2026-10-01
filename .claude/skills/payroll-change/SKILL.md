---
name: payroll-change
description: Change how Jangna calculates pay — new earning/deduction type, pay basis, multiplier, rounding, pay run behaviour (PayrollCalculator, PayRunService). Use for any change to backend/src/Jangna.Payroll.Engine or backend/src/Jangna.Api/PayRuns, or questions like "ทำไมเงินเดือนคนนี้ได้เท่านี้".
---

# Change payroll calculation

อ่าน `docs/payroll.md` ก่อน (กฎปัจจุบัน + สมมติฐานที่ยังรอทนาย)

## กฎ
1. Engine (`Jangna.Payroll.Engine`) เป็น **pure function**: ห้ามแตะ DB, ห้ามอ่านเวลาปัจจุบัน, ห้าม random — ข้อมูลทุกอย่างมาทาง `PayInput`
2. เงิน `decimal` เท่านั้น ปัดใน engine ที่เดียว (`Round` 2 ตำแหน่ง AwayFromZero; สปส. ปัดเป็นบาท)
3. ค่าคงที่ตามกฎหมาย (ตัวคูณ, เพดาน, อัตรา) อยู่ใน `LegalRules` ไม่ hardcode ใน calculator — ถ้าต้องเพิ่ม ใช้ skill `update-legal-rules`
4. กรณีผิดปกติ → เพิ่ม `Warnings` (ภาษาไทย) แทน throw — throw เฉพาะ input ที่เป็นไปไม่ได้
5. รายการเงินได้/หักใหม่ → เพิ่มรหัสใน `LineCodes` **และ** ชื่อสองภาษาใน `payLineLabels` (`frontend/src/lib/types.ts`)
6. อย่าหักเงินพนักงานอัตโนมัติจากความผิดพลาด (เช่น แพ็คผิด) — กฎหมายจำกัดการหักค่าจ้าง

## เทสต์ (ทำก่อน/พร้อมโค้ด)
- `backend/tests/Jangna.Tests/Payroll/PayrollCalculatorTests.cs` — **คิดตัวเลขด้วยมือก่อน** แล้วเขียนวิธีคิดเป็นคอมเมนต์ข้าง assert
  (เคยเจอ: ตัวเลขคาดหวังผิดเอง เช่น ลืมฐานขั้นต่ำ สปส. 1,650 / ลืมว่าสาขาไม่ใช่ กทม.) → ถ้าเทสต์ fail ให้ตรวจการคิดมือก่อนแก้ engine
- พฤติกรรมรอบจ่าย (YTD/MTD, lock, เงินเบิก) → `backend/tests/Jangna.Tests/Api/PayRunFlowTests.cs`
- ถ้าแตะ `PayRunService` หรือ DB → รัน `node scripts/smoke-test.mjs` กับ Postgres (decimal scale / unique index — ดู `docs/gotchas.md`)

```bash
cd /c/Charp/jangna/backend && dotnet test
```

## หลังแก้
- อัปเดตตารางวิธีคิดใน `docs/payroll.md`
- ถ้าเปลี่ยนผลของรอบที่ยังเป็น Draft → ผู้ใช้ต้องกด "คำนวณใหม่"; รอบที่ Locked ไม่เปลี่ยน (snapshot)
- สมมติฐานใหม่ที่ยังไม่แน่ใจทางกฎหมาย → เพิ่มในหัวข้อ "สมมติฐานที่ต้องให้ทนายยืนยัน"
