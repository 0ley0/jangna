"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormError, SelectField, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { keys, useBranches, useEmployees } from "@/lib/queries";
import { payTypeLabels, payTypeUnit, type Employee, type Invite, type PayType } from "@/lib/types";

export default function EmployeesPage() {
  const { t } = useLang();
  const employees = useEmployees();
  const branches = useBranches();
  const queryClient = useQueryClient();
  const [payType, setPayType] = useState<PayType>("Piece");
  const [invite, setInvite] = useState<{ employee: Employee; invite: Invite } | null>(null);

  const create = useMutation<Employee, ApiError, FormData>({
    mutationFn: (form) =>
      api<Employee>("/api/employees", {
        method: "POST",
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
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.employees }),
  });

  const createInvite = useMutation<Invite, ApiError, Employee>({
    mutationFn: (e) => api<Invite>(`/api/employees/${e.id}/invites`, { method: "POST" }),
    onSuccess: (inv, employee) => setInvite({ employee, invite: inv }),
  });

  const errors = create.error?.fieldErrors;
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

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("เพิ่มพนักงาน", "Add employee")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(form) => create.mutate(form)}
            className="grid gap-4 sm:grid-cols-3"
            key={create.isSuccess ? create.data.id : "new"}
          >
            <div className="sm:col-span-3">
              <FormError message={errors && Object.keys(errors).length ? null : create.error?.message} />
            </div>
            <TextField label={t("ชื่อ", "First name")} name="firstName" errors={errors} required />
            <TextField label={t("นามสกุล", "Last name")} name="lastName" errors={errors} />
            <TextField label={t("ชื่อเล่น", "Nickname")} name="nickname" errors={errors} />
            <TextField label={t("เบอร์โทร", "Phone")} name="phone" type="tel" errors={errors} />
            <SelectField label={t("สาขา", "Branch")} name="branchId" defaultValue="">
              <option value="">{t("— ไม่ระบุ —", "— None —")}</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t("ภาษาใน LINE", "LINE language")} name="language" defaultValue="th">
              <option value="th">ไทย</option>
              <option value="en">English</option>
              <option value="my">မြန်မာ ({t("พม่า", "Burmese")})</option>
            </SelectField>
            <SelectField
              label={t("รูปแบบค่าจ้าง", "Pay type")}
              name="payType"
              value={payType}
              onValueChange={(v) => setPayType(v as PayType)}
            >
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
              required={payType !== "Piece"}
              errors={errors}
            />
            <SelectField label={t("สถานะการจ้าง", "Employment type")} name="workerType" defaultValue="Employee">
              <option value="Employee">{t("ลูกจ้าง (เข้าประกันสังคม)", "Employee (social security)")}</option>
              <option value="Freelance">{t("ฟรีแลนซ์ / จ้างทำของ", "Freelance / contractor")}</option>
            </SelectField>
            <div className="sm:col-span-3">
              <Button type="submit" loading={create.isPending}>
                {create.isPending ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มพนักงาน", "Add employee")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {invite && <InviteCard {...invite} onClose={() => setInvite(null)} />}

      <Card>
        <CardContent className="grid gap-3">
          <ChipGroup aria-label={t("กรองตามประเภทค่าจ้าง", "Filter by pay type")} options={filterOptions} value={filter} onChange={setFilter} />
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
                    {e.firstName} {e.lastName}
                    {e.nickname && <span className="text-muted-foreground"> ({e.nickname})</span>}
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
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => createInvite.mutate(e)} disabled={createInvite.isPending}>
                      {e.lineLinked ? t("ผูก LINE ใหม่", "Re-link LINE") : t("ส่งลิงก์ผูก LINE", "Send LINE link")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {shown?.length === 0 && (
                <TableEmpty colSpan={5}>
                    {t("ยังไม่มีพนักงาน", "No employees yet")}
                  </TableEmpty>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
