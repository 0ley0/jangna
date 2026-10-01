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

export const payTypeLabels: Record<PayType, string> = {
  Monthly: "รายเดือน",
  Daily: "รายวัน",
  Hourly: "รายชั่วโมง",
  Piece: "ต่อชิ้น/กล่อง",
};

export const payTypeUnit: Record<PayType, string> = {
  Monthly: "บาท/เดือน",
  Daily: "บาท/วัน",
  Hourly: "บาท/ชม.",
  Piece: "บาท/วัน (ขั้นต่ำ ถ้ามี)",
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
  warnings: string[];
}

export interface PayRunDetail {
  summary: PayRunSummary;
  ruleSetEffectiveFrom: string;
  items: PayRunItem[];
}

export const dayKindLabels: Record<DayKind, string> = {
  Workday: "วันทำงาน",
  WeeklyHoliday: "วันหยุดประจำสัปดาห์",
  PublicHoliday: "วันหยุดนักขัตฤกษ์",
};

export const leaveLabels: Record<LeaveKind, string> = {
  None: "—",
  Paid: "ลา (ได้ค่าจ้าง)",
  Unpaid: "ลา (ไม่ได้ค่าจ้าง)",
};
