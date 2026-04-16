import React from 'react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Reusable page header matching support-header aesthetic
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  subtitle,
  actions,
}) => {
  return (
    <header className="support-header relative mb-6 overflow-hidden rounded-3xl border border-border/60 px-6 py-6 shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          {subtitle && (
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {subtitle}
            </p>
          )}
          <h1 className="font-heading text-3xl leading-tight tracking-tight md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
