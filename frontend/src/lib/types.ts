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
