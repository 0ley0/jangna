"use client";

/**
 * หน้ารวม component (dev reference) — http://localhost:3000/ui
 * เพิ่ม component ใหม่ใน components/ui แล้วใส่ตัวอย่างไว้ที่นี่ด้วย
 */

import { useState } from "react";
import { Calendar, DateField, DateRangeField, todayIso, type DateRange } from "@/components/date-picker";
import { Avatar, avatarColors, BrandMark, Icon } from "@/components/icons";
import { LangToggle } from "@/components/lang-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { FormError, SelectField, TextareaField, TextField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/lib/i18n";
import { provinces } from "@/lib/provinces";

function Section({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2">
          {title}
          <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-ink-2">{code}</code>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap items-center gap-2">{children}</div>;

export default function UiPage() {
  const { t, lang } = useLang();
  const [province, setProvince] = useState("TH-10");
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState(["ค่ารถ", "ค่าอาหาร", "เบี้ยขยัน"]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(true);
  const [date, setDate] = useState<string | null>(todayIso());
  const [range, setRange] = useState<DateRange | null>(null);

  const pulse = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <BrandMark size={36} />
        <div className="flex-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.015em]">{t("ชุด component", "Components")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("ธีม Hearth · ฟอนต์ Noto Sans Thai · ไฟล์อยู่ใน", "Hearth theme · Noto Sans Thai · files in")} <code>src/components/ui</code>
          </p>
        </div>
        <LangToggle />
      </header>

      <Section title={t("ปุ่ม", "Button")} code="components/ui/button">
        <Row>
          <Button>{t("หลัก (หมึก)", "Default (ink)")}</Button>
          <Button variant="accent">{t("เน้น (เทอร์ราคอตต้า)", "Accent")}</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">{t("ลบ", "Delete")}</Button>
          <Button variant="link">Link</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button variant="accent">
            <Icon.Plus size={15} /> {t("มีไอคอน", "With icon")}
          </Button>
          <Button variant="outline" size="icon" aria-label="settings">
            <Icon.Bell size={16} />
          </Button>
          <Button loading={loading} onClick={pulse}>
            {loading ? t("กำลังบันทึก…", "Saving…") : t("กดเพื่อดู loading", "Click for loading")}
          </Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title={t("ช่องกรอก", "Text field")} code="TextField, TextareaField — components/ui/form-field">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("ชื่อ", "Name")} name="demo-name" placeholder={t("เช่น สมชาย", "e.g. Somchai")} required />
          <TextField label={t("เบอร์โทร", "Phone")} name="demo-phone" type="tel" hint={t("ไม่บังคับ", "Optional")} />
          <TextField label={t("อัตรา", "Rate")} name="demo-rate" type="number" defaultValue={-5} error={t("ค่าจ้างติดลบไม่ได้", "Pay cannot be negative")} />
          <TextField label={t("ปิดใช้งาน", "Disabled")} name="demo-disabled" defaultValue="—" disabled />
          <TextareaField className="sm:col-span-2" label={t("หมายเหตุ", "Note")} name="demo-note" hint={t("ยาวได้หลายบรรทัด", "Multi-line")} />
        </div>
        <FormError message={t("FormError — error รวมของฟอร์ม", "FormError — form-level error")} />
      </Section>

      <Section title="Select" code="Select, SelectField — components/ui/select (popover แบบ DatePicker)">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label={t("ประเภทค่าจ้าง", "Pay type")} name="demo-pay" defaultValue="Daily">
            <option value="Monthly">{t("รายเดือน", "Monthly")}</option>
            <option value="Daily">{t("รายวัน", "Daily")}</option>
            <option value="Piece">{t("ต่อชิ้น", "Per piece")}</option>
          </SelectField>
          <SelectField label={t("มี error", "With error")} name="demo-branch" error={t("ไม่พบสาขา", "Branch not found")}>
            <option>—</option>
          </SelectField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t("ขนาดเล็ก (ในตาราง)", "Small (in tables)")}</span>
            <Select size="sm" defaultValue="Workday">
              <option value="Workday">{t("วันทำงาน", "Workday")}</option>
              <option value="Holiday">{t("วันหยุด", "Holiday")}</option>
            </Select>
          </div>
          <SelectField
            label={t("ค้นหาได้ (เกิน 8 รายการ)", "Searchable (8+ options)")}
            name="demo-province"
            value={province}
            onValueChange={setProvince}
            options={provinces.map((p) => ({ value: p.code, label: p[lang], hint: p.code.replace("TH-", "") }))}
          />
          <SelectField
            label={t("มี hint + ตัวที่เลือกไม่ได้", "Hints + disabled option")}
            name="demo-status"
            defaultValue="draft"
            options={[
              { value: "draft", label: t("ร่าง", "Draft"), hint: 3 },
              { value: "locked", label: t("ปิดรอบแล้ว", "Locked"), hint: 12 },
              { value: "paid", label: t("จ่ายแล้ว (เร็วๆ นี้)", "Paid (soon)"), disabled: true },
            ]}
          />
          <SelectField label={t("ปิดใช้งาน", "Disabled")} name="demo-select-disabled" disabled>
            <option>—</option>
          </SelectField>
        </div>
      </Section>

      <Section title={t("วันที่", "Date picker")} code="DateField, DateRangeField, Calendar — components/date-picker">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label={t("วันที่", "Date")} value={date} onChange={setDate} required />
          <DateRangeField
            label={t("ช่วงวันที่", "Date range")}
            value={range}
            onChange={setRange}
            presets={[{ label: t("7 วันล่าสุด", "Last 7 days"), get: () => ({ start: offset(-6), end: todayIso() }) }]}
          />
        </div>
        <Calendar value={date} onSelect={setDate} marked={[offset(2), offset(5)]} size="mini" footer={false} />
      </Section>

      <Section title="Chip" code="Chip, ChipGroup — components/ui/chip">
        <Row>
          <Chip>Neutral</Chip>
          <Chip tone="brand">{t("งาน", "Work")}</Chip>
          <Chip tone="sage">{t("ผูกแล้ว", "Linked")}</Chip>
          <Chip tone="amber">{t("รอตรวจ", "Pending")}</Chip>
          <Chip tone="plum">{t("ส่วนตัว", "Personal")}</Chip>
          <Chip tone="blue">LINE</Chip>
          <Chip>
            <Icon.Clock /> 45 {t("นาที", "min")}
          </Chip>
        </Row>
        <Row>
          <Chip selected={selected} onClick={() => setSelected((s) => !s)}>
            {selected && <Icon.Check />} {t("กดสลับได้", "Toggle me")}
          </Chip>
          {tags.map((tag) => (
            <Chip key={tag} tone="brand" onRemove={() => setTags((ts) => ts.filter((x) => x !== tag))} removeLabel={t("ลบ", "Remove")}>
              {tag}
            </Chip>
          ))}
        </Row>
        <ChipGroup
          aria-label="filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("ทั้งหมด", "All"), count: 12 },
            { value: "daily", label: t("รายวัน", "Daily"), count: 5 },
            { value: "piece", label: t("ต่อชิ้น", "Per piece"), count: 7 },
          ]}
        />
      </Section>

      <Section title="Badge" code="components/ui/badge">
        <Row>
          <Badge>Default</Badge>
          <Badge variant="success">{t("ปิดรอบแล้ว", "Locked")}</Badge>
          <Badge variant="warning">{t("ยังไม่ยืนยัน", "Unverified")}</Badge>
          <Badge variant="outline">{t("ร่าง", "Draft")}</Badge>
          <Badge variant="destructive">Error</Badge>
        </Row>
      </Section>

      <Section title={t("ตาราง", "Table")} code="Table, TableEmpty — components/ui/table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("พนักงาน", "Employee")}</TableHead>
              <TableHead>{t("สถานะ", "Status")}</TableHead>
              <TableHead className="text-right">{t("สุทธิ", "Net")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <Avatar name="สม" color={avatarColors[0]} size={26} /> สมชาย
                </span>
              </TableCell>
              <TableCell>
                <Chip tone="sage">{t("ผูกแล้ว", "Linked")}</Chip>
              </TableCell>
              <TableCell className="text-right tabular">817.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <Avatar name="AU" color={avatarColors[1]} size={26} /> Aung
                </span>
              </TableCell>
              <TableCell>
                <Chip>{t("ยังไม่ผูก", "Not linked")}</Chip>
              </TableCell>
              <TableCell className="text-right tabular">2,783.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Table>
          <TableBody>
            <TableEmpty colSpan={3}>{t("TableEmpty — ยังไม่มีข้อมูล", "TableEmpty — nothing here yet")}</TableEmpty>
          </TableBody>
        </Table>
      </Section>

      <Section title={t("การ์ด", "Cards")} code="Card · .card-warm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-warm p-5">
            <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">card-warm</div>
            <div className="mt-1 text-2xl font-bold">{t("แถบต้อนรับ / สรุป", "Welcome / summary")}</div>
          </div>
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                <Icon.Users size={16} />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">{t("พนักงาน", "Employees")}</div>
                <div className="text-2xl font-bold tabular">12</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title={t("ไอคอน", "Icons")} code="components/icons">
        <Row>
          {(Object.keys(Icon) as (keyof typeof Icon)[]).map((name) => {
            const I = Icon[name];
            return (
              <span key={name} title={name} className="flex flex-col items-center gap-1 rounded-xl border bg-surface px-2.5 py-2 text-[10px] text-muted-foreground">
                <I size={18} className="text-foreground" />
                {name}
              </span>
            );
          })}
        </Row>
      </Section>
    </main>
  );
}

function offset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
