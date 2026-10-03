"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { ImportDialog } from "./import-dialog";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormError, SelectField, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { provinces } from "@/lib/provinces";
import { keys, useBranches, useEmployees } from "@/lib/queries";
import { payTypeLabels, payTypeUnit, titleLabels, type Employee, type Invite, type PayType, type Title } from "@/lib/types";

/** ข้อมูลที่ไฟล์ สปส.1-10 / ภ.ง.ด.1 ต้องใช้ (ฟรีแลนซ์ไม่เข้า สปส.) */
const filingIncomplete = (e: Employee) =>
  e.workerType === "Employee" && (!e.title || !e.nationalId || !e.district || !e.province || !e.postalCode);

export default function EmployeesPage() {
  const { t } = useLang();
  const employees = useEmployees();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formKey, setFormKey] = useState(0); // เปลี่ยนทุกครั้งที่เปิด เพื่อล้าง state ภายในฟอร์ม
  const [invite, setInvite] = useState<{ employee: Employee; invite: Invite } | null>(null);

  const createInvite = useMutation<Invite, ApiError, Employee>({
    mutationFn: (e) => api<Invite>(`/api/employees/${e.id}/invites`, { method: "POST" }),
    onSuccess: (inv, employee) => setInvite({ employee, invite: inv }),
  });

  const [filter, setFilter] = useState<PayType | "all">("all");
  const shown = employees.data?.filter((e) => filter === "all" || e.payType === filter);
  const filterOptions = [
    { value: "all" as const, label: t("ทั้งหมด", "All"), count: employees.data?.length },
    ...(Object.keys(payTypeLabels) as PayType[]).map((p) => ({
      value: p,
      label: t(...payTypeLabels[p]),
      count: employees.data?.filter((e) => e.payType === p).length,
    })),
  ];

  const edit = (e: Employee) => {
    setEditing(e);
    setFormKey((k) => k + 1);
  };
  const add = () => {
    setEditing(null);
    setAdding(true);
    setFormKey((k) => k + 1);
  };
  const closeForm = () => {
    setEditing(null);
    setAdding(false);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setImporting(true)}>
          <Icon.Upload size={16} /> {t("นำเข้าจาก Excel", "Import from Excel")}
        </Button>
        <Button variant="accent" onClick={add}>
          <Icon.Plus size={16} /> {t("เพิ่มพนักงาน", "Add employee")}
        </Button>
      </div>

      <ImportDialog open={importing} onClose={() => setImporting(false)} />

      <EmployeeForm key={formKey} open={adding || editing !== null} employee={editing} onDone={closeForm} />

      {invite && <InviteCard {...invite} onClose={() => setInvite(null)} />}

      <Card>
        <CardContent className="grid gap-3">
          <ChipGroup aria-label={t("กรองตามประเภทค่าจ้าง", "Filter by pay type")} options={filterOptions} value={filter} onChange={setFilter} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ชื่อ", "Name")}</TableHead>
                  <TableHead>{t("สาขา", "Branch")}</TableHead>
                  <TableHead>{t("ค่าจ้าง", "Pay")}</TableHead>
                  <TableHead>LINE</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.title && <span className="text-muted-foreground">{t(...titleLabels[e.title])} </span>}
                      {e.firstName} {e.lastName}
                      {e.nickname && <span className="text-muted-foreground"> ({e.nickname})</span>}
                      {filingIncomplete(e) && (
                        <Badge variant="warning" className="ml-2">
                          {t("ข้อมูลยื่นแบบไม่ครบ", "Filing info missing")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{e.branchName ?? "–"}</TableCell>
                    <TableCell>
                      {t(...payTypeLabels[e.payType])}
                      {e.baseRate > 0 && <span className="text-muted-foreground"> · {e.baseRate.toLocaleString("th-TH")}</span>}
                    </TableCell>
                    <TableCell>
                      {e.lineLinked ? (
                        <Badge variant="success">{t("ผูกแล้ว", "Linked")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("ยังไม่ผูก", "Not linked")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => edit(e)}>
                        {t("แก้ไข", "Edit")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => createInvite.mutate(e)} disabled={createInvite.isPending}>
                        {e.lineLinked ? t("ผูก LINE ใหม่", "Re-link LINE") : t("ส่งลิงก์ผูก LINE", "Send LINE link")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {shown?.length === 0 && <TableEmpty colSpan={5}>{t("ยังไม่มีพนักงาน", "No employees yet")}</TableEmpty>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;

/** ฟอร์มเพิ่ม (employee = null) / แก้ไขพนักงาน */
function EmployeeForm({ open, employee, onDone }: { open: boolean; employee: Employee | null; onDone: () => void }) {
  const { t, lang } = useLang();
  const branches = useBranches();
  const queryClient = useQueryClient();
  const [payType, setPayType] = useState<PayType>(employee?.payType ?? "Piece");
  const [workerType, setWorkerType] = useState(employee?.workerType ?? "Employee");

  const save = useMutation<Employee, ApiError, FormData>({
    mutationFn: (form) =>
      api<Employee>(employee ? `/api/employees/${employee.id}` : "/api/employees", {
        method: employee ? "PUT" : "POST",
        json: {
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          nickname: form.get("nickname"),
          phone: form.get("phone"),
          branchId: form.get("branchId") || null,
          payType: form.get("payType"),
          baseRate: Number(form.get("baseRate") || 0),
          workerType: form.get("workerType"),
          language: form.get("language"),
          title: (form.get("title") || null) as Title | null,
          nationalId: text(form, "nationalId"),
          addressLine: text(form, "addressLine"),
          subdistrict: text(form, "subdistrict"),
          district: text(form, "district"),
          province: text(form, "province"),
          postalCode: text(form, "postalCode"),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.employees });
      onDone();
    },
  });

  const errors = save.error?.fieldErrors;
  const e = employee;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onDone()}
      size="lg"
      title={e ? `${t("แก้ไข", "Edit")} ${e.firstName} ${e.lastName}`.trim() : t("เพิ่มพนักงาน", "Add employee")}
    >
        <form action={(form) => save.mutate(form)} className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <FormError message={errors && Object.keys(errors).length ? null : save.error?.message} />
          </div>
          <TextField label={t("ชื่อ", "First name")} name="firstName" defaultValue={e?.firstName} errors={errors} required />
          <TextField label={t("นามสกุล", "Last name")} name="lastName" defaultValue={e?.lastName} errors={errors} />
          <TextField label={t("ชื่อเล่น", "Nickname")} name="nickname" defaultValue={e?.nickname ?? ""} errors={errors} />
          <TextField label={t("เบอร์โทร", "Phone")} name="phone" type="tel" defaultValue={e?.phone ?? ""} errors={errors} />
          <SelectField label={t("สาขา", "Branch")} name="branchId" defaultValue={e?.branchId ?? ""}>
            <option value="">{t("— ไม่ระบุ —", "— None —")}</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("ภาษาใน LINE และสลิป", "LINE & payslip language")} name="language" defaultValue={e?.language ?? "th"}>
            <option value="th">ไทย</option>
            <option value="en">English</option>
            <option value="my">မြန်မာ ({t("พม่า — สลิปเป็นอังกฤษไปก่อน", "Burmese — payslip in English for now")})</option>
          </SelectField>
          <SelectField label={t("รูปแบบค่าจ้าง", "Pay type")} name="payType" value={payType} onValueChange={(v) => setPayType(v as PayType)}>
            {(Object.keys(payTypeLabels) as PayType[]).map((value) => (
              <option key={value} value={value}>
                {t(...payTypeLabels[value])}
              </option>
            ))}
          </SelectField>
          <TextField
            label={`${t("อัตรา", "Rate")} (${t(...payTypeUnit[payType])})`}
            name="baseRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={e?.baseRate || ""}
            required={payType !== "Piece"}
            errors={errors}
          />
          <SelectField
            label={t("สถานะการจ้าง", "Employment type")}
            name="workerType"
            value={workerType}
            onValueChange={(v) => setWorkerType(v as Employee["workerType"])}
          >
            <option value="Employee">{t("ลูกจ้าง (เข้าประกันสังคม)", "Employee (social security)")}</option>
            <option value="Freelance">{t("ฟรีแลนซ์ / จ้างทำของ", "Freelance / contractor")}</option>
          </SelectField>

          <div className="border-t pt-4 sm:col-span-3">
            <div className="font-medium">{t("ข้อมูลสำหรับยื่น สปส.1-10 และ ภ.ง.ด.1", "For social security and PND 1 filing")}</div>
            <p className="text-xs text-muted-foreground">
              {workerType === "Employee"
                ? t("ไม่บังคับตอนเพิ่ม แต่ต้องมีก่อนออกไฟล์ยื่นแบบ", "Optional now, required before exporting filing files")
                : t("ฟรีแลนซ์ไม่เข้าประกันสังคม — กรอกไว้ใช้ภายหลังได้", "Freelancers are not insured — optional")}
            </p>
          </div>
          <SelectField label={t("คำนำหน้าชื่อ", "Title")} name="title" defaultValue={e?.title ?? ""}>
            <option value="">{t("— เลือก —", "— Select —")}</option>
            {(Object.keys(titleLabels) as Title[]).map((v) => (
              <option key={v} value={v}>
                {t(...titleLabels[v])}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("เลขประจำตัวประชาชน", "National ID")}
            name="nationalId"
            defaultValue={e?.nationalId ?? ""}
            inputMode="numeric"
            maxLength={17}
            placeholder="1-2345-67890-12-3"
            hint={t("= เลขประกันสังคม · แรงงานต่างด้าวใช้เลขที่ สปส. ออกให้", "= social security no. · migrant workers use the SSO-issued number")}
            errors={errors}
          />
          <TextField label={t("บ้านเลขที่ / หมู่ / ถนน", "House no. / street")} name="addressLine" defaultValue={e?.addressLine ?? ""} errors={errors} />
          <TextField label={t("ตำบล / แขวง", "Subdistrict")} name="subdistrict" defaultValue={e?.subdistrict ?? ""} errors={errors} />
          <TextField label={t("อำเภอ / เขต", "District")} name="district" defaultValue={e?.district ?? ""} errors={errors} />
          <SelectField label={t("จังหวัด", "Province")} name="province" defaultValue={e?.province ?? ""}>
            <option value="">{t("— เลือก —", "— Select —")}</option>
            {/* ภ.ง.ด.1 ต้องการชื่อจังหวัดภาษาไทย → ค่าเป็นชื่อไทยเสมอ */}
            {provinces.map((p) => (
              <option key={p.code} value={p.th}>
                {lang === "en" ? `${p.en} (${p.th})` : p.th}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("รหัสไปรษณีย์", "Postal code")}
            name="postalCode"
            defaultValue={e?.postalCode ?? ""}
            inputMode="numeric"
            maxLength={5}
            errors={errors}
          />

          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" variant="accent" loading={save.isPending}>
              {e ? t("บันทึกการแก้ไข", "Save changes") : t("เพิ่มพนักงาน", "Add employee")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              {t("ยกเลิก", "Cancel")}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}

function InviteCard({ employee, invite, onClose }: { employee: Employee; invite: Invite; onClose: () => void }) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState(false);
  // ข้อความที่ส่งให้พนักงานใช้ภาษาที่ตั้งไว้ให้พนักงานคนนั้น ไม่ใช่ภาษาหน้าจอ
  const message =
    employee.language === "en"
      ? `Jangna: open this link in LINE to connect your account to the shop\n${invite.url}`
      : `จ้างนะ: กดลิงก์นี้ใน LINE เพื่อผูกบัญชีกับร้าน\n${invite.url}`;
  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
  };

  return (
    <Card className="border-brand">
      <CardHeader>
        <CardTitle>
          {t("ลิงก์ผูก LINE ของ", "LINE link for")} {employee.firstName}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {t("ส่งลิงก์นี้ให้พนักงานทาง LINE ใช้ได้ครั้งเดียว หมดอายุ", "Send this to the employee on LINE. Single use, expires")}{" "}
          {fmtDateTime(invite.expiresAt, lang)}
        </p>
        <code className="rounded-xl bg-muted px-3 py-2 text-sm break-all">{invite.url}</code>
        <div className="flex gap-2">
          <Button onClick={copy}>{copied ? t("คัดลอกแล้ว", "Copied") : t("คัดลอกข้อความ", "Copy message")}</Button>
          <Button variant="ghost" onClick={onClose}>
            {t("ปิด", "Close")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
