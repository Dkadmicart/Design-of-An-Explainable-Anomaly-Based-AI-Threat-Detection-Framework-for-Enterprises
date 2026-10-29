import React from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
    variant?: 'primary' | 'secondary';
  };
  variant?: 'normal' | 'amber' | 'emerald';
  minHeight?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'normal',
  minHeight = 'min-h-[220px]',
  className,
}: EmptyStateProps) {
  const iconVariants = {
    normal: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border-[var(--color-border-base)]',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center border border-dashed border-[var(--color-border-base)] rounded-2xl bg-[var(--color-empty-bg)] text-center p-6 space-y-3.5',
        minHeight,
        className
      )}
    >
      <div
        className={clsx(
          'w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-2xs',
          iconVariants[variant]
        )}
      >
        <Icon size={22} strokeWidth={2} />
      </div>

      <div className="max-w-sm space-y-1">
        <h4 className="text-sm font-bold text-[var(--color-text-main)]">{title}</h4>
        <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={clsx(
            'btn btn-sm font-bold text-xs mt-1 transition-all cursor-pointer',
            action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'
          )}
        >
          {action.icon && <action.icon size={14} />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
