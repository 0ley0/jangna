"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, FormError, NativeSelect } from "@/components/field";
import { api, ApiError } from "@/lib/api";
import { keys, useBranches, useEmployees } from "@/lib/queries";
import { payTypeLabels, payTypeUnit, type Employee, type Invite, type PayType } from "@/lib/types";

export default function EmployeesPage() {
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

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">พนักงาน</h1>

      <Card>
        <CardHeader>
          <CardTitle>เพิ่มพนักงาน</CardTitle>
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
            <Field label="ชื่อ" name="firstName" errors={errors} required />
            <Field label="นามสกุล" name="lastName" errors={errors} />
            <Field label="ชื่อเล่น" name="nickname" errors={errors} />
            <Field label="เบอร์โทร" name="phone" type="tel" errors={errors} />
            <NativeSelect label="สาขา" name="branchId" defaultValue="">
              <option value="">— ไม่ระบุ —</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect label="ภาษาใน LINE" name="language" defaultValue="th">
              <option value="th">ไทย</option>
              <option value="en">English</option>
              <option value="my">မြန်မာ (พม่า)</option>
            </NativeSelect>
            <NativeSelect
              label="รูปแบบค่าจ้าง"
              name="payType"
              value={payType}
              onChange={(e) => setPayType(e.target.value as PayType)}
            >
              {Object.entries(payTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <Field
              label={`อัตรา (${payTypeUnit[payType]})`}
              name="baseRate"
              type="number"
              min={0}
              step="0.01"
              required={payType !== "Piece"}
              errors={errors}
            />
            <NativeSelect label="สถานะการจ้าง" name="workerType" defaultValue="Employee">
              <option value="Employee">ลูกจ้าง (เข้าประกันสังคม)</option>
              <option value="Freelance">ฟรีแลนซ์ / จ้างทำของ</option>
            </NativeSelect>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "กำลังบันทึก…" : "เพิ่มพนักงาน"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {invite && <InviteCard {...invite} onClose={() => setInvite(null)} />}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>สาขา</TableHead>
                <TableHead>ค่าจ้าง</TableHead>
                <TableHead>LINE</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.firstName} {e.lastName}
                    {e.nickname && <span className="text-muted-foreground"> ({e.nickname})</span>}
                  </TableCell>
                  <TableCell>{e.branchName ?? "–"}</TableCell>
                  <TableCell>
                    {payTypeLabels[e.payType]}
                    {e.baseRate > 0 && <span className="text-muted-foreground"> · {e.baseRate.toLocaleString("th-TH")}</span>}
                  </TableCell>
                  <TableCell>
                    {e.lineLinked ? <Badge>ผูกแล้ว</Badge> : <Badge variant="outline">ยังไม่ผูก</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createInvite.mutate(e)}
                      disabled={createInvite.isPending}
                    >
                      {e.lineLinked ? "ผูก LINE ใหม่" : "ส่งลิงก์ผูก LINE"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {employees.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    ยังไม่มีพนักงาน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteCard({ employee, invite, onClose }: { employee: Employee; invite: Invite; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `จ้างนะ: กดลิงก์นี้ใน LINE เพื่อผูกบัญชีกับร้าน\n${invite.url}`;
  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>ลิงก์ผูก LINE ของ {employee.firstName}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          ส่งลิงก์นี้ให้พนักงานทาง LINE ใช้ได้ครั้งเดียว หมดอายุ{" "}
          {new Date(invite.expiresAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <code className="break-all rounded-lg bg-muted px-3 py-2 text-sm">{invite.url}</code>
        <div className="flex gap-2">
          <Button onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</Button>
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
