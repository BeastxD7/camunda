import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

export interface ProcessFilters {
  searchTerm: string;
  status: string[];
}

interface ProcessFiltersProps {
  onFiltersChange: (filters: ProcessFilters) => void;
}

/**
 * Filters component for process list search and status filtering
 */
export const ProcessFilters: React.FC<ProcessFiltersProps> = ({
  onFiltersChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<string[]>([]);

  const statuses = ['ACTIVE', 'COMPLETED', 'CANCELED', 'TERMINATED'];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onFiltersChange({ searchTerm: value, status });
  };

  const toggleStatus = (s: string) => {
    const newStatus = status.includes(s)
      ? status.filter((st) => st !== s)
      : [...status, s];
    setStatus(newStatus);
    onFiltersChange({ searchTerm, status: newStatus });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatus([]);
    onFiltersChange({ searchTerm: '', status: [] });
  };

  return (
    <div className="support-card rounded-3xl border border-border/60 p-6">
      {/* Search */}
      <div className="mb-4">
        <label className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-3 hover:bg-secondary/30 transition">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by instance key..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch('')}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </label>
      </div>

      {/* Status filters */}
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-3">Filter by Status</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                status.includes(s)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {s}
            </button>
          ))}
          {(searchTerm || status.length > 0) && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
