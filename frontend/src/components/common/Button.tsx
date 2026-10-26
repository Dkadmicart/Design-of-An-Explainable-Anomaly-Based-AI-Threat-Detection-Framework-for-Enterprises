import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'secondary-dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'square' | 'rounded' | 'pill';
  icon?: React.ElementType;
  iconRight?: React.ElementType;
  iconSize?: number;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      shape = 'rounded',
      icon: Icon,
      iconRight: IconRight,
      iconSize,
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'h-9 px-4 text-xs font-bold gap-2 whitespace-nowrap',
      md: 'h-11 px-5 text-sm font-bold gap-2.5 whitespace-nowrap',
      lg: 'h-12 sm:h-13 px-7 text-sm sm:text-base font-bold gap-2.5 whitespace-nowrap',
      xl: 'h-14 sm:h-15 px-8 sm:px-10 text-base font-extrabold gap-3 whitespace-nowrap',
    };

    const shapeClasses = {
      square: 'rounded-none',
      rounded: 'rounded-xl',
      pill: 'rounded-full',
    };

    const variantClasses = {
      primary:
        'bg-[#F5B700] text-slate-950 border border-amber-500/40 hover:bg-[#FACC15] active:bg-[#E0A800] shadow-[0_0_20px_rgba(245,183,0,0.25)] hover:shadow-[0_0_30px_rgba(245,183,0,0.45)] hover:-translate-y-0.5',
      secondary:
        'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-950 shadow-sm hover:shadow hover:-translate-y-0.5',
      'secondary-dark':
        'bg-slate-900/90 text-slate-100 border-2 border-slate-700 hover:bg-slate-800 hover:border-slate-500 hover:text-white shadow-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] hover:-translate-y-0.5',
      outline:
        'bg-transparent text-slate-700 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5',
      ghost:
        'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent',
      danger:
        'bg-red-600 text-white border border-red-700 hover:bg-red-700 shadow-sm hover:-translate-y-0.5',
    };

    const defaultIconSize = size === 'sm' ? 14 : size === 'xl' ? 19 : size === 'lg' ? 18 : 16;
    const computedIconSize = iconSize || defaultIconSize;

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]',
          sizeClasses[size],
          shapeClasses[shape],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {Icon && <Icon size={computedIconSize} className="flex-shrink-0" />}
        {children && <span>{children}</span>}
        {IconRight && <IconRight size={computedIconSize} className="flex-shrink-0" />}
      </button>
    );
  }
);

Button.displayName = 'Button';
