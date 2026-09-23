import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "success" | "secondary" | "ghost" | "danger" | "gold";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-[var(--shadow-card)]",
  success: "bg-brand text-white hover:bg-brand-700 active:bg-brand-800 shadow-[var(--shadow-card)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-subtle hover:border-ink-4",
  ghost: "text-ink-2 hover:bg-navy-50 hover:text-ink",
  danger: "bg-surface text-danger border border-danger-line hover:bg-danger-bg",
  gold: "bg-gold-50 text-gold border border-gold-100 hover:bg-gold-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9.5 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
  icon: "h-9 w-9",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function Button({ variant = "primary", size = "md", className, icon, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function LinkButton({ variant = "primary", size = "md", className, icon, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
