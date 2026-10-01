"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError } from "@/lib/api";
import type { Employee, OpeningBalance } from "@/lib/types";

export function OpeningBalancePanel({ employee, year }: { employee: Employee; year: number }) {
  const queryClient = useQueryClient();
  const queryKey = ["opening-balances", year];
  const balances = useQuery({
    queryKey,
    queryFn: () => api<OpeningBalance[]>(`/api/opening-balances?year=${year}`),
  });
  const current = balances.data?.find((b) => b.employeeId === employee.id);

  const save = useMutation<OpeningBalance, ApiError, FormData>({
    mutationFn: (form) =>
      api("/api/opening-balances", {
        method: "PUT",
        json: {
          employeeId: employee.id,
          year,
          taxableIncome: Number(form.get("taxableIncome") || 0),
          taxWithheld: Number(form.get("taxWithheld") || 0),
          socialSecurity: Number(form.get("socialSecurity") || 0),
          note: form.get("note") || null,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (employee.workerType === "Freelance") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ยอดยกมาต้นปี {year + 543}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          ถ้าเริ่มใช้จ้างนะกลางปี ให้กรอกยอดตั้งแต่ ม.ค. ถึงก่อนรอบแรกในระบบ — ใช้ประมาณภาษีหัก ณ ที่จ่ายให้ถูก
        </p>
        {!balances.isPending && (
          <form
            action={(f) => save.mutate(f)}
            className="grid items-end gap-3 sm:grid-cols-4"
            key={current?.id ?? "new"}
          >
            <div className="sm:col-span-4">
              <FormError message={save.error?.message} />
            </div>
            <Field label="เงินได้สะสม" name="taxableIncome" type="number" min={0} step="0.01" defaultValue={current?.taxableIncome ?? ""} />
            <Field label="ภาษีที่หักไปแล้ว" name="taxWithheld" type="number" min={0} step="0.01" defaultValue={current?.taxWithheld ?? ""} />
            <Field label="ประกันสังคมสะสม" name="socialSecurity" type="number" min={0} step="0.01" defaultValue={current?.socialSecurity ?? ""} />
            <Button type="submit" disabled={save.isPending}>
              {save.isSuccess ? "บันทึกแล้ว" : "บันทึกยอดยกมา"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
