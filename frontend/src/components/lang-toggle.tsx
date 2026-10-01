"use client";

import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** ปุ่มสลับภาษา ไทย | EN — แบบ segmented (.ampm ของ Hearth DatePicker) */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const options: { value: Lang; label: string }[] = [
    { value: "th", label: "ไทย" },
    { value: "en", label: "EN" },
  ];
  return (
    <div className={cn("inline-flex gap-[3px] rounded-[10px] bg-muted p-[3px]", className)} role="group" aria-label="Language / ภาษา">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium text-ink-2 transition",
            lang === o.value && "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
