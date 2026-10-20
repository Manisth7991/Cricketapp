import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Flag } from 'lucide-react';
import { REPORT_REASON_LABELS, type ReportDTO, type ReportStatus } from '@playlocal/shared';
import { useAdminMutation, useAdminReports } from '@/hooks/useAdmin';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { adminService } from '@/services/adminService';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, errorMessage } from '@/components/ui/States';
import { timeAgo } from '@/utils/format';

const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  open: 'red',
  under_review: 'amber',
  resolved: 'green',
  dismissed: 'slate',
};
const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export default function AdminReportsPage() {
  useDocumentTitle('Reports');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'open') as ReportStatus | 'all';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useAdminReports({ status, page });
  const update = useAdminMutation(
    ({ id, s, note }: { id: string; s: ReportStatus; note?: string }) =>
      adminService.updateReport(id, { status: s, resolutionNote: note }),
  );
  const [closing, setClosing] = useState<{
    report: ReportDTO;
    to: 'resolved' | 'dismissed';
  } | null>(null);

  async function change(id: string, s: ReportStatus, note?: string) {
    try {
      await update.mutateAsync({ id, s, note });
      toast.success(`Report marked ${STATUS_LABEL[s].toLowerCase()}`);
      setClosing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Tournaments flagged by users as suspicious or incorrect."
      />
      <Tabs
        className="mb-5"
        label="Filter reports"
        value={status}
        onChange={(v) => setParams({ status: v })}
        items={(['open', 'under_review', 'resolved', 'dismissed', 'all'] as const).map((v) => ({
          value: v,
          label: v === 'all' ? 'All' : STATUS_LABEL[v],
        }))}
      />
      {isLoading ? (
        <Skeleton className="h-72 rounded-[var(--radius-card)]" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState
            icon={<Flag className="size-7" />}
            title="No reports here"
            description="Nice — nothing needs attention."
          />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.items.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      <span className="font-semibold">{REPORT_REASON_LABELS[r.reason]}</span>
                    </div>
                    <p className="mt-1 text-sm">
                      {r.tournament ? (
                        <Link
                          to={`/admin/tournaments/${r.tournament.id}`}
                          className="font-semibold text-accent-700 hover:underline"
                        >
                          {r.tournament.name}
                        </Link>
                      ) : (
                        'Deleted tournament'
                      )}
                      <span className="text-ink-soft">
                        {' '}
                        · reported by {r.reporter?.name ?? 'unknown'} {timeAgo(r.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-surface p-3 text-sm whitespace-pre-line">
                  {r.description}
                </p>
                {r.resolutionNote && (
                  <p className="mt-2 text-sm text-ink-soft">Note: {r.resolutionNote}</p>
                )}
                {(r.status === 'open' || r.status === 'under_review') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === 'open' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void change(r.id, 'under_review')}
                        disabled={update.isPending}
                      >
                        Start review
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setClosing({ report: r, to: 'resolved' })}>
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setClosing({ report: r, to: 'dismissed' })}
                    >
                      Dismiss
                    </Button>
                    {r.tournament && (
                      <Link
                        to={`/admin/tournaments/${r.tournament.id}`}
                        className="ml-auto inline-flex h-10 items-center px-2 text-sm font-semibold text-orange-700 hover:underline"
                      >
                        Suspend tournament →
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPage={(p) => setParams({ status, page: String(p) })} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        title={closing?.to === 'resolved' ? 'Resolve report' : 'Dismiss report'}
        description="The reporter is notified. Add a short note about what you did (optional)."
        confirmLabel={closing?.to === 'resolved' ? 'Resolve' : 'Dismiss'}
        reason={{
          label: 'Note',
          placeholder:
            closing?.to === 'resolved'
              ? 'e.g. Organiser warned; details corrected'
              : 'e.g. Details verified with organiser',
        }}
        loading={update.isPending}
        onConfirm={(note) =>
          closing && void change(closing.report.id, closing.to, note || undefined)
        }
      />
    </div>
  );
}
