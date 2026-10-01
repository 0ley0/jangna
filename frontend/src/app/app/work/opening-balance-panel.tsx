"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { displayYear } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Employee, OpeningBalance } from "@/lib/types";

export function OpeningBalancePanel({ employee, year }: { employee: Employee; year: number }) {
  const { t, lang } = useLang();
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
        <CardTitle>
          {t("ยอดยกมาต้นปี", "Year-to-date opening balance")} {displayYear(year, lang)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {t(
            "ถ้าเริ่มใช้จ้างนะกลางปี ให้กรอกยอดตั้งแต่ ม.ค. ถึงก่อนรอบแรกในระบบ — ใช้ประมาณภาษีหัก ณ ที่จ่ายให้ถูก",
            "Started using Jangna mid-year? Enter totals from January up to your first pay run here, so withholding tax is estimated correctly",
          )}
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
            <TextField label={t("เงินได้สะสม", "Taxable income to date")} name="taxableIncome" type="number" min={0} step="0.01" defaultValue={current?.taxableIncome ?? ""} />
            <TextField label={t("ภาษีที่หักไปแล้ว", "Tax withheld to date")} name="taxWithheld" type="number" min={0} step="0.01" defaultValue={current?.taxWithheld ?? ""} />
            <TextField label={t("ประกันสังคมสะสม", "Social security to date")} name="socialSecurity" type="number" min={0} step="0.01" defaultValue={current?.socialSecurity ?? ""} />
            <Button type="submit" loading={save.isPending}>
              {save.isSuccess ? t("บันทึกแล้ว", "Saved") : t("บันทึกยอดยกมา", "Save opening balance")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
