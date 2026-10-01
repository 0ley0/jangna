"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, NativeSelect } from "@/components/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { baht, daysInMonth, isoDate, thaiDate, thaiMonth } from "@/lib/format";
import type { PayRunDetail, PayRunSummary } from "@/lib/types";

type Span = "full" | "first" | "second";

export default function PayRunsPage() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${now.getMonth() + 1}`);
  const [span, setSpan] = useState<Span>("full");

  const runs = useQuery({ queryKey: ["pay-runs"], queryFn: () => api<PayRunSummary[]>("/api/pay-runs") });

  const create = useMutation<PayRunDetail, ApiError>({
    mutationFn: () => {
      const [y, m] = month.split("-").map(Number);
      const last = daysInMonth(y, m);
      const [from, to] = span === "first" ? [1, 15] : span === "second" ? [16, last] : [1, last];
      return api("/api/pay-runs", {
        method: "POST",
        json: { periodStart: isoDate(y, m, from), periodEnd: isoDate(y, m, to) },
      });
    },
    onSuccess: (run) => router.push(`/app/pay-runs/${run.summary.id}`),
  });

  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    return { value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: thaiMonth(d.getFullYear(), d.getMonth() + 1) };
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">รอบจ่ายเงิน</h1>

      <Card>
        <CardHeader>
          <CardTitle>สร้างรอบจ่าย</CardTitle>
        </CardHeader>
        <CardContent className="grid items-end gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <FormError message={create.error?.message} />
          </div>
          <NativeSelect label="เดือน" name="month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect label="ช่วง" name="span" value={span} onChange={(e) => setSpan(e.target.value as Span)}>
            <option value="full">ทั้งเดือน</option>
            <option value="first">วันที่ 1–15</option>
            <option value="second">วันที่ 16–สิ้นเดือน</option>
          </NativeSelect>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "กำลังคำนวณ…" : "คำนวณเงินเดือน"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รอบ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">คน</TableHead>
                <TableHead className="text-right">รวมเงินได้</TableHead>
                <TableHead className="text-right">จ่ายสุทธิ</TableHead>
                <TableHead className="text-right">คำเตือน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/app/pay-runs/${r.id}`} className="font-medium hover:underline">
                      {thaiDate(r.periodStart)} – {thaiDate(r.periodEnd)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.status === "Locked" ? <Badge>ปิดรอบแล้ว</Badge> : <Badge variant="outline">ร่าง</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{r.employees}</TableCell>
                  <TableCell className="text-right">{baht(r.gross)}</TableCell>
                  <TableCell className="text-right">{baht(r.net)}</TableCell>
                  <TableCell className="text-right">{r.warnings > 0 ? r.warnings : "–"}</TableCell>
                </TableRow>
              ))}
              {runs.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    ยังไม่มีรอบจ่าย
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
