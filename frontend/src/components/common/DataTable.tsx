import React from 'react';
import clsx from 'clsx';

interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function DataTable({ children, className, containerClassName, ...props }: DataTableProps) {
  return (
    <div className={clsx('data-table-container', containerClassName)}>
      <table className={clsx('data-table', className)} {...props}>
        {children}
      </table>
    </div>
  );
}
