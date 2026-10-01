"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { baht, thaiDate } from "@/lib/format";
import { useMe } from "@/lib/queries";
import { payTypeLabels, type PayRunDetail } from "@/lib/types";

export default function PayRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const queryKey = ["pay-run", id];
  const [open, setOpen] = useState<string | null>(null);

  const run = useQuery({ queryKey, queryFn: () => api<PayRunDetail>(`/api/pay-runs/${id}`) });

  const onDone = (data: PayRunDetail) => {
    queryClient.setQueryData(queryKey, data);
    queryClient.invalidateQueries({ queryKey: ["pay-runs"] });
  };
  const recalc = useMutation<PayRunDetail, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}/recalculate`, { method: "POST" }),
    onSuccess: onDone,
  });
  const lock = useMutation<PayRunDetail, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}/lock`, { method: "POST" }),
    onSuccess: onDone,
    // ข้อมูลเปลี่ยนระหว่างนั้น → backend คำนวณใหม่ให้แล้ว ดึงมาแสดง
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });
  const remove = useMutation<void, ApiError>({
    mutationFn: () => api(`/api/pay-runs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-runs"] });
      router.push("/app/pay-runs");
    },
  });

  if (!run.data) return <p className="text-muted-foreground">{run.error?.message ?? "กำลังโหลด…"}</p>;
  const { summary, items } = run.data;
  const draft = summary.status === "Draft";
  const totals = items.reduce(
    (t, i) => ({
      sso: t.sso + i.socialSecurityEmployee,
      ssoEmployer: t.ssoEmployer + i.socialSecurityEmployer,
      wht: t.wht + i.withholdingTax,
      advance: t.advance + i.advanceDeducted,
    }),
    { sso: 0, ssoEmployer: 0, wht: 0, advance: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          รอบ {thaiDate(summary.periodStart)} – {thaiDate(summary.periodEnd)}
        </h1>
        {draft ? <Badge variant="outline">ร่าง</Badge> : <Badge>ปิดรอบแล้ว</Badge>}
        {draft && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
              คำนวณใหม่
            </Button>
            <Button variant="ghost" onClick={() => confirm("ลบรอบร่างนี้?") && remove.mutate()}>
              ลบ
            </Button>
            {me.data?.role === "Owner" && (
              <Button
                onClick={() => confirm("ปิดรอบแล้วจะแก้ข้อมูลในช่วงวันนี้ไม่ได้อีก ยืนยัน?") && lock.mutate()}
                disabled={lock.isPending || items.length === 0}
              >
                ปิดรอบ
              </Button>
            )}
          </div>
        )}
      </div>

      <FormError message={recalc.error?.message ?? lock.error?.message ?? remove.error?.message} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="รวมเงินได้" value={baht(summary.gross)} />
        <Stat label="จ่ายสุทธิ" value={baht(summary.net)} />
        <Stat label="ประกันสังคม (ลูกจ้าง + นายจ้าง)" value={baht(totals.sso + totals.ssoEmployer)} />
        <Stat label="ภาษีหัก ณ ที่จ่าย" value={baht(totals.wht)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            คำนวณเมื่อ {new Date(summary.calculatedAt).toLocaleString("th-TH")} · ใช้กฎหมายชุดวันที่ {thaiDate(run.data.ruleSetEffectiveFrom)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>พนักงาน</TableHead>
                <TableHead className="text-right">เงินได้</TableHead>
                <TableHead className="text-right">สปส.</TableHead>
                <TableHead className="text-right">ภาษี</TableHead>
                <TableHead className="text-right">หักเบิก</TableHead>
                <TableHead className="text-right">สุทธิ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <Fragment key={i.id}>
                  <TableRow className="cursor-pointer" onClick={() => setOpen(open === i.id ? null : i.id)}>
                    <TableCell>
                      <span className="font-medium">{i.employeeName}</span>
                      <span className="text-muted-foreground">
                        {" "}· {payTypeLabels[i.payType]}
                        {i.isFreelance && " · ฟรีแลนซ์"}
                      </span>
                      {i.warnings.length > 0 && (
                        <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                          ⚠ {i.warnings.length}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{baht(i.gross)}</TableCell>
                    <TableCell className="text-right">{baht(i.socialSecurityEmployee)}</TableCell>
                    <TableCell className="text-right">{baht(i.withholdingTax)}</TableCell>
                    <TableCell className="text-right">{baht(i.advanceDeducted)}</TableCell>
                    <TableCell className="text-right font-medium">{baht(i.net)}</TableCell>
                  </TableRow>
                  {open === i.id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6}>
                        <div className="grid gap-3 py-2 sm:grid-cols-2">
                          <ul className="grid gap-1 text-sm">
                            {i.lines.map((l, n) => (
                              <li key={n} className="flex justify-between gap-4">
                                <span>{l.description}</span>
                                <span className={l.kind === "Deduction" ? "text-destructive" : ""}>
                                  {l.kind === "Deduction" ? "−" : ""}
                                  {baht(l.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {i.warnings.length > 0 && (
                            <ul className="grid gap-1 text-sm text-amber-700 dark:text-amber-400">
                              {i.warnings.map((w) => (
                                <li key={w}>⚠ {w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    ไม่มีพนักงานที่ต้องจ่ายในรอบนี้ — บันทึกวันทำงาน/ผลงานก่อน แล้วกดคำนวณใหม่
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
