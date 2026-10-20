import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { playerSchema, type PlayerDTO, type PlayerInput } from '@playlocal/shared';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';

const ROLES = [
  'Captain',
  'Vice-captain',
  'Batter',
  'Bowler',
  'All-rounder',
  'Wicket keeper',
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Forward',
  'Raider',
  'Defender (Kabaddi)',
  'Substitute',
];

interface Props {
  open: boolean;
  onClose: () => void;
  player?: PlayerDTO | null;
  onSubmit: (values: PlayerInput) => Promise<unknown>;
}

export function PlayerFormModal({ open, onClose, player, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(playerSchema),
    defaultValues: { name: '', phone: '', role: '' },
  });

  useEffect(() => {
    if (open)
      reset({ name: player?.name ?? '', phone: player?.phone ?? '', role: player?.role ?? '' });
  }, [open, player, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="player-form" loading={isSubmitting}>
            {player ? 'Save changes' : 'Add player'}
          </Button>
        </>
      }
    >
      <form id="player-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <Field label="Player name" error={errors.name?.message} required>
          <Input
            autoComplete="off"
            placeholder="e.g. Vikram Saini"
            autoFocus
            {...register('name')}
          />
        </Field>
        <Field label="Role / position" error={errors.role?.message} hint="Optional">
          <Input list="player-roles" placeholder="e.g. Bowler" {...register('role')} />
        </Field>
        <datalist id="player-roles">
          {ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Field
          label="Phone number"
          error={errors.phone?.message}
          hint="Optional — visible only to you and organisers of tournaments you register for"
        >
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="98765 43210"
            {...register('phone')}
          />
        </Field>
      </form>
    </Modal>
  );
}
