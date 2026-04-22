import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Search, X, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import type { ProcessInstance } from '../types/support';
import { PageContainer } from '../components/layout/PageContainer';
import { ProcessTable } from '../components/process/ProcessTable';

/**
 * Process List page - displays all process instances with filtering
 */
export const ProcessList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allProcesses, setAllProcesses] = useState<ProcessInstance[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'true' | 'false'>('all');
  const [durationBucketFilter, setDurationBucketFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');

  const statuses = ['ACTIVE', 'COMPLETED', 'CANCELED', 'TERMINATED'];

  useEffect(() => {
    loadProcesses();
  }, []);

  useEffect(() => {
    const stateQuery = (searchParams.get('state') || '').toUpperCase();
    const incidentQuery = (searchParams.get('incident') || '').toLowerCase();
    const bucketQuery = (searchParams.get('durationBucket') || '').trim();

    if (stateQuery && statuses.includes(stateQuery)) {
      setSelectedStatuses([stateQuery]);
    }

    if (incidentQuery === 'true' || incidentQuery === 'false') {
      setIncidentFilter(incidentQuery);
    }

    if (bucketQuery) {
      setDurationBucketFilter(bucketQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    filterProcesses();
  }, [allProcesses, searchTerm, selectedStatuses, incidentFilter, durationBucketFilter]);

  const getDurationBucket = (process: ProcessInstance): string => {
    const startedAt = process.startDate ? new Date(process.startDate).getTime() : NaN;
    const endedAt = process.endDate ? new Date(process.endDate).getTime() : NaN;
    const isActive = String(process.state || '').toUpperCase() === 'ACTIVE';

    if (!Number.isFinite(startedAt)) {
      return 'Unknown';
    }

    if (!Number.isFinite(endedAt)) {
      return isActive ? 'In Progress' : 'Unknown';
    }

    const durationMs = Math.max(0, endedAt - startedAt);
    const minutes = durationMs / 60000;

    if (minutes < 1) return '< 1 min';
    if (minutes < 3) return '1-3 min';
    if (minutes < 10) return '3-10 min';
    return '10+ min';
  };

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const response = await api.support.listProcessInstances();
      if (response.success && response.data) {
        setAllProcesses(response.data.items);
      }
    } catch (error) {
      console.error('Error loading processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProcesses = () => {
    let filtered = allProcesses;

    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.key?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((p) => p.state && selectedStatuses.includes(p.state));
    }

    if (incidentFilter !== 'all') {
      const incidentExpected = incidentFilter === 'true';
      filtered = filtered.filter((p) => Boolean(p.incident) === incidentExpected);
    }

    if (durationBucketFilter !== 'all') {
      filtered = filtered.filter((p) => getDurationBucket(p) === durationBucketFilter);
    }

    setFilteredProcesses(filtered);
  };

  const sortedProcesses = useMemo(() => {
    const sorted = [...filteredProcesses];
    sorted.sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return sortBy === 'latest' ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  }, [filteredProcesses, sortBy]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProcesses();
    setIsRefreshing(false);
  };

  const handleProcessClick = (process: ProcessInstance) => {
    if (process.key) {
      navigate(`/process/${process.key}`);
    }
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setIncidentFilter('all');
    setDurationBucketFilter('all');
    navigate('/processes');
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="space-y-1">
              <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">
                All enquiries
              </h1>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Browse and manage all support enquiries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search and Filters Section */}
        <section className="border border-border/70 bg-background p-5">
          {/* Search Bar */}
          <div className="mb-4">
            <label className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2.5 hover:border-border/100 transition-colors bg-muted/20">
              <Search size={16} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by case ID or key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-1 hover:bg-secondary rounded transition-colors flex-shrink-0"
                  aria-label="Clear search"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              )}
            </label>
          </div>

          {/* Status Filters and Sort */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedStatuses.includes(status)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Sort and Clear Controls */}
            <div className="flex items-center gap-2">
              <select
                value={incidentFilter}
                onChange={(e) => setIncidentFilter(e.target.value as 'all' | 'true' | 'false')}
                className="text-sm rounded-lg border border-border/70 bg-background px-3 py-1.5 text-foreground cursor-pointer hover:border-border/100 transition-colors"
                aria-label="Filter incident state"
              >
                <option value="all">All Incidents</option>
                <option value="true">Incident Only</option>
                <option value="false">Healthy Only</option>
              </select>

              <select
                value={durationBucketFilter}
                onChange={(e) => setDurationBucketFilter(e.target.value)}
                className="text-sm rounded-lg border border-border/70 bg-background px-3 py-1.5 text-foreground cursor-pointer hover:border-border/100 transition-colors"
                aria-label="Filter by duration bucket"
              >
                <option value="all">All Durations</option>
                <option value="< 1 min">&lt; 1 min</option>
                <option value="1-3 min">1-3 min</option>
                <option value="3-10 min">3-10 min</option>
                <option value="10+ min">10+ min</option>
                <option value="In Progress">In Progress</option>
                <option value="Unknown">Unknown</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'oldest')}
                className="text-sm rounded-lg border border-border/70 bg-background px-3 py-1.5 text-foreground cursor-pointer hover:border-border/100 transition-colors"
                aria-label="Sort cases"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              {(searchTerm || selectedStatuses.length > 0 || incidentFilter !== 'all' || durationBucketFilter !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Results Count and Table */}
        <section className="border border-border/70 bg-background p-5">
          <div className="mb-4 text-sm text-muted-foreground">
            Showing <span className="text-foreground font-semibold">{sortedProcesses.length}</span> of{' '}
            <span className="text-foreground font-semibold">{allProcesses.length}</span> cases
          </div>
          <ProcessTable
            processes={sortedProcesses}
            loading={loading}
            onProcessClick={handleProcessClick}
          />
        </section>
      </div>
    </PageContainer>
  );
};
