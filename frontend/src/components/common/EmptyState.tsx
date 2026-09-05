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
    normal: 'bg-slate-100 text-slate-600 border-slate-200',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div
      className={clsx(
        'w-full flex flex-col items-center justify-center border border-dashed border-slate-200/90 rounded-2xl bg-slate-50/60 text-center p-6 space-y-3.5',
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
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{description}</p>
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
