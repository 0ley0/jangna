"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addDaysIso, todayIso } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { fmtDate, weekday, weekdayShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useEmployees } from "@/lib/queries";
import type { Bi, Holiday, Shift, ShiftColor, ShiftTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const colorLabels: Record<ShiftColor, Bi> = {
  brand: ["ส้มอิฐ", "Terracotta"],
  sage: ["เขียว", "Sage"],
  amber: ["เหลือง", "Amber"],
  plum: ["ม่วง", "Plum"],
  blue: ["ฟ้า", "Blue"],
  neutral: ["เทา", "Neutral"],
};

/** "08:00:00" → "08:00" */
const hhmm = (time: string) => time.slice(0, 5);
const span = (s: { startTime: string; endTime: string }) => `${hhmm(s.startTime)}–${hhmm(s.endTime)}`;
const hours = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** วันจันทร์ของสัปดาห์ที่มีวันนี้ */
const mondayOf = (iso: string) => addDaysIso(iso, -((weekday(iso) + 6) % 7));

interface ShiftChange {
  employeeId: string;
  date: string;
  templateId: string | null;
}

export default function ShiftsPage() {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const [monday, setMonday] = useState(() => mondayOf(todayIso()));
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const sunday = days[6];

  const employees = useEmployees();
  const templates = useQuery({ queryKey: ["shift-templates"], queryFn: () => api<ShiftTemplate[]>("/api/shift-templates") });
  const shiftsKey = ["shifts", monday];
  const shifts = useQuery({ queryKey: shiftsKey, queryFn: () => api<Shift[]>(`/api/shifts?from=${monday}&to=${sunday}`) });
  const years = [...new Set([monday.slice(0, 4), sunday.slice(0, 4)])];
  const holidays = useQuery({
    queryKey: ["holidays", years.join()],
    queryFn: async () => (await Promise.all(years.map((y) => api<Holiday[]>(`/api/holidays?year=${y}`)))).flat(),
  });
  const rules = useQuery({
    queryKey: ["legal-rules", monday],
    queryFn: () => api<{ rules: { workingTime: { maxHoursPerWeek: number } } }>(`/api/legal/rules?date=${monday}`),
  });
  const maxWeek = rules.data?.rules.workingTime.maxHoursPerWeek ?? 48;

  const save = useMutation<void, ApiError, ShiftChange[]>({
    mutationFn: (items) => api("/api/shifts", { method: "PUT", json: items }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: shiftsKey }),
  });
  const copyLastWeek = useMutation<{ copied: number }, ApiError>({
    mutationFn: () => api("/api/shifts/copy-week", { method: "POST", json: { from: addDaysIso(monday, -7), to: monday, overwrite: false } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftsKey }),
  });

  const active = employees.data?.filter((e) => e.status === "Active") ?? [];
  const byCell = new Map(shifts.data?.map((s) => [`${s.employeeId}|${s.date}`, s]));
  const templateById = new Map(templates.data?.map((x) => [x.id, x]));
  const usable = templates.data?.filter((x) => !x.archived) ?? [];
  const holidayOn = new Map(holidays.data?.map((h) => [h.date, h.name]));

  /** ตัวเลือกในช่อง: ไม่มีกะ + แม่แบบที่ใช้ได้ + (แม่แบบที่เลิกใช้/กะกำหนดเอง ถ้าช่องนั้นใช้อยู่) */
  const optionsFor = (shift: Shift | undefined) => {
    const options = [
      { value: "", label: t("— หยุด —", "— Off —") },
      ...usable.map((x) => ({ value: x.id, label: x.name, hint: span(x) })),
    ];
    if (shift?.templateId && !usable.some((x) => x.id === shift.templateId))
      options.push({ value: shift.templateId, label: templateById.get(shift.templateId)?.name ?? "?", hint: span(shift) });
    if (shift && !shift.templateId) options.push({ value: "custom", label: t("กำหนดเอง", "Custom"), hint: span(shift) });
    return options;
  };

  const fillWeek = (employeeId: string, templateId: string) =>
    save.mutate(
      days.filter((d) => !byCell.has(`${employeeId}|${d}`) && !holidayOn.has(d)).map((date) => ({ employeeId, date, templateId })),
    );

  return (
    <div className="grid gap-6">
      <TemplatesCard templates={templates.data ?? []} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="mr-auto">
              {fmtDate(monday, lang)} – {fmtDate(sunday, lang)}
            </CardTitle>
            <Button variant="outline" size="icon-sm" onClick={() => setMonday(addDaysIso(monday, -7))} aria-label={t("สัปดาห์ก่อน", "Previous week")}>
              <Icon.ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonday(mondayOf(todayIso()))}>
              {t("สัปดาห์นี้", "This week")}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setMonday(addDaysIso(monday, 7))} aria-label={t("สัปดาห์ถัดไป", "Next week")}>
              <Icon.Chevron size={15} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => copyLastWeek.mutate()} loading={copyLastWeek.isPending}>
              <Icon.Copy size={14} /> {t("คัดลอกจากสัปดาห์ก่อน", "Copy last week")}
            </Button>
            <Button size="sm" disabled title={t("ต้องเปิด LINE OA ก่อน", "Needs the LINE OA first")}>
              <Icon.Line size={14} /> {t("ส่งเข้า LINE (เร็วๆ นี้)", "Send to LINE (soon)")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FormError message={save.error?.message ?? copyLastWeek.error?.message} />
          {copyLastWeek.data && (
            <p className="text-sm text-muted-foreground">
              {t(`คัดลอกแล้ว ${copyLastWeek.data.copied} กะ (ช่องที่มีกะอยู่แล้วไม่ถูกทับ)`, `Copied ${copyLastWeek.data.copied} shifts (existing cells kept)`)}
            </p>
          )}
          {usable.length === 0 && (
            <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
              {t("สร้างแม่แบบกะก่อน แล้วค่อยเลือกกะให้พนักงานแต่ละวัน", "Create a shift template first, then pick shifts for each day")}
            </p>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  {/* ล็อกคอลัมน์ชื่อไว้ซ้ายขณะเลื่อนตารางบนมือถือ */}
                  <TableHead className="sticky left-0 z-10 w-40 bg-card">{t("พนักงาน", "Employee")}</TableHead>
                  {days.map((d) => (
                    <TableHead key={d} className={cn("min-w-28", holidayOn.has(d) && "text-brand-strong")} title={holidayOn.get(d)}>
                      {weekdayShort(d, lang)} {Number(d.slice(8))}
                      {holidayOn.has(d) && " •"}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">{t("ชม./สัปดาห์", "Hrs/week")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((e) => {
                  const total = days.reduce((sum, d) => sum + (byCell.get(`${e.id}|${d}`)?.hours ?? 0), 0);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="sticky left-0 z-10 bg-card">
                        <div className="font-medium">{e.nickname || e.firstName}</div>
                        {usable.length > 0 && (
                          <Select
                            size="sm"
                            value=""
                            aria-label={t("เติมช่องว่างทั้งสัปดาห์", "Fill empty days")}
                            placeholder={t("เติมทั้งสัปดาห์…", "Fill week…")}
                            onValueChange={(v) => v && fillWeek(e.id, v)}
                            options={usable.map((x) => ({ value: x.id, label: x.name, hint: span(x) }))}
                            className="mt-1 w-36"
                          />
                        )}
                      </TableCell>
                      {days.map((d) => {
                        const shift = byCell.get(`${e.id}|${d}`);
                        const template = shift?.templateId ? templateById.get(shift.templateId) : undefined;
                        return (
                          <TableCell key={d} className="align-top">
                            <Select
                              size="sm"
                              aria-label={`${e.firstName} ${fmtDate(d, lang)}`}
                              value={shift ? (shift.templateId ?? "custom") : ""}
                              onValueChange={(v) => v !== "custom" && save.mutate([{ employeeId: e.id, date: d, templateId: v || null }])}
                              options={optionsFor(shift)}
                            />
                            {shift && (
                              <Chip tone={template?.color ?? "neutral"} className="mt-1 h-6 tabular">
                                {span(shift)}
                              </Chip>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className={cn("text-right font-medium tabular", total > maxWeek && "text-amber-ink")}>
                        {hours(total)}
                        {total > maxWeek && (
                          <div className="text-xs font-normal">{t(`เกิน ${maxWeek} ชม.`, `over ${maxWeek} h`)}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {active.length === 0 && <TableEmpty colSpan={9}>{t("ยังไม่มีพนักงาน", "No employees yet")}</TableEmpty>}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              `• = วันหยุดของร้าน · กฎหมายจำกัดเวลาทำงานปกติไม่เกิน ${maxWeek} ชม./สัปดาห์ · ตารางกะยังไม่นำไปคิดเงินเดือน (บันทึกวันทำงานที่หน้า "บันทึกงาน")`,
              `• = shop holiday · Law limits regular hours to ${maxWeek} h/week · Shifts don't affect pay yet (log work days on the Work log page)`,
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplatesCard({ templates }: { templates: ShiftTemplate[] }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shift-templates"] });
  const [open, setOpen] = useState(false);
  const { ask, dialog } = useConfirm();

  const create = useMutation<ShiftTemplate, ApiError, FormData>({
    mutationFn: (form) =>
      api("/api/shift-templates", {
        method: "POST",
        json: {
          name: form.get("name"),
          startTime: `${form.get("startTime")}:00`,
          endTime: `${form.get("endTime")}:00`,
          breakMinutes: Number(form.get("breakMinutes") || 0),
          color: form.get("color"),
        },
      }),
    onSuccess: () => {
      refresh();
      setOpen(false);
    },
  });
  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/shift-templates/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const errors = create.error?.fieldErrors;
  const usable = templates.filter((x) => !x.archived);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{t("แม่แบบกะ", "Shift templates")}</CardTitle>
        <Button
          variant="accent"
          onClick={() => {
            create.reset();
            setOpen(true);
          }}
        >
          <Icon.Plus size={15} /> {t("เพิ่มแม่แบบกะ", "Add template")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {usable.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {usable.map((x) => (
              <Chip
                key={x.id}
                tone={x.color}
                onRemove={async () => {
                  const ok = await ask({
                    title: t(`ลบกะ "${x.name}"?`, `Remove "${x.name}"?`),
                    description: t("กะที่จัดไปแล้วในตารางยังอยู่ แต่จะเลือกแม่แบบนี้เพิ่มไม่ได้อีก", "Shifts already planned stay, but this template can't be picked again"),
                    tone: "danger",
                    confirmLabel: t("ลบ", "Remove"),
                  });
                  if (ok) remove.mutate(x.id);
                }}
                removeLabel={t("ลบแม่แบบ", "Remove template")}
              >
                {x.name} · <span className="tabular">{span(x)}</span>
                <span className="opacity-70">
                  ({hours(x.hours)} {t("ชม.", "h")})
                </span>
              </Chip>
            ))}
          </div>
        )}
        <FormError message={remove.error?.message} />
        <Dialog open={open} onOpenChange={setOpen} title={t("เพิ่มแม่แบบกะ", "Add shift template")}>
        <form action={(form) => create.mutate(form)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormError message={errors && Object.keys(errors).length ? null : create.error?.message} />
          </div>
          <TextField
            className="sm:col-span-2"
            label={t("ชื่อกะ", "Name")}
            name="name"
            placeholder={t("เช่น กะเช้า", "e.g. Morning")}
            required
            errors={errors}
          />
          <TextField label={t("เข้า", "Start")} name="startTime" type="time" defaultValue="08:00" required />
          <TextField label={t("ออก", "End")} name="endTime" type="time" defaultValue="17:00" required />
          <TextField label={t("พัก (นาที)", "Break (min)")} name="breakMinutes" type="number" min={0} step={5} defaultValue={60} errors={errors} />
          <SelectField label={t("สี", "Colour")} name="color" defaultValue="brand">
            {(Object.keys(colorLabels) as ShiftColor[]).map((c) => (
              <option key={c} value={c}>
                {t(...colorLabels[c])}
              </option>
            ))}
          </SelectField>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {t("เวลาออกน้อยกว่าเวลาเข้า = กะข้ามเที่ยงคืน", "End before start = overnight shift")}
          </p>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ยกเลิก", "Cancel")}
            </Button>
            <Button type="submit" variant="accent" loading={create.isPending}>
              {t("เพิ่มแม่แบบกะ", "Add template")}
            </Button>
          </div>
        </form>
        </Dialog>
        {dialog}
      </CardContent>
    </Card>
  );
}
