import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { LIMITS, tournamentRulesSchema } from '@playlocal/shared';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';
import { LockedNote, StepCard, StepFooter, isLocked, type StepProps } from './shared';

const toNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v);
let ruleKey = 0;

export function RulesStep({ tournament: t, onSaved, onBack }: StepProps) {
  const { update } = useTournamentMutations();
  const published = t?.status === 'published';
  const [rules, setRules] = useState(() =>
    (t?.rules.length ? t.rules : ['']).map((text) => ({ key: ++ruleKey, text })),
  );
  const [rulesError, setRulesError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tournamentRulesSchema.omit({ rules: true })),
    defaultValues: {
      entryFee: t?.entryFee ?? 0,
      prizeMoney: t?.prizeMoney ?? 0,
      prizeDetails: t?.prizeDetails ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const cleaned = rules.map((r) => r.text.trim()).filter(Boolean);
    if (cleaned.some((r) => r.length > 300))
      return setRulesError('Each rule must be at most 300 characters');
    setRulesError(null);
    try {
      const body = published ? { rules: cleaned } : { ...values, rules: cleaned };
      onSaved(await update.mutateAsync({ id: t!.id, body }));
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepCard
        title="Fees, prizes & rules"
        description="Entry fee is shown for information only — PlayLocal never collects payments."
      >
        {published && <LockedNote />}
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Entry fee per team (₹)"
            error={errors.entryFee?.message}
            hint="0 for free entry"
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={isLocked(t, 'entryFee')}
              {...register('entryFee', { setValueAs: toNumber })}
            />
          </Field>
          <Field
            label="Total prize money (₹)"
            error={errors.prizeMoney?.message}
            hint="0 if trophies only"
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              disabled={isLocked(t, 'prizeMoney')}
              {...register('prizeMoney', { setValueAs: toNumber })}
            />
          </Field>
        </div>
        <Field
          label="Prize breakdown"
          error={errors.prizeDetails?.message}
          hint="Optional · e.g. Winner ₹31,000 · Runner-up ₹15,000"
        >
          <Textarea
            rows={2}
            maxLength={500}
            disabled={isLocked(t, 'prizeDetails')}
            {...register('prizeDetails')}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Rules</legend>
          {rules.map((r, i) => (
            <div key={r.key} className="flex items-center gap-2">
              <GripVertical className="size-4 shrink-0 text-ink-faint" aria-hidden />
              <span className="w-5 text-right text-xs font-semibold text-ink-faint tabular">
                {i + 1}.
              </span>
              <Input
                aria-label={`Rule ${i + 1}`}
                value={r.text}
                maxLength={300}
                placeholder={i === 0 ? 'e.g. 8 overs per innings' : 'Another rule'}
                onChange={(e) =>
                  setRules((rs) =>
                    rs.map((x) => (x.key === r.key ? { ...x, text: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() =>
                  setRules((rs) =>
                    rs.length === 1
                      ? [{ key: ++ruleKey, text: '' }]
                      : rs.filter((x) => x.key !== r.key),
                  )
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {rulesError && <p className="text-xs font-medium text-red-600">{rulesError}</p>}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={rules.length >= LIMITS.maxRulesPerTournament}
            leftIcon={<Plus className="size-4" />}
            onClick={() => setRules((rs) => [...rs, { key: ++ruleKey, text: '' }])}
          >
            Add rule
          </Button>
        </fieldset>
      </StepCard>
      <StepFooter onBack={onBack} submitting={isSubmitting} />
    </form>
  );
}
