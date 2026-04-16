import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, CheckCircle2, Clock3, ExternalLink } from 'lucide-react';
import { api, type OptimizeDashboard } from '../lib/api';
import type { ProcessInstance } from '../types/support';
import { PageContainer } from '../components/layout/PageContainer';
import { StatsGrid } from '../components/support/stats';
import { ProcessTable } from '../components/process/ProcessTable';
import { isDurationMetricName, formatDuration } from '../lib/support-formatters';
import { MetricGridSkeleton, StatsGridSkeleton, ProcessTableSkeleton } from '../components/ui/skeleton';

const DEFAULT_COLLECTION_ID =
  import.meta.env.VITE_OPTIMIZE_COLLECTION_ID || '44d4a885-b01c-42ef-8d3b-1cd43bc695eb';
const DEFAULT_SUPPORT_BPMN_PROCESS_ID =
  import.meta.env.VITE_SUPPORT_BPMN_PROCESS_ID || 'Process_15wz3ez';

/**
 * Dashboard page - overview of all processes and statistics
 */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [supportBpmnProcessId] = useState(DEFAULT_SUPPORT_BPMN_PROCESS_ID);
  const [dashboardIds, setDashboardIds] = useState<string[]>([]);
  const [dashboardMetaById, setDashboardMetaById] = useState<Record<string, OptimizeDashboard>>({});
  const [reportDataById, setReportDataById] = useState<Record<string, any>>({});
  const [optimizeStatsUpdatedAt, setOptimizeStatsUpdatedAt] = useState<string>('');
  const [, setDashboardsLoading] = useState(false);
  const [, setDashboardsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  useEffect(() => {
    void loadOptimizeDashboards(DEFAULT_COLLECTION_ID);
  }, []);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const response = await api.support.listProcessInstances({
        bpmnProcessId: supportBpmnProcessId,
      });
      if (response.success && response.data) {
        setProcesses(response.data.items);
      }
    } catch (error) {
      console.error('Error loading processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOptimizeDashboards = async (targetCollectionId: string) => {
    const normalizedCollectionId = targetCollectionId.trim();
    if (!normalizedCollectionId) {
      setDashboardsError('Collection ID is required');
      setDashboardIds([]);
      return;
    }

    setDashboardsLoading(true);
    setDashboardsError(null);

    try {
      const dashboardResponse = await api.optimize.getDashboardIds(normalizedCollectionId);

      const ids = Array.isArray(dashboardResponse.data)
        ? dashboardResponse.data
            .map((item) => (typeof item?.id === 'string' ? item.id.trim() : ''))
            .filter(Boolean)
        : [];

      setDashboardIds(ids);
      if (ids.length > 0) {
        const definitionsResponse = await api.optimize.exportDashboardDefinitions(ids);
        const definitions = Array.isArray(definitionsResponse.data) ? definitionsResponse.data : [];
        
        // Create a map of report ID to report data
        const reportMap = new Map<string, OptimizeDashboard>();
        definitions.forEach((entry) => {
          if (entry && typeof entry.id === 'string' && entry.exportEntityType === 'single_process_report') {
            reportMap.set(entry.id, entry);
          }
        });

        // Collect all unique report IDs from all dashboards
        const allReportIds = new Set<string>();
        definitions.forEach((entry) => {
          if (entry && entry.exportEntityType === 'dashboard' && Array.isArray(entry.tiles)) {
            entry.tiles.forEach((tile: any) => {
              if (typeof tile.id === 'string') {
                allReportIds.add(tile.id);
              }
            });
          }
        });

        // Fetch data for all reports in parallel
        if (allReportIds.size > 0) {
          setMetricsLoading(true);
        }
        
        const reportDataMap: Record<string, any> = {};
        const reportDataPromises = Array.from(allReportIds).map(async (reportId) => {
          try {
            const reportDataResponse = await api.optimize.getReportData(reportId);
            reportDataMap[reportId] = reportDataResponse.data;
          } catch (error) {
            console.error(`Failed to load report data for ${reportId}:`, error);
            reportDataMap[reportId] = null;
          }
        });
        
        await Promise.allSettled(reportDataPromises);
        setReportDataById(reportDataMap);
        setMetricsLoading(false);

        // Enrich dashboards with report details from tiles
        const dashboardEntries = definitions.filter(
          (entry) => entry && typeof entry.id === 'string' && entry.exportEntityType === 'dashboard',
        );

        const byId = dashboardEntries.reduce<Record<string, OptimizeDashboard>>((accumulator, entry) => {
          const enrichedEntry = { ...entry };
          
          // Map tiles to reports
          if (Array.isArray(entry.tiles)) {
            enrichedEntry.reports = entry.tiles
              .map((tile: any) => {
                const reportData = reportMap.get(tile.id);
                return {
                  id: tile.id,
                  name: reportData?.name || `Report ${tile.id}`,
                };
              });
          }
          
          accumulator[entry.id] = enrichedEntry;
          return accumulator;
        }, {});

        setDashboardMetaById(byId);
      } else {
        setDashboardMetaById({});
      }

      setOptimizeStatsUpdatedAt(new Date().toISOString());
    } catch (error) {
      setDashboardsError(error instanceof Error ? error.message : 'Failed to load Optimize dashboards');
      setDashboardIds([]);
      setDashboardMetaById({});
    } finally {
      setDashboardsLoading(false);
    }
  };

  const supportCaseMetrics = useMemo(() => {
    for (const dashboardId of dashboardIds) {
      const dashboard = dashboardMetaById[dashboardId];
      if (!dashboard || !Array.isArray(dashboard.reports) || dashboard.reports.length === 0) {
        continue;
      }

      return dashboard.reports
        .filter((report) => typeof report.id === 'string' && report.id.trim().length > 0)
        .map((report) => {
          const reportId = report.id as string;
          const rawValue = reportDataById[reportId]?.data;
          const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

          return {
            id: reportId,
            name: report.name || 'Unnamed Report',
            value: Number.isFinite(value) ? value : 0,
          };
        });
    }

    return [] as Array<{ id: string; name: string; value: number }>;
  }, [dashboardIds, dashboardMetaById, reportDataById]);

  const stats = useMemo(() => {
    const active = processes.filter((p) => p.state === 'ACTIVE').length;
    const completed = processes.filter((p) => p.state === 'COMPLETED').length;
    const flagged = processes.filter((p) => p.incident).length;
    return {
      total: processes.length,
      active,
      completed,
      flagged,
    };
  }, [processes]);

  const sortedProcesses = useMemo(() => {
    const sorted = [...processes];
    sorted.sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return dateB - dateA; // Always latest first
    });
    return sorted;
  }, [processes]);

  const recentProcesses = useMemo(() => {
    return sortedProcesses.slice(0, 5);
  }, [sortedProcesses]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProcesses();
    await loadOptimizeDashboards(DEFAULT_COLLECTION_ID);
    setIsRefreshing(false);
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">
              Customer Support Agent Dashboard
            </h1>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Filtered by BPMN Process ID: {supportBpmnProcessId}
            </p>
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

        {/* Stats Section with Lazy Loading */}
        {loading ? (
          <StatsGridSkeleton />
        ) : (
          <StatsGrid
            stats={stats}
            icons={{
              total: <Clock3 className="h-4 w-4" />,
              active: <AlertCircle className="h-4 w-4" />,
              completed: <CheckCircle2 className="h-4 w-4" />,
              flagged: <AlertCircle className="h-4 w-4" />,
            }}
          />
        )}

        <section className="border border-border/70 bg-background p-5">
          <h2 className="text-xl font-semibold mb-4">Support Case Metrics</h2>
          {metricsLoading ? (
            <>
              <MetricGridSkeleton count={4} />
              <p className="text-xs text-muted-foreground mt-3 animate-pulse">Loading metrics...</p>
            </>
          ) : supportCaseMetrics.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {supportCaseMetrics.map((metric) => {
                  const isDuration = isDurationMetricName(metric.name)
                  const displayValue = isDuration && typeof metric.value === 'number' 
                    ? formatDuration(metric.value)
                    : metric.value
                  
                  return (
                    <div
                      key={metric.id}
                      className="brand-metric-card rounded-lg px-4 py-4 text-foreground"
                    >
                      <p className="text-3xl font-semibold tracking-tight">{displayValue}</p>
                      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">{metric.name}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Last updated: {optimizeStatsUpdatedAt ? new Date(optimizeStatsUpdatedAt).toLocaleString() : 'Loading...'}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No Optimize metrics found for this collection yet. Sync demo data first, or verify the Optimize collection ID.
            </div>
          )}
        </section>

        <section className="border border-border/70 bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Cases</h2>
            <button
              onClick={() => navigate('/processes')}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View All
              <ExternalLink size={16} />
            </button>
          </div>
          {loading ? (
            <ProcessTableSkeleton rows={5} />
          ) : (
            <ProcessTable
              processes={recentProcesses}
              loading={loading}
              onProcessClick={(p) => {
                if (p.key) navigate(`/process/${p.key}`);
              }}
            />
          )}
        </section>

        {/* <section className="border border-border/70 bg-background p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              <h2 className="text-xl font-semibold">Optimize Dashboards</h2>
            </div>
            <span className="text-xs text-muted-foreground">Live embedded views</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Load dashboard IDs from Camunda Optimize and render the actual dashboards directly below.
          </p>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="text-sm">
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Collection ID</p>
              <input
                value={collectionId}
                onChange={(event) => setCollectionId(event.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2"
                placeholder="Optimize collection ID"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={onLoadDashboards}
                disabled={dashboardsLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50 lg:w-auto"
              >
                {dashboardsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Load Dashboards
              </button>
            </div>
          </div>

          {dashboardsError ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dashboardsError}
            </div>
          ) : null}

          {dashboardsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboards...
            </div>
          ) : dashboardIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dashboards found for this collection.</p>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="brand-metric-card rounded-lg px-4 py-4 text-foreground">
                  <div className="mb-3 flex items-center justify-between text-foreground/80">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{optimizeSummary.dashboards}</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">Dashboards</p>
                </div>

                <div className="brand-metric-card rounded-lg px-4 py-4 text-foreground">
                  <div className="mb-3 flex items-center justify-between text-foreground/80">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{optimizeSummary.reports}</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">Reports</p>
                </div>

                <div className="brand-metric-card rounded-lg px-4 py-4 text-foreground">
                  <div className="mb-3 flex items-center justify-between text-foreground/80">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{optimizeSummary.namedDashboards}</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">Named Dashboards</p>
                </div>

                <div className="brand-metric-card rounded-lg px-4 py-4 text-foreground">
                  <div className="mb-3 flex items-center justify-between text-foreground/80">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{optimizeSummary.dashboardsWithoutName}</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">Unnamed</p>
                </div>
              </section>

              {optimizeStatsUpdatedAt ? (
                <p className="text-xs text-muted-foreground">
                  Optimize data synced at {new Date(optimizeStatsUpdatedAt).toLocaleString()}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span>{dashboardIds.length} dashboard(s) found.</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
              {dashboardIds.map((dashboardId) => {
                const dashboardUrl = toOptimizeDashboardUrl(
                  DEFAULT_OPTIMIZE_BASE_URL,
                  collectionId,
                  dashboardId,
                );
                const dashboardMeta = dashboardMetaById[dashboardId];

                return (
                  <a
                    key={dashboardId}
                    href={dashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-border/60 bg-background/70 p-4 transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{dashboardMeta?.name || 'Dashboard'}</p>
                    <p className="mt-1 break-all text-sm font-medium">{dashboardId}</p>
                    
                    {dashboardMeta?.description && (
                      <p className="mt-2 text-xs text-muted-foreground/80">{dashboardMeta.description}</p>
                    )}
                    
                    {Array.isArray(dashboardMeta?.reports) && dashboardMeta.reports.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-border/40 pt-3">
                        <p className="text-xs font-medium text-muted-foreground">Reports</p>
                        <div className="flex flex-wrap gap-1">
                          {dashboardMeta.reports.map((report: any) => {
                            const reportValue = reportDataById[report.id]?.data ?? null;
                            const displayValue = reportValue !== null ? ` (${reportValue})` : '';
                            
                            return (
                              <span
                                key={report.id}
                                className="inline-block rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                              >
                                {report.name || 'Unnamed'}{displayValue}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                      Open in Optimize
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </a>
                );
              })}
              </div>


            </>
          )}
        </section> */}
      </div>
    </PageContainer>
  );
};
