"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import { documentTypeLabels, type EmployeeDocument } from "@/lib/types";
import { ExpiryBadge, WARN_DAYS } from "./documents-dialog";

/** เอกสารที่หมดอายุแล้ว/ใกล้หมด (ภายใน 60 วัน) ของพนักงานที่ยังทำงานอยู่ — ไม่มีรายการ = ไม่แสดงการ์ด */
export function ExpiringDocs({ onOpen }: { onOpen: (employee: { id: string; name: string }) => void }) {
  const { t, lang } = useLang();
  const expiring = useQuery({
    queryKey: keys.expiringDocs,
    queryFn: () => api<EmployeeDocument[]>(`/api/employee-documents/expiring?days=${WARN_DAYS}`),
  });
  if (!expiring.data || expiring.data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`เอกสารใกล้หมดอายุ / หมดอายุแล้ว (${expiring.data.length})`, `Documents expiring or expired (${expiring.data.length})`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {expiring.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{d.employeeName}</span>{" "}
                <span className="text-muted-foreground">
                  · {t(...documentTypeLabels[d.type])} · {d.expiresOn && fmtDate(d.expiresOn, lang)}
                </span>
              </span>
              <ExpiryBadge daysLeft={d.daysLeft} />
              <Button variant="outline" size="sm" onClick={() => onOpen({ id: d.employeeId, name: d.employeeName })}>
                {t("จัดการเอกสาร", "Manage")}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
