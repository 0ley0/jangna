"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError, TextField } from "@/components/ui/form-field";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

interface InvitePreview {
  shopName: string;
  employeeName: string;
  expiresAt: string;
}

/**
 * เปิดจาก LINE (liff.line.me/{liffId}/join?code=...) → login LINE → ส่ง ID token ไปผูกกับพนักงาน
 * ถ้าไม่ได้ตั้ง NEXT_PUBLIC_LIFF_ID (dev) จะให้กรอกชื่อแทน และใช้ token "dev:..." ที่ backend dev รับ
 */
async function getLineIdToken(): Promise<string | null> {
  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId: LIFF_ID! });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return null; // กำลัง redirect ไป LINE
  }
  return liff.getIDToken();
}

export function JoinFlow() {
  const { t } = useLang();
  const code = useSearchParams().get("code") ?? "";
  const [devName, setDevName] = useState("");

  const preview = useQuery<InvitePreview, ApiError>({
    queryKey: ["invite", code],
    queryFn: () => api<InvitePreview>(`/api/liff/invites/${encodeURIComponent(code)}`),
    enabled: code.length > 0,
    retry: false,
  });

  const join = useMutation<{ shopName: string; employeeName: string } | null, ApiError>({
    mutationFn: async () => {
      const idToken = LIFF_ID ? await getLineIdToken() : `dev:${devName.trim().toLowerCase()}:${devName.trim()}`;
      if (!idToken) return null;
      return api("/api/liff/join", { method: "POST", json: { code, idToken } });
    },
  });

  if (!code) return <Message title={t("ลิงก์ไม่ครบ", "Incomplete link")} body={t("กรุณาเปิดจากลิงก์ที่ร้านส่งให้ใน LINE", "Please open the link your shop sent you in LINE")} />;
  if (preview.isPending) return <p className="text-center text-muted-foreground">{t("กำลังตรวจลิงก์…", "Checking link…")}</p>;
  if (preview.isError) return <Message title={t("ใช้ลิงก์นี้ไม่ได้", "This link can't be used")} body={preview.error.message} />;
  if (join.data)
    return (
      <Message
        title={t("ผูก LINE สำเร็จ 🎉", "LINE connected 🎉")}
        body={t(
          `${join.data.employeeName} เชื่อมกับร้าน ${join.data.shopName} แล้ว ต่อไปจะได้รับตารางงานและสลิปเงินเดือนทาง LINE`,
          `${join.data.employeeName} is now connected to ${join.data.shopName}. You'll get your schedule and payslips in LINE.`,
        )}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`ร้าน ${preview.data.shopName} เชิญคุณ`, `${preview.data.shopName} invited you`)}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground">
          {t(
            `สวัสดี ${preview.data.employeeName} กดปุ่มด้านล่างเพื่อผูกบัญชี LINE ของคุณกับร้าน ใช้สำหรับลงเวลา ดูตารางงาน และรับสลิปเงินเดือน`,
            `Hi ${preview.data.employeeName}, tap below to connect your LINE account to the shop — for clocking in, viewing your schedule and getting payslips.`,
          )}
        </p>
        <FormError message={join.error?.message} />
        {!LIFF_ID && (
          <TextField
            label={t("(โหมดทดสอบ) ชื่อบัญชี LINE จำลอง", "(Test mode) mock LINE account name")}
            name="devName"
            value={devName}
            onChange={(e) => setDevName(e.target.value)}
            placeholder={t("เช่น somchai", "e.g. somchai")}
          />
        )}
        <Button size="lg" variant="accent" onClick={() => join.mutate()} disabled={join.isPending || (!LIFF_ID && !devName.trim())}>
          {join.isPending ? t("กำลังผูก…", "Connecting…") : t("ผูกบัญชี LINE", "Connect LINE")}
        </Button>
      </CardContent>
    </Card>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
