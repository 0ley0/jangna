"use client";

import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";
import { LangToggle } from "@/components/lang-toggle";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { t } = useLang();
  const features = [
    {
      icon: Icon.Line,
      title: t("ลงเวลาผ่าน LINE", "Clock in via LINE"),
      body: t("พนักงานไม่ต้องลงแอปเพิ่ม เปิดลิงก์ใน LINE แล้วใช้ได้เลย", "No extra app for staff — just open the link in LINE"),
    },
    {
      icon: Icon.Box,
      title: t("แพ็คปุ๊บ นับปั๊บ", "Pack it, count it"),
      body: t("คิดค่าแพ็คต่อชิ้น พร้อมเติมให้ถึงค่าแรงขั้นต่ำอัตโนมัติ", "Per-piece packing pay, topped up to minimum wage automatically"),
    },
    {
      icon: Icon.Wallet,
      title: t("เงินเดือนครบจบ", "Payroll, done"),
      body: t("ประกันสังคม ภาษีหัก ณ ที่จ่าย เงินเบิก และสลิป", "Social security, withholding tax, advances and payslips"),
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <div className="flex justify-end">
        <LangToggle />
      </div>
      <div className="card-warm relative overflow-hidden p-8 md:p-10">
        <div
          className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(212,162,86,0.35) 0%, transparent 65%)" }}
        />
        <div className="relative space-y-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <span className="text-sm font-medium text-muted-foreground">Jangna</span>
          </div>
          <h1 className="text-5xl font-bold tracking-[-0.015em] md:text-6xl">จ้างนะ</h1>
          <p className="max-w-xl text-xl text-ink-2">
            {t("จ้างง่าย ", "Easy hiring, ")}
            <span className="text-brand">{t("จ่ายถูก", "fair pay")}</span>
            {t(" — ลงเวลา ค่าแพ็ค และเงินเดือน จบใน LINE", " — time tracking, packing pay and payroll, all through LINE")}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/register" className={buttonVariants({ size: "lg", variant: "accent" })}>
              {t("เริ่มใช้ฟรี", "Start free")} <Icon.ArrowRight size={16} />
            </Link>
            <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
              {t("เข้าสู่ระบบ", "Log in")}
            </Link>
          </div>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <li key={f.title} className="rounded-[18px] border bg-card p-5 shadow-card">
            <span className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
              <f.icon size={18} />
            </span>
            <div className="font-semibold">{f.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
