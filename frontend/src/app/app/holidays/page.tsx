"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { DateField } from "@/components/date-picker";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { Icon } from "@/components/icons";
import { displayYear, fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Holiday } from "@/lib/types";

export default function HolidaysPage() {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();
  const queryKey = ["holidays", year];
  const holidays = useQuery({ queryKey, queryFn: () => api<Holiday[]>(`/api/holidays?year=${year}`) });

  const add = useMutation<Holiday, ApiError, FormData>({
    mutationFn: (form) => api("/api/holidays", { method: "POST", json: { date: form.get("date"), name: form.get("name") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
    },
  });
  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const count = holidays.data?.length ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("ปฏิทินวันหยุดประจำปี", "Yearly holiday calendar")}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setYear(year - 1)} aria-label={t("ปีก่อน", "Previous year")}>
            <Icon.ChevronLeft size={15} />
          </Button>
          <span className="w-16 text-center font-semibold tabular">{displayYear(year, lang)}</span>
          <Button variant="outline" size="icon-sm" onClick={() => setYear(year + 1)} aria-label={t("ปีถัดไป", "Next year")}>
            <Icon.Chevron size={15} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{t("วันหยุดตามประเพณี", "Public holidays")}</CardTitle>
          <Button
            variant="accent"
            onClick={() => {
              add.reset();
              setOpen(true);
            }}
          >
            <Icon.Plus size={16} /> {t("เพิ่มวันหยุด", "Add holiday")}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            {t(
              `กฎหมายกำหนดให้ประกาศวันหยุดตามประเพณีปีละไม่น้อยกว่า 13 วัน (รวมวันแรงงาน) — ปีนี้มี ${count} วัน`,
              `By law you must announce at least 13 public holidays a year (including Labour Day) — this year has ${count}`,
            )}
            {count < 13 && <span className="text-amber-ink"> {t("(ยังไม่ครบ 13)", "(fewer than 13)")}</span>} ·{" "}
            {t("ลูกจ้างรายวัน/ต่อชิ้นได้ค่าจ้างวันหยุดเหล่านี้", "daily and piece-rate staff are paid for these days")}
          </p>
          <FormError message={remove.error?.message} />
          <ul className="grid gap-1">
            {holidays.data?.map((h) => (
              <li key={h.id} className="flex items-center justify-between border-b py-1">
                <span>
                  <span className="inline-block w-28 text-muted-foreground">{fmtDate(h.date, lang)}</span>
                  {h.name}
                </span>
                <Button variant="ghost" size="sm" onClick={async () => {
                    const ok = await ask({
                      title: t(`ลบวันหยุด "${h.name}"?`, `Delete holiday "${h.name}"?`),
                      description: fmtDate(h.date, lang),
                      tone: "danger",
                      confirmLabel: t("ลบ", "Delete"),
                    });
                    if (ok) remove.mutate(h.id);
                  }}>
                  {t("ลบ", "Delete")}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} title={t("เพิ่มวันหยุดตามประเพณี", "Add a public holiday")}>
        <form action={(f) => add.mutate(f)} className="grid gap-4">
          <FormError message={add.error?.message} />
          <DateField
            key={year}
            label={t("วันที่", "Date")}
            name="date"
            required
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            marked={holidays.data?.map((h) => h.date)}
          />
          <TextField label={t("ชื่อวันหยุด", "Holiday name")} name="name" placeholder={t("เช่น วันสงกรานต์", "e.g. Songkran")} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ยกเลิก", "Cancel")}
            </Button>
            <Button type="submit" variant="accent" loading={add.isPending}>
              {t("เพิ่มวันหยุด", "Add holiday")}
            </Button>
          </div>
        </form>
      </Dialog>
      {dialog}
    </div>
  );
}
