"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { daysInMonth, isoDate, weekday, weekdayShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  dayKindLabels,
  leaveLabels,
  type DayKind,
  type Employee,
  type Holiday,
  type LeaveKind,
  type WorkDay,
  type Bi,
} from "@/lib/types";

interface Row {
  kind: DayKind;
  normalHours: number;
  overtimeHours: number;
  leave: LeaveKind;
}

const empty: Row = { kind: "Workday", normalHours: 0, overtimeHours: 0, leave: "None" };

export function DayTable({ employee, year, month }: { employee: Employee; year: number; month: number }) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const from = isoDate(year, month, 1);
  const to = isoDate(year, month, daysInMonth(year, month));
  const queryKey = ["work-days", employee.id, from];

  const saved = useQuery({
    queryKey,
    queryFn: () => api<WorkDay[]>(`/api/work-days?from=${from}&to=${to}&employeeId=${employee.id}`),
  });
  const holidays = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => api<Holiday[]>(`/api/holidays?year=${year}`),
  });

  const [edits, setEdits] = useState<Record<string, Row>>({});
  const dates = Array.from({ length: daysInMonth(year, month) }, (_, i) => isoDate(year, month, i + 1));
  const savedByDate = new Map(saved.data?.map((w) => [w.date, w]));
  const holidayByDate = new Map(holidays.data?.map((h) => [h.date, h.name]));

  const rowFor = (date: string): Row => edits[date] ?? savedByDate.get(date) ?? empty;
  const edit = (date: string, patch: Partial<Row>) => setEdits((e) => ({ ...e, [date]: { ...rowFor(date), ...patch } }));

  /** เติมเฉพาะวันที่ยังไม่ได้บันทึก: จ.–ส. ทำงาน 8 ชม., อา. หยุด, วันหยุดร้าน = นักขัตฤกษ์ */
  const fillStandard = () =>
    setEdits((e) => {
      const next = { ...e };
      for (const date of dates) {
        if (savedByDate.has(date) || next[date]) continue;
        next[date] = holidayByDate.has(date)
          ? { ...empty, kind: "PublicHoliday" }
          : weekday(date) === 0
            ? { ...empty, kind: "WeeklyHoliday" }
            : { ...empty, normalHours: 8 };
      }
      return next;
    });

  const save = useMutation<void, ApiError>({
    mutationFn: () =>
      api("/api/work-days", {
        method: "PUT",
        json: Object.entries(edits).map(([date, r]) => ({ employeeId: employee.id, date, ...r })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setEdits({});
    },
  });

  const dirty = Object.keys(edits).length;
  const totals = dates.reduce(
    (t, d) => {
      const r = rowFor(d);
      return { normal: t.normal + r.normalHours, ot: t.ot + r.overtimeHours };
    },
    { normal: 0, ot: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("วันทำงาน", "Work days")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillStandard}>
            {t("เติมวันทำงานปกติ (จ.–ส.)", "Fill standard week (Mon–Sat)")}
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? t("กำลังบันทึก…", "Saving…") : dirty ? t(`บันทึก ${dirty} วัน`, `Save ${dirty} day${dirty > 1 ? "s" : ""}`) : t("บันทึกแล้ว", "Saved")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {employee.payType === "Monthly" && (
          <p className="text-sm text-muted-foreground">
            {t(
              "พนักงานรายเดือนได้เงินเดือนเต็มอยู่แล้ว — บันทึกเฉพาะวันขาด/ลา/OT/ทำงานวันหยุดก็พอ",
              "Monthly staff get their full salary — only record absences, leave, overtime and holiday work",
            )}
          </p>
        )}
        <FormError message={save.error?.message} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("วันที่", "Date")}</TableHead>
                <TableHead>{t("ประเภทวัน", "Day type")}</TableHead>
                <TableHead className="w-24">{t("ชม. ปกติ", "Hours")}</TableHead>
                <TableHead className="w-24">{t("ชม. OT", "OT hours")}</TableHead>
                <TableHead>{t("ลา", "Leave")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((date) => {
                const r = rowFor(date);
                const isSaved = savedByDate.has(date);
                return (
                  <TableRow key={date} className={cn(r.kind !== "Workday" && "bg-muted/40", edits[date] && "bg-brand-soft/40")}>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-block w-8 text-muted-foreground">{weekdayShort(date, lang)}</span>
                      {Number(date.slice(8))}
                      {holidayByDate.has(date) && (
                        <span className="ml-2 text-xs text-brand-strong">{holidayByDate.get(date)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BiSelect
                        value={r.kind}
                        onChange={(v) => edit(date, { kind: v as DayKind })}
                        options={dayKindLabels}
                      />
                    </TableCell>
                    <TableCell>
                      <HoursInput value={r.normalHours} onChange={(v) => edit(date, { normalHours: v })} />
                    </TableCell>
                    <TableCell>
                      <HoursInput value={r.overtimeHours} onChange={(v) => edit(date, { overtimeHours: v })} />
                    </TableCell>
                    <TableCell>
                      <BiSelect value={r.leave} onChange={(v) => edit(date, { leave: v as LeaveKind })} options={leaveLabels} />
                    </TableCell>
                    <TableCell className="text-right">
                      {edits[date] ? <Badge variant="outline">{t("แก้ไข", "Edited")}</Badge> : isSaved ? null : (
                        <span className="text-xs text-muted-foreground">{t("ยังไม่บันทึก", "Not saved")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-medium">
                <TableCell colSpan={2}>{t("รวม", "Total")}</TableCell>
                <TableCell>{totals.normal}</TableCell>
                <TableCell>{totals.ot}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      max={24}
      step={0.5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-8 w-20 rounded-[10px] px-2 tabular"
    />
  );
}

/** Select ที่ option เป็นข้อความสองภาษา */
function BiSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, Bi> }) {
  const { t } = useLang();
  return (
    <Select size="sm" value={value} onValueChange={onChange}>
      {Object.entries(options).map(([v, [th, en]]) => (
        <option key={v} value={v}>
          {t(th, en)}
        </option>
      ))}
    </Select>
  );
}
