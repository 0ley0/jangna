# Data model

ชื่อตาราง/คอลัมน์เป็น snake_case (EFCore.NamingConventions) · enum เก็บเป็น string · id = Guid v7 (สร้างฝั่งแอป)
ต้นฉบับจริง: `backend/src/Jangna.Core/Entities/*` + `JangnaDbContext.OnModelCreating`

## ตารางที่มีแล้ว
| ตาราง | หน้าที่ | หมายเหตุ |
|---|---|---|
| `tenants` | ร้าน/บริษัท + ข้อมูลยื่นแบบ: legal_name, address, tax_id, tax_branch_no, sso_account_no, sso_branch_no, rd_user_id | สาขา default `000000` |
| `users` | ผู้ใช้ฝั่งเจ้าของ (email unique) | password hash ของ ASP.NET Identity |
| `memberships` | user ↔ tenant + role (Owner/Manager/Staff) | user 1 คนอยู่ได้หลายร้าน |
| `branches` | สาขา: `province_code` (ISO 3166-2:TH), `area_code` (รหัสอำเภอ 4 หลัก), geo + รัศมี | ใช้หาค่าแรงขั้นต่ำ |
| `employees` | pay_type (Monthly/Daily/Hourly/Piece), base_rate, worker_type (Employee/Freelance), language (th/en/my), line_user_id, title (Mr/Mrs/Miss), national_id, address_line/subdistrict/district/province/postal_code | unique (tenant, line_user_id); national_id ซ้ำในร้านไม่ได้ (ตรวจในแอป) |
| `employee_documents` | เอกสารพนักงาน: type (Passport/Visa/WorkPermit/PinkCard/Other), number, issued_on, expires_on (null = ไม่แจ้งเตือน), note | index (tenant, employee), (tenant, expires_on) · ยังไม่เก็บไฟล์สแกน (รอ R2) |
| `employee_invites` | code 8 ตัว ใช้ครั้งเดียว หมดอายุ 7 วัน | สร้างใหม่ = ยกเลิกอันเก่า |
| `legal_rule_sets` | กฎหมายแบบ effective-dated, `payload` jsonb (`LegalRules`) | **ข้อมูลระบบ** ไม่ผูก tenant, seeder sync จากโค้ด |
| `minimum_wages` | province + area (nullable) + rate + effective_from + `verified` | ข้อมูลระบบ, seed จาก JSON draft |
| `work_days` | 1 คน 1 วัน: kind (Workday/WeeklyHoliday/PublicHoliday), normal/OT hours, leave (None/Paid/Unpaid), source | unique (tenant, employee, date) |
| `piece_work_entries` | ผลงานต่อชิ้น: qty, rate, overtime, source (Manual/Attendance/PackStation) | |
| `advances` | เงินเบิก (ติดลบ = กลับรายการ, ไม่มีลบ) | ยอดค้าง = ผลรวม − ที่หักในรอบที่ lock |
| `holidays` | วันหยุดตามประเพณีของร้าน | unique (tenant, date) |
| `opening_balances` | ยอดยกมาต้นปี (taxable income, tax withheld, SSO) ต่อคนต่อปี | แก้ไม่ได้ถ้าปีนั้นมีรอบที่ lock แล้ว |
| `pay_runs` | period, pay_date, status (Draft/Locked), `rules_snapshot` jsonb, locked_at/by | ห้ามทับช่วง, ต้องอยู่ในเดือนเดียว |
| `pay_run_items` | ผลต่อคน: gross, taxable, SSO, WHT, advance, net + `lines`/`warnings`/`input` jsonb | `input` = snapshot ของ `PayInput`, warnings = `[{th, en}]` |
| `shift_templates` | ชื่อกะ, start/end (`time`), break_minutes, color, archived | ลบแม่แบบที่ใช้แล้ว = archived |
| `work_policies` | นโยบายการทำงาน: name (unique ต่อร้าน), description, `cycle_weeks` (1–8), `anchor_date` (จันทร์ที่เริ่มสัปดาห์แรกของรอบ), archived | พนักงานคนละ 1 นโยบาย (`employees.work_policy_id`, ลบนโยบาย = SetNull) · ใช้สร้าง `shifts` ผ่าน `/shifts/generate` ไม่ทับกะเดิม |
| `work_policy_days` | วันในแพทเทิร์น: week_index (0-based), day_index (0 = จันทร์), shift_template_id (Restrict) — ไม่มีแถว = วันหยุด | unique (tenant, policy, week, day) · แม่แบบที่ถูกอ้างอิง = archived แทนการลบ |
| `shifts` | 1 คน 1 วัน: template (nullable), start/end/break คัดลอกจากแม่แบบ, note | unique (tenant, employee, date); end < start = ข้ามเที่ยงคืน |
| `audit_logs` | ใคร/อะไร/เมื่อไหร่ ของ entity `IAudited`, `changes` jsonb | เขียนอัตโนมัติ |

Migrations: `InitialCreate` → `AddWorkAndPayRuns` → `AddOpeningBalances` → `AddFilingInfoAndShifts` (แปลง warnings เดิมเป็น `{th, en}`) (ห้ามแก้ migration ที่ apply แล้ว — เพิ่มใหม่เสมอ)

## ตารางที่วางแผน (ยังไม่มี)
```
attendance_events (employee_id, type: in|out, at, lat, lng, selfie_key, source)    -- Phase 1
leave_requests, ot_requests                                                         -- Phase 1
payslips (pay_run_item_id, sent_at)                                                 -- Phase 1
piece_rates (basis: box|item|box_size|category, key, rate, effective_from)          -- Phase 2
pack_sessions (employee_id, station_id, tracking_no, order_ref, started_at, ended_at, video_key, item_count) -- Phase 2
employee_documents (type, number, expires_at)                                       -- Phase 3
webhook_events (source, event_id, payload, processed_at)                            -- เมื่อมี LINE/Ruam Talad webhook
```
