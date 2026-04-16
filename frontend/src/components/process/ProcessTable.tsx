import React from 'react';
import { ProcessListItem } from './ProcessListItem';
import type { ProcessInstance } from '../../types/support';

interface ProcessTableProps {
  processes: ProcessInstance[];
  loading?: boolean;
  onProcessClick?: (process: ProcessInstance) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

/**
 * Table/list component for displaying processes
 */
export const ProcessTable: React.FC<ProcessTableProps> = ({
  processes,
  loading,
  onProcessClick,
  onLoadMore,
  hasMore,
  loadingMore,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading processes...</p>
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No processes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {processes.map((process) => (
        <ProcessListItem
          key={process.key}
          process={process}
          onClick={onProcessClick}
        />
      ))}

      {/* Load more button */}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 disabled:opacity-50 transition"
        >
          {loadingMore ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
};
