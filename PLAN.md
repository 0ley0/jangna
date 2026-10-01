# Jangna (จ้างนะ) — Project Plan

SaaS ลงเวลา + เงินเดือน ผ่าน LINE สำหรับ SME ไทยที่จ้างพนักงานรายวัน/รายชั่วโมง/ต่อชิ้น
กลุ่มแรก: **ร้านค้าออนไลน์ที่จ้างพนักงานแพ็คสินค้า** → ต่อด้วยร้านอาหาร

- Domain: jangna.com (+ จ้างนะ.com, จ้างนะ.ไทย redirect มา) — jangna.co.th เมื่อมีนิติบุคคล/ทะเบียนพาณิชย์
- Namespace (C#): `Jangna.*`
- Tagline (ร่าง): "จ้างนะ จ้างง่าย จ่ายถูก" / "แพ็คปุ๊บ นับปั๊บ จ้างนะจ่ายให้"
- โปรเจกต์พี่น้อง: Ruam Talad (`../ruam-talad`) — ส่งข้อมูลออเดอร์มาให้ Pack module

## Decisions
| หัวข้อ | ตัดสินใจ |
|---|---|
| รูปแบบ | SaaS multi-tenant (tenant = ร้าน/บริษัท, มีได้หลายสาขา) |
| กลุ่มแรก | ร้านออนไลน์ที่จ้างคนแพ็ค (ค่าแพ็คต่อกล่อง/ชิ้น + รายวัน) |
| ฝั่งพนักงาน | LINE LIFF (ไม่ต้องลงแอป) — ใช้ LINE OA กลางของ Jangna ตัวเดียวใน MVP |
| ฝั่งเจ้าของ | Web (Next.js) + แจ้งเตือนผ่าน LINE |
| Frontend | Next.js (App Router) + TanStack Query + shadcn/ui → Vercel |
| Backend | ASP.NET Core (.NET 10), Modular Monolith → Docker |
| Database | PostgreSQL บน Neon (project แยกจาก Ruam Talad) + Redis |
| Background jobs | Hangfire (Postgres storage) |
| Video storage | Cloudflare R2 (S3-compatible, ไม่มีค่า egress) + lifecycle ลบอัตโนมัติ |
| เชื่อม Ruam Talad | ผ่าน API/webhook (ไม่แชร์ DB) — Jangna ใช้งานเดี่ยวได้โดยไม่ต้องมี Ruam Talad |

## Action items ที่ต้องทำคู่ขนาน (ไม่ใช่โค้ด)
- [ ] จดโดเมน jangna.com (+ jangna.app, จ้างนะ.com, จ้างนะ.ไทย, ruamtalad.com)
- [ ] เปิด LINE OA "จ้างนะ" + LINE Developers channel (Messaging API, LINE Login, LIFF)
- [ ] เช็กค่าส่งข้อความ LINE OA (push message เกินโควตาฟรีมีค่าใช้จ่าย) → ออกแบบให้ประหยัด
- [ ] สัมภาษณ์ร้านออนไลน์ที่จ้างคนแพ็ค ≥3 คน จำนวน 10 ร้าน (นับยอดยังไง / จ่ายยังไง / เคลมเดือนละเท่าไหร่)
- [ ] ปรึกษาทนายแรงงาน: ค่าจ้างตามผลงาน vs ค่าแรงขั้นต่ำ, ค่าทำงานวันหยุด, สถานะคนช่วงเซล (ลูกจ้าง/ฟรีแลนซ์)
- [ ] จดทะเบียนพาณิชย์หรือตั้งบริษัทชื่อ "จ้างนะ" → แล้วจด jangna.co.th
- [ ] ยื่นจดเครื่องหมายการค้า "Jangna / จ้างนะ" ที่กรมทรัพย์สินทางปัญญา
- [ ] Privacy policy + แบบขอความยินยอม (PDPA): รูปเซลฟี่, GPS, วิดีโอแพ็ค

## Phases

### Phase 0 — Foundation ✅ (2026-10-01)
- [x] โครง repo, docker-compose (postgres, redis)
- [x] Auth เจ้าของ (email + password → JWT), Tenant, Branch, User, Membership/Role (owner / manager / staff)
- [ ] Auth เจ้าของด้วย LINE Login (ย้ายไป Phase 1)
- [x] Multi-tenant: `tenant_id` + EF Core global query filter + กันเขียนข้าม tenant ตอน SaveChanges
- [x] Employee + เชิญผูก LINE (invite code ใช้ครั้งเดียว 7 วัน → LIFF → verify ID token กับ LINE → ผูก `line_user_id`)
- [x] `LegalRuleSet` แบบ effective-dated: ฐาน สปส. 15,000 → 17,500 (2026) → 20,000 (2029) → 23,000 (2032), OT, เวลาทำงาน
- [x] ค่าแรงขั้นต่ำรายจังหวัด/อำเภอ — seed เป็น **draft ยังไม่ยืนยัน** (ต้องตรวจกับประกาศจริง)
- [ ] ขั้นภาษีเงินได้ (ทำพร้อม payroll ใน Phase 1)

### Phase 1 — MVP: Time & Pay
- กะงาน (shift templates, จัดกะรายสัปดาห์) + ส่งตารางเข้า LINE
- ลงเวลาผ่าน LIFF: geofence รัศมีสาขา + เซลฟี่, กันลงซ้ำ, แก้เวลาโดย manager (มี audit)
- ขอลา / ขอ OT / ขอเบิกเงินล่วงหน้า ผ่าน LINE → อนุมัติใน LINE/เว็บ
- [x] Payroll engine (pure, 32 เทสต์): รายเดือน / รายวัน / รายชั่วโมง / ต่อชิ้น, OT 1.5, วันหยุด 1/2 เท่า, OT วันหยุด 3,
      วันหยุดนักขัตฤกษ์ + ลาได้ค่าจ้าง, เติมค่าแรงขั้นต่ำ, สปส. (รวมหลายรอบในเดือน), ภาษี ภ.ง.ด.1 แบบสะสมทั้งปี,
      ฟรีแลนซ์ 3%, หักเงินเบิก (ยอดเกินยกไปรอบหน้า), warnings
  - สมมติฐานที่ต้องให้ทนายยืนยัน: สปส. นับ OT เป็นค่าจ้าง, ค่าจ้างวันหยุดนักขัตฤกษ์ของลูกจ้างต่อชิ้น (ใช้ค่าจ้างรายวันพื้นฐาน/ขั้นต่ำ),
    ขั้นต่ำคิดตามสัดส่วนชั่วโมงเวลาปกติ, ลดหย่อนอื่นนอกจากส่วนตัว/สปส. ยังต้องกรอกเอง
- Pay run: draft → owner ตรวจ → lock (แก้ไม่ได้, ต้องทำ adjustment รอบถัดไป)
- สลิปเงินเดือนเข้า LINE (TH/EN/MY)
- Export: สปส.1-10 (ไฟล์ e-Service), ภ.ง.ด.1, รายงานสรุปค่าแรง

### Phase 2 — Pack module (จุดขายหลัก)
- Pack station (เว็บบนมือถือ/PC + กล้อง): สแกนบาร์โค้ดใบปะหน้า → เริ่มอัดวิดีโอ → สแกนปิดกล่อง → upload
- วิดีโอฝัง overlay: เลขพัสดุ, เวลา, ชื่อคนแพ็ค (MediaRecorder + canvas)
- นับยอดแพ็คต่อคนแบบ realtime → `piece_work_entries`
- อัตราค่าแพ็ค: ต่อกล่อง / ต่อชิ้น / ตามขนาดกล่อง / ตามหมวดสินค้า
- Minimum-wage floor: ค่าแพ็ครวมวันนั้นต่ำกว่าขั้นต่ำ → เติมให้อัตโนมัติ (เปิดเป็นค่าเริ่มต้น)
- ค้นหาวิดีโอจากเลขพัสดุ/เลขออเดอร์ (ใช้ตอนลูกค้าเคลม) + ลบอัตโนมัติตาม retention (ค่าเริ่มต้น 90 วัน)
- Dashboard: กล่อง/ชั่วโมง/คน, ต้นทุนแพ็คต่อออเดอร์, เคลมย้อนกลับหาคนแพ็ค (บันทึกอย่างเดียว ห้ามหักเงินอัตโนมัติ)
- Integration Ruam Talad: รับ order (items, qty) → ตรวจว่าแพ็คครบ SKU + คิดค่าแพ็คต่อชิ้นได้แม่นขึ้น
- คนช่วงเซล: ลิงก์ลงทะเบียนเอง (บัตร, พร้อมเพย์), ระบุสถานะ ลูกจ้าง/ฟรีแลนซ์ ชัดเจน

### Phase 3 — Growth
- ร้านอาหาร: แบ่ง service charge / ทิป, หลายสาขา, ค่าแรงขั้นต่ำตามจังหวัดสาขา
- แรงงานต่างด้าว: เก็บเอกสาร (work permit, visa, passport) + แจ้งเตือนก่อนหมดอายุ
- ไฟล์โอนเงินเดือนธนาคาร (bulk payment) / จ่ายรายวันผ่านพร้อมเพย์
- Billing / subscription (Free / Shop / Warehouse) + ส่วนลดลูกค้า Ruam Talad
- Earned wage access (ต้องมีพาร์ตเนอร์การเงิน)

## Architecture
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

## Key design rules
1. **Payroll engine เป็น pure function**: input (employee, attendance, piece work, advances, rule set ณ วันที่) → output (lines) — ไม่แตะ DB, test ได้ 100%
2. **เงินใช้ `decimal` เสมอ**, กำหนดกฎปัดเศษไว้ที่เดียว (สตางค์ / ปัดตามแบบฟอร์ม สปส.)
3. **กฎหมายเป็นข้อมูล ไม่ใช่โค้ด**: `legal_rule_sets` มี `effective_from` — เช่น ฐาน สปส. 17,500 (2026–2028) → 20,000 (2029) → 23,000 (2032)
4. **Pay run ที่ lock แล้วห้ามแก้** — เก็บ snapshot ของ input + rule set ที่ใช้ เพื่อคำนวณซ้ำ/ตรวจสอบย้อนหลังได้
5. **ทุกการแก้เวลา/ค่าแรงมี audit log** (ใคร แก้อะไร เมื่อไหร่ เพราะอะไร)
6. Webhook idempotent (เก็บ event_id); ข้อมูลจาก Ruam Talad เป็นแค่ input เสริม ระบบต้องทำงานได้ถ้าไม่มี
7. รูป/วิดีโอ upload ตรงไป R2 ด้วย presigned URL (ไม่ผ่าน API) + lifecycle ลบอัตโนมัติ (PDPA)
8. LINE push แบบรวมข้อความ (batch) เพื่อลดค่าส่ง; ใช้ reply token เมื่อทำได้ (ฟรี)

## Legal notes (2026 — ต้องยืนยันกับทนายก่อน launch)
| เรื่อง | ค่า/กฎ |
|---|---|
| ประกันสังคม | 5% ฝั่งละ, ฐาน 1,650–17,500 → สูงสุด 875 บาท/เดือน (ตั้งแต่ 1 ม.ค. 2026) |
| ค่าแรงขั้นต่ำ | 337–400 บาท/วัน ตามจังหวัด/ประเภท (ตั้งแต่ 1 ก.ค. 2026) |
| เวลาทำงานปกติ | ≤ 8 ชม./วัน, ≤ 48 ชม./สัปดาห์ |
| OT วันทำงาน | ≥ 1.5 เท่า |
| ทำงานวันหยุด | รายเดือน: เพิ่ม ≥ 1 เท่า / รายวัน-ชั่วโมง-ต่อชิ้น: ≥ 2 เท่า (ตามผลงานสำหรับต่อชิ้น) |
| OT วันหยุด | ≥ 3 เท่า |
| ค่าจ้างตามผลงาน | จ่ายได้ แต่ต้องเทียบค่าแรงขั้นต่ำ → ใช้ minimum-wage floor |
| หักค่าจ้าง | ทำได้เฉพาะที่กฎหมายอนุญาต → ห้ามหักค่าแพ็คผิดอัตโนมัติ |

## Repo structure
```
jangna/
  backend/    Jangna.sln (Api, Modules/*, Payroll.Engine, Infrastructure, Workers)
  frontend/   Next.js (owner web + /liff routes + /station)
  docker/     docker-compose.yml
  PLAN.md
```

## Initial DB tables
```
tenants, branches (geo_lat, geo_lng, radius_m, province_code), users, user_roles
employees (pay_type: monthly|daily|hourly|piece, base_rate, line_user_id, status, worker_type: employee|freelance)
employee_documents (type, number, expires_at)            -- Phase 3
legal_rule_sets (effective_from, payload jsonb), minimum_wages (province_code, rate, effective_from)
shift_templates, shifts (employee_id, branch_id, start_at, end_at)
attendance_events (employee_id, type: in|out, at, lat, lng, selfie_key, source)
leave_requests, ot_requests, advances (amount, requested_at, approved_by, pay_run_id)
piece_rates (tenant_id, basis: box|item|box_size|category, key, rate, effective_from)
pack_sessions (employee_id, station_id, tracking_no, order_ref, started_at, ended_at, video_key, item_count)
piece_work_entries (employee_id, date, source: pack_session|manual, qty, rate, amount)
pay_runs (period, status: draft|locked|paid, rule_set_snapshot jsonb)
pay_run_items (pay_run_id, employee_id, gross, sso, wht, net), pay_run_lines (type, qty, rate, amount)
payslips (pay_run_item_id, sent_at)
audit_logs, webhook_events (source, event_id, payload, processed_at)
```

## Pricing (ร่าง)
| แพ็กเกจ | เงื่อนไข | ราคา/เดือน |
|---|---|---|
| Free | ≤ 5 คน, ≤ 300 ออเดอร์แพ็ค | 0 |
| Shop | 1 สาขา ≤ 25 คน / ≤ 3,000 ออเดอร์ | 390 บาท |
| Warehouse | Pack module เต็ม (สแกน + วิดีโอ + ค่าแพ็คต่อชิ้น) | 790–1,490 บาท |
| ลูกค้า Ruam Talad | ใช้คู่กัน | ลด 20–30% |

## Competitors (ตุลาคม 2026)
- HumanSoft — HR ทั่วไปสำหรับ SME, เริ่ม 590 บาท/เดือน (10 คน), ลงเวลา 14 แบบ, มีภาษาพม่า
- SMEMOVE — บัญชี + เงินเดือน, Pro 699 บาท/เดือน
- PackStamp / Cam Booth — อัดวิดีโอแพ็คอย่างเดียว ไม่ผูกกับค่าแรง
- จุดต่างของ Jangna: **แพ็ค = ลงงาน = เงินเดือน** ในระบบเดียว ผ่าน LINE
