import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Skeleton loading placeholder component
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className || ''}`}
      {...props}
    />
  );
};

/**
 * Metric card skeleton loader
 */
export const MetricSkeleton: React.FC = () => {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
};

/**
 * Grid of metric skeletons
 */
export const MetricGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <MetricSkeleton key={i} />
      ))}
    </div>
  );
};

/**
 * Stats card skeleton loader
 */
export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
};

/**
 * Stats grid skeleton loader (4 stat cards)
 */
export const StatsGridSkeleton: React.FC = () => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
};

/**
 * Process table row skeleton
 */
export const ProcessTableRowSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border/30 last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-5 w-16 rounded-lg flex-shrink-0" />
    </div>
  );
};

/**
 * Process table skeleton loader
 */
export const ProcessTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="border border-border/70 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border/70 bg-muted/30">
        <Skeleton className="h-4 w-32" />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <ProcessTableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};
