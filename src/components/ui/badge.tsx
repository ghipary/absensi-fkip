import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Badge pill (radius 999px) — pasangan warna semantic selalu lolos AA. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-2xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-muted text-fg-muted",
        accent: "border-accent-border bg-accent-subtle text-accent",
        success: "border-success-border bg-success-bg text-success-text",
        warning: "border-warning-border bg-warning-bg text-warning-text",
        danger: "border-danger-border bg-danger-bg text-danger-text",
        info: "border-info-border bg-info-bg text-info-text",
        solid: "border-transparent bg-accent text-accent-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Dot status kecil (untuk indikator online/aktif) */
function StatusDot({
  tone = "success",
  className,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  const map = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-fg-subtle",
  } as const;
  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 rounded-full", map[tone], className)}
    />
  );
}

export { Badge, badgeVariants, StatusDot };
