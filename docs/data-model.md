# Data model

ชื่อตาราง/คอลัมน์เป็น snake_case (EFCore.NamingConventions) · enum เก็บเป็น string · id = Guid v7 (สร้างฝั่งแอป)
ต้นฉบับจริง: `backend/src/Jangna.Core/Entities/*` + `JangnaDbContext.OnModelCreating`

## ตารางที่มีแล้ว
| ตาราง | หน้าที่ | หมายเหตุ |
|---|---|---|
| `tenants` | ร้าน/บริษัท | |
| `users` | ผู้ใช้ฝั่งเจ้าของ (email unique) | password hash ของ ASP.NET Identity |
| `memberships` | user ↔ tenant + role (Owner/Manager/Staff) | user 1 คนอยู่ได้หลายร้าน |
| `branches` | สาขา: `province_code` (ISO 3166-2:TH), `area_code` (รหัสอำเภอ 4 หลัก), geo + รัศมี | ใช้หาค่าแรงขั้นต่ำ |
| `employees` | pay_type (Monthly/Daily/Hourly/Piece), base_rate, worker_type (Employee/Freelance), language (th/en/my), line_user_id | unique (tenant, line_user_id) |
| `employee_invites` | code 8 ตัว ใช้ครั้งเดียว หมดอายุ 7 วัน | สร้างใหม่ = ยกเลิกอันเก่า |
| `legal_rule_sets` | กฎหมายแบบ effective-dated, `payload` jsonb (`LegalRules`) | **ข้อมูลระบบ** ไม่ผูก tenant, seeder sync จากโค้ด |
| `minimum_wages` | province + area (nullable) + rate + effective_from + `verified` | ข้อมูลระบบ, seed จาก JSON draft |
| `work_days` | 1 คน 1 วัน: kind (Workday/WeeklyHoliday/PublicHoliday), normal/OT hours, leave (None/Paid/Unpaid), source | unique (tenant, employee, date) |
| `piece_work_entries` | ผลงานต่อชิ้น: qty, rate, overtime, source (Manual/Attendance/PackStation) | |
| `advances` | เงินเบิก (ติดลบ = กลับรายการ, ไม่มีลบ) | ยอดค้าง = ผลรวม − ที่หักในรอบที่ lock |
| `holidays` | วันหยุดตามประเพณีของร้าน | unique (tenant, date) |
| `opening_balances` | ยอดยกมาต้นปี (taxable income, tax withheld, SSO) ต่อคนต่อปี | แก้ไม่ได้ถ้าปีนั้นมีรอบที่ lock แล้ว |
| `pay_runs` | period, status (Draft/Locked), `rules_snapshot` jsonb, locked_at/by | ห้ามทับช่วง, ต้องอยู่ในเดือนเดียว |
| `pay_run_items` | ผลต่อคน: gross, taxable, SSO, WHT, advance, net + `lines`/`warnings`/`input` jsonb | `input` = snapshot ของ `PayInput` |
| `audit_logs` | ใคร/อะไร/เมื่อไหร่ ของ entity `IAudited`, `changes` jsonb | เขียนอัตโนมัติ |

Migrations: `InitialCreate` → `AddWorkAndPayRuns` → `AddOpeningBalances` (ห้ามแก้ migration ที่ apply แล้ว — เพิ่มใหม่เสมอ)

## ตารางที่วางแผน (ยังไม่มี)
```
shift_templates, shifts (employee_id, branch_id, start_at, end_at)                 -- Phase 1
attendance_events (employee_id, type: in|out, at, lat, lng, selfie_key, source)    -- Phase 1
leave_requests, ot_requests                                                         -- Phase 1
payslips (pay_run_item_id, sent_at)                                                 -- Phase 1
piece_rates (basis: box|item|box_size|category, key, rate, effective_from)          -- Phase 2
pack_sessions (employee_id, station_id, tracking_no, order_ref, started_at, ended_at, video_key, item_count) -- Phase 2
employee_documents (type, number, expires_at)                                       -- Phase 3
webhook_events (source, event_id, payload, processed_at)                            -- เมื่อมี LINE/Ruam Talad webhook
```
