"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, avatarColors, BrandMark, Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ApiError, getToken, setToken } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";
import { roleLabels, type Bi } from "@/lib/types";
import { cn } from "@/lib/utils";

// layout ตามดีไซน์ Hearth: sidebar ซ้าย (cream-2) + header แบบกระจก (glass)
const nav: { href: string; label: Bi; sub: Bi; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { href: "/app", label: ["ภาพรวม", "Overview"], icon: Icon.Home, sub: ["สรุปร้านและขั้นตอนเริ่มต้น", "Your shop at a glance"] },
  { href: "/app/employees", label: ["พนักงาน", "Employees"], icon: Icon.Users, sub: ["เพิ่มพนักงานและผูก LINE", "Add staff and link LINE"] },
  { href: "/app/work", label: ["บันทึกงาน", "Work log"], icon: Icon.Tasks, sub: ["วันทำงาน OT ลา ผลงานต่อชิ้น และเงินเบิก", "Days, overtime, leave, piece work and advances"] },
  { href: "/app/shifts", label: ["กะงาน", "Shifts"], icon: Icon.Clock, sub: ["จัดกะรายสัปดาห์จากแม่แบบกะ", "Plan the week from shift templates"] },
  { href: "/app/work-policies", label: ["นโยบายงาน", "Work policies"], icon: Icon.Tasks, sub: ["แพทเทิร์นกะประจำที่กำหนดให้พนักงาน", "Standing shift patterns you assign to staff"] },
  { href: "/app/pay-runs", label: ["รอบจ่าย", "Pay runs"], icon: Icon.Wallet, sub: ["คำนวณ ตรวจ ปิดรอบ และออกสลิป", "Calculate, review, lock and issue payslips"] },
  { href: "/app/filings", label: ["เอกสารนำส่ง", "Filings"], icon: Icon.Doc, sub: ["ไฟล์ สปส.1-10 และ ภ.ง.ด.1 รายเดือน", "Monthly social security and PND 1 files"] },
  { href: "/app/holidays", label: ["วันหยุด", "Holidays"], icon: Icon.Cal, sub: ["วันหยุดตามประเพณีของร้าน", "Your shop's public holidays"] },
  { href: "/app/branches", label: ["สาขา", "Branches"], icon: Icon.Building, sub: ["จังหวัด ค่าแรงขั้นต่ำ และรัศมีลงเวลา", "Province, minimum wage and clock-in radius"] },
  { href: "/app/settings", label: ["ตั้งค่าร้าน", "Shop settings"], icon: Icon.Settings, sub: ["ชื่อ ที่อยู่ เลขผู้เสียภาษี และบัญชีนายจ้าง สปส.", "Name, address, tax ID and social security account"] },
];

const activeItem = (pathname: string) =>
  [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

// อ่าน token จาก localStorage หลัง hydrate เท่านั้น (server render = ยังไม่รู้)
const subscribe = () => () => {};
const useHasToken = () => useSyncExternalStore(subscribe, () => !!getToken(), () => null);

export default function AppLayout({ children }: LayoutProps<"/app">) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const hasToken = useHasToken();
  const me = useMe();
  const { t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);

  const unauthorized = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (hasToken === false || unauthorized) router.replace("/login");
  }, [hasToken, unauthorized, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!hasToken) return null;

  const logout = () => {
    setToken(null);
    queryClient.clear();
    router.replace("/login");
  };

  const current = activeItem(pathname);


  const sidebarBody = (
    <>
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
          <BrandMark />
          <div>
            <div className="text-[20px] leading-none font-bold tracking-[-0.015em]">จ้างนะ</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t("จ้างง่าย จ่ายถูก", "Easy hiring, fair pay")}</div>
          </div>
        </div>

        {/* ร้านที่กำลังใช้งาน */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2.5 rounded-2xl border bg-background px-3 py-2.5">
            <Avatar name={me.data?.tenantName ?? "…"} color={avatarColors[0]} size={26} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{me.data?.tenantName ?? "…"}</div>
              <div className="truncate text-xs text-muted-foreground">{me.data ? t(...roleLabels[me.data.role]) : ""}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pt-1">
          <div className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const active = current?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border border-transparent px-3 py-2 text-sm text-ink-2 transition hover:bg-muted hover:text-foreground",
                    active && "bg-sage-soft font-semibold text-sage-ink",
                  )}
                >
                  <item.icon size={17} />
                  <span className="flex-1">{t(...item.label)}</span>
                </Link>
              );
            })}
          </div>

          <div className="px-2.5 pt-6 pb-2 text-xs font-semibold text-muted-foreground">{t("เร็วๆ นี้", "Coming soon")}</div>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
              <Icon.Box size={16} /> {t("แพ็คสินค้า (สแกน + วิดีโอ)", "Packing (scan + video)")}
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
              <Icon.Line size={16} /> {t("ลงเวลาผ่าน LINE", "Clock-in via LINE")}
            </div>
          </div>
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={me.data?.displayName ?? "…"} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{me.data?.displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{me.data?.email}</div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={logout} title={t("ออกจากระบบ", "Log out")} aria-label={t("ออกจากระบบ", "Log out")}>
              <Icon.Logout size={16} />
            </Button>
          </div>
        </div>
      
    </>
  );

  return (
    <div className="flex min-h-screen flex-1 md:gap-2 md:p-4">
      {/* Sidebar (จอใหญ่) */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col overflow-hidden rounded-[28px] border bg-sidebar md:flex">
        {sidebarBody}
      </aside>

      {/* เมนูแฮมเบอร์เกอร์ (มือถือ) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t("เมนู", "Menu")}
            className="absolute inset-y-3 left-3 flex w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in flex-col overflow-hidden rounded-[28px] border bg-sidebar"
          >
            <Button variant="ghost" size="icon-sm" onClick={() => setMenuOpen(false)} className="absolute top-4 right-4" aria-label={t("ปิดเมนู", "Close menu")}>
              <Icon.Close size={16} />
            </Button>
            {sidebarBody}
          </aside>
        </div>
      )}


      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 bg-background md:static">
          <div className="mx-auto flex w-full max-w-[1480px] items-center gap-4 px-4 py-4 md:px-8 md:pt-6 md:pb-2">
            <Button variant="outline" size="icon" onClick={() => setMenuOpen(true)} className="md:hidden" aria-label={t("เปิดเมนู", "Open menu")} aria-expanded={menuOpen} aria-controls="mobile-menu">
              <Icon.Menu size={18} />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span>{me.data?.tenantName}</span>
                <Icon.Chevron size={11} />
                <span>{current && t(...current.label)}</span>
              </div>
              <h1 className="truncate text-[22px] leading-tight font-semibold md:text-[32px]">{current && t(...current.label)}</h1>
              <div className="hidden text-sm text-muted-foreground sm:block">{current && t(...current.sub)}</div>
            </div>
            <LangToggle />
          </div>
        </header>

        <div key={pathname} className="mx-auto w-full max-w-[1480px] flex-1 animate-fade-up px-4 py-6 md:px-8 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

