import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crosshair, MapPin, X } from 'lucide-react';
import { INDIAN_STATES, tournamentLocationSchema } from '@playlocal/shared';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { useUserLocation } from '@/context/LocationContext';
import { geoService } from '@/services/geoService';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';
import { LockedNote, StepCard, StepFooter, isLocked, type StepProps } from './shared';

export function LocationStep({ tournament: t, onSaved, onBack }: StepProps) {
  const { update } = useTournamentMutations();
  const { requestCoords } = useUserLocation();
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locked = isLocked(t, 'venue');
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tournamentLocationSchema),
    defaultValues: {
      venue: {
        name: t?.venue.name ?? '',
        address: t?.venue.address ?? '',
        city: t?.venue.city ?? '',
        state: t?.venue.state ?? '',
        coordinates: t?.venue.coordinates,
      },
    },
  });
  const coords = watch('venue.coordinates');

  async function useHere() {
    setGeoMsg(null);
    setLocating(true);
    try {
      const c = await requestCoords();
      setValue('venue.coordinates', c, { shouldDirty: true });
      const place = await geoService.reverse(c.lat, c.lng).catch(() => null);
      if (place?.city && !watch('venue.city')) setValue('venue.city', place.city);
      if (
        place?.state &&
        !watch('venue.state') &&
        (INDIAN_STATES as readonly string[]).includes(place.state)
      )
        setValue('venue.state', place.state);
    } catch (e) {
      setGeoMsg(e instanceof Error ? e.message : 'Could not get location');
    } finally {
      setLocating(false);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (locked) return onSaved(t!);
    try {
      onSaved(await update.mutateAsync({ id: t!.id, body: values }));
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepCard title="Where is it?" description="Teams use this to find tournaments near them.">
        {locked && <LockedNote />}
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <Field label="Venue / ground name" error={errors.venue?.name?.message} required>
          <Input
            placeholder="e.g. Govt School Ground"
            disabled={locked}
            {...register('venue.name')}
          />
        </Field>
        <Field label="Address / landmark" error={errors.venue?.address?.message} required>
          <Input
            placeholder="e.g. Station Road, near bus stand"
            disabled={locked}
            {...register('venue.address')}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Village / City" error={errors.venue?.city?.message} required>
            <Input placeholder="e.g. Sikar" disabled={locked} {...register('venue.city')} />
          </Field>
          <Field label="State" error={errors.venue?.state?.message} required>
            <Select disabled={locked} {...register('venue.state')}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line/60">
          <p className="text-sm font-semibold">Map location (recommended)</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Standing at the venue? Save its exact location so nearby players see the distance.
            Otherwise we'll locate it from the address.
          </p>
          {coords ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-line">
              <span className="flex items-center gap-2 font-medium text-primary-800">
                <MapPin className="size-4" aria-hidden /> {coords.lat.toFixed(4)},{' '}
                {coords.lng.toFixed(4)}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => setValue('venue.coordinates', undefined, { shouldDirty: true })}
                  className="grid size-8 place-items-center rounded-full hover:bg-slate-100"
                  aria-label="Clear map location"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ) : (
            !locked && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                loading={locating}
                onClick={useHere}
                leftIcon={<Crosshair className="size-4" />}
              >
                Use my current location
              </Button>
            )
          )}
          {geoMsg && <p className="mt-2 text-xs font-medium text-amber-700">{geoMsg}</p>}
        </div>
      </StepCard>
      <StepFooter
        onBack={onBack}
        submitting={isSubmitting}
        label={locked ? 'Continue' : 'Save & continue'}
      />
    </form>
  );
}
