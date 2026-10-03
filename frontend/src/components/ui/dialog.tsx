"use client"

import { AlertDialog as AlertPrimitive } from "@base-ui/react/alert-dialog"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { useLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// z-40 ต่ำกว่า popover ของ Select (z-50, portal ไป body) เพื่อให้ dropdown ในฟอร์มเปิดทับ dialog ได้
const backdropClass =
  "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
const viewportClass = "fixed inset-0 z-40 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center"
// ไม่ใส่ overflow-hidden — DatePicker เป็น popover แบบ absolute ข้างในต้องไม่ถูกตัด
const popupClass =
  "relative w-full rounded-[18px] border bg-surface p-5 text-foreground shadow-pop outline-none transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-6"

const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const

/** Dialog ฟอร์ม/เนื้อหาทั่วไป — ปิดได้ด้วย Esc, คลิกพื้นหลัง, ปุ่ม × */
function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: keyof typeof sizes
  children: React.ReactNode
}) {
  const { t } = useLang()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={backdropClass} />
        <DialogPrimitive.Viewport className={viewportClass}>
          <DialogPrimitive.Popup className={cn(popupClass, sizes[size])}>
            <div className="mb-4 flex items-start gap-3">
              <div className="grid flex-1 gap-1">
                <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                aria-label={t("ปิด", "Close")}
                className="grid size-8 shrink-0 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/15 focus-visible:outline-none"
              >
                <X size={16} />
              </DialogPrimitive.Close>
            </div>
            {children}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  /** danger = ลบ/ย้อนไม่ได้ (ปุ่มแดง), warning = ทำต่อได้แต่มีผลกระทบ (ปุ่มหลัก) */
  tone?: "danger" | "warning"
}

/** Dialog ยืนยัน/เตือน — ไม่ปิดเมื่อคลิกพื้นหลัง ต้องกดยกเลิกหรือยืนยันเท่านั้น */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "warning",
  loading,
  onConfirm,
}: ConfirmOptions & {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  onConfirm: () => void
}) {
  const { t } = useLang()
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Backdrop className={backdropClass} />
        <AlertPrimitive.Viewport className={viewportClass}>
          <AlertPrimitive.Popup className={cn(popupClass, sizes.sm)}>
            <div className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-base font-bold",
                  tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-amber-soft text-amber-ink",
                )}
              >
                !
              </span>
              <div className="grid gap-1">
                <AlertPrimitive.Title className="text-base font-semibold">{title}</AlertPrimitive.Title>
                {description && (
                  <AlertPrimitive.Description className="text-sm text-muted-foreground">{description}</AlertPrimitive.Description>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <AlertPrimitive.Close render={<Button variant="outline" disabled={loading} />}>{t("ยกเลิก", "Cancel")}</AlertPrimitive.Close>
              <Button variant={tone === "danger" ? "destructive" : "accent"} loading={loading} onClick={onConfirm}>
                {confirmLabel ?? t("ยืนยัน", "Confirm")}
              </Button>
            </div>
          </AlertPrimitive.Popup>
        </AlertPrimitive.Viewport>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  )
}

/**
 * แทน window.confirm: `if (await ask({ title, tone: "danger" })) remove.mutate()`
 * ต้อง render `{dialog}` ไว้ใน JSX ของหน้านั้นด้วย
 */
function useConfirm() {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
  const [open, setOpen] = React.useState(false)
  const resolver = React.useRef<((ok: boolean) => void) | null>(null)

  const settle = React.useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpen(false) // เก็บ options ไว้จนกว่า animation ปิดจบ ข้อความจะไม่หายกลางจาง
  }, [])

  const ask = React.useCallback((next: ConfirmOptions) => {
    resolver.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOptions(next)
      setOpen(true)
    })
  }, [])

  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={(open) => !open && settle(false)}
      title={options?.title ?? ""}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      tone={options?.tone}
      onConfirm={() => settle(true)}
    />
  )
  return { ask, dialog }
}

export { ConfirmDialog, Dialog, useConfirm }
