"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError } from "@/lib/api";
import { thaiDate } from "@/lib/format";
import type { Holiday } from "@/lib/types";

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const queryKey = ["holidays", year];
  const holidays = useQuery({ queryKey, queryFn: () => api<Holiday[]>(`/api/holidays?year=${year}`) });

  const add = useMutation<Holiday, ApiError, FormData>({
    mutationFn: (form) => api("/api/holidays", { method: "POST", json: { date: form.get("date"), name: form.get("name") } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => api(`/api/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const count = holidays.data?.length ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">วันหยุดของร้าน</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear(year - 1)}>
            ‹
          </Button>
          <span className="w-16 text-center">{year + 543}</span>
          <Button variant="outline" size="sm" onClick={() => setYear(year + 1)}>
            ›
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เพิ่มวันหยุดตามประเพณี</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            กฎหมายกำหนดให้ประกาศวันหยุดตามประเพณีปีละไม่น้อยกว่า 13 วัน (รวมวันแรงงาน) — ปีนี้มี {count} วัน
            {count < 13 && <span className="text-amber-600"> (ยังไม่ครบ 13)</span>} · ลูกจ้างรายวัน/ต่อชิ้นได้ค่าจ้างวันหยุดเหล่านี้
          </p>
          <form action={(f) => add.mutate(f)} className="grid items-end gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <FormError message={add.error?.message ?? remove.error?.message} />
            </div>
            <Field label="วันที่" name="date" type="date" required />
            <Field label="ชื่อวันหยุด" name="name" placeholder="เช่น วันสงกรานต์" required />
            <Button type="submit" disabled={add.isPending}>
              เพิ่มวันหยุด
            </Button>
          </form>
          <ul className="grid gap-1">
            {holidays.data?.map((h) => (
              <li key={h.id} className="flex items-center justify-between border-b py-1">
                <span>
                  <span className="inline-block w-28 text-muted-foreground">{thaiDate(h.date)}</span>
                  {h.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(h.id)}>
                  ลบ
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
