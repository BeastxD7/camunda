import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronLeft, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { TokenUsage } from '../components/support/token-usage';
import type { ProcessDetailsPayload, ProcessInstance } from '../types/support';
import { PageContainer } from '../components/layout/PageContainer';
import { CaseDetails } from '../components/support/case-details';

/**
 * Process Detail page - shows detailed information for a specific process instance
 */
export const ProcessDetail: React.FC = () => {
  const navigate = useNavigate();
  const { instanceKey } = useParams<{ instanceKey: string }>();
  const [details, setDetails] = useState<ProcessDetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instanceKey) {
      loadProcessDetails();
    }
  }, [instanceKey]);

  const loadProcessDetails = async () => {
    if (!instanceKey) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.support.getProcessInstanceDetails(instanceKey);
      if (response.success && response.data) {
        setDetails(response.data);
      } else {
        setError('Failed to load process details');
      }
    } catch (err) {
      console.error('Error loading process details:', err);
      setError('Error loading process details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProcessDetails();
    setIsRefreshing(false);
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/processes')}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Back to processes"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="space-y-1">
              <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">
                Case Details
              </h1>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Case {instanceKey}
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

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center rounded-lg border border-border/70 bg-background p-12">
            <div className="text-center">
              <Loader className="animate-spin mx-auto mb-4 h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Loading process details...</p>
            </div>
          </div>
        ) : !details ? (
          <div className="rounded-lg border border-border/70 bg-background p-12 text-center">
            <p className="text-sm text-muted-foreground">No process details available</p>
          </div>
        ) : (
          /* Token Usage and Details content */
          <div className="space-y-6">
            {/* Token Usage Section */}
            <div className="border border-border/70 bg-background p-5">
              <TokenUsage details={details} />
            </div>

            {/* Case Details */}
            <CaseDetails
              details={details}
              selectedCase={{
                key: instanceKey || '',
                state: String(details.instance.state || ''),
                startDate: String(details.instance.startDate || ''),
              } as ProcessInstance}
              isLoading={false}
              error={null}
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
};
