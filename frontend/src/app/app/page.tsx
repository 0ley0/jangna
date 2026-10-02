"use client";

import Link from "next/link";
import { Avatar, avatarColors, Icon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranches, useEmployees, useMe } from "@/lib/queries";
import { useLang } from "@/lib/i18n";
import { payTypeLabels } from "@/lib/types";
import { cn } from "@/lib/utils";

/** วงแหวนความคืบหน้า (Ring ของ Hearth) */
function Ring({ pct, size = 56, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-beige-2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="stroke-brand transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

function greeting(t: (th: string, en: string) => string) {
  const h = new Date().getHours();
  return h < 12 ? t("อรุณสวัสดิ์", "Good morning,") : h < 17 ? t("สวัสดีตอนบ่าย", "Good afternoon,") : t("สวัสดีตอนเย็น", "Good evening,");
}

export default function OverviewPage() {
  const { t, lang } = useLang();
  const me = useMe();
  const branches = useBranches();
  const employees = useEmployees();

  const total = employees.data?.length ?? 0;
  const linked = employees.data?.filter((e) => e.lineLinked).length ?? 0;

  const steps = [
    { done: (branches.data?.length ?? 0) > 0, label: t("เพิ่มสาขาแรก", "Add your first branch"), hint: t("ใช้หาค่าแรงขั้นต่ำและรัศมีลงเวลา", "Sets minimum wage and clock-in radius"), href: "/app/branches" },
    { done: total > 0, label: t("เพิ่มพนักงาน", "Add employees"), hint: t("รายเดือน รายวัน หรือต่อชิ้น", "Monthly, daily or per piece"), href: "/app/employees" },
    { done: linked > 0, label: t("ส่งลิงก์ให้พนักงานผูก LINE", "Send staff their LINE link"), hint: t("รับตารางงานและสลิปทาง LINE", "Schedules and payslips via LINE"), href: "/app/employees" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <div className="grid gap-6">
      {/* แถบต้อนรับ (card-warm) */}
      <div className="card-warm relative overflow-hidden p-6 md:p-7">
        <div
          className="pointer-events-none absolute -top-10 -right-10 size-64 rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, rgba(212,162,86,0.35) 0%, transparent 65%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[640px]">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Icon.Coffee size={16} />
              <span className="text-xs tracking-[0.12em] uppercase">
                {greeting(t)} {me.data?.displayName}
              </span>
            </div>
            <h2 className="text-[28px] leading-[1.15] font-bold tracking-[-0.015em] md:text-[36px]">
              {next ? (
                lang === "en" ? (
                  <>
                    <span className="text-brand">
                      {steps.length - doneCount} step{steps.length - doneCount > 1 ? "s" : ""}
                    </span>{" "}
                    left until {me.data?.tenantName} is ready to run payroll
                  </>
                ) : (
                  <>
                    อีก <span className="text-brand">{steps.length - doneCount} ขั้น</span> ร้าน {me.data?.tenantName} ก็พร้อมจ่ายเงินเดือนแล้ว
                  </>
                )
              ) : lang === "en" ? (
                <>
                  You&apos;re <span className="text-brand">all set</span> — log work and run payroll
                </>
              ) : (
                <>
                  ทุกอย่าง<span className="text-brand">พร้อมแล้ว</span> — บันทึกงานแล้วคำนวณเงินเดือนได้เลย
                </>
              )}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t("เริ่มต้นใช้งาน", "Getting started")}</div>
                <div className="mt-1 text-[28px] leading-none font-bold tabular">
                  {doneCount}
                  <span className="text-lg text-muted-foreground"> / {steps.length}</span>
                </div>
              </div>
              <Ring pct={(doneCount / steps.length) * 100} />
            </div>
            <Link href={next?.href ?? "/app/pay-runs"} className={buttonVariants()}>
              {next ? next.label : t("ไปที่รอบจ่าย", "Go to pay runs")} <Icon.ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>{t("ขั้นตอนเริ่มต้น", "Setup checklist")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/45">
                    <span
                      className={cn(
                        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] bg-surface transition",
                        s.done && "border-brand bg-brand",
                      )}
                    >
                      {s.done && <Icon.Check size={12} sw={2.4} className="text-brand-foreground" />}
                    </span>
                    <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>{s.label}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{s.hint}</span>
                    <Icon.Chevron size={14} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <Stat title={t("สาขา", "Branches")} value={branches.data?.length} icon={<Icon.Building size={16} />} />
          <Stat title={t("พนักงาน", "Employees")} value={employees.data ? total : undefined} icon={<Icon.Users size={16} />} />
          <Stat title={t("ผูก LINE แล้ว", "LINE linked")} value={employees.data ? `${linked}/${total}` : undefined} icon={<Icon.Line size={16} />} />
        </div>
      </div>

      {employees.data && employees.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("ทีมของคุณ", "Your team")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {employees.data.slice(0, 9).map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5">
                  <Avatar name={e.nickname ?? e.firstName} color={avatarColors[i % avatarColors.length]} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {e.firstName} {e.lastName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t(...payTypeLabels[e.payType])} · {e.branchName ?? t("ไม่ระบุสาขา", "No branch")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ title, value, icon }: { title: string; value: number | string | undefined; icon: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</span>
        <div>
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-2xl font-bold tabular">{value ?? "–"}</div>
        </div>
      </CardContent>
    </Card>
  );
}
