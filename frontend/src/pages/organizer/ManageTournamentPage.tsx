import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Send,
  Timer,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import type { RegistrationDTO, RegistrationStatus } from '@playlocal/shared';
import { useTournament } from '@/hooks/useTournaments';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { useRegistrationMutations, useTournamentRegistrations } from '@/hooks/useRegistrations';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon';
import { whatsappLink } from '@/utils/whatsapp';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  RegistrationStatusBadge,
  TournamentStatusBadge,
  VerifiedBadge,
} from '@/components/tournament/Badges';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
  errorMessage,
} from '@/components/ui/States';
import { formatDateRange, formatDateTime, timeAgo } from '@/utils/format';

function Stat({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular ${tone}`}>{value}</p>
    </div>
  );
}

function RegistrationRow({
  reg,
  onConfirm,
  onDecline,
  busy,
}: {
  reg: RegistrationDTO;
  onConfirm: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = ['pending', 'confirmed', 'waitlisted'].includes(reg.status);
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={reg.team?.name ?? '?'} src={reg.team?.logo} size="md" square />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{reg.team?.name}</p>
            <RegistrationStatusBadge status={reg.status} />
            {reg.waitlistPosition && (
              <span className="text-xs font-medium text-accent-700">
                #{reg.waitlistPosition} in line
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            Captain {reg.captain?.name} · {reg.team?.playerCount}{' '}
            {reg.team?.playerCount === 1 ? 'player' : 'players'} · registered{' '}
            {timeAgo(reg.registeredAt)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
            {reg.captain?.phone && (
              <a
                href={`tel:${reg.captain.phone}`}
                className="inline-flex items-center gap-1 font-medium text-accent-700 hover:underline"
              >
                <Phone className="size-3.5" aria-hidden /> {reg.captain.phone}
              </a>
            )}
            {reg.captain?.phone && (
              <a
                href={whatsappLink(reg.captain.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#128C7E] hover:underline"
              >
                <WhatsAppIcon className="size-3.5" /> WhatsApp
              </a>
            )}
            {reg.captain?.email && (
              <a
                href={`mailto:${reg.captain.email}`}
                className="inline-flex items-center gap-1 font-medium text-accent-700 hover:underline"
              >
                <Mail className="size-3.5" aria-hidden /> {reg.captain.email}
              </a>
            )}
          </div>
          {reg.note && (
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
              “{reg.note}”
            </p>
          )}
          {reg.decisionReason && !active && (
            <p className="mt-1 text-xs text-ink-soft">Reason: {reg.decisionReason}</p>
          )}
        </div>
        {active && (
          <div className="flex w-full gap-2 sm:w-auto">
            {reg.status === 'pending' && (
              <Button size="sm" onClick={onConfirm} disabled={busy} className="flex-1 sm:flex-none">
                Confirm
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              disabled={busy}
              className="flex-1 text-red-600 sm:flex-none"
            >
              Decline
            </Button>
          </div>
        )}
      </div>
      {reg.team?.players && reg.team.players.length > 0 && (
        <div className="mt-2 pl-13">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
            aria-expanded={open}
          >
            <ChevronDown
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />{' '}
            {open ? 'Hide' : 'Show'} roster
          </button>
          {open && (
            <ol className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {reg.team.players.map((p, i) => (
                <li key={p.id} className="text-ink-soft">
                  {i + 1}. <span className="text-ink">{p.name}</span>
                  {p.role && ` · ${p.role}`}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

type RegTab = RegistrationStatus | 'all';

export default function ManageTournamentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: t, isLoading, isError, error, refetch } = useTournament(id);
  const regsQ = useTournamentRegistrations(
    t && ['published', 'completed', 'suspended', 'cancelled'].includes(t.status) ? id : undefined,
  );
  const tm = useTournamentMutations();
  const rm = useRegistrationMutations();
  useDocumentTitle(t ? `Manage · ${t.name}` : 'Manage tournament');

  const [tab, setTab] = useState<RegTab>('pending');
  const [dialog, setDialog] = useState<
    null | 'cancel' | 'delete' | 'complete' | { decline: RegistrationDTO }
  >(null);

  const regs = useMemo(() => regsQ.data ?? [], [regsQ.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: regs.length };
    for (const r of regs) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [regs]);
  const visible = tab === 'all' ? regs : regs.filter((r) => r.status === tab);

  if (isLoading) return <LoadingState />;
  if (isError || !t)
    return (
      <div className="container-page py-10">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  if (user && t.organizerId !== user.id && user.role !== 'admin')
    return <Navigate to={`/tournaments/${t.id}`} replace />;

  const started = t.startDate ? new Date(`${t.startDate}T00:00:00`).getTime() <= Date.now() : false;
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      setDialog(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <PageHeader
        back="/my-tournaments"
        title={t.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TournamentStatusBadge status={t.status} />
            {t.verified && <VerifiedBadge />}
            <span>{formatDateRange(t.startDate, t.endDate)}</span>
          </span>
        }
        actions={
          <ButtonLink
            to={`/tournaments/${t.id}`}
            variant="outline"
            size="sm"
            leftIcon={<ExternalLink className="size-4" />}
          >
            {t.status === 'published' ? 'View public page' : 'Preview'}
          </ButtonLink>
        }
      />

      {!t.contact &&
        ['draft', 'pending_verification', 'rejected', 'published'].includes(t.status) && (
          <InlineAlert
            tone="blue"
            className="mb-5"
            title="Add a WhatsApp number"
            icon={<WhatsAppIcon className="size-5" />}
          >
            Players can't message you yet.{' '}
            <Link to={`/tournaments/${t.id}/edit/basic`} className="font-semibold underline">
              Add your WhatsApp number
            </Link>{' '}
            so they can ask questions before registering.
          </InlineAlert>
        )}

      {/* Status-specific guidance + primary actions */}
      {t.status === 'draft' && (
        <InlineAlert
          tone="blue"
          className="mb-5"
          title="Draft — only you can see this"
          icon={<Pencil className="size-5" />}
        >
          Finish the details and submit it for verification.
        </InlineAlert>
      )}
      {t.status === 'pending_verification' && (
        <InlineAlert
          tone="amber"
          className="mb-5"
          title="This tournament is awaiting verification."
          icon={<Timer className="size-5" />}
        >
          Submitted {t.submittedAt ? timeAgo(t.submittedAt) : ''}. You can still edit details while
          it's pending.
        </InlineAlert>
      )}
      {t.status === 'rejected' && (
        <InlineAlert
          className="mb-5"
          title="Not approved"
          icon={<AlertTriangle className="size-5" />}
        >
          {t.rejectionReason ?? 'Please review the details.'} Update the tournament and submit it
          again.
        </InlineAlert>
      )}
      {t.status === 'suspended' && (
        <InlineAlert
          tone="amber"
          className="mb-5"
          title="Suspended by PlayLocal"
          icon={<AlertTriangle className="size-5" />}
        >
          {t.suspensionReason ?? ''} It is hidden from discovery. Contact support if you think this
          is a mistake.
        </InlineAlert>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {(t.status === 'draft' || t.status === 'rejected') && (
          <ButtonLink
            to={`/tournaments/${t.id}/edit/review`}
            leftIcon={<Send className="size-4" />}
          >
            {t.status === 'rejected' ? 'Edit & resubmit' : 'Continue & submit'}
          </ButtonLink>
        )}
        {['draft', 'pending_verification', 'rejected', 'published'].includes(t.status) && (
          <ButtonLink
            to={`/tournaments/${t.id}/edit/basic`}
            variant="outline"
            leftIcon={<Pencil className="size-4" />}
          >
            Edit details
          </ButtonLink>
        )}
        {t.status === 'published' && started && (
          <Button
            variant="outline"
            onClick={() => setDialog('complete')}
            leftIcon={<CalendarCheck className="size-4" />}
          >
            Mark completed
          </Button>
        )}
        {['pending_verification', 'published', 'suspended'].includes(t.status) && (
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setDialog('cancel')}
            leftIcon={<XCircle className="size-4" />}
          >
            Cancel tournament
          </Button>
        )}
        {(t.status === 'draft' || t.status === 'rejected') && (
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setDialog('delete')}
            leftIcon={<Trash2 className="size-4" />}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Registrations */}
      {regsQ.isFetched || regsQ.isLoading ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Teams registered" value={`${t.registeredCount}/${t.maxTeams ?? '—'}`} />
            <Stat label="Awaiting confirmation" value={counts.pending ?? 0} tone="text-amber-700" />
            <Stat label="Confirmed" value={counts.confirmed ?? 0} tone="text-primary-700" />
            <Stat label="Waitlist" value={t.waitlistCount} tone="text-accent-700" />
          </div>
          <p className="mb-4 text-sm text-ink-soft">
            Registration deadline: {formatDateTime(t.registrationDeadline)}
          </p>

          <section className="card overflow-hidden" aria-labelledby="regs-h">
            <div className="border-b border-line p-4">
              <h2 id="regs-h" className="mb-3 flex items-center gap-2 font-semibold">
                <Users className="size-5 text-primary-700" aria-hidden /> Registrations
              </h2>
              <Tabs
                label="Filter registrations"
                value={tab}
                onChange={setTab}
                items={(['pending', 'confirmed', 'waitlisted', 'all'] as RegTab[]).map((v) => ({
                  value: v,
                  label:
                    v === 'pending'
                      ? 'Pending'
                      : v === 'all'
                        ? 'All'
                        : v[0]!.toUpperCase() + v.slice(1),
                  count: counts[v] ?? 0,
                }))}
              />
            </div>
            {regsQ.isLoading ? (
              <LoadingState />
            ) : regsQ.isError ? (
              <ErrorState error={regsQ.error} onRetry={() => void regsQ.refetch()} />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Users className="size-7" />}
                title="No registrations here yet"
                description="Share your tournament link to get teams registering."
              />
            ) : (
              <ul className="divide-y divide-line">
                {visible.map((r) => (
                  <RegistrationRow
                    key={r.id}
                    reg={r}
                    busy={rm.confirm.isPending || rm.decline.isPending}
                    onConfirm={() =>
                      void run(() => rm.confirm.mutateAsync(r.id), `${r.team?.name} confirmed`)
                    }
                    onDecline={() => setDialog({ decline: r })}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Users className="size-7" />}
            title="Registrations open after verification"
            description="Once approved, teams can register and you'll manage them here."
          />
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this tournament?"
        description="All registered teams will be notified and their registrations cancelled. This cannot be undone."
        confirmLabel="Cancel tournament"
        tone="danger"
        reason={{
          label: 'Reason (shared with teams)',
          placeholder: 'e.g. Ground unavailable due to rain',
        }}
        loading={tm.cancel.isPending}
        onConfirm={(reason) =>
          void run(() => tm.cancel.mutateAsync({ id: t.id, reason }), 'Tournament cancelled')
        }
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this tournament?"
        description="The draft will be permanently deleted."
        confirmLabel="Delete"
        tone="danger"
        loading={tm.remove.isPending}
        onConfirm={() =>
          void run(async () => {
            await tm.remove.mutateAsync(t.id);
            navigate('/my-tournaments', { replace: true });
          }, 'Tournament deleted')
        }
      />
      <ConfirmDialog
        open={dialog === 'complete'}
        onClose={() => setDialog(null)}
        title="Mark as completed?"
        description="The tournament will move to Completed and stop accepting changes."
        confirmLabel="Mark completed"
        loading={tm.complete.isPending}
        onConfirm={() => void run(() => tm.complete.mutateAsync(t.id), 'Tournament completed 🏆')}
      />
      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null}
        onClose={() => setDialog(null)}
        title={`Decline ${typeof dialog === 'object' && dialog ? dialog.decline.team?.name : ''}?`}
        description="The captain will be notified. If the team held a spot, the next waitlisted team moves up."
        confirmLabel="Decline"
        tone="danger"
        reason={{ label: 'Reason (shared with the captain)', placeholder: 'Optional' }}
        loading={rm.decline.isPending}
        onConfirm={(reason) => {
          if (typeof dialog === 'object' && dialog)
            void run(
              () => rm.decline.mutateAsync({ id: dialog.decline.id, reason: reason || undefined }),
              'Registration declined',
            );
        }}
      />
    </div>
  );
}
