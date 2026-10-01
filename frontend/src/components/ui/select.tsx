"use client"

/**
 * Select แบบเดียวกับ DatePicker ของ Hearth: ช่องกด + popover การ์ด (rounded-18, shadow-pop)
 * ตัวที่เลือก = พื้นหมึก + เครื่องหมายถูก (เหมือนวันที่เลือกในปฏิทิน)
 *
 *   <Select name="branchId" defaultValue="">            ← ใช้ <option> แบบ native ได้เลย
 *     <option value="">— ไม่ระบุ —</option>
 *     <option value="a">สาขา A</option>
 *   </Select>
 *   <Select value={v} onValueChange={setV} options={[{ value, label, hint }]} />
 *
 * - ส่งค่าไปกับ <form> ผ่าน `name` และให้ browser ตรวจ `required` ได้ (เหมือน DateField)
 * - ตัวเลือกเกิน 8 รายการ → มีช่องค้นหา (ปิด/เปิดเองได้ด้วย `searchable`)
 * - คีย์บอร์ด: ↑ ↓ Home End เลื่อน, Enter เลือก, Esc ปิด
 * - popover render ผ่าน portal (position fixed) → ไม่โดน overflow ของตาราง/การ์ดตัด
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { useLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: React.ReactNode
  /** ข้อความเล็กด้านขวา เช่น จำนวน หรือรหัส */
  hint?: React.ReactNode
  disabled?: boolean
}

export interface SelectProps {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options?: SelectOption[]
  children?: React.ReactNode
  placeholder?: string
  required?: boolean
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  size?: "default" | "sm"
  className?: string
  "aria-invalid"?: boolean
  "aria-label"?: string
}

const SEARCH_THRESHOLD = 8

/** แปลง <option> children เป็น options */
function optionsFromChildren(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<React.ComponentProps<"option">>(child) || child.type !== "option") return []
    const { value, children: label, disabled } = child.props
    return [{ value: String(value ?? textOf(label)), label, disabled }]
  })
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

/** ตำแหน่ง popover แบบ fixed ใต้ (หรือเหนือ ถ้าที่ไม่พอ) ช่องกด */
function usePanelPosition(open: boolean, triggerRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = React.useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number; above: boolean } | null>(null)

  React.useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 8
      const below = window.innerHeight - r.bottom - gap - 12
      const aboveSpace = r.top - gap - 12
      const above = below < 220 && aboveSpace > below
      const maxHeight = Math.max(160, Math.min(320, above ? aboveSpace : below))
      const width = Math.max(r.width, 200)
      const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12)
      // เปิดขึ้นด้านบนใช้ bottom (ไม่ใช้ translate เพราะชนกับ transform ของ animation)
      setPos(above ? { bottom: window.innerHeight - r.top + gap, left, width, maxHeight, above } : { top: r.bottom + gap, left, width, maxHeight, above })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, triggerRef])

  return pos
}

function Select({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  options: optionsProp,
  children,
  placeholder = "—",
  required,
  disabled,
  searchable,
  searchPlaceholder,
  emptyText,
  size = "default",
  className,
  "aria-invalid": invalid,
  "aria-label": ariaLabel,
}: SelectProps) {
  const { t } = useLang()
  const options = React.useMemo(() => optionsProp ?? optionsFromChildren(children), [optionsProp, children])
  const firstEnabled = options.find((o) => !o.disabled)?.value
  // เหมือน <select> native: ไม่ได้กำหนดค่า = ตัวเลือกแรก
  const [inner, setInner] = React.useState<string | undefined>(defaultValue)
  const current = value !== undefined ? value : (inner ?? firstEnabled)
  const selected = options.find((o) => o.value === current)

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(-1)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()
  const pos = usePanelPosition(open, triggerRef)

  const canSearch = searchable ?? options.length > SEARCH_THRESHOLD
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${textOf(o.label)} ${o.value}`.toLowerCase().includes(q))
  }, [options, query])

  const openPanel = () => {
    if (disabled) return
    setQuery("")
    setActive(Math.max(0, options.findIndex((o) => o.value === current)))
    setOpen(true)
  }

  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return
    if (value === undefined) setInner(option.value)
    onValueChange?.(option.value)
    close()
  }

  // ปิดเมื่อคลิกนอก (popover อยู่ใน portal จึงต้องเช็กทั้งสองที่)
  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // โฟกัสช่องค้นหา / เลื่อนให้เห็นตัวที่ active
  React.useEffect(() => {
    if (open && canSearch) searchRef.current?.focus()
    else if (open) listRef.current?.focus()
  }, [open, canSearch])
  React.useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  const move = (dir: 1 | -1, from = active) => {
    if (filtered.length === 0) return
    let i = from
    for (let step = 0; step < filtered.length; step++) {
      i = (i + dir + filtered.length) % filtered.length
      if (!filtered[i].disabled) break
    }
    setActive(i)
  }

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        move(1)
        break
      case "ArrowUp":
        e.preventDefault()
        move(-1)
        break
      case "Home":
        e.preventDefault()
        move(1, -1)
        break
      case "End":
        e.preventDefault()
        move(-1, filtered.length)
        break
      case "Enter":
        e.preventDefault()
        choose(filtered[active])
        break
      case "Escape":
        e.preventDefault()
        close()
        break
      case "Tab":
        close(false)
        break
    }
  }

  const sm = size === "sm"

  return (
    <div data-slot="select" className={cn("relative", sm ? "inline-flex" : "flex w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            openPanel()
          }
        }}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 border border-input bg-surface text-left text-sm transition-[border-color,box-shadow,background] duration-200",
          "hover:bg-[#fbf4e5] dark:hover:bg-muted focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/12 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          sm ? "h-8 rounded-[10px] px-2.5" : "h-9 rounded-xl px-3",
          open && "border-brand ring-4 ring-brand/12"
        )}
      >
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        <Chevron className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* ส่งค่าไปกับ <form> + ให้ browser ตรวจ required ได้ */}
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

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(
              "fixed z-50 flex flex-col rounded-[18px] border bg-surface p-1.5 text-foreground shadow-pop animate-pop-in",
              pos.above ? "origin-bottom" : "origin-top"
            )}
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          >
            {canSearch && (
              <div className="relative mb-1.5 shrink-0">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onListKey}
                  placeholder={searchPlaceholder ?? t("ค้นหา…", "Search…")}
                  className="h-8 w-full rounded-[10px] border bg-[#fbf4e5] pr-2.5 pl-8 text-[13px] outline-none focus:border-brand focus:bg-surface dark:bg-muted"
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              onKeyDown={onListKey}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
            >
              {filtered.length === 0 && <li className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">{emptyText ?? t("ไม่พบรายการ", "No matches")}</li>}
              {filtered.map((o, i) => {
                const isSelected = o.value === current
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 text-[13px] text-ink-2 transition-colors",
                      sm ? "py-1.5" : "py-2",
                      i === active && !isSelected && "bg-muted text-foreground",
                      isSelected && "bg-primary font-semibold text-primary-foreground shadow-ink",
                      o.disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint !== undefined && (
                      <span className={cn("shrink-0 text-xs tabular", isSelected ? "opacity-70" : "text-muted-foreground")}>{o.hint}</span>
                    )}
                    <CheckIcon className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}

const Chevron = ({ className }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4 4 10-10" />
  </svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

export { Select }
