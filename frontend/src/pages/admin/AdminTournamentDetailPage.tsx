import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flag,
  Mail,
  Phone,
  RotateCcw,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import { useAdminMutation, useAdminTournament } from '@/hooks/useAdmin';
import { useSports, sportLabel } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { adminService } from '@/services/adminService';
import { TournamentBanner } from '@/components/tournament/TournamentBanner';
import { TournamentStatusBadge, VerifiedBadge } from '@/components/tournament/Badges';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineAlert, LoadingState, errorMessage } from '@/components/ui/States';
import { formatDate, formatDateRange, formatDateTime, formatMoney, timeAgo } from '@/utils/format';

type Dialog = 'approve' | 'reject' | 'suspend' | 'reinstate' | null;

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

export default function AdminTournamentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { bySlug } = useSports();
  const { data: t, isLoading, isError, error, refetch } = useAdminTournament(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  useDocumentTitle(t ? `Review · ${t.name}` : 'Review tournament');

  const approve = useAdminMutation(() => adminService.approve(id!));
  const reject = useAdminMutation((reason: string) => adminService.reject(id!, reason));
  const suspend = useAdminMutation((reason: string) => adminService.suspend(id!, reason));
  const reinstate = useAdminMutation(() => adminService.reinstate(id!));

  if (isLoading) return <LoadingState />;
  if (isError || !t) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const contact = (
    t as typeof t & {
      organizerContact?: {
        email?: string;
        phone?: string;
        status: string;
        memberSince: string;
        tournamentCount: number;
      };
    }
  ).organizerContact;
  const openReports = (t as typeof t & { openReports?: number }).openReports ?? 0;

  async function act(fn: () => Promise<unknown>, msg: string, back = false) {
    try {
      await fn();
      toast.success(msg);
      setDialog(null);
      if (back) navigate('/admin/verification');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        back="/admin/verification"
        title={t.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TournamentStatusBadge status={t.status} />
            {t.verified && <VerifiedBadge />}
            {t.submittedAt && <span>Submitted {timeAgo(t.submittedAt)}</span>}
          </span>
        }
        actions={
          <Link
            to={`/tournaments/${t.id}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent-700 hover:bg-accent-50"
          >
            <ExternalLink className="size-4" aria-hidden /> Open listing
          </Link>
        }
      />

      {openReports > 0 && (
        <InlineAlert
          className="mb-5"
          icon={<Flag className="size-5" />}
          title={`${openReports} open report${openReports > 1 ? 's' : ''} on this tournament`}
        >
          <Link to="/admin/reports" className="underline">
            Review reports
          </Link>
        </InlineAlert>
      )}
      {t.rejectionReason && (
        <InlineAlert tone="amber" className="mb-5" title="Previously rejected">
          {t.rejectionReason}
        </InlineAlert>
      )}
      {t.suspensionReason && (
        <InlineAlert
          tone="amber"
          className="mb-5"
          title="Suspended"
          icon={<AlertTriangle className="size-5" />}
        >
          {t.suspensionReason}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <div className="card overflow-hidden">
            <TournamentBanner
              src={t.banner}
              sport={t.sport}
              sportIcon={bySlug.get(t.sport)?.icon}
              alt="Banner"
              aspect={16 / 6}
              sizes="(min-width: 1024px) 640px, 100vw"
            />
            <dl className="grid gap-4 p-5 sm:grid-cols-2">
              <Row label="Sport" value={sportLabel(bySlug, t.sport)} />
              <Row label="Dates" value={formatDateRange(t.startDate, t.endDate)} />
              <Row
                label="Registration deadline"
                value={t.registrationDeadline && formatDateTime(t.registrationDeadline)}
              />
              <Row label="Max teams" value={t.maxTeams} />
              <Row label="Entry fee" value={formatMoney(t.entryFee)} />
              <Row label="Prize money" value={t.prizeMoney ? formatMoney(t.prizeMoney) : 'None'} />
              <Row label="Venue" value={t.venue.name} />
              <Row
                label="Address"
                value={[t.venue.address, t.venue.city, t.venue.state].filter(Boolean).join(', ')}
              />
              <Row
                label="Map coordinates"
                value={
                  t.venue.coordinates
                    ? `${t.venue.coordinates.lat.toFixed(4)}, ${t.venue.coordinates.lng.toFixed(4)}`
                    : 'Not set'
                }
              />
              <Row
                label="Registered"
                value={`${t.registeredCount} teams · ${t.waitlistCount} waitlisted`}
              />
            </dl>
          </div>
          <section className="card p-5">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{t.description || '—'}</p>
            {t.prizeDetails && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Prize details</h3>
                <p className="mt-1 text-sm text-ink-soft">{t.prizeDetails}</p>
              </>
            )}
            <h3 className="mt-4 text-sm font-semibold">Rules ({t.rules.length})</h3>
            <ol className="mt-1 list-decimal pl-5 text-sm text-ink-soft">
              {t.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="font-semibold">Organiser</h2>
            <p className="mt-2 font-medium">{t.organizer?.name}</p>
            {contact && (
              <div className="mt-2 flex flex-col gap-1.5 text-sm">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 text-accent-700 hover:underline"
                  >
                    <Mail className="size-4" aria-hidden /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex items-center gap-1.5 text-accent-700 hover:underline"
                  >
                    <Phone className="size-4" aria-hidden /> {contact.phone}
                  </a>
                )}
                <p className="text-ink-soft">
                  Member since {formatDate(contact.memberSince)} · {contact.tournamentCount}{' '}
                  tournament{contact.tournamentCount === 1 ? '' : 's'} · account {contact.status}
                </p>
              </div>
            )}
          </section>

          <section className="card flex flex-col gap-2 p-5">
            <h2 className="mb-1 font-semibold">Actions</h2>
            {t.status === 'pending_verification' && (
              <>
                <Button
                  onClick={() => setDialog('approve')}
                  leftIcon={<CheckCircle2 className="size-4" />}
                >
                  Approve & publish
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => setDialog('reject')}
                  leftIcon={<XCircle className="size-4" />}
                >
                  Reject
                </Button>
              </>
            )}
            {t.status === 'published' && (
              <Button
                variant="outline"
                className="text-orange-700"
                onClick={() => setDialog('suspend')}
                leftIcon={<ShieldOff className="size-4" />}
              >
                Suspend
              </Button>
            )}
            {t.status === 'suspended' && (
              <Button
                variant="outline"
                onClick={() => setDialog('reinstate')}
                leftIcon={<RotateCcw className="size-4" />}
              >
                Reinstate
              </Button>
            )}
            {!['pending_verification', 'published', 'suspended'].includes(t.status) && (
              <p className="text-sm text-ink-soft">No actions available for this status.</p>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title="Approve and publish?"
        description="The tournament goes live immediately with a Verified badge and the organiser is notified."
        confirmLabel="Approve & publish"
        loading={approve.isPending}
        onConfirm={() =>
          void act(() => approve.mutateAsync(undefined), 'Tournament approved and published', true)
        }
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject this tournament?"
        description="The organiser sees your reason and can fix the details and resubmit."
        confirmLabel="Reject"
        tone="danger"
        reason={{
          label: 'Reason for rejection',
          required: true,
          placeholder: 'e.g. Venue address is incomplete; please add a landmark.',
        }}
        loading={reject.isPending}
        onConfirm={(reason) =>
          void act(() => reject.mutateAsync(reason), 'Tournament rejected', true)
        }
      />
      <ConfirmDialog
        open={dialog === 'suspend'}
        onClose={() => setDialog(null)}
        title="Suspend this tournament?"
        description="It disappears from discovery and registration stops. The organiser is notified."
        confirmLabel="Suspend"
        tone="danger"
        reason={{
          label: 'Reason',
          required: true,
          placeholder: 'e.g. Multiple reports of upfront payment requests',
        }}
        loading={suspend.isPending}
        onConfirm={(reason) => void act(() => suspend.mutateAsync(reason), 'Tournament suspended')}
      />
      <ConfirmDialog
        open={dialog === 'reinstate'}
        onClose={() => setDialog(null)}
        title="Reinstate this tournament?"
        description="It becomes visible and open for registration again."
        confirmLabel="Reinstate"
        loading={reinstate.isPending}
        onConfirm={() => void act(() => reinstate.mutateAsync(undefined), 'Tournament reinstated')}
      />
    </div>
  );
}
