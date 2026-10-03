"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { DateRangeField, monthsShort, toIso, type DateRange, type RangePreset } from "@/components/date-picker";
import { FormError } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { baht, daysInMonth, fmtDate } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import type { PayRunDetail, PayRunSummary } from "@/lib/types";

/** รอบจ่ายต้องอยู่ในเดือนเดียว → ปุ่มลัด: ทั้งเดือน / 1–15 / 16–สิ้นเดือน ของเดือนนี้และเดือนก่อน */
function payPeriodPresets(lang: Lang): RangePreset[] {
  const now = new Date();
  return [0, -1].flatMap((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const last = daysInMonth(y, m + 1);
    const name = monthsShort(lang)[m];
    return [
      { label: lang === "en" ? `All of ${name}` : `ทั้งเดือน ${name}`, get: () => ({ start: toIso(y, m, 1), end: toIso(y, m, last) }) },
      { label: `1–15 ${name}`, get: () => ({ start: toIso(y, m, 1), end: toIso(y, m, 15) }) },
      { label: `16–${last} ${name}`, get: () => ({ start: toIso(y, m, 16), end: toIso(y, m, last) }) },
    ];
  });
}

export default function PayRunsPage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const presets = payPeriodPresets(lang);
  const [period, setPeriod] = useState<DateRange | null>(() => presets[0].get());
  const [open, setOpen] = useState(false);

  const runs = useQuery({ queryKey: ["pay-runs"], queryFn: () => api<PayRunSummary[]>("/api/pay-runs") });

  const create = useMutation<PayRunDetail, ApiError>({
    mutationFn: () =>
      api("/api/pay-runs", {
        method: "POST",
        json: { periodStart: period!.start, periodEnd: period!.end },
      }),
    onSuccess: (run) => router.push(`/app/pay-runs/${run.summary.id}`),
  });

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <Button
          variant="accent"
          onClick={() => {
            create.reset();
            setOpen(true);
          }}
        >
          <Icon.Plus size={16} /> {t("สร้างรอบจ่าย", "New pay run")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen} size="lg" title={t("สร้างรอบจ่าย", "New pay run")}>
        <div className="grid gap-4">
          <FormError message={create.error?.message} />
          <DateRangeField label={t("ช่วงรอบจ่าย (ต้องอยู่ในเดือนเดียวกัน)", "Pay period (must be within one month)")} value={period} onChange={setPeriod} presets={presets} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ยกเลิก", "Cancel")}
            </Button>
            <Button variant="accent" onClick={() => create.mutate()} loading={create.isPending} disabled={!period}>
              {create.isPending ? t("กำลังคำนวณ…", "Calculating…") : t("คำนวณเงินเดือน", "Run payroll")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("รอบ", "Period")}</TableHead>
                <TableHead>{t("สถานะ", "Status")}</TableHead>
                <TableHead className="text-right">{t("คน", "Staff")}</TableHead>
                <TableHead className="text-right">{t("รวมเงินได้", "Gross")}</TableHead>
                <TableHead className="text-right">{t("จ่ายสุทธิ", "Net pay")}</TableHead>
                <TableHead className="text-right">{t("คำเตือน", "Warnings")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/app/pay-runs/${r.id}`} className="font-medium hover:underline">
                      {fmtDate(r.periodStart, lang)} – {fmtDate(r.periodEnd, lang)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.status === "Locked" ? <Badge variant="success">{t("ปิดรอบแล้ว", "Locked")}</Badge> : <Badge variant="outline">{t("ร่าง", "Draft")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{r.employees}</TableCell>
                  <TableCell className="text-right">{baht(r.gross)}</TableCell>
                  <TableCell className="text-right">{baht(r.net)}</TableCell>
                  <TableCell className="text-right">{r.warnings > 0 ? r.warnings : "–"}</TableCell>
                </TableRow>
              ))}
              {runs.data?.length === 0 && (
                <TableEmpty colSpan={6}>
                    {t("ยังไม่มีรอบจ่าย", "No pay runs yet")}
                  </TableEmpty>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
