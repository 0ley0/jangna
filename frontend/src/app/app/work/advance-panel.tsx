"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField, todayIso } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { baht, fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { AdvanceEntry, Employee } from "@/lib/types";

export function AdvancePanel({ employee }: { employee: Employee }) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const queryKey = ["advances", employee.id];
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();
  const advances = useQuery({
    queryKey,
    queryFn: () => api<AdvanceEntry[]>(`/api/advances?employeeId=${employee.id}`),
  });

  const add = useMutation<AdvanceEntry, ApiError, FormData>({
    mutationFn: (form) =>
      api("/api/advances", {
        method: "POST",
        json: {
          employeeId: employee.id,
          date: form.get("date"),
          amount: Number(form.get("amount")),
          note: form.get("note") || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
  });

  // เงินเบิกลบไม่ได้ (เก็บประวัติ) — เตือนก่อนบันทึกเสมอ
  const submit = async (form: FormData) => {
    const amount = Number(form.get("amount"));
    const ok = await ask({
      title: amount < 0 ? t("บันทึกยอดกลับรายการ?", "Record a reversal?") : t("บันทึกเงินเบิก?", "Record this advance?"),
      description: t(
        `${employee.firstName} · ${baht(amount)} — บันทึกแล้วลบไม่ได้ ถ้าผิดต้องใส่ยอดติดลบเพื่อกลับรายการ`,
        `${employee.firstName} · ${baht(amount)} — it cannot be deleted once saved; to correct it, enter a negative amount`,
      ),
      confirmLabel: t("บันทึก", "Save"),
    });
    if (ok) add.mutate(form);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{t("เงินเบิกล่วงหน้า", "Salary advances")}</CardTitle>
        <Button
          variant="accent"
          onClick={() => {
            add.reset();
            setOpen(true);
          }}
        >
          <Icon.Plus size={16} /> {t("บันทึกเงินเบิก", "Record advance")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {t(
            "หักอัตโนมัติในรอบจ่ายถัดไป ถ้าเกินยอดจ่ายจะยกไปหักรอบหน้า · บันทึกผิด ให้ใส่ยอดติดลบเพื่อกลับรายการ (ลบไม่ได้ เพื่อเก็บประวัติ)",
            "Deducted automatically in the next pay run; any excess carries over · To correct a mistake, enter a negative amount (entries cannot be deleted, to keep history)",
          )}
        </p>
        {advances.data && advances.data.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {advances.data.map((a) => (
              <li key={a.id} className="flex justify-between border-b py-1">
                <span>
                  {fmtDate(a.date, lang)} {a.note && <span className="text-muted-foreground">· {a.note}</span>}
                </span>
                <span className={a.amount < 0 ? "text-destructive" : ""}>{baht(a.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <Dialog open={open} onOpenChange={setOpen} title={t("บันทึกเงินเบิก", "Record advance")} description={employee.firstName}>
          <form action={submit} className="grid gap-4">
            <FormError message={add.error?.message} />
            <DateField label={t("วันที่", "Date")} name="date" defaultValue={todayIso()} required />
            <TextField label={t("จำนวนเงิน", "Amount")} name="amount" type="number" step="0.01" required />
            <TextField label={t("หมายเหตุ", "Note")} name="note" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("ยกเลิก", "Cancel")}
              </Button>
              <Button type="submit" variant="accent" loading={add.isPending}>
                {t("บันทึกเงินเบิก", "Record advance")}
              </Button>
            </div>
          </form>
        </Dialog>
        {dialog}
      </CardContent>
    </Card>
  );
}
