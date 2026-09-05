import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variantStyles = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    info: 'badge-info',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={clsx('badge', variantStyles[variant], className)}>
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const sev = severity?.toUpperCase();
  const variant =
    sev === 'CRITICAL' ? 'critical' :
    sev === 'HIGH' ? 'high' :
    sev === 'MEDIUM' ? 'medium' : 'low';

  return <Badge variant={variant}>{severity}</Badge>;
}
