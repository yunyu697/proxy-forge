import React from 'react';
import clsx from 'clsx';

/* ------------------------------- Icon -------------------------------- */

const PATHS: Record<string, string> = {
  laptop: 'M3 5h18v11H3zM2 19h20M9 19h6',
  router: 'M4 15h16v4H4zM2 19h20M8 15v-3M16 15v-3M12 15V8M7 11a5 5 0 0 1 10 0',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 21V9M7 14l5-5 5 5M4 4h16',
  check: 'M4 12l5 5L20 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  warning: 'M12 3l9 17H3zM12 9v5M12 17h.01',
  edit: 'M4 20h4L20 8l-4-4L4 16z',
  link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
  save: 'M5 4h11l3 3v13H5zM8 4v6h7V4M8 20v-6h8v6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5',
  close: 'M6 6l12 12M18 6L6 18',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3.2z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6z',
  gauge: 'M12 14l4-5M4 20a9 9 0 1 1 16 0',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3',
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
}) {
  const d = PATHS[name] || PATHS.file;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/* ------------------------------ Button ------------------------------- */

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
}) {
  const cls = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant];
  return (
    <button className={clsx(cls, size === 'sm' && 'px-2.5 py-1.5 text-xs', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

/* -------------------------------- Card ------------------------------- */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('card', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  desc,
  icon,
  right,
}: {
  title: string;
  desc?: string;
  icon?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name={icon} size={15} />
          </span>
        )}
        <div>
          <h2 className="text-[15px] font-semibold text-ink-800">{title}</h2>
          {desc && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{desc}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 self-center">{right}</div>}
    </div>
  );
}

/* -------------------------------- Field ------------------------------ */

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', props.className)} {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input font-mono text-[12px]', props.className)} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx('input appearance-none bg-no-repeat pr-8 cursor-pointer', props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7787' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 8px center',
      }}
      {...props}
    />
  );
}

/* ------------------------------- Toggle ------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        'flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5 transition cursor-pointer',
        checked ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-white hover:bg-ink-50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-800">{label}</div>
        {desc && <div className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-brand-600' : 'bg-ink-300',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------ Checkbox ----------------------------- */

export function Checkbox({
  checked,
  onChange,
  label,
  desc,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  desc?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition',
        checked ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-white hover:bg-ink-50',
        className,
      )}
    >
      <span
        className={clsx(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white',
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && <Icon name="check" size={11} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink-800">{label}</span>
        {desc && <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">{desc}</span>}
      </span>
    </label>
  );
}

/* -------------------------------- Chip ------------------------------- */

export function Chip({
  children,
  tone = 'ink',
  className,
}: {
  children: React.ReactNode;
  tone?: 'ink' | 'brand' | 'green' | 'red' | 'amber' | 'blue';
  className?: string;
}) {
  const tones = {
    ink: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
  };
  return <span className={clsx('chip', tones[tone], className)}>{children}</span>;
}

/* ------------------------------ EmptyState --------------------------- */

export function EmptyState({
  icon = 'file',
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50/50 px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm">
        <Icon name={icon} size={20} />
      </span>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------- Notice ------------------------------ */

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: React.ReactNode }) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <div
      className={clsx('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed', tones[tone])}
    >
      <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ----------------------------- StepFooter ---------------------------- */

/**
 * 统一的步骤页脚：左侧提示文字，右侧「上一步 / 下一步」。
 * 每个步骤页都以它收尾，导航行为全应用一致。
 */
export function StepFooter({
  hint,
  nextLabel,
  onNext,
  onPrev,
  nextDisabled,
}: {
  hint?: React.ReactNode;
  nextLabel?: string;
  onNext?: () => void;
  onPrev?: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5">
      <div className="min-w-0 text-[12px] leading-relaxed text-ink-400">{hint}</div>
      <div className="flex shrink-0 items-center gap-2">
        {onPrev && (
          <Button variant="ghost" onClick={onPrev}>
            ← 上一步
          </Button>
        )}
        {onNext && (
          <Button icon="chevronRight" onClick={onNext} disabled={nextDisabled}>
            {nextLabel || '下一步'}
          </Button>
        )}
      </div>
    </div>
  );
}
