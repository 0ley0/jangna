import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 rounded-xl border border-input bg-surface px-3 py-2 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground md:text-sm",
        "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/12",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
