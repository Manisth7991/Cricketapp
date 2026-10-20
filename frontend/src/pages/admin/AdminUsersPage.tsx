import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Ban, CheckCircle2, Users } from 'lucide-react';
import type { UserDTO } from '@playlocal/shared';
import { useAdminMutation, useAdminUsers } from '@/hooks/useAdmin';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { adminService } from '@/services/adminService';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, errorMessage } from '@/components/ui/States';
import { formatDate, plural } from '@/utils/format';

export default function AdminUsersPage() {
  useDocumentTitle('Users');
  const { user: me } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const search = params.get('search') ?? '';
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isError, error, refetch } = useAdminUsers({
    status: status === 'all' ? undefined : status,
    search: search || undefined,
    page,
  });
  const setStatus = useAdminMutation(({ id, s }: { id: string; s: 'active' | 'blocked' }) =>
    adminService.setUserStatus(id, s),
  );
  const [target, setTarget] = useState<UserDTO | null>(null);

  const set = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) n.set(k, v);
        else n.delete(k);
      }
      if (!('page' in patch)) n.delete('page');
      return n;
    });

  const blocking = target?.status === 'active';

  return (
    <div>
      <PageHeader title="Users" subtitle="Search accounts and block abusive users." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="Filter users"
          value={status}
          onChange={(v) => set({ status: v === 'all' ? undefined : v })}
          items={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'admin', label: 'Admins' },
          ]}
        />
        <SearchInput
          label="Search users"
          placeholder="Name, email or phone"
          value={search}
          onChange={(v) => set({ search: v || undefined })}
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <div className="card">
          <EmptyState icon={<Users className="size-7" />} title="No users found" />
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-line overflow-hidden">
            {data.items.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={u.name} src={u.profileImage} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{u.name}</p>
                    {u.role === 'admin' && <Badge tone="indigo">Admin</Badge>}
                    {u.status === 'blocked' && <Badge tone="red">Blocked</Badge>}
                  </div>
                  <p className="truncate text-sm text-ink-soft">
                    {[u.email, u.phone].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-ink-faint">
                    Joined {formatDate(u.createdAt)} · {plural(u.teamCount ?? 0, 'team')} ·{' '}
                    {plural(u.tournamentCount ?? 0, 'tournament')}
                    {u.location?.city && ` · ${u.location.city}`}
                  </p>
                </div>
                {u.role !== 'admin' && u.id !== me?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={u.status === 'active' ? 'text-red-600' : 'text-primary-700'}
                    leftIcon={
                      u.status === 'active' ? (
                        <Ban className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )
                    }
                    onClick={() => setTarget(u)}
                  >
                    {u.status === 'active' ? 'Block' : 'Unblock'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={blocking ? `Block ${target?.name}?` : `Unblock ${target?.name}?`}
        description={
          blocking
            ? 'They will be signed out immediately and cannot log in.'
            : 'They will be able to log in again.'
        }
        confirmLabel={blocking ? 'Block user' : 'Unblock'}
        tone={blocking ? 'danger' : 'primary'}
        loading={setStatus.isPending}
        onConfirm={async () => {
          try {
            await setStatus.mutateAsync({ id: target!.id, s: blocking ? 'blocked' : 'active' });
            toast.success(blocking ? 'User blocked' : 'User unblocked');
            setTarget(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
