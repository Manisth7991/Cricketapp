import { Link, useNavigate } from 'react-router';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  LogOut,
  MapPin,
  Megaphone,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserLocation } from '@/context/LocationContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { formatDate } from '@/utils/format';

function Row({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <span className="grid size-9 place-items-center rounded-xl bg-surface text-ink-soft">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
      <ChevronRight className="size-5 text-ink-faint" aria-hidden />
    </Link>
  );
}

export default function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, logout, isLoading } = useAuth();
  const { location } = useUserLocation();
  const navigate = useNavigate();

  if (!isLoading && !user) {
    return (
      <div className="container-page max-w-md py-12">
        <div className="card">
          <EmptyState
            title="Join PlayLocal"
            description="Log in to register teams, host tournaments and get updates."
            action={
              <div className="flex gap-2">
                <ButtonLink to="/login?next=/profile">Log in</ButtonLink>
                <ButtonLink to="/signup?next=/profile" variant="outline">
                  Sign up
                </ButtonLink>
              </div>
            }
          />
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="container-page max-w-xl py-6 sm:py-8">
      <div className="card flex items-center gap-4 p-5">
        <Avatar name={user.name} src={user.profileImage} size="xl" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{user.name}</h1>
          <p className="truncate text-sm text-ink-soft">
            {[user.email, user.phone].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
            <MapPin className="size-3.5" aria-hidden />
            {location.city || user.location?.city
              ? `${location.city ?? user.location?.city}, ${location.state ?? user.location?.state}`
              : 'No location set'}{' '}
            · Joined {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      <nav className="card mt-4 divide-y divide-line overflow-hidden" aria-label="Account">
        <Row
          to="/activity/registrations"
          icon={<ClipboardList className="size-5" />}
          label="My registrations"
        />
        <Row to="/teams" icon={<Users className="size-5" />} label="My teams" />
        <Row to="/my-tournaments" icon={<Megaphone className="size-5" />} label="My tournaments" />
        <Row to="/notifications" icon={<Bell className="size-5" />} label="Notifications" />
      </nav>

      <nav className="card mt-4 divide-y divide-line overflow-hidden" aria-label="Settings">
        <Row
          to="/settings"
          icon={<Settings className="size-5" />}
          label="Account settings"
          hint="Name, contact details, password"
        />
        <Row
          to="/location?next=/profile"
          icon={<MapPin className="size-5" />}
          label="Change location"
        />
        {user.role === 'admin' && (
          <Row to="/admin" icon={<Shield className="size-5" />} label="Admin console" />
        )}
      </nav>

      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/', { replace: true });
        }}
        className="card mt-4 flex min-h-14 w-full items-center gap-3 px-4 font-semibold text-red-600 hover:bg-red-50"
      >
        <LogOut className="size-5" aria-hidden /> Log out
      </button>
    </div>
  );
}
