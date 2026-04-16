import React from 'react';
import { ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import type { ProcessInstance } from '../../types/support';
import { formatDate, statusClass } from '../../lib/support-formatters';

interface ProcessListItemProps {
  process: ProcessInstance;
  onClick?: (process: ProcessInstance) => void;
}

/**
 * Individual process list item component
 */
export const ProcessListItem: React.FC<ProcessListItemProps> = ({
  process,
  onClick,
}) => {
  return (
    <button
      onClick={() => onClick?.(process)}
      className="support-card w-full text-left rounded-xl border border-border/60 px-4 py-3 transition hover:opacity-90"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Instance info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-amber-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">
              {process.key}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>v{process.processVersion}</span>
            <span>•</span>
            <span>{formatDate(process.startDate || '')}</span>
            {process.incident ? (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  <AlertTriangle size={12} />
                  Incident
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Middle: Status badge */}
        <div className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusClass(process.state || '')}`}>
          {process.state}
        </div>

        {/* Right: Chevron */}
        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
      </div>
    </button>
  );
};
