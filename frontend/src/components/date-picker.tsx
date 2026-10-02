"use client";

/**
 * DatePicker ตามดีไซน์ Hearth (powerd_bese_desinge/DatePicker-standalone-src.html) — สองภาษา ไทย (พ.ศ.) / อังกฤษ (ค.ศ.)
 * - Calendar: ปฏิทินเดือนเดียว เจาะดูเดือน/ปีได้, วันนี้, วันที่เลือก, จุดบอกวันสำคัญ (marked), จำกัด min/max
 * - DateField: ช่องกรอกในฟอร์ม + popover — ส่งค่าเป็น yyyy-mm-dd ผ่าน FormData (name) ได้เลย
 * - DateRangeField: เลือกช่วงวันที่ 2 เดือน + ปุ่มลัด (presets) — ใช้กับรอบจ่าย
 * ค่าวันที่ทั้งหมดเป็น ISO "yyyy-mm-dd" (ตรงกับ DateOnly ฝั่ง API) ไม่ใช้ Date เพื่อเลี่ยงปัญหา timezone
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAMES = {
  th: {
    months: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
    monthsShort: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
    weekdays: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
    weekdaysFull: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"],
    yearOffset: 543,
  },
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdays: ["S", "M", "T", "W", "T", "F", "S"],
    weekdaysFull: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    yearOffset: 0,
  },
} as const;

export const monthsShort = (lang: Lang) => NAMES[lang].monthsShort;

// ---------- วันที่แบบ ISO (ไม่ผูก timezone) ----------

const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0-11
const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
};
export const todayIso = () => {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth(), n.getDate());
};
const weekdayOf = (iso: string) => {
  const { y, m, d } = parts(iso);
  return new Date(y, m, d).getDay();
};
export const addDaysIso = (iso: string, n: number) => {
  const { y, m, d } = parts(iso);
  const x = new Date(y, m, d + n);
  return toIso(x.getFullYear(), x.getMonth(), x.getDate());
};
const daysBetween = (a: string, b: string) => {
  const pa = parts(a), pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m, pb.d) - Date.UTC(pa.y, pa.m, pa.d)) / 86_400_000);
};

/** "5 ต.ค. 2569" / "Oct 5, 2026" */
export const fmtShort = (iso: string, lang: Lang) => {
  const { y, m, d } = parts(iso);
  const n = NAMES[lang];
  return lang === "en" ? `${n.monthsShort[m]} ${d}, ${y}` : `${d} ${n.monthsShort[m]} ${y + n.yearOffset}`;
};
/** "จันทร์ 5 ต.ค. 2569" / "Mon, Oct 5, 2026" */
export const fmtLong = (iso: string, lang: Lang) =>
  lang === "en"
    ? `${NAMES.en.weekdaysFull[weekdayOf(iso)]}, ${fmtShort(iso, lang)}`
    : `${NAMES.th.weekdaysFull[weekdayOf(iso)]} ${fmtShort(iso, lang)}`;

function monthGrid(y: number, m: number) {
  const startOffset = new Date(y, m, 1).getDay();
  const first = toIso(y, m, 1);
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDaysIso(first, i - startOffset);
    return { iso, inMonth: parts(iso).m === m, day: parts(iso).d };
  });
}

const outside = (iso: string, min?: string, max?: string) => (min && iso < min) || (max && iso > max);

// ---------- ชิ้นส่วนร่วม ----------

const iconBtn =
  "inline-flex size-[30px] items-center justify-center rounded-[10px] text-ink-2 transition hover:bg-muted hover:text-foreground active:scale-95";
const smallGhost = "rounded-lg px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:bg-muted hover:text-foreground";
const smallAccent =
  "rounded-[9px] bg-brand-action px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand transition hover:bg-brand-action-hover disabled:opacity-50";

function Weekdays({ lang }: { lang: Lang }) {
  return (
    <div className="grid grid-cols-7 px-0.5 pb-1">
      {NAMES[lang].weekdays.map((w, i) => (
        <div key={i} className={cn("py-1.5 text-center text-[11px] font-medium text-muted-foreground", i === 0 && "text-brand-strong/80")}>
          {w}
        </div>
      ))}
    </div>
  );
}

// ---------- Calendar ----------

export interface CalendarProps {
  value?: string | null;
  onSelect?: (iso: string) => void;
  min?: string;
  max?: string;
  /** วันที่ที่มีจุดบอก เช่น วันหยุดร้าน */
  marked?: Iterable<string>;
  footer?: boolean;
  size?: "normal" | "mini";
  className?: string;
}

export function Calendar({ value, onSelect, min, max, marked, footer = true, size = "normal", className }: CalendarProps) {
  const { lang, t } = useLang();
  const names = NAMES[lang];
  const today = todayIso();
  const initial = parts(value ?? (max && today > max ? max : min && today < min ? min : today));
  const [view, setView] = useState({ y: initial.y, m: initial.m });
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const markedSet = useMemo(() => new Set(marked ?? []), [marked]);
  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const year = (y: number) => y + names.yearOffset;

  const shift = (dir: -1 | 1) =>
    setView((v) =>
      mode === "days"
        ? { y: v.m + dir < 0 ? v.y - 1 : v.m + dir > 11 ? v.y + 1 : v.y, m: (v.m + dir + 12) % 12 }
        : { y: v.y + dir * (mode === "months" ? 1 : 12), m: v.m },
    );

  const mini = size === "mini";
  const tp = parts(today);

  return (
    <div
      className={cn(
        "rounded-[18px] border bg-surface text-foreground shadow-pop",
        mini ? "w-[260px] p-3" : "w-[320px] max-w-[calc(100vw-2rem)] p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-sm font-semibold transition hover:bg-muted"
          onClick={() => setMode(mode === "days" ? "months" : mode === "months" ? "years" : "days")}
        >
          {mode === "days" && (
            <>
              {names.months[view.m]} <span className="font-normal text-muted-foreground tabular">{year(view.y)}</span>
            </>
          )}
          {mode === "months" && <span className="tabular">{year(view.y)}</span>}
          {mode === "years" && <span className="tabular">{year(view.y - 6)} – {year(view.y + 5)}</span>}
          <Icon.ChevronDown size={14} />
        </button>
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} onClick={() => shift(-1)} aria-label={t("ก่อนหน้า", "Previous")}>
            <Icon.ChevronLeft size={16} />
          </button>
          <button type="button" className={iconBtn} onClick={() => shift(1)} aria-label={t("ถัดไป", "Next")}>
            <Icon.Chevron size={16} />
          </button>
        </div>
      </div>

      {mode === "days" && (
        <>
          <Weekdays lang={lang} />
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(({ iso, inMonth, day }) => {
              const disabled = outside(iso, min, max);
              const selected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!!disabled}
                  onClick={() => onSelect?.(iso)}
                  className={cn(
                    "relative flex aspect-square items-center justify-center border border-transparent tabular transition",
                    mini ? "rounded-lg text-xs" : "rounded-[10px] text-[13px]",
                    "hover:bg-muted",
                    !inMonth && "text-muted-foreground/55",
                    iso === today && !selected && "border-brand font-semibold text-brand-strong",
                    selected && "border-primary bg-primary font-semibold text-primary-foreground shadow-ink hover:bg-primary/90",
                    disabled && "cursor-not-allowed text-muted-foreground/35 hover:bg-transparent",
                  )}
                >
                  {day}
                  {markedSet.has(iso) && (
                    <span
                      className={cn(
                        "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                        selected ? "bg-background" : "bg-brand",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "months" && (
        <div className="grid grid-cols-3 gap-1.5 px-0.5 py-1.5">
          {names.monthsShort.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setView({ y: view.y, m: i });
                setMode("days");
              }}
              className={cn(
                "rounded-[10px] border border-transparent py-3 text-[13px] text-ink-2 transition hover:bg-muted hover:text-foreground",
                i === tp.m && view.y === tp.y && "border-brand font-semibold text-brand-strong",
                i === view.m && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "years" && (
        <div className="grid grid-cols-3 gap-1.5 px-0.5 py-1.5">
          {Array.from({ length: 12 }, (_, i) => view.y - 6 + i).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setView({ y, m: view.m });
                setMode("months");
              }}
              className={cn(
                "rounded-[10px] border border-transparent py-3 text-[13px] text-ink-2 tabular transition hover:bg-muted hover:text-foreground",
                y === tp.y && "border-brand font-semibold text-brand-strong",
                y === view.y && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
              )}
            >
              {year(y)}
            </button>
          ))}
        </div>
      )}

      {footer && (
        <div className="mt-3.5 flex items-center justify-between border-t border-dashed pt-3">
          <div className="text-xs text-muted-foreground">
            {value ? (
              <>
                {t("เลือก", "Selected")} · <b className="font-semibold text-foreground">{fmtShort(value, lang)}</b>
              </>
            ) : (
              t("ยังไม่ได้เลือก", "No date selected")
            )}
          </div>
          <button
            type="button"
            className={smallGhost}
            disabled={!!outside(today, min, max)}
            onClick={() => {
              setView({ y: tp.y, m: tp.m });
              setMode("days");
              onSelect?.(today);
            }}
          >
            {t("วันนี้", "Today")}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Popover ----------

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const fieldButton = (open: boolean) =>
  cn(
    "flex h-9 w-full items-center gap-2.5 rounded-xl border bg-surface px-3 text-left text-sm transition-[border-color,box-shadow,background] duration-200 hover:bg-[#fbf4e5] dark:hover:bg-muted",
    open && "border-brand ring-4 ring-brand/12",
  );

// ---------- DateField ----------

export interface DateFieldProps {
  name?: string;
  label?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (iso: string | null) => void;
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  marked?: Iterable<string>;
  errors?: Record<string, string[]>;
}

export function DateField({ name, label, value, defaultValue, onChange, min, max, required, placeholder, marked, errors }: DateFieldProps) {
  const { lang, t } = useLang();
  const id = useId();
  const { open, setOpen, ref } = usePopover();
  const [inner, setInner] = useState<string | null>(defaultValue ?? null);
  const current = value !== undefined ? value : inner;
  const error = name ? errors?.[name]?.[0] : undefined;

  const select = (iso: string) => {
    if (value === undefined) setInner(iso);
    onChange?.(iso);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative grid gap-1.5">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-brand" aria-hidden>*</span>}
        </Label>
      )}
      <button id={id} type="button" className={fieldButton(open)} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon.Cal size={16} className="text-muted-foreground" />
        <span className={cn("flex-1 truncate", !current && "text-muted-foreground")}>
          {current ? fmtLong(current, lang) : (placeholder ?? t("เลือกวันที่", "Pick a date"))}
        </span>
        <Icon.ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {/* ส่งค่าไปกับ <form> + ให้ browser ตรวจ required ได้ (hidden input ตรวจ required ไม่ได้) */}
      {name && (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={current ?? ""}
          required={required}
          onChange={() => {}}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 origin-top-left animate-pop-in">
          <Calendar value={current} onSelect={select} min={min} max={max} marked={marked} />
        </div>
      )}
    </div>
  );
}

// ---------- DateRangeField ----------

export interface DateRange {
  start: string;
  end: string;
}

export interface RangePreset {
  label: string;
  get: () => DateRange;
}

export function DateRangeField({
  label,
  value,
  onChange,
  presets = [],
  placeholder,
}: {
  label?: string;
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  presets?: RangePreset[];
  placeholder?: string;
}) {
  const { lang, t } = useLang();
  const names = NAMES[lang];
  const id = useId();
  const { open, setOpen, ref } = usePopover();
  const [draft, setDraft] = useState<{ start: string | null; end: string | null }>({ start: value?.start ?? null, end: value?.end ?? null });
  const [hover, setHover] = useState<string | null>(null);
  const base = parts(draft.start ?? value?.start ?? todayIso());
  const [view, setView] = useState({ y: base.y, m: base.m });
  const today = todayIso();

  const openPicker = () => {
    setDraft({ start: value?.start ?? null, end: value?.end ?? null });
    setOpen((o) => !o);
  };

  const click = (iso: string) => {
    if (!draft.start || draft.end) setDraft({ start: iso, end: null });
    else if (iso < draft.start) setDraft({ start: iso, end: draft.start });
    else setDraft({ start: draft.start, end: iso });
  };

  const month = (offset: 0 | 1) => {
    const y = view.m + offset > 11 ? view.y + 1 : view.y;
    const m = (view.m + offset) % 12;
    const { start, end } = draft;
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between px-1 pb-2">
          {offset === 0 ? (
            <button type="button" className={iconBtn} onClick={() => setView(({ y, m }) => ({ y: m === 0 ? y - 1 : y, m: (m + 11) % 12 }))} aria-label={t("เดือนก่อน", "Previous month")}>
              <Icon.ChevronLeft size={16} />
            </button>
          ) : (
            <span className="w-[30px]" />
          )}
          <div className="text-sm font-semibold">
            {names.months[m]} <span className="font-normal text-muted-foreground tabular">{y + names.yearOffset}</span>
          </div>
          {offset === 1 ? (
            <button type="button" className={iconBtn} onClick={() => setView(({ y, m }) => ({ y: m === 11 ? y + 1 : y, m: (m + 1) % 12 }))} aria-label={t("เดือนถัดไป", "Next month")}>
              <Icon.Chevron size={16} />
            </button>
          ) : (
            <span className="w-[30px]" />
          )}
        </div>
        <Weekdays lang={lang} />
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthGrid(y, m).map(({ iso, inMonth, day }) => {
            if (!inMonth) return <span key={iso} />;
            const isStart = iso === start;
            const isEnd = iso === end;
            const lo = start && !end && hover ? (hover < start ? hover : start) : start;
            const hi = start && !end && hover ? (hover < start ? start : hover) : end;
            const inRange = !!lo && !!hi && iso > lo && iso < hi;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => click(iso)}
                onMouseEnter={() => setHover(iso)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-[10px] border border-transparent text-[13px] tabular transition hover:bg-muted",
                  iso === today && !isStart && !isEnd && "border-brand font-semibold text-brand-strong",
                  inRange && "rounded-none bg-brand-soft hover:bg-[#efcdbc] dark:hover:bg-brand-soft",
                  (isStart || isEnd) && "bg-brand-action font-semibold text-brand-foreground hover:bg-brand-action-hover",
                  isStart && end && !isEnd && "rounded-r-none",
                  isEnd && start && !isStart && "rounded-l-none",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const days = draft.start && draft.end ? daysBetween(draft.start, draft.end) + 1 : 0;

  return (
    <div ref={ref} className="relative grid gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <button id={id} type="button" className={fieldButton(open)} onClick={openPicker} aria-expanded={open}>
        <Icon.Cal size={16} className="text-muted-foreground" />
        <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
          {value ? `${fmtShort(value.start, lang)} → ${fmtShort(value.end, lang)}` : (placeholder ?? t("เลือกช่วงวันที่", "Pick a date range"))}
        </span>
        <Icon.ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[min(680px,calc(100vw-2rem))] origin-top-left animate-pop-in rounded-[18px] border bg-surface p-4 shadow-pop">
          <div className="flex flex-col md:flex-row">
            {presets.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-0.5 border-b border-dashed pb-2 md:mr-3.5 md:mb-0 md:w-36 md:shrink-0 md:flex-col md:flex-nowrap md:border-r md:border-b-0 md:pr-2 md:pb-0">
                <div className="hidden px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase md:block">
                  {t("ลัด", "Quick")}
                </div>
                {presets.map((p) => {
                  const r = p.get();
                  const active = draft.start === r.start && draft.end === r.end;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setDraft(r);
                        const s = parts(r.start);
                        setView({ y: s.y, m: s.m });
                      }}
                      className={cn(
                        "rounded-[9px] px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition hover:bg-muted hover:text-foreground",
                        active && "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-4.5">
              {month(0)}
              <div className="hidden sm:block sm:flex-1">{month(1)}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
            <div className="text-xs text-muted-foreground">
              {draft.start && draft.end ? (
                <>
                  <b className="font-semibold text-foreground">{fmtShort(draft.start, lang)}</b> →{" "}
                  <b className="font-semibold text-foreground">{fmtShort(draft.end, lang)}</b> ·{" "}
                  <span className="font-semibold text-brand-strong">
                    {days} {t("วัน", days === 1 ? "day" : "days")}
                  </span>
                </>
              ) : draft.start ? (
                <>
                  {t("เริ่ม", "Start")} <b className="font-semibold text-foreground">{fmtShort(draft.start, lang)}</b> —{" "}
                  {t("เลือกวันสิ้นสุด", "pick an end date")}
                </>
              ) : (
                t("เลือกวันเริ่มและวันสิ้นสุด", "Select start and end dates")
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className={smallGhost} onClick={() => setDraft({ start: null, end: null })}>
                {t("ล้าง", "Clear")}
              </button>
              <button
                type="button"
                className={smallAccent}
                disabled={!draft.start || !draft.end}
                onClick={() => {
                  if (draft.start && draft.end) onChange({ start: draft.start, end: draft.end });
                  setOpen(false);
                }}
              >
                {t("ใช้ช่วงนี้", "Apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
