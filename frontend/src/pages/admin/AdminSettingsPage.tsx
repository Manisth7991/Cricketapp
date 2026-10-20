import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { SportDTO } from '@playlocal/shared';
import { useAdminMutation, useAdminSports } from '@/hooks/useAdmin';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';
import { adminService } from '@/services/adminService';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineAlert, LoadingState, errorMessage } from '@/components/ui/States';

export default function AdminSettingsPage() {
  useDocumentTitle('Sports & settings');
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useAdminSports();
  const create = useAdminMutation((body: { name: string; icon?: string; order?: number }) =>
    adminService.createSport(body),
  );
  const update = useAdminMutation(({ id, body }: { id: string; body: Partial<SportDTO> }) =>
    adminService.updateSport(id, body),
  );
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setFormError('Enter a sport name');
    setFormError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        icon: icon.trim() || undefined,
        order: ((data?.length ?? 0) + 1) * 10,
      });
      toast.success(`${name.trim()} added`);
      setName('');
      setIcon('');
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Sports & settings"
        subtitle="Sports shown in filters, team creation and tournament creation."
      />
      <form onSubmit={add} noValidate className="card mb-6 flex flex-col gap-4 p-5">
        <h2 className="font-semibold">Add a sport</h2>
        {formError && <InlineAlert>{formError}</InlineAlert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Throwball"
              maxLength={40}
            />
          </Field>
          <Field label="Emoji icon">
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏐"
              maxLength={8}
            />
          </Field>
          <Button type="submit" loading={create.isPending} leftIcon={<Plus className="size-4" />}>
            Add
          </Button>
        </div>
      </form>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {data!.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden>
                {s.icon ?? '🏆'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-ink-faint">slug: {s.slug}</p>
              </div>
              {!s.active && <Badge tone="slate">Hidden</Badge>}
              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={async () => {
                  try {
                    await update.mutateAsync({ id: s.id, body: { active: !s.active } });
                    toast.success(s.active ? `${s.name} hidden` : `${s.name} shown`);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                {s.active ? 'Hide' : 'Show'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-soft">
        Hiding a sport removes it from pickers; existing tournaments and teams keep it.
      </p>
    </div>
  );
}
