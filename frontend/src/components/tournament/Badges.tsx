import { BadgeCheck, Clock, Hourglass, Lock, Users } from 'lucide-react';
import type {
  RegistrationAvailability,
  RegistrationStatus,
  TournamentStatus,
} from '@playlocal/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge tone="blue" icon={<BadgeCheck className="size-3.5" aria-hidden />} className={className}>
      Verified
    </Badge>
  );
}

const STATUS: Record<TournamentStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  pending_verification: { label: 'Pending verification', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  published: { label: 'Published', tone: 'green' },
  suspended: { label: 'Suspended', tone: 'orange' },
  completed: { label: 'Completed', tone: 'indigo' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const AVAIL: Record<
  RegistrationAvailability,
  { label: string; tone: BadgeTone; icon: typeof Clock }
> = {
  open: { label: 'Registration open', tone: 'green', icon: Users },
  waitlist: { label: 'Waitlist open', tone: 'amber', icon: Hourglass },
  full: { label: 'Full', tone: 'red', icon: Lock },
  closed: { label: 'Registration closed', tone: 'slate', icon: Lock },
  unavailable: { label: 'Not open', tone: 'slate', icon: Clock },
};

export function AvailabilityBadge({
  availability,
  short,
}: {
  availability: RegistrationAvailability;
  short?: boolean;
}) {
  const a = AVAIL[availability];
  const Icon = a.icon;
  const label = short
    ? a.label.replace('Registration ', '').replace(/^\w/, (c) => c.toUpperCase())
    : a.label;
  return (
    <Badge tone={a.tone} icon={<Icon className="size-3.5" aria-hidden />}>
      {label}
    </Badge>
  );
}

const REG: Record<RegistrationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Awaiting organiser', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  waitlisted: { label: 'Waitlisted', tone: 'blue' },
  withdrawn: { label: 'Withdrawn', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const r = REG[status];
  return <Badge tone={r.tone}>{r.label}</Badge>;
}
