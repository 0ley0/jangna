"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/field";
import { thaiMonth } from "@/lib/format";
import { useEmployees } from "@/lib/queries";
import { payTypeLabels } from "@/lib/types";
import { AdvancePanel } from "./advance-panel";
import { DayTable } from "./day-table";
import { OpeningBalancePanel } from "./opening-balance-panel";
import { PieceWorkPanel } from "./piece-work-panel";

export default function WorkPage() {
  const employees = useEmployees();
  const now = new Date();
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(`${now.getFullYear()}-${now.getMonth() + 1}`);
  const [year, monthNumber] = month.split("-").map(Number);

  const employee = employees.data?.find((e) => e.id === employeeId) ?? employees.data?.[0];
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    return { value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: thaiMonth(d.getFullYear(), d.getMonth() + 1) };
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">บันทึกงาน</h1>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NativeSelect label="พนักงาน" name="employee" value={employee?.id ?? ""} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} · {payTypeLabels[e.payType]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect label="เดือน" name="month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </CardContent>
      </Card>

      {employees.data?.length === 0 && <p className="text-muted-foreground">ยังไม่มีพนักงาน — เพิ่มที่หน้าพนักงานก่อน</p>}

      {employee && (
        // key: เปลี่ยนคน/เดือนแล้วล้างค่าที่แก้ค้างไว้
        <div key={`${employee.id}-${month}`} className="grid gap-6">
          <DayTable employee={employee} year={year} month={monthNumber} />
          {employee.payType === "Piece" && <PieceWorkPanel employee={employee} year={year} month={monthNumber} />}
          <AdvancePanel employee={employee} />
          <OpeningBalancePanel employee={employee} year={year} />
        </div>
      )}
    </div>
  );
}
