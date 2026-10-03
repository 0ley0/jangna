"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { baht, displayYear } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Employee, OpeningBalance } from "@/lib/types";

export function OpeningBalancePanel({ employee, year }: { employee: Employee; year: number }) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const queryKey = ["opening-balances", year];
  const [open, setOpen] = useState(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
  });

  if (employee.workerType === "Freelance") return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>
          {t("ยอดยกมาต้นปี", "Year-to-date opening balance")} {displayYear(year, lang)}
        </CardTitle>
        <Button
          variant={current ? "outline" : "accent"}
          disabled={balances.isPending}
          onClick={() => {
            save.reset();
            setOpen(true);
          }}
        >
          {current ? t("แก้ไขยอดยกมา", "Edit balance") : t("กรอกยอดยกมา", "Enter balance")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {t(
            "ถ้าเริ่มใช้จ้างนะกลางปี ให้กรอกยอดตั้งแต่ ม.ค. ถึงก่อนรอบแรกในระบบ — ใช้ประมาณภาษีหัก ณ ที่จ่ายให้ถูก",
            "Started using Jangna mid-year? Enter totals from January up to your first pay run here, so withholding tax is estimated correctly",
          )}
        </p>
        {current && (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("เงินได้สะสม", "Taxable income to date")}</dt>
              <dd className="font-semibold tabular">{baht(current.taxableIncome)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("ภาษีที่หักไปแล้ว", "Tax withheld to date")}</dt>
              <dd className="font-semibold tabular">{baht(current.taxWithheld)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("ประกันสังคมสะสม", "Social security to date")}</dt>
              <dd className="font-semibold tabular">{baht(current.socialSecurity)}</dd>
            </div>
          </dl>
        )}
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={t("ยอดยกมาต้นปี", "Year-to-date opening balance")}
          description={t(
            "แก้ไขแล้วผลคำนวณภาษีของรอบจ่ายที่ยังเป็นร่างจะเปลี่ยนเมื่อคำนวณใหม่",
            "Draft pay runs pick up the change when you recalculate them",
          )}
        >
          <form action={(f) => save.mutate(f)} className="grid gap-4">
            <FormError message={save.error?.message} />
            <TextField label={t("เงินได้สะสม", "Taxable income to date")} name="taxableIncome" type="number" min={0} step="0.01" defaultValue={current?.taxableIncome ?? ""} />
            <TextField label={t("ภาษีที่หักไปแล้ว", "Tax withheld to date")} name="taxWithheld" type="number" min={0} step="0.01" defaultValue={current?.taxWithheld ?? ""} />
            <TextField label={t("ประกันสังคมสะสม", "Social security to date")} name="socialSecurity" type="number" min={0} step="0.01" defaultValue={current?.socialSecurity ?? ""} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("ยกเลิก", "Cancel")}
              </Button>
              <Button type="submit" variant="accent" loading={save.isPending}>
                {t("บันทึกยอดยกมา", "Save opening balance")}
              </Button>
            </div>
          </form>
        </Dialog>
      </CardContent>
    </Card>
  );
}
