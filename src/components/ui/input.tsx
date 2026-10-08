import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Ikon kiri opsional */
  icon?: React.ReactNode;
  /** True untuk input numerik/monospace (NIM, nilai) */
  mono?: boolean;
  /** true = tampil border merah + aria-invalid (untuk validasi form) */
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, mono, invalid, type, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 flex text-fg-subtle">
            {icon}
          </span>
        )}
        <input
          type={type}
          className={cn(
            "h-9 w-full rounded border border-border bg-surface px-3 text-base text-fg placeholder:text-fg-subtle",
            "transition-colors hover:border-border-strong",
            "focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
            icon && "pl-9",
            mono && "font-mono-nums",
            invalid && "border-danger focus:border-danger focus-visible:ring-danger/30",
            className
          )}
          aria-invalid={invalid || undefined}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

/** Textarea dengan gaya konsisten Input */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[80px] w-full rounded border border-border bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-subtle",
      "transition-colors hover:border-border-strong",
      "focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
      "disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
