"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { DateField } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, downloadFile } from "@/lib/api";
import { baht, fmtDate, fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { payLineLabels, payTypeLabels, type PayLine, type PayRunDetail } from "@/lib/types";

export default function PayRunPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const queryKey = ["pay-run", id];
  const [open, setOpen] = useState<string | null>(null);

  const run = useQuery({ queryKey, queryFn: () => api<PayRunDetail>(`/api/pay-runs/${id}`) });

  const onDone = (data: PayRunDetail) => {
    queryClient.setQueryData(queryKey, data);
    queryClient.invalidateQueries({ queryKey: ["pay-runs"] });
  };
  const recalc = useMutation<PayRunDetail, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}/recalculate`, { method: "POST" }),
    onSuccess: onDone,
  });
  const lock = useMutation<PayRunDetail, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}/lock`, { method: "POST" }),
    onSuccess: onDone,
    // ข้อมูลเปลี่ยนระหว่างนั้น → backend คำนวณใหม่ให้แล้ว ดึงมาแสดง
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
  const payDate = useMutation<PayRunDetail, ApiError, string>({
    mutationFn: (date) => api(`/api/pay-runs/${id}/pay-date`, { method: "PUT", json: { payDate: date } }),
    onSuccess: onDone,
  });
  // employeeId = สลิปคนเดียว, null = ทุกคนในไฟล์เดียว (ภาษาตามที่ตั้งไว้ให้พนักงานแต่ละคน)
  const slip = useMutation<void, ApiError, string | null>({
    mutationFn: (employeeId) =>
      downloadFile(`/api/pay-runs/${id}/payslips${employeeId ? `?employeeId=${employeeId}` : ""}`, "payslips.pdf"),
  });
  const remove = useMutation<void, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-runs"] });
      router.push("/app/pay-runs");
    },
  });

  if (!run.data) return <p className="text-muted-foreground">{run.error?.message ?? t("กำลังโหลด…", "Loading…")}</p>;
  const { summary, items } = run.data;
  const draft = summary.status === "Draft";
  const totals = items.reduce(
    (t, i) => ({
      sso: t.sso + i.socialSecurityEmployee,
      ssoEmployer: t.ssoEmployer + i.socialSecurityEmployer,
      wht: t.wht + i.withholdingTax,
      advance: t.advance + i.advanceDeducted,
    }),
    { sso: 0, ssoEmployer: 0, wht: 0, advance: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">
          {t("รอบ", "Pay run")} {fmtDate(summary.periodStart, lang)} – {fmtDate(summary.periodEnd, lang)}
        </h2>
        {draft ? <Badge variant="outline">{t("ร่าง", "Draft")}</Badge> : <Badge variant="success">{t("ปิดรอบแล้ว", "Locked")}</Badge>}
        {!draft && (
          <Button variant="accent" className="ml-auto" onClick={() => slip.mutate(null)} loading={slip.isPending && slip.variables === null}>
            <Icon.Download size={16} /> {t("สลิปทุกคน (PDF)", "All payslips (PDF)")}
          </Button>
        )}
        {draft && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
              {t("คำนวณใหม่", "Recalculate")}
            </Button>
            <Button variant="ghost" onClick={() => confirm(t("ลบรอบร่างนี้?", "Delete this draft pay run?")) && remove.mutate()}>
              {t("ลบ", "Delete")}
            </Button>
            {me.data?.role === "Owner" && (
              <Button
                onClick={() => confirm(t("ปิดรอบแล้วจะแก้ข้อมูลในช่วงวันนี้ไม่ได้อีก ยืนยัน?", "Once locked, work data in this period can no longer be edited. Continue?")) && lock.mutate()}
                disabled={lock.isPending || items.length === 0}
              >
                {t("ปิดรอบ", "Lock pay run")}
              </Button>
            )}
          </div>
        )}
      </div>

      <FormError message={recalc.error?.message ?? lock.error?.message ?? remove.error?.message ?? payDate.error?.message ?? slip.error?.message} />

      <div className="flex flex-wrap items-end gap-3">
        {draft ? (
          <div className="w-56">
            <DateField
              key={summary.payDate}
              label={t("วันที่จ่ายเงิน (ใช้ในสลิปและ ภ.ง.ด.1)", "Pay date (on payslips and PND 1)")}
              value={summary.payDate}
              min={summary.periodStart}
              onChange={(date) => date && date !== summary.payDate && payDate.mutate(date)}
            />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("จ่ายวันที่", "Paid on")} <span className="font-medium text-foreground">{fmtDate(summary.payDate, lang)}</span>
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t("รวมเงินได้", "Gross pay")} value={baht(summary.gross)} />
        <Stat label={t("จ่ายสุทธิ", "Net pay")} value={baht(summary.net)} />
        <Stat label={t("ประกันสังคม (ลูกจ้าง + นายจ้าง)", "Social security (employee + employer)")} value={baht(totals.sso + totals.ssoEmployer)} />
        <Stat label={t("ภาษีหัก ณ ที่จ่าย", "Withholding tax")} value={baht(totals.wht)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {t("คำนวณเมื่อ", "Calculated")} {fmtDateTime(summary.calculatedAt, lang)} · {t("ใช้กฎหมายชุดวันที่", "Legal rules effective")}{" "}
            {fmtDate(run.data.ruleSetEffectiveFrom, lang)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("พนักงาน", "Employee")}</TableHead>
                <TableHead className="text-right">{t("เงินได้", "Gross")}</TableHead>
                <TableHead className="text-right">{t("สปส.", "SSO")}</TableHead>
                <TableHead className="text-right">{t("ภาษี", "Tax")}</TableHead>
                <TableHead className="text-right">{t("หักเบิก", "Advance")}</TableHead>
                <TableHead className="text-right">{t("สุทธิ", "Net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <Fragment key={i.id}>
                  {/* คลิกทั้งแถวได้ (เมาส์) — คีย์บอร์ด/screen reader ใช้ปุ่มในเซลล์ชื่อ */}
                  <TableRow className="cursor-pointer" onClick={() => setOpen(open === i.id ? null : i.id)}>
                    <TableCell>
                      <button
                        type="button"
                        aria-expanded={open === i.id}
                        aria-controls={`detail-${i.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(open === i.id ? null : i.id);
                        }}
                        className="-mx-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
                      >
                        <Icon.ChevronDown size={14} className={open === i.id ? "" : "-rotate-90"} />
                        <span>
                          <span className="font-medium">{i.employeeName}</span>
                          <span className="text-muted-foreground">
                            {" "}· {t(...payTypeLabels[i.payType])}
                            {i.isFreelance && ` · ${t("ฟรีแลนซ์", "Freelance")}`}
                          </span>
                        </span>
                      </button>
                      {i.warnings.length > 0 && (
                        <Badge variant="warning" className="ml-2">
                          ⚠ {i.warnings.length}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{baht(i.gross)}</TableCell>
                    <TableCell className="text-right">{baht(i.socialSecurityEmployee)}</TableCell>
                    <TableCell className="text-right">{baht(i.withholdingTax)}</TableCell>
                    <TableCell className="text-right">{baht(i.advanceDeducted)}</TableCell>
                    <TableCell className="text-right font-medium">{baht(i.net)}</TableCell>
                  </TableRow>
                  {open === i.id && (
                    <TableRow id={`detail-${i.id}`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6}>
                        <div className="grid gap-3 py-2 sm:grid-cols-2">
                          <ul className="grid gap-1 text-sm">
                            {i.lines.map((l, n) => (
                              <li key={n} className="flex justify-between gap-4">
                                <span>{lang === "en" ? englishLine(l) : l.description}</span>
                                <span className={l.kind === "Deduction" ? "text-destructive" : ""}>
                                  {l.kind === "Deduction" ? "−" : ""}
                                  {baht(l.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="grid content-start gap-3">
                            {i.warnings.length > 0 && (
                              <ul className="grid gap-1 text-sm text-amber-ink">
                                {i.warnings.map((w) => (
                                  <li key={w.th}>⚠ {t(w.th, w.en)}</li>
                                ))}
                              </ul>
                            )}
                            {!draft && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-self-start"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  slip.mutate(i.employeeId);
                                }}
                                loading={slip.isPending && slip.variables === i.employeeId}
                              >
                                <Icon.Download size={14} /> {t("สลิป PDF", "Payslip PDF")}
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && (
                <TableEmpty colSpan={6}>
                    {t(
                      "ไม่มีพนักงานที่ต้องจ่ายในรอบนี้ — บันทึกวันทำงาน/ผลงานก่อน แล้วกดคำนวณใหม่",
                      "Nobody to pay in this period — log work days or piece work first, then recalculate",
                    )}
                  </TableEmpty>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

/** ชื่อรายการภาษาอังกฤษจากรหัส + วันที่ (dd/MM) ท้าย description เดิมถ้ามี */
function englishLine(l: PayLine) {
  const label = payLineLabels[l.code]?.[1] ?? l.description;
  const date = l.description.match(/(\d{2}\/\d{2})$/)?.[1];
  return date ? `${label} ${date}` : label;
}
