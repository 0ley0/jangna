"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError, setToken } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

export default function RegisterPage() {
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
        <CardTitle>สมัครใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={(form) => register.mutate(form)} className="grid gap-4">
          {!errors || Object.keys(errors).length === 0 ? <FormError message={register.error?.message} /> : null}
          <Field label="ชื่อร้าน / บริษัท" name="shopName" errors={errors} required />
          <Field label="ชื่อของคุณ" name="displayName" autoComplete="name" errors={errors} required />
          <Field label="อีเมล" name="email" type="email" autoComplete="email" errors={errors} required />
          <Field
            label="รหัสผ่าน (อย่างน้อย 8 ตัว)"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            errors={errors}
            required
          />
          <Button type="submit" disabled={register.isPending}>
            {register.isPending ? "กำลังสร้างร้าน…" : "สร้างร้าน"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
