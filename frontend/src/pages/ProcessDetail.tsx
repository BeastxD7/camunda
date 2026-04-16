import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronLeft, Loader } from 'lucide-react';
import { api } from '../lib/api';
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
        {/* Back button */}
        <button
          onClick={() => navigate('/processes')}
          className="support-card inline-flex w-fit items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to Processes
        </button>

        {/* Header section */}
        <div className="support-card rounded-3xl border border-border/60 px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Customer Support Case
              </p>
              <h1 className="font-heading text-3xl leading-tight md:text-4xl truncate">
                Case {instanceKey}
              </h1>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="support-card rounded-xl border border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="support-card flex justify-center rounded-3xl border border-border/60 py-12">
            <div className="text-center">
              <Loader className="animate-spin mx-auto mb-4 h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Loading process details...</p>
            </div>
          </div>
        ) : !details ? (
          <div className="support-card rounded-3xl border border-border/60 py-12 text-center">
            <p className="text-sm text-muted-foreground">No process details available</p>
          </div>
        ) : (
          /* Details content */
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
        )}
      </div>
    </PageContainer>
  );
};
