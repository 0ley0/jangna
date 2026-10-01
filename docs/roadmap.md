# Roadmap

อัปเดตไฟล์นี้ทุกครั้งที่งานเสร็จ (เปลี่ยน `[ ]` → `[x]` + วันที่)

## งานที่ไม่ใช่โค้ด (เจ้าของโปรเจกต์ทำเอง)
- [ ] จดโดเมน jangna.com (+ jangna.app, จ้างนะ.com, จ้างนะ.ไทย, ruamtalad.com)
- [ ] เปิด LINE OA "จ้างนะ" + LINE Developers channel (Messaging API, LINE Login, LIFF) → ปลดล็อกงานลงเวลา/สลิป
- [ ] เช็กค่าส่งข้อความ LINE OA (push เกินโควตาฟรีมีค่าใช้จ่าย)
- [ ] สัมภาษณ์ร้านออนไลน์ที่จ้างคนแพ็ค ≥3 คน 10 ร้าน (นับยอดยังไง / จ่ายยังไง / เคลมเดือนละเท่าไหร่) — **ก่อน Phase 2**
- [ ] ปรึกษาทนายแรงงาน — รายการสมมติฐานอยู่ใน [payroll.md](payroll.md#สมมติฐานที่ต้องให้ทนายยืนยัน)
- [ ] ตรวจค่าแรงขั้นต่ำกับประกาศคณะกรรมการค่าจ้างจริง แล้วตั้ง `verified: true`
- [ ] จดทะเบียนพาณิชย์/บริษัทชื่อ "จ้างนะ" → จด jangna.co.th + เครื่องหมายการค้า
- [ ] Privacy policy + แบบขอความยินยอม PDPA (เซลฟี่, GPS, วิดีโอแพ็ค)

## Phase 0 — Foundation ✅ (2026-10-01)
- [x] โครง repo, docker-compose (postgres, redis)
- [x] Auth เจ้าของ (email + password → JWT), Tenant, Branch, User, Membership/Role
- [x] Multi-tenant: global query filter + กันเขียนข้าม tenant
- [x] Employee + เชิญผูก LINE (invite ใช้ครั้งเดียว 7 วัน → LIFF → verify ID token)
- [x] Legal rule sets แบบ effective-dated + ค่าแรงขั้นต่ำ (draft)
- [ ] Auth เจ้าของด้วย LINE Login → ย้ายไป Phase 1

## Phase 1 — MVP: Time & Pay
- [x] Payroll engine (2026-10-02) — รายละเอียดใน [payroll.md](payroll.md)
- [x] Pay run: draft → ตรวจ → lock + snapshot (2026-10-02)
- [x] บันทึกงานแบบกรอกเอง: วันทำงาน/OT/ลา, ผลงานต่อชิ้น, เงินเบิก, วันหยุดร้าน, ยอดยกมาต้นปี, audit log (2026-10-02)
- [x] UI theme Hearth + DatePicker ไทย/อังกฤษ + สลับภาษา TH/EN ทั้งแอป (2026-10-02)
- [x] ฟอนต์ Noto Sans Thai + ชุด component ใช้ซ้ำ (Button loading, TextField/SelectField/TextareaField, Select, Chip/ChipGroup, TableEmpty) + หน้า `/ui` (2026-10-02)
- [ ] ข้อความจาก backend สองภาษา (validation, คำเตือนรอบจ่าย, error) — ตอนนี้ไทยอย่างเดียว
- [ ] Export สปส.1-10 (e-Service), ภ.ง.ด.1, สลิป PDF — **ทำได้เลยไม่ต้องรอ LINE**
- [ ] กะงาน (shift templates, จัดกะรายสัปดาห์) + ส่งตารางเข้า LINE
- [ ] ลงเวลาผ่าน LIFF: geofence + เซลฟี่ (R2), กันลงซ้ำ, แก้เวลาโดย manager (audit) → สรุปเป็น `work_days` อัตโนมัติ
- [ ] ขอลา / ขอ OT / ขอเบิก ผ่าน LINE → อนุมัติใน LINE/เว็บ
- [ ] สลิปเงินเดือนเข้า LINE (TH/EN/MY)
- [ ] Auth เจ้าของด้วย LINE Login

## Phase 2 — Pack module (จุดขายหลัก)
- [ ] Pack station (เว็บมือถือ/PC + กล้อง): สแกนใบปะหน้า → อัดวิดีโอ → สแกนปิดกล่อง → upload R2 (presigned)
- [ ] วิดีโอฝัง overlay: เลขพัสดุ, เวลา, ชื่อคนแพ็ค (MediaRecorder + canvas)
- [ ] นับยอดแพ็คต่อคน realtime → `piece_work_entries` (source = PackStation)
- [ ] อัตราค่าแพ็ค: ต่อกล่อง / ต่อชิ้น / ตามขนาดกล่อง / ตามหมวดสินค้า
- [ ] ค้นวิดีโอจากเลขพัสดุ/ออเดอร์ (ตอนเคลม) + ลบอัตโนมัติ 90 วัน
- [ ] Dashboard: กล่อง/ชม./คน, ต้นทุนแพ็คต่อออเดอร์, เคลมย้อนกลับหาคนแพ็ค (บันทึกอย่างเดียว ห้ามหักเงินอัตโนมัติ)
- [ ] Integration Ruam Talad: รับ order → ตรวจแพ็คครบ SKU
- [ ] คนช่วงเซล: ลิงก์ลงทะเบียนเอง (บัตร, พร้อมเพย์), ระบุลูกจ้าง/ฟรีแลนซ์

## Phase 3 — Growth
- [ ] ร้านอาหาร: service charge / ทิป, หลายสาขา
- [ ] แรงงานต่างด้าว: เอกสาร (work permit, visa, passport) + แจ้งเตือนก่อนหมดอายุ
- [ ] ไฟล์โอนเงินเดือนธนาคาร / จ่ายรายวันผ่านพร้อมเพย์
- [ ] Billing / subscription + ส่วนลดลูกค้า Ruam Talad
- [ ] Earned wage access (ต้องมีพาร์ตเนอร์การเงิน)

## ก่อนเปิดให้ลูกค้าจริง (ยังไม่ได้วาง phase)
- [ ] Deploy: frontend → Vercel, API → (Fly.io / Railway / อื่นๆ), DB → Neon
- [ ] CI รันเทสต์ทุก push, log/monitoring, backup DB
- [ ] ปุ่มสลับโหมดมืด (token "dusk" มีแล้ว)
