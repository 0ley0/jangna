"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, FormError, NativeSelect } from "@/components/field";
import { api, ApiError } from "@/lib/api";
import { provinceName, provinces } from "@/lib/provinces";
import { keys, useBranches } from "@/lib/queries";
import type { Branch, MinimumWageRate } from "@/lib/types";

export default function BranchesPage() {
  const branches = useBranches();
  const queryClient = useQueryClient();
  const [province, setProvince] = useState("TH-10");

  const create = useMutation<Branch, ApiError, FormData>({
    mutationFn: (form) =>
      api<Branch>("/api/branches", {
        method: "POST",
        json: {
          name: form.get("name"),
          provinceCode: form.get("provinceCode"),
          areaCode: form.get("areaCode") || null,
          geoLat: form.get("geoLat") ? Number(form.get("geoLat")) : null,
          geoLng: form.get("geoLng") ? Number(form.get("geoLng")) : null,
          geoRadiusMeters: Number(form.get("geoRadiusMeters") || 150),
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.branches }),
  });
  const errors = create.error?.fieldErrors;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">สาขา</h1>

      <Card>
        <CardHeader>
          <CardTitle>เพิ่มสาขา</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(form) => create.mutate(form)}
            className="grid gap-4 sm:grid-cols-2"
            key={create.isSuccess ? create.data.id : "new"}
          >
            <div className="sm:col-span-2">
              <FormError message={errors && Object.keys(errors).length ? null : create.error?.message} />
            </div>
            <Field label="ชื่อสาขา" name="name" placeholder="เช่น โกดังบางนา" errors={errors} required />
            <NativeSelect label="จังหวัด" name="provinceCode" value={province} onChange={(e) => setProvince(e.target.value)}>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            <Field label="ละติจูด (ไม่บังคับ)" name="geoLat" inputMode="decimal" placeholder="13.6600" errors={errors} />
            <Field label="ลองจิจูด (ไม่บังคับ)" name="geoLng" inputMode="decimal" placeholder="100.6000" errors={errors} />
            <Field label="รัศมีลงเวลา (เมตร)" name="geoRadiusMeters" type="number" defaultValue={150} min={20} max={5000} errors={errors} />
            <Field label="รหัสอำเภอที่มีค่าแรงพิเศษ (ไม่บังคับ)" name="areaCode" placeholder="เช่น 9011 = หาดใหญ่" errors={errors} />
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "กำลังบันทึก…" : "เพิ่มสาขา"}
              </Button>
              <MinimumWageHint province={province} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>สาขา</TableHead>
                <TableHead>จังหวัด</TableHead>
                <TableHead>พิกัด</TableHead>
                <TableHead className="text-right">รัศมี</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    {provinceName(b.provinceCode)}
                    {b.areaCode && <span className="text-muted-foreground"> · อ.{b.areaCode}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.geoLat != null ? `${b.geoLat}, ${b.geoLng}` : "ยังไม่ตั้ง"}
                  </TableCell>
                  <TableCell className="text-right">{b.geoRadiusMeters} ม.</TableCell>
                </TableRow>
              ))}
              {branches.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    ยังไม่มีสาขา
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

function MinimumWageHint({ province }: { province: string }) {
  const rate = useQuery({
    queryKey: ["minimum-wage", province],
    queryFn: () => api<MinimumWageRate>(`/api/legal/minimum-wage?province=${province}`),
  });
  if (!rate.data) return null;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      ค่าแรงขั้นต่ำ {rate.data.dailyRate} บาท/วัน
      {!rate.data.verified && <Badge variant="outline">ยังไม่ยืนยันกับประกาศ</Badge>}
    </span>
  );
}
