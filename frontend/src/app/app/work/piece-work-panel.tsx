"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField, todayIso } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { baht, daysInMonth, fmtDate, isoDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Employee, PieceWork } from "@/lib/types";

export function PieceWorkPanel({ employee, year, month }: { employee: Employee; year: number; month: number }) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const from = isoDate(year, month, 1);
  const to = isoDate(year, month, daysInMonth(year, month));
  const queryKey = ["piece-work", employee.id, from];
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();

  const entries = useQuery({
    queryKey,
    queryFn: () => api<PieceWork[]>(`/api/piece-work?from=${from}&to=${to}&employeeId=${employee.id}`),
  });

  const add = useMutation<PieceWork, ApiError, FormData>({
    mutationFn: (form) =>
      api("/api/piece-work", {
        method: "POST",
        json: {
          employeeId: employee.id,
          date: form.get("date"),
          description: form.get("description"),
          quantity: Number(form.get("quantity")),
          rate: Number(form.get("rate")),
          overtime: form.get("overtime") === "on",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
  });

  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/piece-work/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const total = entries.data?.reduce((s, e) => s + e.quantity * e.rate * (e.overtime ? 1.5 : 1), 0) ?? 0;
  const today = todayIso();
  const defaultDate = today >= from && today <= to ? today : from;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{t("ผลงานต่อชิ้น", "Piece work")}</CardTitle>
        <Button
          variant="accent"
          onClick={() => {
            add.reset();
            setOpen(true);
          }}
        >
          <Icon.Plus size={16} /> {t("เพิ่มผลงาน", "Add entry")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormError message={remove.error?.message} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("วันที่", "Date")}</TableHead>
              <TableHead>{t("งาน", "Task")}</TableHead>
              <TableHead className="text-right">{t("จำนวน", "Qty")}</TableHead>
              <TableHead className="text-right">{t("อัตรา", "Rate")}</TableHead>
              <TableHead className="text-right">{t("ประมาณ", "Est.")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.data?.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{fmtDate(e.date, lang)}</TableCell>
                <TableCell>
                  {e.description}
                  {e.overtime && <span className="text-muted-foreground"> (OT ×1.5)</span>}
                </TableCell>
                <TableCell className="text-right">{e.quantity}</TableCell>
                <TableCell className="text-right">{baht(e.rate)}</TableCell>
                <TableCell className="text-right">{baht(e.quantity * e.rate * (e.overtime ? 1.5 : 1))}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={async () => {
                      const ok = await ask({
                        title: t("ลบรายการผลงานนี้?", "Delete this piece-work entry?"),
                        description: `${fmtDate(e.date, lang)} · ${e.description} × ${e.quantity}`,
                        tone: "danger",
                        confirmLabel: t("ลบ", "Delete"),
                      });
                      if (ok) remove.mutate(e.id);
                    }}>
                    {t("ลบ", "Delete")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell colSpan={4}>{t("รวม (ยังไม่รวมเติมขั้นต่ำ/ตัวคูณวันหยุด)", "Total (before min-wage top-up / holiday multipliers)")}</TableCell>
              <TableCell className="text-right">{baht(total)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
        <Dialog open={open} onOpenChange={setOpen} title={t("เพิ่มผลงานต่อชิ้น", "Add piece-work entry")} description={employee.firstName}>
          <form action={(f) => add.mutate(f)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormError message={add.error?.message} />
            </div>
            <DateField label={t("วันที่", "Date")} name="date" min={from} max={to} defaultValue={defaultDate} required />
            <TextField label={t("งาน", "Task")} name="description" defaultValue={t("แพ็คกล่อง", "Packing")} required />
            <TextField label={t("จำนวน", "Quantity")} name="quantity" type="number" min={1} step="1" required />
            <TextField label={t("บาท/ชิ้น", "THB/piece")} name="rate" type="number" min={0} step="0.01" defaultValue={5} required />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="overtime" /> {t("นอกเวลา (OT)", "Overtime (OT)")}
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("ยกเลิก", "Cancel")}
              </Button>
              <Button type="submit" variant="accent" loading={add.isPending}>
                {t("เพิ่มผลงาน", "Add entry")}
              </Button>
            </div>
          </form>
        </Dialog>
        {dialog}
      </CardContent>
    </Card>
  );
}
