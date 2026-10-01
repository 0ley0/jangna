import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// ฟอนต์หลักของจ้างนะ: Noto Sans Thai (มีทั้งตัวไทยและละติน) — variable font น้ำหนัก 100–900
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "จ้างนะ — ลงเวลาและเงินเดือนผ่าน LINE",
  description: "จ้างนะ จ้างง่าย จ่ายถูก ระบบลงเวลา ค่าแพ็ค และเงินเดือนสำหรับร้านค้าออนไลน์และ SME ไทย",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
