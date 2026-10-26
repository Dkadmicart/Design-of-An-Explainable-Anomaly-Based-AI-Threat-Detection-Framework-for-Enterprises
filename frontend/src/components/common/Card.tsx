import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'compact' | 'normal' | 'large';
  'p-4'?: boolean;
  'p-5'?: boolean;
  'p-6'?: boolean;
  'p-8'?: boolean;
  'p-12'?: boolean;
}

export function Card({
  children,
  className,
  hover = false,
  padding = 'normal',
  'p-4': p4,
  'p-5': p5,
  'p-6': p6,
  'p-8': p8,
  'p-12': p12,
  ...props
}: CardProps) {
  const paddingStyles = {
    none: 'p-0',
    compact: 'p-4 sm:p-5',
    normal: 'p-5 lg:p-6',
    large: 'p-6 lg:p-8',
  };

  let resolvedPadding = paddingStyles[padding];
  if (p4) resolvedPadding = 'p-4';
  if (p5) resolvedPadding = 'p-5';
  if (p6) resolvedPadding = 'p-5 lg:p-6';
  if (p8) resolvedPadding = 'p-8';
  if (p12) resolvedPadding = 'p-12';

  return (
    <div
      className={clsx(
        'card bg-white border border-slate-200/80 rounded-2xl shadow-2xs transition-all duration-200',
        hover && 'card-hover',
        resolvedPadding,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="text-xs font-medium text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
