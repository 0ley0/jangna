import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 rounded-2xl border-2 border-input bg-background px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground md:text-sm",
        "focus-visible:border-brand focus-visible:bg-surface",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
