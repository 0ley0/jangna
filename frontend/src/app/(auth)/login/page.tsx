"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError, setToken } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export default function LoginPage() {
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
        <CardTitle>เข้าสู่ระบบ</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={(form) => login.mutate(form)} className="grid gap-4">
          <FormError message={login.error?.message} />
          <Field label="อีเมล" name="email" type="email" autoComplete="email" required />
          <Field label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" required />
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              สมัครใช้ฟรี
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

