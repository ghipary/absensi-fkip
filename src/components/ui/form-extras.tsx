"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Select bergaya design system — memakai <select> native
 * (accessible by default, keyboard navigable, tanpa dependensi berat).
 */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Opsi: value + label */
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded border border-border bg-surface pl-3 pr-8 text-base text-fg",
          "transition-colors hover:border-border-strong",
          "focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
    </div>
  )
);
Select.displayName = "Select";

/** Progress bar tipis untuk % kehadiran */
function Progress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number; // 0–100
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
  label?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  const toneMap = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  } as const;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted", className)}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-500", toneMap[tone])}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Checkbox standar bergaya */
function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer cursor-pointer appearance-none rounded border border-border-strong bg-surface transition-colors",
        "checked:border-accent checked:bg-accent",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "[&:checked]:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%2220 6 9 17 4 12%22/></svg>')] [&:checked]:bg-[length:12px] [&:checked]:bg-center [&:checked]:bg-no-repeat",
        className
      )}
      {...props}
    />
  );
}

export { Select, Progress, Checkbox, Check };
