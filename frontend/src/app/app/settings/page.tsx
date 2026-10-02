"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, TextareaField, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { keys, useMe, useShop } from "@/lib/queries";
import type { Shop } from "@/lib/types";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export default function SettingsPage() {
  const { t } = useLang();
  const me = useMe();
  const shop = useShop();
  const queryClient = useQueryClient();
  const isOwner = me.data?.role === "Owner";

  const save = useMutation<Shop, ApiError, FormData>({
    mutationFn: (form) =>
      api<Shop>("/api/shop", {
        method: "PUT",
        json: {
          name: text(form, "name"),
          legalName: text(form, "legalName") || null,
          address: text(form, "address") || null,
          taxId: text(form, "taxId") || null,
          taxBranchNo: text(form, "taxBranchNo") || "000000",
          ssoAccountNo: text(form, "ssoAccountNo") || null,
          ssoBranchNo: text(form, "ssoBranchNo") || "000000",
          rdUserId: text(form, "rdUserId") || null,
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(keys.shop, data);
      queryClient.invalidateQueries({ queryKey: keys.me }); // ชื่อร้านใน sidebar
    },
  });

  if (!shop.data) return <p className="text-muted-foreground">{shop.error?.message ?? t("กำลังโหลด…", "Loading…")}</p>;
  const s = shop.data;
  const errors = save.error?.fieldErrors;

  return (
    <form action={(form) => save.mutate(form)} className="grid max-w-3xl gap-6" key={JSON.stringify(s)}>
      {!isOwner && (
        <p className="text-sm text-muted-foreground">{t("เฉพาะเจ้าของร้านแก้ข้อมูลหน้านี้ได้", "Only the shop owner can edit these settings")}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("ข้อมูลร้าน", "Shop details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("ชื่อร้าน (แสดงในแอป)", "Shop name (shown in the app)")} name="name" defaultValue={s.name} required errors={errors} />
          <TextField
            label={t("ชื่อจดทะเบียน / ชื่อสถานประกอบการ", "Registered / business name")}
            name="legalName"
            defaultValue={s.legalName ?? ""}
            hint={t("พิมพ์บนสลิปและไฟล์ สปส. — ว่างไว้ = ใช้ชื่อร้าน", "Printed on payslips and the SSO file — blank = shop name")}
            errors={errors}
          />
          <TextareaField
            className="sm:col-span-2"
            label={t("ที่อยู่ (พิมพ์บนสลิป)", "Address (printed on payslips)")}
            name="address"
            defaultValue={s.address ?? ""}
            rows={2}
            errors={errors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("ประกันสังคม", "Social security")}
            {s.ssoAccountNo ? <Badge variant="success">{t("พร้อมยื่น", "Ready")}</Badge> : <Badge variant="warning">{t("ยังไม่ครบ", "Incomplete")}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("เลขที่บัญชีนายจ้าง", "Employer account no.")}
            name="ssoAccountNo"
            defaultValue={s.ssoAccountNo ?? ""}
            inputMode="numeric"
            maxLength={10}
            hint={t("10 หลัก ตามหนังสือแจ้งขึ้นทะเบียนนายจ้าง (สปส.1-01)", "10 digits, from your employer registration (SSO 1-01)")}
            errors={errors}
          />
          <TextField
            label={t("ลำดับที่สาขา", "Branch no.")}
            name="ssoBranchNo"
            defaultValue={s.ssoBranchNo}
            inputMode="numeric"
            maxLength={6}
            hint={t("สำนักงานใหญ่ = 000000", "Head office = 000000")}
            errors={errors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("ภาษีหัก ณ ที่จ่าย (ภ.ง.ด.1)", "Withholding tax (PND 1)")}
            {s.taxId ? <Badge variant="success">{t("พร้อมยื่น", "Ready")}</Badge> : <Badge variant="warning">{t("ยังไม่ครบ", "Incomplete")}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("เลขประจำตัวผู้เสียภาษี", "Tax ID")}
            name="taxId"
            defaultValue={s.taxId ?? ""}
            inputMode="numeric"
            maxLength={13}
            hint={t("13 หลัก — ร้านบุคคลธรรมดาใช้เลขบัตรประชาชนเจ้าของ", "13 digits — sole proprietors use the owner's national ID")}
            errors={errors}
          />
          <TextField
            label={t("สาขา", "Branch no.")}
            name="taxBranchNo"
            defaultValue={s.taxBranchNo}
            inputMode="numeric"
            maxLength={6}
            hint={t("ตาม ภ.พ.20 — สำนักงานใหญ่ = 000000", "As on your VAT certificate — head office = 000000")}
            errors={errors}
          />
          <TextField
            label={t("User ID ระบบยื่นแบบออนไลน์ (ไม่บังคับ)", "RD e-Filing user ID (optional)")}
            name="rdUserId"
            defaultValue={s.rdUserId ?? ""}
            hint={t("ใส่แล้วไฟล์จะเป็นแบบยื่นผ่านอินเทอร์เน็ต ว่างไว้ = ยื่นด้วยสื่อ/ฝากไฟล์", "If set, the file is for internet filing; blank = upload/media filing")}
            errors={errors}
          />
        </CardContent>
      </Card>

      <FormError message={errors && Object.keys(errors).length ? null : save.error?.message} />
      {isOwner && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="accent" loading={save.isPending}>
            {t("บันทึก", "Save")}
          </Button>
          {save.isSuccess && <span className="text-sm text-sage-ink">{t("บันทึกแล้ว", "Saved")}</span>}
        </div>
      )}
    </form>
  );
}
