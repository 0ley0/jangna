import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * ฟิลด์ฟอร์ม = label + control + คำอธิบาย (hint) + error
 * error มาได้ 2 ทาง: `error="..."` หรือ `errors={apiError.fieldErrors}` (ใช้ key = name แบบ camelCase จาก ProblemDetails)
 *
 *   <TextField label="ชื่อ" name="firstName" errors={errors} required />
 *   <SelectField label="สาขา" name="branchId"><option>…</option></SelectField>
 *   <TextareaField label="หมายเหตุ" name="note" hint="ไม่บังคับ" />
 */
interface FieldBase {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: string
  errors?: Record<string, string[]>
  className?: string
}

function resolveError(name: string | undefined, error?: string, errors?: Record<string, string[]>) {
  return error ?? (name ? errors?.[name]?.[0] : undefined)
}

function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: Omit<FieldBase, "errors"> & { id?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div data-slot="form-field" className={cn("grid gap-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-brand" aria-hidden>*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

function TextField({ label, hint, error, errors, className, id, name, ...props }: FieldBase & React.ComponentProps<typeof Input>) {
  const fieldId = id ?? name
  const message = resolveError(name, error, errors)
  return (
    <FormField id={fieldId} label={label} hint={hint} error={message} required={props.required} className={className}>
      <Input id={fieldId} name={name} aria-invalid={!!message || undefined} {...props} />
    </FormField>
  )
}

function SelectField({
  label,
  hint,
  error,
  errors,
  className,
  id,
  name,
  children,
  ...props
}: FieldBase & Omit<React.ComponentProps<typeof Select>, "size">) {
  const fieldId = id ?? name
  const message = resolveError(name, error, errors)
  return (
    <FormField id={fieldId} label={label} hint={hint} error={message} required={props.required} className={className}>
      <Select id={fieldId} name={name} aria-invalid={!!message || undefined} {...props}>
        {children}
      </Select>
    </FormField>
  )
}

function TextareaField({ label, hint, error, errors, className, id, name, ...props }: FieldBase & React.ComponentProps<typeof Textarea>) {
  const fieldId = id ?? name
  const message = resolveError(name, error, errors)
  return (
    <FormField id={fieldId} label={label} hint={hint} error={message} required={props.required} className={className}>
      <Textarea id={fieldId} name={name} aria-invalid={!!message || undefined} {...props} />
    </FormField>
  )
}

/** error รวมของฟอร์ม (ไม่ผูกกับฟิลด์ใด) */
function FormError({ message }: { message?: string | null }) {
  return message ? (
    <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  ) : null
}

export { FormField, TextField, SelectField, TextareaField, FormError }
