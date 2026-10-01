import type { SVGProps } from "react";

/**
 * ไอคอนเส้นชุดเดียวกับ Hearth (powerd_bese_desinge/icons.jsx): viewBox 24, stroke 1.6, ปลายมน
 * ไอคอนที่ Hearth ไม่มี (Users, Wallet, Building, Box, Logout) วาดเพิ่มในสไตล์เดียวกัน
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; sw?: number };

function Ic({ size = 18, sw = 1.6, children, ...p }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      {children}
    </svg>
  );
}

const make = (paths: React.ReactNode) => {
  const Icon = (p: IconProps) => <Ic {...p}>{paths}</Ic>;
  return Icon;
};

export const Icon = {
  Home: make(<><path d="M3.5 11 12 4l8.5 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></>),
  Tasks: make(<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M7.5 9.5l2 2 4-4" /><path d="M7.5 15.5h7" /></>),
  Cal: make(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></>),
  Search: make(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  Bell: make(<><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>),
  Plus: make(<path d="M12 5v14M5 12h14" />),
  Sparkle: make(<path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />),
  Coffee: make(<><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" /><path d="M7 4c0 1 1 1 1 2s-1 1-1 2M11 4c0 1 1 1 1 2s-1 1-1 2" /></>),
  Chevron: make(<path d="m9 6 6 6-6 6" />),
  ChevronDown: make(<path d="m6 9 6 6 6-6" />),
  ChevronLeft: make(<path d="m15 6-6 6 6 6" />),
  Check: make(<path d="m5 12.5 4 4 10-10" />),
  Clock: make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  ArrowRight: make(<path d="M5 12h14m-5-5 5 5-5 5" />),
  Pin: make(<path d="M9 4h6l-1 5 3 3-6 1 1 7-1-7-6-1 3-3z" />),
  Flag: make(<path d="M5 21V4h12l-2 4 2 4H5" />),
  // เพิ่มสำหรับจ้างนะ
  Users: make(<><circle cx="9" cy="8.5" r="3.5" /><path d="M3 19.5a6 6 0 0 1 12 0" /><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M17.5 14.2a6 6 0 0 1 3.5 5.3" /></>),
  Wallet: make(<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" /><rect x="3.5" y="7.5" width="17" height="12" rx="3" /><path d="M16 13.5h1.5" /></>),
  Building: make(<><path d="M4.5 20V6.5A1.5 1.5 0 0 1 6 5h7a1.5 1.5 0 0 1 1.5 1.5V20" /><path d="M14.5 10H18a1.5 1.5 0 0 1 1.5 1.5V20" /><path d="M3 20h18M8 9h3M8 12.5h3M8 16h3" /></>),
  Box: make(<><path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4z" /><path d="M3.5 8 12 12l8.5-4M12 12v8" /></>),
  Logout: make(<><path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 16l-4-4 4-4M6 12h9" /></>),
  Line: make(<><path d="M12 4C7 4 3.5 7.2 3.5 11c0 2.4 1.4 4.5 3.6 5.8-.2 1.1-.7 2.3-1.1 3.2 1.6-.4 3.3-1.3 4.5-2.2.5.1 1 .2 1.5.2 5 0 8.5-3.2 8.5-7S17 4 12 4z" /></>),
};

/** โลโก้จ้างนะ: กระเบื้องเทอร์ราคอตต้าไล่สีแบบ brand mark ของ Hearth + ตัว "จ" */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[10px] text-[#fff8ee]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(180deg, #E89976 0%, #C97B5D 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 10px -4px rgba(201,123,93,0.5)",
        fontSize: size * 0.5,
        fontWeight: 700,
        lineHeight: 1,
      }}
      aria-hidden
    >
      จ
    </div>
  );
}

export function Avatar({ name, color = "#8B6F56", size = 30 }: { name: string; color?: string; size?: number }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#fff8ee]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
