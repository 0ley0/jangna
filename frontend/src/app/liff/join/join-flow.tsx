"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError } from "@/components/field";
import { api, ApiError } from "@/lib/api";

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

  if (!code) return <Message title="ลิงก์ไม่ครบ" body="กรุณาเปิดจากลิงก์ที่ร้านส่งให้ใน LINE" />;
  if (preview.isPending) return <p className="text-center text-muted-foreground">กำลังตรวจลิงก์…</p>;
  if (preview.isError) return <Message title="ใช้ลิงก์นี้ไม่ได้" body={preview.error.message} />;
  if (join.data)
    return (
      <Message
        title="ผูก LINE สำเร็จ 🎉"
        body={`${join.data.employeeName} เชื่อมกับร้าน ${join.data.shopName} แล้ว ต่อไปจะได้รับตารางงานและสลิปเงินเดือนทาง LINE`}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ร้าน {preview.data.shopName} เชิญคุณ</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground">
          สวัสดี {preview.data.employeeName} กดปุ่มด้านล่างเพื่อผูกบัญชี LINE ของคุณกับร้าน ใช้สำหรับลงเวลา ดูตารางงาน และรับสลิปเงินเดือน
        </p>
        <FormError message={join.error?.message} />
        {!LIFF_ID && (
          <Field
            label="(โหมดทดสอบ) ชื่อบัญชี LINE จำลอง"
            name="devName"
            value={devName}
            onChange={(e) => setDevName(e.target.value)}
            placeholder="เช่น somchai"
          />
        )}
        <Button
          size="lg"
          onClick={() => join.mutate()}
          disabled={join.isPending || (!LIFF_ID && !devName.trim())}
        >
          {join.isPending ? "กำลังผูก…" : "ผูกบัญชี LINE"}
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
