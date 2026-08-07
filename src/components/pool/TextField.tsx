import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  type: "text" | "email" | "tel";
  autoComplete: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string | undefined;
  className?: string | undefined;
}

export function TextField({
  label,
  value,
  type,
  autoComplete,
  onChange,
  required = false,
  error,
  className,
}: Props) {
  const id = useId();
  return (
    <div className={cn("group flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label-xs transition-colors group-focus-within:text-foreground">
        {label} {required ? <span className="text-brand">*</span> : null}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={120}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-none border-0 border-b border-border/80 bg-transparent px-0 text-[15px] font-light shadow-none transition-[border-color,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-foreground/65 focus-visible:ring-0 aria-invalid:border-destructive md:text-[15px]"
      />
      {error ? (
        <span id={`${id}-error`} className="text-[11px] font-light text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
