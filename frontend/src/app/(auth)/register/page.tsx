"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError, setToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { AuthResponse } from "@/lib/types";

export default function RegisterPage() {
  const { t } = useLang();
  const router = useRouter();
  const register = useMutation<AuthResponse, ApiError, FormData>({
    mutationFn: (form) =>
      api<AuthResponse>("/api/auth/register", {
        method: "POST",
        json: {
          shopName: form.get("shopName"),
          displayName: form.get("displayName"),
          email: form.get("email"),
          password: form.get("password"),
        },
      }),
    onSuccess: (res) => {
      setToken(res.accessToken);
      router.push("/app");
    },
  });
  const errors = register.error?.fieldErrors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("สมัครใช้งาน", "Create your shop")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={(form) => register.mutate(form)} className="grid gap-4">
          {!errors || Object.keys(errors).length === 0 ? <FormError message={register.error?.message} /> : null}
          <TextField label={t("ชื่อร้าน / บริษัท", "Shop / company name")} name="shopName" errors={errors} required />
          <TextField label={t("ชื่อของคุณ", "Your name")} name="displayName" autoComplete="name" errors={errors} required />
          <TextField label={t("อีเมล", "Email")} name="email" type="email" autoComplete="email" errors={errors} required />
          <TextField
            label={t("รหัสผ่าน (อย่างน้อย 8 ตัว)", "Password (at least 8 characters)")}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            errors={errors}
            required
          />
          <Button type="submit" loading={register.isPending}>
            {register.isPending ? t("กำลังสร้างร้าน…", "Creating…") : t("สร้างร้าน", "Create shop")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("มีบัญชีแล้ว?", "Already have an account?")}{" "}
            <Link href="/login" className="text-brand-strong underline-offset-4 hover:underline">
              {t("เข้าสู่ระบบ", "Log in")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
