import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, CheckCircle2, Clock3, ExternalLink, Maximize2 } from 'lucide-react';
import { api, type OptimizeDashboard } from '../lib/api';
import type { ProcessInstance } from '../types/support';
import { PageContainer } from '../components/layout/PageContainer';
import { StatsGrid } from '../components/support/stats';
import { ProcessTable } from '../components/process/ProcessTable';
import { isDurationMetricName, formatDuration } from '../lib/support-formatters';
import { MetricGridSkeleton, StatsGridSkeleton, ProcessTableSkeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const DonutMetricCard = lazy(() =>
  import('../components/support/DonutMetricCard').then((module) => ({
    default: module.DonutMetricCard,
  })),
);

const BarMetricCard = lazy(() =>
  import('../components/support/BarMetricCard').then((module) => ({
    default: module.BarMetricCard,
  })),
);

const DEFAULT_COLLECTION_ID =
  import.meta.env.VITE_OPTIMIZE_COLLECTION_ID || '44d4a885-b01c-42ef-8d3b-1cd43bc695eb';
const DEFAULT_SUPPORT_BPMN_PROCESS_ID =
  import.meta.env.VITE_SUPPORT_BPMN_PROCESS_ID || 'Process_15wz3ez';
const HEATMAP_IMAGES = [
  { src: '/heatmap.png', label: 'Heatmap 1' },
  { src: '/heatmap2.png', label: 'Heatmap 2' },
  { src: '/heatmap3.png', label: 'Heatmap 3' },
];

const PIE_PALETTE = ['#06b6d4', '#34d399', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b'];

type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type OptimizeReportView =
  | { id: string; name: string; kind: 'metric'; value: number }
  | { id: string; name: string; kind: 'pie'; slices: DonutSlice[] }
  | { id: string; name: string; kind: 'bar'; slices: DonutSlice[] };

type OptimizeChartType = 'pie' | 'bar' | 'metric' | 'heatmap' | 'unknown';

type ReportMeta = {
  id: string;
  name: string;
  chartType: OptimizeChartType;
};

type MetricValueResolution = {
  value: number;
  source: string;
  rawValue: unknown;
  usedFallback: boolean;
};

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatIsoLikeDateLabel(label: string): string {
  const trimmed = label.trim();
  const isoLike = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(trimmed);

  if (!isoLike) {
    return label;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return label;
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function resolveMetricValue(payload: unknown): MetricValueResolution {
  const candidates: Array<{ source: string; value: unknown }> = [
    { source: 'payload', value: payload },
  ];

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    candidates.push(
      { source: 'payload.data', value: record.data },
      { source: 'payload.value', value: record.value },
      { source: 'payload.result', value: record.result },
    );

    if (record.result && typeof record.result === 'object') {
      const nested = record.result as Record<string, unknown>;
      candidates.push(
        { source: 'payload.result.value', value: nested.value },
        { source: 'payload.result.data', value: nested.data },
      );
    }
  }

  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate.value);
    if (parsed !== null) {
      return {
        value: parsed,
        source: candidate.source,
        rawValue: candidate.value,
        usedFallback: false,
      };
    }
  }

  return {
    value: 0,
    source: 'fallback(0)',
    rawValue: payload,
    usedFallback: true,
  };
}

function detectChartTypeFromDefinition(definition: Record<string, unknown>): OptimizeChartType {
  const directCandidates = [
    definition.visualization,
    definition.visualizationType,
    definition.chartType,
    definition.type,
    definition.reportType,
    definition.view,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  if (directCandidates.some((candidate) => candidate.includes('pie') || candidate.includes('donut'))) {
    return 'pie';
  }

  if (directCandidates.some((candidate) => candidate.includes('bar') || candidate.includes('histogram'))) {
    return 'bar';
  }

  if (directCandidates.some((candidate) => candidate.includes('heatmap') || candidate.includes('heat_map'))) {
    return 'heatmap';
  }

  if (directCandidates.some((candidate) => candidate.includes('number') || candidate.includes('single') || candidate.includes('metric'))) {
    return 'metric';
  }

  const flattened = JSON.stringify(definition).toLowerCase();
  if (flattened.includes('"pie"') || flattened.includes('"donut"')) return 'pie';
  if (flattened.includes('"bar"') || flattened.includes('"histogram"')) return 'bar';
  if (flattened.includes('"heatmap"') || flattened.includes('"heat_map"')) return 'heatmap';
  if (flattened.includes('single_number') || flattened.includes('single value') || flattened.includes('kpi')) return 'metric';
  return 'unknown';
}

function extractCategoricalSlices(payload: unknown, minimumPoints = 2): DonutSlice[] | null {
  const candidateArrays: unknown[] = [];

  if (Array.isArray(payload)) {
    candidateArrays.push(payload);
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    candidateArrays.push(record.data, record.values, record.result);

    const result = record.result;
    if (result && typeof result === 'object') {
      const nested = result as Record<string, unknown>;
      candidateArrays.push(nested.data, nested.values);
    }
  }

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate) || candidate.length === 0) {
      continue;
    }

    const slices = candidate
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const row = item as Record<string, unknown>;
        const labelRaw = row.label ?? row.name ?? row.group ?? row.key ?? row.category;
        const valueRaw = row.value ?? row.count ?? row.data ?? row.amount;
        const label =
          typeof labelRaw === 'string' ? formatIsoLikeDateLabel(labelRaw.trim()) : '';
        const value = toFiniteNumber(valueRaw);

        if (!label || value === null || value < 0) {
          return null;
        }

        return {
          label,
          value,
          color: PIE_PALETTE[index % PIE_PALETTE.length],
        } as DonutSlice;
      })
      .filter((slice): slice is DonutSlice => Boolean(slice));

    if (slices.length >= minimumPoints && slices.some((slice) => slice.value > 0)) {
      return slices;
    }
  }

  return null;
}

function inferChartKindForUnknownReport(
  payload: unknown,
  slices: DonutSlice[],
  reportName: string,
): 'pie' | 'bar' {
  if (isDurationMetricName(reportName)) {
    return 'bar';
  }

  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data) && data.length > 0) {
      const rows = data.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      );

      const hasKeyValueRows =
        rows.length > 0 &&
        rows.every(
          (row) =>
            typeof row.key === 'string' &&
            (typeof row.value === 'number' || typeof row.value === 'string'),
        );

      const hasDateLikeKeys = rows.some(
        (row) => typeof row.key === 'string' && /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(row.key),
      );

      if (hasDateLikeKeys || (hasKeyValueRows && rows.length === 1)) {
        return 'bar';
      }
    }
  }

  if (slices.length === 1) {
    return 'bar';
  }

  return 'pie';
}

function isHeatmapPayload(payload: unknown): boolean {
  const candidateArrays: unknown[] = [];

  if (Array.isArray(payload)) {
    candidateArrays.push(payload);
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    candidateArrays.push(record.data, record.values, record.result);

    const result = record.result;
    if (result && typeof result === 'object') {
      const nested = result as Record<string, unknown>;
      candidateArrays.push(nested.data, nested.values);
    }
  }

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate) || candidate.length < 10) {
      continue;
    }

    let bpmKeyMatches = 0;
    let objectRows = 0;

    for (const item of candidate) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      objectRows += 1;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === 'string' ? row.key : '';

      if (/^(activity|event|gateway|task|subprocess|callactivity|sequenceflow)_/i.test(key)) {
        bpmKeyMatches += 1;
      }
    }

    if (objectRows >= 10 && bpmKeyMatches >= Math.max(4, Math.floor(objectRows * 0.4))) {
      return true;
    }
  }

  return false;
}

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
  const [reportMetaById, setReportMetaById] = useState<Record<string, ReportMeta>>({});
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
        
        // Build report meta from exported definitions
        const reportMap = new Map<string, OptimizeDashboard>();
        const metaById: Record<string, ReportMeta> = {};
        definitions.forEach((entry) => {
          if (entry && typeof entry.id === 'string' && entry.exportEntityType === 'single_process_report') {
            reportMap.set(entry.id, entry);
            const chartType = detectChartTypeFromDefinition(entry as unknown as Record<string, unknown>);
            metaById[entry.id] = {
              id: entry.id,
              name: entry.name || `Report ${entry.id}`,
              chartType,
            };
          }
        });
        setReportMetaById(metaById);

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

  const optimizeReports = useMemo<OptimizeReportView[]>(() => {
    for (const dashboardId of dashboardIds) {
      const dashboard = dashboardMetaById[dashboardId];
      if (!dashboard || !Array.isArray(dashboard.reports) || dashboard.reports.length === 0) {
        continue;
      }

      return dashboard.reports
        .filter((report) => typeof report.id === 'string' && report.id.trim().length > 0)
        .map((report) => {
          const reportId = report.id as string;
          const payload = reportDataById[reportId];
          const chartType = reportMetaById[reportId]?.chartType || 'unknown';

          if (chartType === 'heatmap' || isHeatmapPayload(payload)) {
            return null;
          }

          const slices = extractCategoricalSlices(payload, chartType === 'bar' ? 1 : 2);

          if (slices && chartType === 'bar') {
            return {
              id: reportId,
              name: report.name || 'Unnamed Report',
              kind: 'bar' as const,
              slices,
            };
          }

          if (slices && chartType === 'pie') {
            return {
              id: reportId,
              name: report.name || 'Unnamed Report',
              kind: 'pie' as const,
              slices,
            };
          }

          if (slices && chartType === 'unknown') {
            const inferredKind = inferChartKindForUnknownReport(
              payload,
              slices,
              report.name || 'Unnamed Report',
            );

            return {
              id: reportId,
              name: report.name || 'Unnamed Report',
              kind: inferredKind,
              slices,
            };
          }

          const resolution = resolveMetricValue(payload);

          return {
            id: reportId,
            name: report.name || 'Unnamed Report',
            kind: 'metric' as const,
            value: resolution.value,
          };
        })
        .filter((report): report is OptimizeReportView => Boolean(report));
    }

    return [] as OptimizeReportView[];
  }, [dashboardIds, dashboardMetaById, reportDataById, reportMetaById]);

  const supportCaseMetrics = useMemo(
    () => optimizeReports.filter((report): report is Extract<OptimizeReportView, { kind: 'metric' }> => report.kind === 'metric'),
    [optimizeReports],
  );

  const optimizePieReports = useMemo(
    () => optimizeReports.filter((report): report is Extract<OptimizeReportView, { kind: 'pie' }> => report.kind === 'pie'),
    [optimizeReports],
  );

  const optimizeBarReports = useMemo(
    () => optimizeReports.filter((report): report is Extract<OptimizeReportView, { kind: 'bar' }> => report.kind === 'bar'),
    [optimizeReports],
  );

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

  const statusSlices = useMemo(() => {
    const counts = {
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELED: 0,
      TERMINATED: 0,
      OTHER: 0,
    }

    for (const process of processes) {
      const state = String(process.state || '').toUpperCase()
      if (state === 'ACTIVE') counts.ACTIVE += 1
      else if (state === 'COMPLETED') counts.COMPLETED += 1
      else if (state === 'CANCELED') counts.CANCELED += 1
      else if (state === 'TERMINATED') counts.TERMINATED += 1
      else counts.OTHER += 1
    }

    return [
      { label: 'Active', value: counts.ACTIVE, color: '#06b6d4' },
      { label: 'Completed', value: counts.COMPLETED, color: '#34d399' },
      { label: 'Canceled', value: counts.CANCELED, color: '#f43f5e' },
      { label: 'Terminated', value: counts.TERMINATED, color: '#f59e0b' },
      { label: 'Other', value: counts.OTHER, color: '#64748b' },
    ]
  }, [processes])

  const incidentSlices = useMemo(() => {
    const flagged = processes.filter((p) => Boolean(p.incident)).length
    const healthy = Math.max(processes.length - flagged, 0)
    return [
      { label: 'Incident', value: flagged, color: '#f43f5e' },
      { label: 'Healthy', value: healthy, color: '#2dd4bf' },
    ]
  }, [processes])

  const slaSlices = useMemo(() => {
    const buckets = {
      under1m: 0,
      oneToThree: 0,
      threeToTen: 0,
      overTen: 0,
      inProgress: 0,
      unknown: 0,
    }

    for (const process of processes) {
      const startedAt = process.startDate ? new Date(process.startDate).getTime() : NaN
      const endedAt = process.endDate ? new Date(process.endDate).getTime() : NaN
      const isActive = String(process.state || '').toUpperCase() === 'ACTIVE'

      if (!Number.isFinite(startedAt)) {
        buckets.unknown += 1
        continue
      }

      if (!Number.isFinite(endedAt)) {
        if (isActive) buckets.inProgress += 1
        else buckets.unknown += 1
        continue
      }

      const durationMs = Math.max(0, endedAt - startedAt)
      const minutes = durationMs / 60000

      if (minutes < 1) buckets.under1m += 1
      else if (minutes < 3) buckets.oneToThree += 1
      else if (minutes < 10) buckets.threeToTen += 1
      else buckets.overTen += 1
    }

    return [
      { label: '< 1 min', value: buckets.under1m, color: '#22d3ee' },
      { label: '1-3 min', value: buckets.oneToThree, color: '#3b82f6' },
      { label: '3-10 min', value: buckets.threeToTen, color: '#f59e0b' },
      { label: '10+ min', value: buckets.overTen, color: '#f43f5e' },
      { label: 'In Progress', value: buckets.inProgress, color: '#8b5cf6' },
      { label: 'Unknown', value: buckets.unknown, color: '#64748b' },
    ]
  }, [processes])

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProcesses();
    await loadOptimizeDashboards(DEFAULT_COLLECTION_ID);
    setIsRefreshing(false);
  };

  const handleStatusSliceClick = (slice: { label: string }) => {
    const state = slice.label.toUpperCase()
    if (!['ACTIVE', 'COMPLETED', 'CANCELED', 'TERMINATED'].includes(state)) {
      navigate('/processes')
      return
    }

    navigate(`/processes?state=${encodeURIComponent(state)}`)
  }

  const handleIncidentSliceClick = (slice: { label: string }) => {
    const incident = slice.label.toLowerCase() === 'incident' ? 'true' : 'false'
    navigate(`/processes?incident=${incident}`)
  }

  const handleSlaSliceClick = (slice: { label: string }) => {
    navigate(`/processes?durationBucket=${encodeURIComponent(slice.label)}`)
  }

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

        <section className="border border-border/70 bg-background p-5">
          <h2 className="text-xl font-semibold mb-4">Current Cases</h2>

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

          <div className="mt-4">
            <Suspense fallback={<MetricGridSkeleton count={3} />}>
              <section className="grid gap-3 lg:grid-cols-3">
                <DonutMetricCard
                  title="Case Status Mix"
                  subtitle="Distribution by process state"
                  slices={statusSlices}
                  onSliceClick={handleStatusSliceClick}
                />
                <DonutMetricCard
                  title="Incident Risk Split"
                  subtitle="Cases with incidents vs healthy cases"
                  slices={incidentSlices}
                  onSliceClick={handleIncidentSliceClick}
                />
                <DonutMetricCard
                  title="Resolution Time Buckets"
                  subtitle="SLA-style grouping from start to end time"
                  slices={slaSlices}
                  onSliceClick={handleSlaSliceClick}
                />
              </section>
            </Suspense>
          </div>

          <div className="my-5 border-t border-border/70" />

          <h2 className="text-xl font-semibold mb-4">Overall Support Case Metrics</h2>
          {metricsLoading ? (
            <>
              <MetricGridSkeleton count={4} />
              <p className="text-xs text-muted-foreground mt-3 animate-pulse">Loading metrics...</p>
            </>
          ) : optimizePieReports.length > 0 || optimizeBarReports.length > 0 || supportCaseMetrics.length > 0 ? (
            <>
              

              {optimizePieReports.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  {optimizePieReports.map((report) => (
                    <DonutMetricCard
                      key={report.id}
                      title={report.name}
                      subtitle="Optimize pie report"
                      slices={report.slices}
                    />
                  ))}
                </div>
              ) : null}

              {optimizeBarReports.length > 0 ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {optimizeBarReports.map((report) => {
                    const isDuration = isDurationMetricName(report.name)
                    return (
                    <BarMetricCard
                      key={report.id}
                      title={report.name}
                      subtitle="Optimize bar report"
                      slices={report.slices}
                      valueFormatter={(value) =>
                        isDuration ? formatDuration(value) : value.toLocaleString()
                      }
                    />
                    )
                  })}
                </div>
              ) : null}

              {supportCaseMetrics.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              ) : null}

              <p className="text-xs text-muted-foreground mt-3">
                Last updated: {optimizeStatsUpdatedAt ? new Date(optimizeStatsUpdatedAt).toLocaleString() : 'Loading...'}
              </p>

              {/* {metricDebugRows.length > 0 ? (
                <details className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Metric Value Debug
                  </summary>
                  <div className="mt-3 overflow-auto">
                    <table className="w-full min-w-[920px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground">
                          <th className="px-2 py-2 font-semibold">Name</th>
                          <th className="px-2 py-2 font-semibold">Report ID</th>
                          <th className="px-2 py-2 font-semibold">Chart Type</th>
                          <th className="px-2 py-2 font-semibold">Rendered Value</th>
                          <th className="px-2 py-2 font-semibold">Source</th>
                          <th className="px-2 py-2 font-semibold">Fallback</th>
                          <th className="px-2 py-2 font-semibold">Payload Shape</th>
                          <th className="px-2 py-2 font-semibold">Raw Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricDebugRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/40 align-top">
                            <td className="px-2 py-2 text-foreground">{row.name}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.id}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.chartType}</td>
                            <td className="px-2 py-2 text-foreground">{row.value}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.source}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.fallback ? 'yes' : 'no'}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.payloadShape}</td>
                            <td className="max-w-[280px] truncate px-2 py-2 text-muted-foreground" title={row.rawPreview}>
                              {row.rawPreview}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null} */}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              No Optimize metrics found for this collection yet. Sync demo data first, or verify the Optimize collection ID.
            </div>
          )}
        </section>

        <section className="mb-3 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Customer support automation flow</h3>
                    <p className="text-xs text-muted-foreground">Heatmap image set</p>
                  </div>
                </div>

                <div className="grid gap-3 bg-white p-2 lg:grid-cols-2">
                  {HEATMAP_IMAGES.map((heatmap, index) => (
                    <figure
                      key={heatmap.src}
                      className={`overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm ${
                        index === 0 ? 'lg:col-span-2' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {heatmap.label}
                        </span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition hover:border-border hover:bg-muted/40"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              Fullscreen
                            </button>
                          </DialogTrigger>
                          <DialogContent className="h-[96vh] max-w-[96vw] overflow-hidden p-0 sm:max-w-[96vw]">
                            <div className="flex h-full flex-col bg-background">
                              <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
                                <DialogTitle>{heatmap.label}</DialogTitle>
                                <DialogDescription>Fullscreen heatmap image preview</DialogDescription>
                              </DialogHeader>
                              <div className="min-h-0 flex-1 overflow-auto bg-neutral-50 p-4 dark:bg-neutral-950">
                                <img
                                  src={heatmap.src}
                                  alt={`${heatmap.label} fullscreen preview`}
                                  className="h-full w-full rounded-xl object-contain"
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <img
                        src={heatmap.src}
                        alt={`Customer support automation flow ${heatmap.label.toLowerCase()}`}
                        className={`${index === 0 ? 'max-h-[520px]' : 'max-h-[320px]'} h-full w-full object-contain`}
                      />
                    </figure>
                  ))}
                </div>
              </section>

        <section className="border border-border/70 bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Enquiries</h2>
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
