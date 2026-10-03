export type Role = "Owner" | "Manager" | "Staff";
export type PayType = "Monthly" | "Daily" | "Hourly" | "Piece";
export type WorkerType = "Employee" | "Freelance";
export type EmployeeStatus = "Active" | "Inactive";

export interface TenantSummary {
  id: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  tenantId: string;
  tenants: TenantSummary[];
}

export interface Me {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  tenantName: string;
  role: Role;
}

export interface Branch {
  id: string;
  name: string;
  provinceCode: string;
  areaCode: string | null;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusMeters: number;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  phone: string | null;
  branchId: string | null;
  branchName: string | null;
  payType: PayType;
  baseRate: number;
  workerType: WorkerType;
  status: EmployeeStatus;
  language: string;
  lineLinked: boolean;
  lineLinkedAt: string | null;
  // ข้อมูลยื่น สปส./ภ.ง.ด.1
  title: Title | null;
  nationalId: string | null;
  addressLine: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  workPolicyId: string | null;
  workPolicyName: string | null;
}

export type Title = "Mr" | "Mrs" | "Miss";

export const titleLabels: Record<Title, Bi> = {
  Mr: ["นาย", "Mr"],
  Mrs: ["นาง", "Mrs"],
  Miss: ["นางสาว", "Miss"],
};

/** ข้อมูลร้านสำหรับสลิปและเอกสารนำส่ง (GET/PUT /api/shop) */
export interface Shop {
  name: string;
  legalName: string | null;
  address: string | null;
  taxId: string | null;
  taxBranchNo: string;
  ssoAccountNo: string | null;
  ssoBranchNo: string;
  rdUserId: string | null;
}

/** ข้อความสองภาษาจาก backend (คำเตือนรอบจ่าย, ข้อมูลที่ขาดสำหรับยื่นแบบ) */
export interface LocalizedText {
  th: string;
  en: string;
}

export interface FilingSummary {
  year: number;
  month: number;
  lockedRuns: number;
  draftRuns: number;
  sso: { employees: number; wages: number; employeeContribution: number; employerContribution: number; issues: LocalizedText[] };
  pnd1: { employees: number; paid: number; tax: number; issues: LocalizedText[] };
  pnd3: { employees: number; paid: number; tax: number; issues: LocalizedText[] };
}

export interface YearFilingSummary {
  year: number;
  lockedRuns: number;
  draftRuns: number;
  pnd1A: { employees: number; paid: number; tax: number; issues: LocalizedText[] };
  certificates: { employees: number; paid: number; tax: number; issues: LocalizedText[] };
}

export type ShiftColor = "brand" | "sage" | "amber" | "plum" | "blue" | "neutral";

export interface ShiftTemplate {
  id: string;
  name: string;
  /** "HH:mm:ss" */
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: ShiftColor;
  archived: boolean;
  hours: number;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  templateId: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  note: string | null;
}

export interface Invite {
  code: string;
  url: string;
  expiresAt: string;
}

export interface MinimumWageRate {
  provinceCode: string;
  areaCode: string | null;
  dailyRate: number;
  effectiveFrom: string;
  verified: boolean;
}

/** ข้อความสองภาษา [ไทย, อังกฤษ] — ใช้กับ t(...label) จาก useLang() */
export type Bi = [th: string, en: string];

export const payTypeLabels: Record<PayType, Bi> = {
  Monthly: ["รายเดือน", "Monthly"],
  Daily: ["รายวัน", "Daily"],
  Hourly: ["รายชั่วโมง", "Hourly"],
  Piece: ["ต่อชิ้น/กล่อง", "Per piece"],
};

export const payTypeUnit: Record<PayType, Bi> = {
  Monthly: ["บาท/เดือน", "THB/month"],
  Daily: ["บาท/วัน", "THB/day"],
  Hourly: ["บาท/ชม.", "THB/hour"],
  Piece: ["บาท/วัน (ขั้นต่ำ ถ้ามี)", "THB/day (base, optional)"],
};

export type DayKind = "Workday" | "WeeklyHoliday" | "PublicHoliday";
export type LeaveKind = "None" | "Paid" | "Unpaid";
export type PayRunStatus = "Draft" | "Locked";

export interface WorkDay {
  id: string;
  employeeId: string;
  date: string;
  kind: DayKind;
  normalHours: number;
  overtimeHours: number;
  leave: LeaveKind;
  source: string;
  note: string | null;
}

export interface PieceWork {
  id: string;
  employeeId: string;
  date: string;
  description: string;
  quantity: number;
  rate: number;
  overtime: boolean;
  note: string | null;
}

export interface AdvanceEntry {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  note: string | null;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface OpeningBalance {
  id: string;
  employeeId: string;
  year: number;
  taxableIncome: number;
  taxWithheld: number;
  socialSecurity: number;
  note: string | null;
}

export interface PayLine {
  code: string;
  description: string;
  kind: "Earning" | "Deduction";
  quantity: number;
  rate: number;
  amount: number;
}

export interface PayRunSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  employees: number;
  gross: number;
  net: number;
  socialSecurityEmployer: number;
  warnings: number;
  calculatedAt: string;
  lockedAt: string | null;
}

export interface PayRunItem {
  id: string;
  employeeId: string;
  employeeName: string;
  payType: PayType;
  isFreelance: boolean;
  gross: number;
  socialSecurityEmployee: number;
  socialSecurityEmployer: number;
  withholdingTax: number;
  advanceDeducted: number;
  advanceCarriedOver: number;
  net: number;
  lines: PayLine[];
  warnings: LocalizedText[];
}

export interface PayRunDetail {
  summary: PayRunSummary;
  ruleSetEffectiveFrom: string;
  items: PayRunItem[];
}

export const dayKindLabels: Record<DayKind, Bi> = {
  Workday: ["วันทำงาน", "Workday"],
  WeeklyHoliday: ["วันหยุดประจำสัปดาห์", "Weekly day off"],
  PublicHoliday: ["วันหยุดนักขัตฤกษ์", "Public holiday"],
};

export const leaveLabels: Record<LeaveKind, Bi> = {
  None: ["—", "—"],
  Paid: ["ลา (ได้ค่าจ้าง)", "Leave (paid)"],
  Unpaid: ["ลา (ไม่ได้ค่าจ้าง)", "Leave (unpaid)"],
};

export const roleLabels: Record<Role, Bi> = {
  Owner: ["เจ้าของร้าน", "Owner"],
  Manager: ["ผู้จัดการ", "Manager"],
  Staff: ["พนักงาน", "Staff"],
};

/** ชื่อรายการในสลิปตามรหัสจาก payroll engine (description จาก backend เป็นภาษาไทย) — ชุดเดียวกับ backend Exports/PayLineLabels.cs */
export const payLineLabels: Record<string, Bi> = {
  SALARY: ["เงินเดือน", "Salary"],
  UNPAID_ABSENCE: ["หักวันขาด/ลาไม่รับค่าจ้าง", "Unpaid absence"],
  DAILY_WAGE: ["ค่าจ้างรายวัน", "Daily wage"],
  HOURLY_WAGE: ["ค่าจ้างรายชั่วโมง", "Hourly wage"],
  PIECE: ["ค่าจ้างต่อชิ้น", "Piece rate"],
  PIECE_OT: ["ค่าจ้างต่อชิ้น (OT)", "Piece rate (OT)"],
  PIECE_HOLIDAY: ["ค่าจ้างต่อชิ้น (วันหยุด)", "Piece rate (holiday)"],
  PIECE_HOLIDAY_OT: ["ค่าจ้างต่อชิ้น (OT วันหยุด)", "Piece rate (holiday OT)"],
  OT: ["ค่าล่วงเวลา", "Overtime"],
  HOLIDAY_WORK: ["ค่าทำงานวันหยุด", "Holiday work"],
  HOLIDAY_OT: ["ค่าล่วงเวลาวันหยุด", "Holiday overtime"],
  PUBLIC_HOLIDAY: ["ค่าจ้างวันหยุดนักขัตฤกษ์", "Public holiday pay"],
  PAID_LEAVE: ["ลาได้รับค่าจ้าง", "Paid leave"],
  MIN_WAGE_TOPUP: ["เติมให้ถึงค่าแรงขั้นต่ำ", "Minimum wage top-up"],
  SSO: ["ประกันสังคม", "Social security"],
  WHT: ["ภาษีหัก ณ ที่จ่าย", "Withholding tax"],
  ADVANCE: ["หักเงินเบิกล่วงหน้า", "Advance deduction"],
};

export interface ImportRowResult {
  row: number;
  name: string;
  errors: string[];
}

export interface ImportReport {
  total: number;
  valid: number;
  imported: number;
  rows: ImportRowResult[];
}

export type DocumentType = "Passport" | "Visa" | "WorkPermit" | "PinkCard" | "Other";

export const documentTypeLabels: Record<DocumentType, Bi> = {
  Passport: ["พาสปอร์ต", "Passport"],
  Visa: ["วีซ่า", "Visa"],
  WorkPermit: ["ใบอนุญาตทำงาน", "Work permit"],
  PinkCard: ["บัตรชมพู", "Pink card"],
  Other: ["อื่นๆ", "Other"],
};

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  type: DocumentType;
  number: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  note: string | null;
  /** เหลือกี่วัน — ติดลบ = หมดอายุแล้ว, null = ไม่มีวันหมดอายุ */
  daysLeft: number | null;
}

/** หนึ่งวันในแพทเทิร์น: สัปดาห์ที่ weekIndex (0-based) วันที่ dayIndex (0 = จันทร์ … 6 = อาทิตย์) ทำกะ templateId */
export interface WorkPolicyCell {
  weekIndex: number;
  dayIndex: number;
  templateId: string;
}

export interface WorkPolicy {
  id: string;
  name: string;
  description: string | null;
  cycleWeeks: number;
  anchorDate: string;
  archived: boolean;
  days: WorkPolicyCell[];
  employeeCount: number;
}
