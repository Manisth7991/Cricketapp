import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ClipboardList } from 'lucide-react';
import type { RegistrationDTO } from '@playlocal/shared';
import { useMyRegistrations, useRegistrationMutations } from '@/hooks/useRegistrations';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { RegistrationCard } from '@/components/tournament/RegistrationCard';
import { ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, errorMessage } from '@/components/ui/States';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Awaiting organiser' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'all', label: 'All' },
];

export default function MyRegistrationsPage() {
  useDocumentTitle('My registrations');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'active';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useMyRegistrations(status, page);
  const { withdraw } = useRegistrationMutations();
  const toast = useToast();
  const [target, setTarget] = useState<RegistrationDTO | null>(null);

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <PageHeader
        title="My registrations"
        subtitle="Teams you've registered for tournaments."
        back="/activity"
      />
      <Tabs
        label="Filter registrations"
        items={TABS}
        value={status}
        onChange={(v) => setParams({ status: v })}
      />
      <div className="mt-5 flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius-card)]" />
          ))
        ) : isError ? (
          <div className="card">
            <ErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : !data?.items.length ? (
          <div className="card">
            <EmptyState
              icon={<ClipboardList className="size-7" />}
              title="No registrations here"
              description="When you register a team for a tournament, it will show up here."
              action={<ButtonLink to="/explore">Find a tournament</ButtonLink>}
            />
          </div>
        ) : (
          <>
            {data.items.map((r) => (
              <RegistrationCard key={r.id} reg={r} onWithdraw={setTarget} />
            ))}
            <Pagination meta={data.meta} onPage={(p) => setParams({ status, page: String(p) })} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Withdraw this registration?"
        description={`${target?.team?.name} will be removed from ${target?.tournament?.name}. If the tournament is full, the next waitlisted team will take your spot.`}
        confirmLabel="Withdraw"
        tone="danger"
        loading={withdraw.isPending}
        onConfirm={async () => {
          try {
            await withdraw.mutateAsync(target!.id);
            toast.success('Registration withdrawn');
            setTarget(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
