import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'live';
type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface-raised text-text border border-border hover:border-border-input',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-raised hover:text-text',
  danger: 'bg-danger-solid text-on-danger hover:brightness-110',
  live: 'bg-live text-on-live hover:brightness-110',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap',
        'transition-[background-color,border-color,filter] duration-fast ease-std',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}

/* -------------------------------------------------------------- IconButton */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required: icon-only buttons need an accessible name
  icon: ReactNode;
  active?: boolean; // toggled on (e.g. mic on, sharing)
  tone?: 'default' | 'danger' | 'live';
  size?: 'md' | 'lg';
}

export function IconButton({
  label,
  icon,
  active,
  tone = 'default',
  size = 'lg',
  className,
  ...rest
}: IconButtonProps) {
  const toneClass =
    tone === 'danger'
      ? 'bg-danger-solid text-on-danger hover:brightness-110'
      : tone === 'live'
        ? 'bg-live text-on-live hover:brightness-110'
        : active
          ? 'bg-accent text-on-accent hover:bg-accent-hover'
          : 'bg-surface-raised text-text hover:bg-border';
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <button
          {...rest}
          aria-label={label}
          aria-pressed={active}
          className={clsx(
            'inline-flex items-center justify-center rounded-pill transition-colors duration-fast',
            'disabled:cursor-not-allowed disabled:opacity-50',
            size === 'lg' ? 'size-12' : 'size-10',
            toneClass,
            className,
          )}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={8}
          className="rounded-sm bg-surface-raised px-2 py-1 text-xs text-text shadow-pop border border-border"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* --------------------------------------------------------------- LiveBadge */

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm bg-live px-1.5 py-0.5 text-xs font-bold tracking-wide text-on-live uppercase',
        className,
      )}
    >
      Live
    </span>
  );
}

/* ------------------------------------------------------------------- Toast */

export function Toast({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: ReactNode;
}) {
  const bar = { info: 'bg-focus', warning: 'bg-warning', danger: 'bg-danger', success: 'bg-success' }[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex w-80 overflow-hidden rounded-md border border-border bg-surface-raised shadow-pop"
    >
      <span aria-hidden className={clsx('w-1 shrink-0', bar)} />
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-text">{title}</p>
        {children && <p className="mt-0.5 text-sm text-text-muted">{children}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- TextField */

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: string }) {
  const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const describedBy = error ? `${fid}-err` : hint ? `${fid}-hint` : undefined;
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={fid} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={fid}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        {...rest}
        className={clsx(
          'h-10 rounded-md border bg-bg px-3 text-sm text-text placeholder:text-text-subtle',
          error ? 'border-danger' : 'border-border-input',
        )}
      />
      {error ? (
        <p id={`${fid}-err`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-md bg-surface-raised', className)} />;
}

export { Tooltip };
