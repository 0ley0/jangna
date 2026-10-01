"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranches, useEmployees, useMe } from "@/lib/queries";

export default function OverviewPage() {
  const me = useMe();
  const branches = useBranches();
  const employees = useEmployees();

  const total = employees.data?.length ?? 0;
  const linked = employees.data?.filter((e) => e.lineLinked).length ?? 0;

  const steps = [
    { done: (branches.data?.length ?? 0) > 0, label: "เพิ่มสาขาแรก (ใช้หาค่าแรงขั้นต่ำและรัศมีลงเวลา)", href: "/app/branches" },
    { done: total > 0, label: "เพิ่มพนักงาน", href: "/app/employees" },
    { done: linked > 0, label: "ส่งลิงก์ให้พนักงานผูก LINE", href: "/app/employees" },
  ];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">สวัสดี {me.data?.displayName}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="สาขา" value={branches.data?.length} />
        <Stat title="พนักงาน" value={employees.data ? total : undefined} />
        <Stat title="ผูก LINE แล้ว" value={employees.data ? `${linked}/${total}` : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เริ่มต้นใช้งาน</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={
                    s.done
                      ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
                      : "flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground"
                  }
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <Link href={s.href} className={s.done ? "text-muted-foreground line-through" : "hover:underline"}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number | string | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-semibold">{value ?? "–"}</CardContent>
    </Card>
  );
}
