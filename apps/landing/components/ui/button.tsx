import * as React from "react";

import { Slot } from "@radix-ui/react-slot";

import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-sky-300 text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-200 disabled:bg-slate-600 disabled:text-slate-300",
  outline:
    "border border-white/15 bg-white/5 text-white hover:bg-white/10 disabled:border-white/10 disabled:text-slate-500",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, asChild = false, variant = "default", type = "button", ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});
