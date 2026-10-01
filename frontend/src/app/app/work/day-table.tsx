"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { daysInMonth, isoDate, weekday, weekdayShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  dayKindLabels,
  leaveLabels,
  type DayKind,
  type Employee,
  type Holiday,
  type LeaveKind,
  type WorkDay,
} from "@/lib/types";

interface Row {
  kind: DayKind;
  normalHours: number;
  overtimeHours: number;
  leave: LeaveKind;
}

const empty: Row = { kind: "Workday", normalHours: 0, overtimeHours: 0, leave: "None" };

export function DayTable({ employee, year, month }: { employee: Employee; year: number; month: number }) {
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
        <CardTitle>วันทำงาน</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillStandard}>
            เติมวันทำงานปกติ (จ.–ส.)
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "กำลังบันทึก…" : dirty ? `บันทึก ${dirty} วัน` : "บันทึกแล้ว"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {employee.payType === "Monthly" && (
          <p className="text-sm text-muted-foreground">
            พนักงานรายเดือนได้เงินเดือนเต็มอยู่แล้ว — บันทึกเฉพาะวันขาด/ลา/OT/ทำงานวันหยุดก็พอ
          </p>
        )}
        <FormError message={save.error?.message} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>ประเภทวัน</TableHead>
                <TableHead className="w-24">ชม. ปกติ</TableHead>
                <TableHead className="w-24">ชม. OT</TableHead>
                <TableHead>ลา</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((date) => {
                const r = rowFor(date);
                const isSaved = savedByDate.has(date);
                return (
                  <TableRow key={date} className={cn(r.kind !== "Workday" && "bg-muted/40", edits[date] && "bg-primary/5")}>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-block w-8 text-muted-foreground">{weekdayShort(date)}</span>
                      {Number(date.slice(8))}
                      {holidayByDate.has(date) && (
                        <span className="ml-2 text-xs text-primary">{holidayByDate.get(date)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
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
                      <Select value={r.leave} onChange={(v) => edit(date, { leave: v as LeaveKind })} options={leaveLabels} />
                    </TableCell>
                    <TableCell className="text-right">
                      {edits[date] ? <Badge variant="outline">แก้ไข</Badge> : isSaved ? null : (
                        <span className="text-xs text-muted-foreground">ยังไม่บันทึก</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-medium">
                <TableCell colSpan={2}>รวม</TableCell>
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
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
    >
      {Object.entries(options).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
