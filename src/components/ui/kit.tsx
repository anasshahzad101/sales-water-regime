/** Small presentational building blocks shared by every screen (no client state). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

// ---------------------------------------------------------------- buttons
export type ButtonVariant = "primary" | "cta" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border-0",
  cta: "bg-cta text-on-cta hover:bg-cta-hover border-0 shadow-[0_12px_28px_-12px_rgba(0,169,80,0.75)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-2 border-0 hover:bg-surface-2 hover:text-ink",
  danger: "bg-red-solid text-on-solid border-0 hover:opacity-90",
  "danger-ghost": "bg-transparent text-red border border-line-strong hover:bg-red-bg",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13.5px] gap-1.5",
  md: "h-11 px-[22px] text-[15px] gap-2",
  lg: "h-[52px] px-[26px] text-base gap-2.5",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap no-underline transition-colors hover:no-underline disabled:cursor-not-allowed disabled:opacity-55",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

type BtnProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: string; loading?: boolean };
export function Button({ variant = "primary", size = "md", icon, loading, className, children, disabled, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="loader-circle" size={size === "sm" ? 14 : 16} className="animate-spin" /> : icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

type LinkBtnProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: string };
export function LinkButton({ variant = "primary", size = "md", icon, className, children, ...rest }: LinkBtnProps) {
  return (
    <Link className={buttonClass(variant, size, cn(className, variant === "primary" || variant === "cta" ? "hover:text-on-primary" : "hover:text-ink"))} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </Link>
  );
}

export function IconButton({ icon, label, className, size = 40, iconSize = 18, ...rest }: ComponentProps<"button"> & { icon: string; label: string; size?: number; iconSize?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("flex items-center justify-center rounded-full border-0 bg-transparent text-text-2 hover:bg-surface-2 hover:text-ink", className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

// ---------------------------------------------------------------- form fields
export const fieldClass =
  "wr-field w-full min-w-0 rounded-xl border border-line-strong bg-input px-3.5 text-ink outline-none h-11 text-[14.5px] max-md:h-12 max-md:text-base placeholder:text-text-3 disabled:opacity-60";
export const selectClass = cn(fieldClass, "appearance-none bg-no-repeat pr-10");
export const textareaClass =
  "wr-field w-full min-w-0 rounded-xl border border-line-strong bg-input px-3.5 py-2.5 text-ink outline-none text-[14.5px] max-md:text-base leading-normal placeholder:text-text-3";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold">
        {label}
        {required && <span className="text-red"> *</span>}
      </label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <span className="text-[12.5px] leading-snug text-text-3">{hint}</span> : null}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium text-red" role="alert">
      <Icon name="circle-alert" size={14} />
      {children}
    </span>
  );
}

/** Native <select> with the design's chevron. */
export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <span className="relative flex min-w-0">
      <select className={cn(selectClass, className)} {...rest}>
        {children}
      </select>
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-2" />
    </span>
  );
}

// ---------------------------------------------------------------- surfaces
export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]", className)} {...rest}>
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-4 md:gap-6", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:min-w-[280px]">
        {eyebrow && <span className="text-[13px] font-semibold text-text-2 max-md:hidden">{eyebrow}</span>}
        <h1 className="m-0 font-display text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] max-md:hidden">{title}</h1>
        {subtitle && <p className="m-0 text-[15px] text-pretty text-text-2 max-md:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, count, aside, className }: { children: ReactNode; count?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <h2 className="m-0 font-display text-[17px] font-semibold tracking-[-0.01em]">{children}</h2>
      {count}
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: string;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-[14px] bg-brand-soft text-green">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex max-w-[420px] flex-col gap-1">
        <span className="font-display text-base font-semibold">{title}</span>
        {text && <span className="text-sm leading-relaxed text-pretty text-text-2">{text}</span>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("block animate-shimmer rounded-lg bg-skeleton", className)} style={style} />;
}

export function Avatar({ initials, size = 34, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("flex flex-none items-center justify-center rounded-full bg-brand-soft font-bold text-green", className)}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials}
    </span>
  );
}

export function Banner({ tone = "info", icon, title, children, className }: { tone?: "info" | "warning" | "error" | "success"; icon?: string; title?: ReactNode; children?: ReactNode; className?: string }) {
  const palette = {
    info: "bg-aqua-bg text-aqua",
    warning: "bg-amber-bg text-amber",
    error: "bg-red-bg text-red",
    success: "bg-green-bg text-green",
  }[tone];
  const ic = icon ?? { info: "info", warning: "triangle-alert", error: "circle-alert", success: "circle-check" }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex items-start gap-3 rounded-[14px] px-4 py-3.5", palette, className)}>
      <Icon name={ic} size={18} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        {title && <span className="text-sm font-bold">{title}</span>}
        {children && <span className="text-[13.5px] leading-snug text-ink">{children}</span>}
      </div>
    </div>
  );
}
