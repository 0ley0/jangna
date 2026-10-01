import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** label + input + error ของฟิลด์นั้นจาก ProblemDetails (key เป็น camelCase) */
export function Field({
  label,
  name,
  errors,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string; errors?: Record<string, string[]> }) {
  const error = errors?.[name]?.[0];
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={!!error || undefined} {...props} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function NativeSelect({
  label,
  name,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string; name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  return message ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p> : null;
}
