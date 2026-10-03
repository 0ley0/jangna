"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DateField } from "@/components/date-picker";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import { documentTypeLabels, type DocumentType, type EmployeeDocument } from "@/lib/types";

/** ใกล้หมดอายุ = ภายใน 60 วัน (ตรงกับค่าเริ่มต้นของ backend) */
export const WARN_DAYS = 60;

/** สถานะวันหมดอายุของเอกสาร — ใช้ทั้งในรายการเอกสารและการ์ดแจ้งเตือน */
export function ExpiryBadge({ daysLeft }: { daysLeft: number | null }) {
  const { t } = useLang();
  if (daysLeft === null) return <Badge variant="outline">{t("ไม่มีวันหมดอายุ", "No expiry")}</Badge>;
  if (daysLeft < 0) return <Badge variant="destructive">{t(`หมดอายุแล้ว ${-daysLeft} วัน`, `Expired ${-daysLeft} d ago`)}</Badge>;
  if (daysLeft === 0) return <Badge variant="destructive">{t("หมดอายุวันนี้", "Expires today")}</Badge>;
  if (daysLeft <= WARN_DAYS) return <Badge variant="warning">{t(`อีก ${daysLeft} วัน`, `${daysLeft} days left`)}</Badge>;
  return <Badge variant="success">{t(`อีก ${daysLeft} วัน`, `${daysLeft} days left`)}</Badge>;
}

/** เอกสารของพนักงานหนึ่งคน (พาสปอร์ต วีซ่า ใบอนุญาตทำงาน บัตรชมพู) — เพิ่ม/แก้/ลบในที่เดียว */
export function DocumentsDialog({ employee, onClose }: { employee: { id: string; name: string } | null; onClose: () => void }) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const { ask, dialog } = useConfirm();
  const [editing, setEditing] = useState<EmployeeDocument | "new" | null>(null);
  const [type, setType] = useState<DocumentType>("WorkPermit");

  const employeeId = employee?.id;
  const queryKey = ["employee-documents", employeeId];
  const docs = useQuery({
    queryKey,
    enabled: !!employeeId,
    queryFn: () => api<EmployeeDocument[]>(`/api/employee-documents?employeeId=${employeeId}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: keys.expiringDocs });
  };
  const current = editing && editing !== "new" ? editing : null;
  const save = useMutation<EmployeeDocument, ApiError, FormData>({
    mutationFn: (form) =>
      api(current ? `/api/employee-documents/${current.id}` : "/api/employee-documents", {
        method: current ? "PUT" : "POST",
        json: {
          employeeId,
          type: form.get("type"),
          number: form.get("number") || null,
          issuedOn: form.get("issuedOn") || null,
          expiresOn: form.get("expiresOn") || null,
          note: form.get("note") || null,
        },
      }),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });
  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/employee-documents/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const startEdit = (d: EmployeeDocument | "new") => {
    save.reset();
    setType(d === "new" ? "WorkPermit" : d.type);
    setEditing(d);
  };
  const close = () => {
    setEditing(null);
    save.reset();
    onClose();
  };
  const errors = save.error?.fieldErrors;

  return (
    <Dialog
      open={employee !== null}
      onOpenChange={(o) => !o && close()}
      size="lg"
      title={t("เอกสารพนักงาน", "Employee documents")}
      description={employee?.name}
    >
      <div className="grid gap-4">
        <FormError message={remove.error?.message} />
        {docs.data?.length === 0 && !editing && (
          <p className="text-sm text-muted-foreground">
            {t(
              "ยังไม่มีเอกสาร — เพิ่มพาสปอร์ต วีซ่า หรือใบอนุญาตทำงานเพื่อให้ระบบเตือนก่อนหมดอายุ",
              "No documents yet — add a passport, visa or work permit to get expiry reminders",
            )}
          </p>
        )}
        <ul className="grid gap-2">
          {docs.data?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-surface px-3 py-2">
              <div className="grid min-w-0 flex-1">
                <span className="font-medium">
                  {t(...documentTypeLabels[d.type])}
                  {d.number && <span className="text-muted-foreground"> · {d.number}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.expiresOn ? t(`หมดอายุ ${fmtDate(d.expiresOn, lang)}`, `Expires ${fmtDate(d.expiresOn, lang)}`) : t("ไม่มีวันหมดอายุ", "No expiry date")}
                  {d.note && ` · ${d.note}`}
                </span>
              </div>
              <ExpiryBadge daysLeft={d.daysLeft} />
              <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>
                {t("แก้ไข", "Edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const ok = await ask({
                    title: t("ลบเอกสารนี้?", "Delete this document?"),
                    description: `${t(...documentTypeLabels[d.type])}${d.number ? ` · ${d.number}` : ""}`,
                    tone: "danger",
                    confirmLabel: t("ลบ", "Delete"),
                  });
                  if (ok) remove.mutate(d.id);
                }}
              >
                {t("ลบ", "Delete")}
              </Button>
            </li>
          ))}
        </ul>

        {editing ? (
          <form action={(f) => save.mutate(f)} className="grid gap-4 rounded-xl border bg-cream p-4 sm:grid-cols-2" key={current?.id ?? "new"}>
            <div className="font-medium sm:col-span-2">{current ? t("แก้ไขเอกสาร", "Edit document") : t("เพิ่มเอกสาร", "Add document")}</div>
            <div className="sm:col-span-2">
              <FormError message={errors && Object.keys(errors).length ? null : save.error?.message} />
            </div>
            <SelectField label={t("ประเภทเอกสาร", "Document type")} name="type" value={type} onValueChange={(v) => setType(v as DocumentType)}>
              {(Object.keys(documentTypeLabels) as DocumentType[]).map((v) => (
                <option key={v} value={v}>
                  {t(...documentTypeLabels[v])}
                </option>
              ))}
            </SelectField>
            <TextField label={t("เลขที่เอกสาร", "Document no.")} name="number" defaultValue={current?.number ?? ""} errors={errors} />
            <DateField label={t("วันที่ออก (ไม่บังคับ)", "Issued on (optional)")} name="issuedOn" defaultValue={current?.issuedOn} errors={errors} />
            <DateField
              label={t("วันหมดอายุ (ว่าง = ไม่เตือน)", "Expires on (empty = no reminder)")}
              name="expiresOn"
              defaultValue={current?.expiresOn}
              errors={errors}
            />
            <div className="sm:col-span-2">
              <TextField label={t("หมายเหตุ", "Note")} name="note" defaultValue={current?.note ?? ""} errors={errors} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t("ยกเลิก", "Cancel")}
              </Button>
              <Button type="submit" variant="accent" loading={save.isPending}>
                {current ? t("บันทึก", "Save") : t("เพิ่มเอกสาร", "Add document")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-between gap-2">
            <Button variant="accent" onClick={() => startEdit("new")}>
              <Icon.Plus size={16} /> {t("เพิ่มเอกสาร", "Add document")}
            </Button>
            <Button variant="outline" onClick={close}>
              {t("ปิด", "Close")}
            </Button>
          </div>
        )}
      </div>
      {dialog}
    </Dialog>
  );
}
