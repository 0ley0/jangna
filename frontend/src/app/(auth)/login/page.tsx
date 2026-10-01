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

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const login = useMutation<AuthResponse, ApiError, FormData>({
    mutationFn: (form) =>
      api<AuthResponse>("/api/auth/login", {
        method: "POST",
        json: { email: form.get("email"), password: form.get("password") },
      }),
    onSuccess: (res) => {
      setToken(res.accessToken);
      router.push("/app");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("เข้าสู่ระบบ", "Log in")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={(form) => login.mutate(form)} className="grid gap-4">
          <FormError message={login.error?.message} />
          <TextField label={t("อีเมล", "Email")} name="email" type="email" autoComplete="email" required />
          <TextField label={t("รหัสผ่าน", "Password")} name="password" type="password" autoComplete="current-password" required />
          <Button type="submit" loading={login.isPending}>
            {login.isPending ? t("กำลังเข้าสู่ระบบ…", "Logging in…") : t("เข้าสู่ระบบ", "Log in")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("ยังไม่มีบัญชี?", "No account yet?")}{" "}
            <Link href="/register" className="text-brand-strong underline-offset-4 hover:underline">
              {t("สมัครใช้ฟรี", "Sign up free")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

