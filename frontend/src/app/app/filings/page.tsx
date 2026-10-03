"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DateField, toIso } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-field";
import { api, ApiError, downloadFile } from "@/lib/api";
import { baht, fmtMonth } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { FilingSummary, LocalizedText, YearFilingSummary } from "@/lib/types";

/** ค่าเริ่มต้น = เดือนที่แล้ว (ยื่นของเดือนที่แล้วภายในวันที่ 7/15 ของเดือนนี้) */
function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** วันที่ 15 ของเดือนถัดไป — กำหนดส่งเงินสมทบ */
const ssoDeadline = (year: number, month: number) => (month === 12 ? toIso(year + 1, 0, 15) : toIso(year, month, 15));

export default function FilingsPage() {
  const { t, lang } = useLang();
  const [{ year, month }, setPeriod] = useState(lastMonth);
  const [paymentDate, setPaymentDate] = useState<string | null>(() => ssoDeadline(lastMonth().year, lastMonth().month));

  const move = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
    setPeriod(next);
    setPaymentDate(ssoDeadline(next.year, next.month));
  };

  const summary = useQuery({
    queryKey: ["filings", year, month],
    queryFn: () => api<FilingSummary>(`/api/exports/summary?year=${year}&month=${month}`),
  });

  const sso = useMutation<void, ApiError>({
    mutationFn: () =>
      downloadFile(`/api/exports/sso?year=${year}&month=${month}&paymentDate=${paymentDate}`, `SSO1-10_${year}${String(month).padStart(2, "0")}.txt`),
  });
  const pnd1 = useMutation<void, ApiError>({
    mutationFn: () => downloadFile(`/api/exports/pnd1?year=${year}&month=${month}`, `PND1_${year}_${month}.txt`),
  });

  const pnd3 = useMutation<void, ApiError>({
    mutationFn: () => downloadFile(`/api/exports/pnd3?year=${year}&month=${month}`, `PND3_${year}_${month}.csv`),
  });

  // ภ.ง.ด.1ก / 50 ทวิ ยื่นสิ้นปี (ภายในสิ้น ก.พ. ปีถัดไป) — ม.ค.-ก.พ. ค่าเริ่มต้นคือปีที่แล้ว
  const [taxYear, setTaxYear] = useState(() => {
    const now = new Date();
    return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const yearSummary = useQuery({
    queryKey: ["filings-year", taxYear],
    queryFn: () => api<YearFilingSummary>(`/api/exports/year-summary?year=${taxYear}`),
  });
  const pnd1a = useMutation<void, ApiError>({
    mutationFn: () => downloadFile(`/api/exports/pnd1a?year=${taxYear}`, `PND1A_${taxYear}.txt`),
  });
  const certs = useMutation<void, ApiError>({
    mutationFn: () => downloadFile(`/api/exports/certificates?year=${taxYear}`, `50twi_${taxYear}.pdf`),
  });

  const s = summary.data;
  const y = yearSummary.data;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t("เอกสารนำส่งจากรอบจ่ายที่ปิดแล้วเท่านั้น", "Built from locked pay runs only")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label={t("เดือนก่อน", "Previous month")}>
            <Icon.ChevronLeft size={15} />
          </Button>
          <span className="min-w-36 text-center font-semibold">{fmtMonth(year, month, lang)}</span>
          <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label={t("เดือนถัดไป", "Next month")}>
            <Icon.Chevron size={15} />
          </Button>
        </div>
      </div>

      {summary.error && <FormError message={summary.error.message} />}

      {s && s.draftRuns > 0 && (
        <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
          {t(
            `มีรอบจ่ายร่าง ${s.draftRuns} รอบในเดือนนี้ — ยังไม่นับรวม ปิดรอบก่อนแล้วค่อยออกไฟล์`,
            `${s.draftRuns} draft pay run(s) this month are not included — lock them first`,
          )}{" "}
          <Link href="/app/pay-runs" className="font-medium underline">
            {t("ไปที่รอบจ่าย", "Go to pay runs")}
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("สปส.1-10 เงินสมทบประกันสังคม", "SSO 1-10 social security contributions")}
              {s && <Ready issues={s.sso.issues} empty={s.sso.employees === 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "ตามงวดค่าจ้างของเดือนนี้ ยื่นและชำระภายในวันที่ 15 ของเดือนถัดไป — อัปโหลดไฟล์ที่ e-Service ของ สปส. (sso.go.th)",
                "By wage period. File and pay by the 15th of the next month — upload at the SSO e-Service (sso.go.th)",
              )}
            </p>
            {s && (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t("ผู้ประกันตน", "Insured")} value={String(s.sso.employees)} />
                <Stat label={t("ค่าจ้างที่แจ้ง", "Reported wages")} value={baht(s.sso.wages)} />
                <Stat label={t("ส่วนลูกจ้าง", "Employee share")} value={baht(s.sso.employeeContribution)} />
                <Stat label={t("ส่วนนายจ้าง", "Employer share")} value={baht(s.sso.employerContribution)} />
              </dl>
            )}
            {s && <Issues issues={s.sso.issues} />}
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <DateField label={t("วันที่ชำระเงินสมทบ", "Contribution payment date")} value={paymentDate} onChange={setPaymentDate} required />
              <Button
                variant="accent"
                onClick={() => sso.mutate()}
                loading={sso.isPending}
                disabled={!s || s.sso.employees === 0 || s.sso.issues.length > 0 || !paymentDate}
              >
                <Icon.Download size={16} /> {t("ดาวน์โหลดไฟล์ สปส.1-10", "Download SSO 1-10 file")}
              </Button>
            </div>
            <FormError message={sso.error?.message} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("ภ.ง.ด.1 ภาษีหัก ณ ที่จ่าย", "PND 1 withholding tax")}
              {s && <Ready issues={s.pnd1.issues} empty={s.pnd1.employees === 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "ตามวันที่จ่ายเงินในเดือนนี้ เฉพาะคนที่ถูกหักภาษี ยื่นภายในวันที่ 7 ของเดือนถัดไป (ออนไลน์ได้ถึงวันที่ 15) — ไฟล์ตามรูปแบบกลางของกรมสรรพากร v2.0",
                "By pay date, only staff with tax withheld. File by the 7th of the next month (15th online) — Revenue Department standard format v2.0",
              )}
            </p>
            {s && (
              <dl className="grid grid-cols-3 gap-3">
                <Stat label={t("ผู้มีเงินได้", "Payees")} value={String(s.pnd1.employees)} />
                <Stat label={t("เงินได้ที่จ่าย", "Income paid")} value={baht(s.pnd1.paid)} />
                <Stat label={t("ภาษีที่หัก", "Tax withheld")} value={baht(s.pnd1.tax)} />
              </dl>
            )}
            {s && s.pnd1.employees === 0 && s.pnd1.issues.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("เดือนนี้ไม่มีภาษีหัก ณ ที่จ่าย — ไม่ต้องยื่น ภ.ง.ด.1", "No tax withheld this month — no PND 1 to file")}
              </p>
            )}
            {s && <Issues issues={s.pnd1.issues} />}
            <Button
              variant="accent"
              className="justify-self-start"
              onClick={() => pnd1.mutate()}
              loading={pnd1.isPending}
              disabled={!s || s.pnd1.employees === 0 || s.pnd1.issues.length > 0}
            >
              <Icon.Download size={16} /> {t("ดาวน์โหลดไฟล์ ภ.ง.ด.1", "Download PND 1 file")}
            </Button>
            <FormError message={pnd1.error?.message} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("ภ.ง.ด.3 ภาษีหัก ณ ที่จ่าย (ฟรีแลนซ์)", "PND 3 withholding tax (freelancers)")}
              {s && <Ready issues={s.pnd3.issues} empty={s.pnd3.employees === 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "ตามวันที่จ่ายเงินในเดือนนี้ เฉพาะฟรีแลนซ์ที่ถูกหัก 3% ยื่นภายในวันที่ 7 ของเดือนถัดไป (ออนไลน์ได้ถึงวันที่ 15) — ไฟล์ CSV ใบแนบ ใช้กรอกต่อในระบบสรรพากร ยังไม่ใช่ไฟล์นำเข้าทางการ",
                "By pay date, only freelancers with 3% withheld. File by the 7th of the next month (15th online) — attachment-list CSV to key into the Revenue system; not an official import file",
              )}
            </p>
            {s && (
              <dl className="grid grid-cols-3 gap-3">
                <Stat label={t("ผู้มีเงินได้", "Payees")} value={String(s.pnd3.employees)} />
                <Stat label={t("เงินได้ที่จ่าย", "Income paid")} value={baht(s.pnd3.paid)} />
                <Stat label={t("ภาษีที่หัก", "Tax withheld")} value={baht(s.pnd3.tax)} />
              </dl>
            )}
            {s && s.pnd3.employees === 0 && s.pnd3.issues.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("เดือนนี้ไม่มีภาษีหักของฟรีแลนซ์ — ไม่ต้องยื่น ภ.ง.ด.3", "No freelancer tax withheld this month — no PND 3 to file")}
              </p>
            )}
            {s && <Issues issues={s.pnd3.issues} />}
            <Button
              variant="accent"
              className="justify-self-start"
              onClick={() => pnd3.mutate()}
              loading={pnd3.isPending}
              disabled={!s || s.pnd3.employees === 0 || s.pnd3.issues.length > 0}
            >
              <Icon.Download size={16} /> {t("ดาวน์โหลดรายการ ภ.ง.ด.3 (CSV)", "Download PND 3 list (CSV)")}
            </Button>
            <FormError message={pnd3.error?.message} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{t("สิ้นปี", "Year-end")}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setTaxYear(taxYear - 1)} aria-label={t("ปีก่อน", "Previous year")}>
            <Icon.ChevronLeft size={15} />
          </Button>
          <span className="min-w-36 text-center font-semibold">
            {lang === "th" ? `ปีภาษี ${taxYear + 543}` : `Tax year ${taxYear}`}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setTaxYear(taxYear + 1)} aria-label={t("ปีถัดไป", "Next year")}>
            <Icon.Chevron size={15} />
          </Button>
        </div>
      </div>

      {yearSummary.error && <FormError message={yearSummary.error.message} />}

      {y && y.draftRuns > 0 && (
        <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
          {t(
            `มีรอบจ่ายร่าง ${y.draftRuns} รอบในปีนี้ — ยังไม่นับรวม`,
            `${y.draftRuns} draft pay run(s) this year are not included`,
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("ภ.ง.ด.1ก สรุปเงินเดือนทั้งปี", "PND 1A annual salary summary")}
              {y && <Ready issues={y.pnd1A.issues} empty={y.pnd1A.employees === 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "รวมเงินได้และภาษีของลูกจ้างทุกคนตามวันจ่ายทั้งปี ยื่นภายในสิ้นเดือนกุมภาพันธ์ปีถัดไป — ไม่รวมยอดยกมาต้นปี ถ้าย้ายมาใช้กลางปีให้บวกเอง",
                "Per-employee income and tax by pay date for the year. File by end of February next year — excludes opening balances, so add them yourself if you joined mid-year",
              )}
            </p>
            {y && (
              <dl className="grid grid-cols-3 gap-3">
                <Stat label={t("ลูกจ้าง", "Employees")} value={String(y.pnd1A.employees)} />
                <Stat label={t("เงินได้ที่จ่าย", "Income paid")} value={baht(y.pnd1A.paid)} />
                <Stat label={t("ภาษีที่หัก", "Tax withheld")} value={baht(y.pnd1A.tax)} />
              </dl>
            )}
            {y && <Issues issues={y.pnd1A.issues} />}
            <Button
              variant="accent"
              className="justify-self-start"
              onClick={() => pnd1a.mutate()}
              loading={pnd1a.isPending}
              disabled={!y || y.pnd1A.employees === 0 || y.pnd1A.issues.length > 0}
            >
              <Icon.Download size={16} /> {t("ดาวน์โหลดไฟล์ ภ.ง.ด.1ก", "Download PND 1A file")}
            </Button>
            <FormError message={pnd1a.error?.message} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("หนังสือรับรองหักภาษี (50 ทวิ)", "Withholding tax certificates (50 Tawi)")}
              {y && <Ready issues={y.certificates.issues} empty={y.certificates.employees === 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "ออกให้ลูกจ้างและฟรีแลนซ์ทุกคนที่ถูกหักภาษีในปีนี้ คนละหน้า — ผู้จ่ายตรวจและลงนามก่อนส่งมอบ",
                "One page per employee and freelancer with tax withheld this year — the payer reviews and signs before handing over",
              )}
            </p>
            {y && (
              <dl className="grid grid-cols-3 gap-3">
                <Stat label={t("ผู้ถูกหักภาษี", "Payees")} value={String(y.certificates.employees)} />
                <Stat label={t("เงินได้ที่จ่าย", "Income paid")} value={baht(y.certificates.paid)} />
                <Stat label={t("ภาษีที่หัก", "Tax withheld")} value={baht(y.certificates.tax)} />
              </dl>
            )}
            {y && <Issues issues={y.certificates.issues} />}
            <Button
              variant="accent"
              className="justify-self-start"
              onClick={() => certs.mutate()}
              loading={certs.isPending}
              disabled={!y || y.certificates.employees === 0 || y.certificates.issues.length > 0}
            >
              <Icon.Download size={16} /> {t("ดาวน์โหลด 50 ทวิ (PDF)", "Download 50 Tawi (PDF)")}
            </Button>
            <FormError message={certs.error?.message} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "ครั้งแรกที่ยื่น ให้ตรวจไฟล์กับระบบของ สปส./สรรพากร ก่อน (อัปโหลดแล้วดูหน้าตรวจสอบ) — รูปแบบ ภ.ง.ด.1ก ยังเป็นสมมติฐานจากรูปแบบ ภ.ง.ด.1",
          "The first time you file, check the file in the SSO / Revenue Department system before submitting. The PND 1A layout is assumed from the PND 1 format.",
        )}
      </p>
    </div>
  );
}

function Ready({ issues, empty }: { issues: LocalizedText[]; empty: boolean }) {
  const { t } = useLang();
  if (issues.length > 0) return <Badge variant="warning">{t(`ขาดข้อมูล ${issues.length}`, `${issues.length} missing`)}</Badge>;
  if (empty) return <Badge variant="outline">{t("ไม่มีรายการ", "Nothing to file")}</Badge>;
  return <Badge variant="success">{t("พร้อมยื่น", "Ready")}</Badge>;
}

function Issues({ issues }: { issues: LocalizedText[] }) {
  const { t } = useLang();
  if (issues.length === 0) return null;
  return (
    <div className="grid gap-2 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
      <ul className="grid gap-1">
        {issues.map((i) => (
          <li key={i.th}>⚠ {t(i.th, i.en)}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 font-medium">
        <Link href="/app/employees" className="underline">
          {t("แก้ข้อมูลพนักงาน", "Edit employees")}
        </Link>
        <Link href="/app/settings" className="underline">
          {t("ตั้งค่าร้าน", "Shop settings")}
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-surface px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  );
}
