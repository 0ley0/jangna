"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormError, SelectField, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { provinceName, provinces } from "@/lib/provinces";
import { keys, useBranches } from "@/lib/queries";
import type { Branch, MinimumWageRate } from "@/lib/types";

export default function BranchesPage() {
  const { t, lang } = useLang();
  const branches = useBranches();
  const queryClient = useQueryClient();
  const [province, setProvince] = useState("TH-10");
  const [open, setOpen] = useState(false);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.branches });
      setOpen(false);
    },
  });
  const errors = create.error?.fieldErrors;
  const sorted = [...provinces].sort((a, b) => a[lang].localeCompare(b[lang], lang));

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <Button
          variant="accent"
          onClick={() => {
            create.reset();
            setOpen(true);
          }}
        >
          <Icon.Plus size={16} /> {t("เพิ่มสาขา", "Add branch")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen} title={t("เพิ่มสาขา", "Add branch")}>
        <form action={(form) => create.mutate(form)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormError message={errors && Object.keys(errors).length ? null : create.error?.message} />
          </div>
          <TextField
            label={t("ชื่อสาขา", "Branch name")}
            name="name"
            placeholder={t("เช่น โกดังบางนา", "e.g. Bang Na warehouse")}
            errors={errors}
            required
          />
          <SelectField label={t("จังหวัด", "Province")} name="provinceCode" value={province} onValueChange={setProvince}>
            {sorted.map((p) => (
              <option key={p.code} value={p.code}>
                {p[lang]}
              </option>
            ))}
          </SelectField>
          <TextField label={t("ละติจูด (ไม่บังคับ)", "Latitude (optional)")} name="geoLat" inputMode="decimal" placeholder="13.6600" errors={errors} />
          <TextField label={t("ลองจิจูด (ไม่บังคับ)", "Longitude (optional)")} name="geoLng" inputMode="decimal" placeholder="100.6000" errors={errors} />
          <TextField
            label={t("รัศมีลงเวลา (เมตร)", "Clock-in radius (m)")}
            name="geoRadiusMeters"
            type="number"
            defaultValue={150}
            min={20}
            max={5000}
            errors={errors}
          />
          <TextField
            label={t("รหัสอำเภอที่มีค่าแรงพิเศษ (ไม่บังคับ)", "District code with special wage (optional)")}
            name="areaCode"
            placeholder={t("เช่น 9011 = หาดใหญ่", "e.g. 9011 = Hat Yai")}
            errors={errors}
          />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" loading={create.isPending}>
              {create.isPending ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มสาขา", "Add branch")}
            </Button>
            <MinimumWageHint province={province} />
          </div>
        </form>
      </Dialog>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("สาขา", "Branch")}</TableHead>
                <TableHead>{t("จังหวัด", "Province")}</TableHead>
                <TableHead>{t("พิกัด", "Location")}</TableHead>
                <TableHead className="text-right">{t("รัศมี", "Radius")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    {provinceName(b.provinceCode, lang)}
                    {b.areaCode && (
                      <span className="text-muted-foreground">
                        {" "}· {t("อ.", "District ")}
                        {b.areaCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.geoLat != null ? `${b.geoLat}, ${b.geoLng}` : t("ยังไม่ตั้ง", "Not set")}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.geoRadiusMeters} {t("ม.", "m")}
                  </TableCell>
                </TableRow>
              ))}
              {branches.data?.length === 0 && (
                <TableEmpty colSpan={4}>
                    {t("ยังไม่มีสาขา", "No branches yet")}
                  </TableEmpty>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MinimumWageHint({ province }: { province: string }) {
  const { t } = useLang();
  const rate = useQuery({
    queryKey: ["minimum-wage", province],
    queryFn: () => api<MinimumWageRate>(`/api/legal/minimum-wage?province=${province}`),
  });
  if (!rate.data) return null;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      {t("ค่าแรงขั้นต่ำ", "Minimum wage")} {rate.data.dailyRate} {t("บาท/วัน", "THB/day")}
      {!rate.data.verified && <Badge variant="warning">{t("ยังไม่ยืนยันกับประกาศ", "Not yet verified")}</Badge>}
    </span>
  );
}
