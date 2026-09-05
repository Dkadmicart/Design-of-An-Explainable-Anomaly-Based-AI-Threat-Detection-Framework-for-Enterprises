import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'compact' | 'normal' | 'large';
}

export function Card({ children, className, hover = false, padding = 'normal', ...props }: CardProps) {
  const paddingStyles = {
    none: 'p-0',
    compact: 'p-4 sm:p-5',
    normal: 'p-5 lg:p-6',
    large: 'p-6 lg:p-8',
  };

  return (
    <div
      className={clsx(
        'card bg-white border border-slate-200/80 rounded-2xl shadow-2xs transition-all duration-200',
        hover && 'card-hover',
        paddingStyles[padding],
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
