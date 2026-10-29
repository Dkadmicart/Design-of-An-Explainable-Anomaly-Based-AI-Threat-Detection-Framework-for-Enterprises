import React from 'react';
import clsx from 'clsx';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  statusBadge?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, statusBadge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-[var(--color-border-base)] mb-6 lg:mb-8 min-w-0">
      <div className="space-y-1.5 min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title text-balance">{title}</h1>
          {statusBadge}
        </div>
        {subtitle && <p className="page-subtitle max-w-3xl text-pretty">{subtitle}</p>}
      </div>

      {actions && (
        <div className="flex items-center gap-3 self-start sm:self-auto flex-shrink-0 mt-1">
          {actions}
        </div>
      )}
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={clsx('animate-fade-in space-y-6 lg:space-y-8 pb-10 min-w-0 w-full max-w-full overflow-x-hidden', className)}>
      {children}
    </div>
  );
}
