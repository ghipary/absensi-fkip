import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  // Dasar: inline-flex, rapi secara vertikal, fokus = ring aksen (globals.css)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-80 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-gradient text-accent-fg shadow-sm hover:shadow-md hover:brightness-110 active:brightness-95",
        secondary:
          "border border-border bg-surface text-fg hover:-translate-y-px hover:border-border-strong hover:bg-surface-muted hover:shadow-sm active:translate-y-0 active:bg-surface-muted",
        ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg",
        danger:
          "bg-danger text-white shadow-sm hover:bg-danger/90 hover:shadow-md active:bg-danger/80",
        "danger-ghost":
          "text-danger-text hover:bg-danger-bg",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        // Di layar sentuh (mobile) target minimal 44px; di md+ kembali padat.
        sm: "h-11 px-3 text-xs md:h-7 md:px-2.5",
        md: "h-11 px-4 text-base md:h-9",
        lg: "h-11 px-5 text-base md:h-10",
        icon: "h-11 w-11 md:h-9 md:w-9",
        "icon-sm": "h-11 w-11 md:h-7 md:w-7",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
