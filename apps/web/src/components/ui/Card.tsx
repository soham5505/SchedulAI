import React from 'react';
import { cn } from '../../utils/cn.js';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, glass = false, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100 shadow-xl',
        glass && 'backdrop-blur-xl bg-slate-900/60 border-slate-800/80',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
