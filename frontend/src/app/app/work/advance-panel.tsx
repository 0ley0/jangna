"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError } from "@/lib/api";
import { baht, thaiDate } from "@/lib/format";
import type { AdvanceEntry, Employee } from "@/lib/types";

export function AdvancePanel({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient();
  const queryKey = ["advances", employee.id];
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>เงินเบิกล่วงหน้า</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          หักอัตโนมัติในรอบจ่ายถัดไป ถ้าเกินยอดจ่ายจะยกไปหักรอบหน้า · บันทึกผิด ให้ใส่ยอดติดลบเพื่อกลับรายการ (ลบไม่ได้ เพื่อเก็บประวัติ)
        </p>
        <form action={(f) => add.mutate(f)} className="grid items-end gap-3 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <FormError message={add.error?.message} />
          </div>
          <Field label="วันที่" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          <Field label="จำนวนเงิน" name="amount" type="number" step="0.01" required />
          <Field label="หมายเหตุ" name="note" />
          <Button type="submit" disabled={add.isPending}>
            บันทึกเงินเบิก
          </Button>
        </form>
        {advances.data && advances.data.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {advances.data.map((a) => (
              <li key={a.id} className="flex justify-between border-b py-1">
                <span>
                  {thaiDate(a.date)} {a.note && <span className="text-muted-foreground">· {a.note}</span>}
                </span>
                <span className={a.amount < 0 ? "text-destructive" : ""}>{baht(a.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
