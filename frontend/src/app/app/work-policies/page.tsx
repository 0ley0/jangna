"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DateField, addDaysIso, todayIso } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { FormError, SelectField, TextField, TextareaField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { fmtDate, weekdayShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { keys, useEmployees, useWorkPolicies } from "@/lib/queries";
import type { Employee, ShiftTemplate, WorkPolicy, WorkPolicyCell } from "@/lib/types";

const MAX_CYCLE = 8;
/** วันจันทร์อ้างอิงสำหรับชื่อวันในหัวตาราง (ค่าไม่สำคัญ ขอให้เป็นวันจันทร์) */
const REF_MONDAY = "2026-10-05";

const hhmm = (time: string) => time.slice(0, 5);
const span = (s: { startTime: string; endTime: string }) => `${hhmm(s.startTime)}–${hhmm(s.endTime)}`;

/** วันจันทร์ของสัปดาห์ที่มี iso */
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`).getDay();
  return addDaysIso(iso, -((d + 6) % 7));
};

const cellKey = (week: number, day: number) => `${week}|${day}`;

export default function WorkPoliciesPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const policies = useWorkPolicies();
  const employees = useEmployees();
  const templates = useQuery({ queryKey: ["shift-templates"], queryFn: () => api<ShiftTemplate[]>("/api/shift-templates") });
  const { ask, dialog } = useConfirm();
  const [editing, setEditing] = useState<WorkPolicy | "new" | null>(null);
  const [assigning, setAssigning] = useState<WorkPolicy | null>(null);

  const templateById = new Map(templates.data?.map((x) => [x.id, x]));
  const usable = templates.data?.filter((x) => !x.archived) ?? [];

  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/work-policies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.workPolicies });
      queryClient.invalidateQueries({ queryKey: keys.employees });
    },
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t(
            "นโยบายการทำงานคือแพทเทิร์นกะประจำที่ตั้งชื่อไว้ แล้วกำหนดให้พนักงาน (คนละ 1 นโยบาย) — ใช้สร้างตารางกะที่หน้ากะงานได้ในคลิกเดียว ตารางที่จัดแล้วไม่ถูกทับ",
            "A work policy is a named standing shift pattern you assign to staff (one policy each) — use it to fill the roster on the Shifts page in one click. Shifts already planned are never overwritten",
          )}
        </p>
        <Button variant="accent" className="ml-auto" onClick={() => setEditing("new")} disabled={usable.length === 0}>
          <Icon.Plus size={16} /> {t("สร้างนโยบาย", "New policy")}
        </Button>
      </div>

      {templates.data && usable.length === 0 && (
        <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
          {t("ต้องมีแม่แบบกะอย่างน้อย 1 อัน ก่อนสร้างนโยบาย — สร้างได้ที่หน้ากะงาน", "Create at least one shift template first — on the Shifts page")}
        </p>
      )}
      <FormError message={remove.error?.message} />

      <div className="grid gap-4 lg:grid-cols-2">
        {policies.data?.map((p) => (
          <Card key={p.id} className={p.archived ? "opacity-70" : undefined}>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{p.name}</span>
                {p.archived && <Badge variant="outline">{t("เลิกใช้แล้ว", "Archived")}</Badge>}
                <Badge variant={p.employeeCount > 0 ? "success" : "outline"}>{t(`${p.employeeCount} คน`, `${p.employeeCount} staff`)}</Badge>
                <Badge variant="outline">
                  {p.cycleWeeks === 1 ? t("ซ้ำทุกสัปดาห์", "Weekly") : t(`หมุนเวียน ${p.cycleWeeks} สัปดาห์`, `${p.cycleWeeks}-week rotation`)}
                </Badge>
              </div>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <PatternPreview policy={p} templateById={templateById} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                  {t("แก้ไข", "Edit")}
                </Button>
                {!p.archived && (
                  <Button variant="outline" size="sm" onClick={() => setAssigning(p)}>
                    <Icon.Users size={14} /> {t("กำหนดให้พนักงาน", "Assign staff")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const inUse = p.employeeCount > 0;
                    const ok = await ask({
                      title: t(`ลบนโยบาย "${p.name}"?`, `Delete policy "${p.name}"?`),
                      description: inUse
                        ? t(
                            `มีพนักงาน ${p.employeeCount} คนใช้อยู่ — นโยบายจะถูกเก็บเข้าคลัง (เลิกใช้) พนักงานยังคงอยู่ในนโยบายนี้จนกว่าจะเปลี่ยน`,
                            `${p.employeeCount} staff use it — it will be archived; they stay on it until you change them`,
                          )
                        : t("ไม่มีพนักงานใช้ — จะลบถาวร", "Nobody uses it — it will be deleted for good"),
                      tone: "danger",
                      confirmLabel: inUse ? t("เก็บเข้าคลัง", "Archive") : t("ลบ", "Delete"),
                    });
                    if (ok) remove.mutate(p.id);
                  }}
                >
                  {t("ลบ", "Delete")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {policies.data?.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="text-center text-sm text-muted-foreground">{t("ยังไม่มีนโยบายการทำงาน", "No work policies yet")}</CardContent>
          </Card>
        )}
      </div>

      <PolicyDialog editing={editing} usable={usable} templateById={templateById} onClose={() => setEditing(null)} />
      <AssignDialog policy={assigning} employees={employees.data ?? []} policies={policies.data ?? []} onClose={() => setAssigning(null)} />
      {dialog}
    </div>
  );
}

/** แพทเทิร์นแบบย่อ: แต่ละสัปดาห์ในรอบเป็นแถว วันละช่อง (ชื่อกะย่อ หรือ –) */
function PatternPreview({ policy, templateById }: { policy: WorkPolicy; templateById: Map<string, ShiftTemplate> }) {
  const { t, lang } = useLang();
  const cells = new Map(policy.days.map((d) => [cellKey(d.weekIndex, d.dayIndex), d.templateId]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-muted-foreground">
            {policy.cycleWeeks > 1 && <th className="w-12" />}
            {Array.from({ length: 7 }, (_, d) => (
              <th key={d} className="font-medium">
                {weekdayShort(addDaysIso(REF_MONDAY, d), lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: policy.cycleWeeks }, (_, w) => (
            <tr key={w}>
              {policy.cycleWeeks > 1 && <td className="text-muted-foreground">{t(`สัปดาห์ ${w + 1}`, `Wk ${w + 1}`)}</td>}
              {Array.from({ length: 7 }, (_, d) => {
                const template = templateById.get(cells.get(cellKey(w, d)) ?? "");
                return (
                  <td key={d} className="text-center">
                    {template ? (
                      <Chip tone={template.color} className="h-6 max-w-full justify-center truncate px-1.5">
                        {template.name}
                      </Chip>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyDialog({
  editing,
  usable,
  templateById,
  onClose,
}: {
  editing: WorkPolicy | "new" | null;
  usable: ShiftTemplate[];
  templateById: Map<string, ShiftTemplate>;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const policy = editing && editing !== "new" ? editing : null;
  // ฟอร์มนี้ถูก mount ใหม่ทุกครั้งที่เปิด (key) เพื่อให้ state เริ่มจากนโยบายที่เลือก
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={policy ? t("แก้ไขนโยบายการทำงาน", "Edit work policy") : t("สร้างนโยบายการทำงาน", "New work policy")}
    >
      {editing !== null && (
        <PolicyForm
          key={policy?.id ?? "new"}
          policy={policy}
          usable={usable}
          templateById={templateById}
          lang={lang}
          t={t}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: keys.workPolicies });
            queryClient.invalidateQueries({ queryKey: keys.employees });
            onClose();
          }}
          onCancel={onClose}
        />
      )}
    </Dialog>
  );
}

function PolicyForm({
  policy,
  usable,
  templateById,
  lang,
  t,
  onDone,
  onCancel,
}: {
  policy: WorkPolicy | null;
  usable: ShiftTemplate[];
  templateById: Map<string, ShiftTemplate>;
  lang: "th" | "en";
  t: (th: string, en: string) => string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [cycle, setCycle] = useState(policy?.cycleWeeks ?? 1);
  const [anchor, setAnchor] = useState<string | null>(policy?.anchorDate ?? mondayOf(todayIso()));
  const [cells, setCells] = useState(() => new Map(policy?.days.map((d) => [cellKey(d.weekIndex, d.dayIndex), d.templateId]) ?? []));
  const { ask, dialog } = useConfirm();

  const save = useMutation<WorkPolicy, ApiError, FormData>({
    mutationFn: (form) => {
      const days: WorkPolicyCell[] = [...cells.entries()]
        .map(([key, templateId]) => {
          const [weekIndex, dayIndex] = key.split("|").map(Number);
          return { weekIndex, dayIndex, templateId };
        })
        .filter((c) => c.weekIndex < cycle);
      return api(policy ? `/api/work-policies/${policy.id}` : "/api/work-policies", {
        method: policy ? "PUT" : "POST",
        json: {
          name: form.get("name"),
          description: form.get("description") || null,
          cycleWeeks: cycle,
          anchorDate: anchor,
          days,
          archived: policy?.archived ?? false,
        },
      });
    },
    onSuccess: onDone,
  });
  const errors = save.error?.fieldErrors;

  // รวมกะที่เลิกใช้แล้วแต่นโยบายนี้ยังอ้างถึง ไว้ในตัวเลือก ไม่งั้นช่องจะแสดงว่าง
  const optionsFor = (current: string | undefined) => {
    const options = [{ value: "", label: t("— หยุด —", "— Off —") }, ...usable.map((x) => ({ value: x.id, label: x.name, hint: span(x) }))];
    if (current && !usable.some((x) => x.id === current)) {
      const x = templateById.get(current);
      options.push({ value: current, label: x ? `${x.name} (${t("เลิกใช้", "archived")})` : "?", hint: x ? span(x) : "" });
    }
    return options;
  };

  const setCell = (week: number, day: number, templateId: string) =>
    setCells((prev) => {
      const next = new Map(prev);
      if (templateId) next.set(cellKey(week, day), templateId);
      else next.delete(cellKey(week, day));
      return next;
    });

  const fillWeek = (week: number, templateId: string) =>
    setCells((prev) => {
      const next = new Map(prev);
      for (let d = 0; d < 7; d++) {
        if (templateId && d < 5) next.set(cellKey(week, d), templateId); // จ-ศ
        else next.delete(cellKey(week, d));
      }
      return next;
    });

  const submit = async (form: FormData) => {
    // ลดจำนวนสัปดาห์ในรอบ = ตัดแพทเทิร์นสัปดาห์ท้ายๆ ทิ้ง — เตือนก่อนถ้ามีกะอยู่ในส่วนที่จะหาย
    const lost = [...cells.keys()].filter((k) => Number(k.split("|")[0]) >= cycle).length;
    if (lost > 0) {
      const ok = await ask({
        title: t("ลดจำนวนสัปดาห์ในรอบ?", "Shorten the cycle?"),
        description: t(`สัปดาห์ที่เกินรอบมี ${lost} กะ จะถูกตัดทิ้งเมื่อบันทึก`, `${lost} shift(s) in the removed weeks will be dropped on save`),
        confirmLabel: t("บันทึกต่อ", "Save anyway"),
      });
      if (!ok) return;
    }
    save.mutate(form);
  };

  return (
    <form action={submit} className="grid gap-4">
      <FormError message={errors && Object.keys(errors).length ? null : save.error?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("ชื่อนโยบาย", "Policy name")} name="name" defaultValue={policy?.name ?? ""} placeholder={t("เช่น แพ็คเกอร์กะเช้า จ-ส", "e.g. Packers, morning Mon–Sat")} errors={errors} required />
        <SelectField label={t("รอบของแพทเทิร์น", "Pattern cycle")} name="cycleWeeks" value={String(cycle)} onValueChange={(v) => setCycle(Number(v))}>
          {Array.from({ length: MAX_CYCLE }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? t("ซ้ำทุกสัปดาห์", "Repeat weekly") : t(`หมุนเวียน ${n} สัปดาห์`, `${n}-week rotation`)}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextareaField label={t("คำอธิบาย (ไม่บังคับ)", "Description (optional)")} name="description" defaultValue={policy?.description ?? ""} rows={2} errors={errors} />
        </div>
        {cycle > 1 && (
          <DateField
            label={t("สัปดาห์แรกของรอบเริ่มวันจันทร์ที่", "Week 1 of the cycle starts on Monday")}
            value={anchor}
            onChange={(v) => v && setAnchor(mondayOf(v))}
            required
          />
        )}
      </div>
      {cycle > 1 && anchor && (
        <p className="text-xs text-muted-foreground">
          {t(
            `สัปดาห์ที่ 1 ของรอบเริ่ม ${fmtDate(anchor, lang)} แล้ววนซ้ำทุก ${cycle} สัปดาห์ (ย้อนหลังก็นับต่อได้)`,
            `Week 1 starts ${fmtDate(anchor, lang)} and repeats every ${cycle} weeks (counts backwards too)`,
          )}
        </p>
      )}

      <div className="grid gap-3">
        <div className="text-sm font-medium">{t("กะในแต่ละวัน", "Shift on each day")}</div>
        {Array.from({ length: cycle }, (_, week) => (
          <div key={week} className="grid gap-2 rounded-xl border bg-cream p-3">
            <div className="flex flex-wrap items-center gap-2">
              {cycle > 1 && <span className="text-sm font-medium">{t(`สัปดาห์ที่ ${week + 1}`, `Week ${week + 1}`)}</span>}
              <Select
                size="sm"
                value=""
                aria-label={t("เติม จ-ศ ด้วยกะเดียวกัน", "Fill Mon–Fri with one shift")}
                placeholder={t("เติม จ-ศ…", "Fill Mon–Fri…")}
                onValueChange={(v) => v && fillWeek(week, v)}
                options={usable.map((x) => ({ value: x.id, label: x.name, hint: span(x) }))}
                className="w-36"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => fillWeek(week, "")}>
                {t("ล้างสัปดาห์", "Clear week")}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, day) => (
                <div key={day} className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{weekdayShort(addDaysIso(REF_MONDAY, day), lang)}</span>
                  <Select
                    size="sm"
                    value={cells.get(cellKey(week, day)) ?? ""}
                    aria-label={`${t(`สัปดาห์ ${week + 1}`, `Week ${week + 1}`)} ${weekdayShort(addDaysIso(REF_MONDAY, day), lang)}`}
                    onValueChange={(v) => setCell(week, day, v)}
                    options={optionsFor(cells.get(cellKey(week, day)))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {errors?.days && <p className="text-sm text-destructive">{errors.days[0]}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("ยกเลิก", "Cancel")}
        </Button>
        <Button type="submit" variant="accent" loading={save.isPending}>
          {policy ? t("บันทึก", "Save") : t("สร้างนโยบาย", "Create policy")}
        </Button>
      </div>
      {dialog}
    </form>
  );
}

function AssignDialog({
  policy,
  employees,
  policies,
  onClose,
}: {
  policy: WorkPolicy | null;
  employees: Employee[];
  policies: WorkPolicy[];
  onClose: () => void;
}) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { ask, dialog } = useConfirm();
  const active = employees.filter((e) => e.status === "Active");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lastPolicy, setLastPolicy] = useState<string | null>(null);

  // เริ่มด้วยคนที่อยู่ในนโยบายนี้แล้ว (เปิดใหม่ทุกครั้งที่เลือกนโยบายต่างกัน)
  if (policy && policy.id !== lastPolicy) {
    setLastPolicy(policy.id);
    setPicked(new Set(active.filter((e) => e.workPolicyId === policy.id).map((e) => e.id)));
  }
  if (!policy && lastPolicy) setLastPolicy(null);

  const policyName = new Map(policies.map((p) => [p.id, p.name]));
  const save = useMutation<unknown, ApiError, { policyId: string | null; ids: string[] }>({
    mutationFn: ({ policyId, ids }) => api("/api/work-policies/assign", { method: "POST", json: { policyId, employeeIds: ids } }),
  });

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!policy) return;
    const add = active.filter((e) => picked.has(e.id) && e.workPolicyId !== policy.id);
    const remove = active.filter((e) => !picked.has(e.id) && e.workPolicyId === policy.id);
    const switching = add.filter((e) => e.workPolicyId);
    if (switching.length > 0) {
      const ok = await ask({
        title: t(`ย้าย ${switching.length} คนมานโยบายนี้?`, `Move ${switching.length} staff to this policy?`),
        description: t(
          `พนักงานเหล่านี้ใช้นโยบายอื่นอยู่ (${switching.map((e) => `${e.firstName}: ${policyName.get(e.workPolicyId!) ?? "?"}`).join(", ")}) คนละ 1 นโยบาย จึงจะถูกย้ายออกจากนโยบายเดิม — ตารางกะที่จัดไปแล้วไม่เปลี่ยน`,
          `They are on another policy (${switching.map((e) => `${e.firstName}: ${policyName.get(e.workPolicyId!) ?? "?"}`).join(", ")}). One policy each, so they leave the old one — planned shifts are unchanged`,
        ),
        confirmLabel: t("ย้าย", "Move"),
      });
      if (!ok) return;
    }
    try {
      if (add.length > 0) await save.mutateAsync({ policyId: policy.id, ids: add.map((e) => e.id) });
      if (remove.length > 0) await save.mutateAsync({ policyId: null, ids: remove.map((e) => e.id) });
    } catch {
      return; // ข้อความ error แสดงใต้ฟอร์มจาก save.error
    } finally {
      queryClient.invalidateQueries({ queryKey: keys.employees });
      queryClient.invalidateQueries({ queryKey: keys.workPolicies });
    }
    onClose();
  };

  return (
    <Dialog
      open={policy !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t("กำหนดนโยบายให้พนักงาน", "Assign staff to policy")}
      description={policy?.name}
    >
      <div className="grid gap-4">
        <FormError message={save.error?.message} />
        <ul className="grid max-h-80 gap-1 overflow-y-auto">
          {active.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-brand-action" />
                <span className="flex-1">
                  {e.firstName} {e.lastName}
                </span>
                {e.workPolicyId && e.workPolicyId !== policy?.id && (
                  <span className="text-xs text-muted-foreground">{policyName.get(e.workPolicyId)}</span>
                )}
              </label>
            </li>
          ))}
          {active.length === 0 && <li className="text-sm text-muted-foreground">{t("ยังไม่มีพนักงาน", "No employees yet")}</li>}
        </ul>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("ยกเลิก", "Cancel")}
          </Button>
          <Button variant="accent" onClick={submit} loading={save.isPending}>
            {t("บันทึก", "Save")}
          </Button>
        </div>
      </div>
      {dialog}
    </Dialog>
  );
}
