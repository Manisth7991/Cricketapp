import type { TournamentDTO } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router';
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon';
import { whatsappLink } from '@/utils/whatsapp';
import { cn } from '@/utils/cn';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none active:scale-[0.98]';
const GREEN = 'bg-[#128C7E] text-white shadow-sm hover:bg-[#0f7a6d]';
const OUTLINE = 'bg-white text-ink ring-1 ring-line ring-inset hover:bg-slate-50';
/** Same height as the large Register button; `compact` = square icon button for the mobile bar. */
const size = (compact?: boolean) => (compact ? 'size-13 shrink-0' : 'h-13 w-full px-4 text-base');

/**
 * "Chat on WhatsApp" for players. The API includes the number only when this viewer may see it:
 * guests get a login prompt; with "registered teams only" visibility, non-members get a hint.
 * `compact` renders an icon-only button for the mobile action bar.
 */
export function ContactOrganiser({ t, compact }: { t: TournamentDTO; compact?: boolean }) {
  const { user } = useAuth();
  if (!t.contact || user?.id === t.organizerId) return null;

  if (t.contact.whatsapp) {
    const text = `Hi${t.organizer ? ` ${t.organizer.name}` : ''}, I saw "${t.name}" on PlayLocal and have a question.\n${window.location.origin}/tournaments/${t.id}`;
    return (
      <a
        href={whatsappLink(t.contact.whatsapp, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={compact ? 'Chat with the organiser on WhatsApp' : undefined}
        className={cn(BASE, GREEN, size(compact))}
      >
        <WhatsAppIcon className="size-5 shrink-0" />
        {!compact && 'Chat on WhatsApp'}
      </a>
    );
  }

  if (!user) {
    const to = `/login?next=${encodeURIComponent(`/tournaments/${t.id}`)}`;
    return (
      <Link
        to={to}
        aria-label={compact ? 'Log in to chat with the organiser' : undefined}
        className={cn(BASE, OUTLINE, size(compact))}
      >
        <WhatsAppIcon className="size-5 shrink-0 text-[#128C7E]" />
        {!compact && 'Log in to chat with organiser'}
      </Link>
    );
  }

  // Logged in, but the organiser only talks to teams that have joined.
  return compact ? null : (
    <p className="flex items-center gap-2 text-xs text-ink-soft">
      <WhatsAppIcon className="size-4 shrink-0 text-[#128C7E]" />
      Register a team to chat with the organiser on WhatsApp.
    </p>
  );
}
