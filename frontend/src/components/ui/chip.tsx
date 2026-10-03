"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { useLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Chip ตาม .chip / .tag ของ Hearth
 * - แสดงอย่างเดียว: <Chip tone="sage">ผูกแล้ว</Chip>
 * - กดได้ (ตัวกรอง): <Chip selected={on} onClick={...}>รายวัน</Chip>
 * - ลบได้: <Chip onRemove={...}>ค่ารถ</Chip>
 * - เลือกจากหลายตัว: <ChipGroup options value onChange />
 */
const chipVariants = cva(
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface text-ink-2",
        brand: "border-transparent bg-brand-soft text-brand-ink",
        sage: "border-transparent bg-sage-soft text-sage-ink",
        amber: "border-transparent bg-amber-soft text-amber-ink",
        plum: "border-transparent bg-plum-soft text-plum-ink",
        blue: "border-transparent bg-blue-soft text-blue-ink",
      },
      selected: {
        true: "border-transparent bg-sage-soft font-semibold text-sage-ink",
        false: "",
      },
      interactive: {
        true: "cursor-pointer hover:bg-sage-soft focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none",
        false: "",
      },
    },
    compoundVariants: [{ selected: true, interactive: true, className: "hover:bg-sage-soft" }],
    defaultVariants: { tone: "neutral", selected: false, interactive: false },
  }
)

type ChipProps = Omit<React.ComponentProps<"span">, "onClick"> &
  Omit<VariantProps<typeof chipVariants>, "interactive"> & {
    onClick?: () => void
    onRemove?: () => void
    removeLabel?: string
  }

function Chip({ className, tone, selected, onClick, onRemove, removeLabel, children, ...props }: ChipProps) {
  const { t } = useLang()
  const classes = cn(chipVariants({ tone, selected: !!selected, interactive: !!onClick }), onRemove && "pr-1", className)
  const remove = onRemove && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onRemove()
      }}
      aria-label={removeLabel ?? t("ลบ", "Remove")}
      className="inline-flex size-5 items-center justify-center rounded-full opacity-70 transition hover:bg-foreground/10 hover:opacity-100"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    </button>
  )

  if (onClick)
    return (
      <span data-slot="chip" className={classes} {...props}>
        <button type="button" onClick={onClick} aria-pressed={!!selected} className="inline-flex items-center gap-1.5 outline-none">
          {children}
        </button>
        {remove}
      </span>
    )

  return (
    <span data-slot="chip" className={classes} {...props}>
      {children}
      {remove}
    </span>
  )
}

/** กลุ่ม chip เลือกค่าเดียว (เช่น ตัวกรอง) */
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: { value: T; label: React.ReactNode; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => (
        <Chip key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tabular opacity-70">{o.count}</span>}
        </Chip>
      ))}
    </div>
  )
}

export { Chip, ChipGroup, chipVariants }
