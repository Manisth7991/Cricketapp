import { Navigate, useNavigate, useParams } from 'react-router';
import type { TournamentDTO } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/hooks/useTournaments';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ButtonLink } from '@/components/ui/Button';
import { TournamentStatusBadge } from '@/components/tournament/Badges';
import { STEPS, StepProgress, type StepKey } from './steps/shared';
import { BasicStep } from './steps/BasicStep';
import { LocationStep } from './steps/LocationStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { RulesStep } from './steps/RulesStep';
import { ReviewStep } from './steps/ReviewStep';

const EDITABLE = ['draft', 'pending_verification', 'rejected', 'published'];

/**
 * Multi-step create/edit flow. `/create/tournament` = new (basic step only);
 * `/tournaments/:id/edit/:step` = existing draft. Each step saves to the server,
 * so progress is never lost and the user can leave and resume any time.
 */
export default function TournamentEditorPage() {
  const { id, step: stepParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = useTournament(id);
  const t = q.data;
  const step = (STEPS.some((s) => s.key === stepParam) ? stepParam : 'basic') as StepKey;
  const idx = STEPS.findIndex((s) => s.key === step);
  useDocumentTitle(id ? `Edit · ${t?.name ?? 'Tournament'}` : 'Host a tournament');

  if (id && q.isLoading) return <LoadingState />;
  if (id && (q.isError || !t))
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (t && user && t.organizerId !== user.id && user.role !== 'admin')
    return <Navigate to={`/tournaments/${t.id}`} replace />;
  if (t && !EDITABLE.includes(t.status)) {
    return (
      <div className="container-page max-w-2xl py-10">
        <div className="card">
          <EmptyState
            title="This tournament can no longer be edited"
            description={`It is ${t.status.replace('_', ' ')}.`}
            action={<ButtonLink to={`/my-tournaments/${t.id}`}>Back to tournament</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const go = (key: StepKey, saved?: TournamentDTO) =>
    navigate(`/tournaments/${(saved ?? t)!.id}/edit/${key}`, { replace: !id });
  const next = (saved: TournamentDTO) => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]!.key, saved);
  const back = idx > 0 ? () => go(STEPS[idx - 1]!.key) : undefined;

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <PageHeader
        title={t ? 'Edit tournament' : 'Host a tournament'}
        subtitle={
          t ? (
            <span className="inline-flex items-center gap-2">
              {t.name} <TournamentStatusBadge status={t.status} />
            </span>
          ) : (
            'Takes about 3 minutes. Your progress is saved after every step.'
          )
        }
        back={t ? `/my-tournaments/${t.id}` : '/create'}
      />
      <StepProgress current={step} reachable={Boolean(t)} onJump={(k) => go(k)} />
      <div key={step} className="animate-[var(--animate-fade-in)]">
        {step === 'basic' && <BasicStep tournament={t} onSaved={next} />}
        {step === 'location' && t && <LocationStep tournament={t} onSaved={next} onBack={back} />}
        {step === 'schedule' && t && <ScheduleStep tournament={t} onSaved={next} onBack={back} />}
        {step === 'rules' && t && <RulesStep tournament={t} onSaved={next} onBack={back} />}
        {step === 'review' && t && <ReviewStep tournament={t} onBack={back!} />}
      </div>
    </div>
  );
}
