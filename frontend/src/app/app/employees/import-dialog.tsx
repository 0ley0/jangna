"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { keys } from "@/lib/queries";
import type { ImportReport } from "@/lib/types";

/** นำเข้าพนักงานจาก Excel: ดาวน์โหลดแม่แบบ → เลือกไฟล์ (ตรวจให้ทันที) → ยืนยันนำเข้า (ทั้งไฟล์หรือไม่เลย) */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const send = (f: File, dryRun: boolean) => {
    const body = new FormData();
    body.append("file", f);
    return api<ImportReport>(`/api/employees/import?dryRun=${dryRun}`, { method: "POST", body });
  };

  const template = useMutation<void, ApiError>({
    mutationFn: () => downloadFile("/api/employees/import/template", "jangna-employees-template.xlsx"),
  });
  const check = useMutation<ImportReport, ApiError, File>({
    mutationFn: (f) => send(f, true),
  });
  const commit = useMutation<ImportReport, ApiError>({
    mutationFn: () => send(file!, false),
    onSuccess: (report) => {
      if (report.imported > 0) queryClient.invalidateQueries({ queryKey: keys.employees });
    },
  });

  const reset = () => {
    setFile(null);
    check.reset();
    commit.reset();
    if (input.current) input.current.value = "";
  };
  const close = () => {
    reset();
    onClose();
  };

  const done = commit.data && commit.data.imported > 0 ? commit.data : null;
  const report = check.data;
  const bad = report ? report.rows.filter((r) => r.errors.length > 0) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()} size="lg" title={t("นำเข้าพนักงานจาก Excel", "Import employees from Excel")}>
      {done ? (
        <div className="grid gap-4">
          <p className="rounded-xl bg-sage-soft px-3 py-2 text-sm text-sage-ink">
            <Icon.Check size={14} className="mr-1 inline" />
            {t(`นำเข้าพนักงาน ${done.imported} คนเรียบร้อย`, `Imported ${done.imported} employee(s)`)}
          </p>
          <div className="flex justify-end">
            <Button variant="accent" onClick={close}>
              {t("เสร็จสิ้น", "Done")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">{t("1. ดาวน์โหลดแม่แบบ", "1. Download the template")}</h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "กรอกพนักงานคนละแถวตั้งแต่แถว 2 — ดูวิธีกรอกในชีตที่สองของไฟล์",
                "One employee per row from row 2 — see the second sheet for how to fill it in",
              )}
            </p>
            <Button variant="outline" className="justify-self-start" onClick={() => template.mutate()} loading={template.isPending}>
              <Icon.Download size={16} /> {t("ดาวน์โหลดแม่แบบ Excel", "Download Excel template")}
            </Button>
            <FormError message={template.error?.message} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">{t("2. เลือกไฟล์ที่กรอกแล้ว", "2. Choose the filled file")}</h3>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                commit.reset();
                if (f) check.mutate(f);
                else check.reset();
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => input.current?.click()} loading={check.isPending}>
                <Icon.Upload size={16} /> {file ? t("เลือกไฟล์อื่น", "Choose another file") : t("เลือกไฟล์ Excel (.xlsx)", "Choose Excel file (.xlsx)")}
              </Button>
              {file && <span className="min-w-0 truncate text-sm text-muted-foreground">{file.name}</span>}
            </div>
            {check.isPending && <p className="text-sm text-muted-foreground">{t("กำลังตรวจไฟล์…", "Checking the file…")}</p>}
            <FormError message={check.error?.message ?? commit.error?.message} />
          </section>

          {report && (
            <section className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{t("3. ผลการตรวจ", "3. Check result")}</h3>
                <Badge variant="outline">{t(`ทั้งหมด ${report.total} แถว`, `${report.total} rows`)}</Badge>
                <Badge variant="success">{t(`ผ่าน ${report.valid}`, `${report.valid} OK`)}</Badge>
                {bad.length > 0 && <Badge variant="warning">{t(`ต้องแก้ ${bad.length}`, `${bad.length} to fix`)}</Badge>}
              </div>
              {bad.length > 0 ? (
                <>
                  <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber-ink">
                    {t(
                      "มีแถวที่ต้องแก้ — ยังไม่นำเข้าใครเลย แก้ไฟล์ Excel แล้วเลือกไฟล์ใหม่อีกครั้ง",
                      "Some rows need fixing — nobody is imported yet. Fix the Excel file and choose it again",
                    )}
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">{t("แถว", "Row")}</TableHead>
                          <TableHead>{t("ชื่อ", "Name")}</TableHead>
                          <TableHead>{t("ที่ต้องแก้", "Problems")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bad.map((r) => (
                          <TableRow key={r.row}>
                            <TableCell className="tabular">{r.row}</TableCell>
                            <TableCell>{r.name || "–"}</TableCell>
                            <TableCell>
                              <ul className="grid gap-0.5 text-sm text-amber-ink">
                                {r.errors.map((m) => (
                                  <li key={m}>⚠ {m}</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(`พร้อมนำเข้า ${report.valid} คน — ตรวจแล้วไม่พบแถวที่ผิด`, `Ready to import ${report.valid} — no problems found`)}
                </p>
              )}
            </section>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t("ยกเลิก", "Cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={!report || bad.length > 0 || report.valid === 0 || check.isPending}
              loading={commit.isPending}
              onClick={() => commit.mutate()}
            >
              {report && bad.length === 0 ? t(`นำเข้า ${report.valid} คน`, `Import ${report.valid}`) : t("นำเข้า", "Import")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
