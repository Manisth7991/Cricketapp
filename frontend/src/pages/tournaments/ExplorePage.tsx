import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import {
  INDIAN_STATES,
  TOURNAMENT_AVAILABILITY,
  TOURNAMENT_SORTS,
  type TournamentAvailability,
  type TournamentQuery,
} from '@playlocal/shared';
import { useTournamentList } from '@/hooks/useTournaments';
import { useSports } from '@/hooks/useSports';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useUserLocation } from '@/context/LocationContext';
import {
  TournamentCard,
  TournamentGrid,
  TournamentGridSkeleton,
} from '@/components/tournament/TournamentCard';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { cn } from '@/utils/cn';

const AVAILABILITY_LABELS: Record<TournamentAvailability | 'all', string> = {
  all: 'All',
  open: 'Registration open',
  upcoming: 'Upcoming',
  closed: 'Closed',
  completed: 'Completed',
};
const SORT_LABELS: Record<(typeof TOURNAMENT_SORTS)[number], string> = {
  date: 'Start date',
  nearest: 'Nearest first',
  newest: 'Newly added',
  prize: 'Highest prize',
};

type FilterKey = 'sport' | 'state' | 'city' | 'startDate' | 'endDate';

export default function ExplorePage() {
  useDocumentTitle('Explore tournaments');
  const [params, setParams] = useSearchParams();
  const { sports } = useSports();
  const { location, requestCoords, setLocation } = useUserLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Search box is local state (instant typing) → debounced into the URL.
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(searchText, 350);

  const update = (patch: Record<string, string | undefined>, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if ((params.get('search') ?? '') !== debouncedSearch.trim())
      update({ search: debouncedSearch.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const sort = (params.get('sort') as TournamentQuery['sort']) ?? undefined;
  const status = (params.get('status') as TournamentAvailability | null) ?? undefined;
  const coords = location.coords;

  const query: TournamentQuery = useMemo(() => {
    const q: TournamentQuery = {
      search: params.get('search') || undefined,
      sport: params.get('sport') || undefined,
      state: params.get('state') || undefined,
      city: params.get('city') || undefined,
      startDate: params.get('startDate') || undefined,
      endDate: params.get('endDate') || undefined,
      status,
      sort: sort === 'nearest' && !coords ? undefined : sort,
      page: Number(params.get('page')) || 1,
      limit: 12,
    };
    if (coords) Object.assign(q, { lat: coords.lat, lng: coords.lng });
    return q;
  }, [params, status, sort, coords]);

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useTournamentList(query);

  const activeFilters = (['sport', 'state', 'city', 'startDate', 'endDate'] as FilterKey[]).filter(
    (k) => params.get(k),
  );

  async function enableNearest() {
    setGeoError(null);
    try {
      const c = await requestCoords();
      setLocation({ ...location, coords: c });
      update({ sort: 'nearest' });
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Could not get your location');
    }
  }

  const filterFields = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <Field label="Sport">
        <Select
          value={params.get('sport') ?? ''}
          onChange={(e) => update({ sport: e.target.value || undefined })}
        >
          <option value="">All sports</option>
          {sports.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.icon} {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="State">
        <Select
          value={params.get('state') ?? ''}
          onChange={(e) => update({ state: e.target.value || undefined })}
        >
          <option value="">All states</option>
          {INDIAN_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label="Village / City">
        <Input
          defaultValue={params.get('city') ?? ''}
          placeholder="e.g. Sikar"
          onBlur={(e) => update({ city: e.target.value.trim() || undefined })}
          onKeyDown={(e) =>
            e.key === 'Enter' && update({ city: e.currentTarget.value.trim() || undefined })
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Field label="From">
          <Input
            type="date"
            value={params.get('startDate') ?? ''}
            onChange={(e) => update({ startDate: e.target.value || undefined })}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={params.get('endDate') ?? ''}
            min={params.get('startDate') ?? undefined}
            onChange={(e) => update({ endDate: e.target.value || undefined })}
          />
        </Field>
      </div>
      {activeFilters.length > 0 && (
        <Button
          variant="ghost"
          onClick={() => update(Object.fromEntries(activeFilters.map((k) => [k, undefined])))}
        >
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Explore tournaments</h1>
        <p className="text-sm text-ink-soft">Only verified tournaments are listed.</p>
      </div>

      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="explore-search" className="sr-only">
            Search tournaments
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            id="explore-search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name, city or venue"
            className="pl-11"
            enterKeyHint="search"
          />
        </div>
        <Button
          variant="outline"
          className="relative lg:hidden"
          onClick={() => setFiltersOpen(true)}
          leftIcon={<SlidersHorizontal className="size-4" />}
        >
          <span className="hidden sm:inline">Filters</span>
          {activeFilters.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary-700 text-[11px] text-white">
              {activeFilters.length}
            </span>
          )}
        </Button>
        <label htmlFor="explore-sort" className="sr-only">
          Sort by
        </label>
        <Select
          id="explore-sort"
          className="w-auto max-w-[11rem]"
          value={query.sort ?? 'date'}
          onChange={(e) =>
            e.target.value === 'nearest' && !coords
              ? void enableNearest()
              : update({ sort: e.target.value === 'date' ? undefined : e.target.value })
          }
        >
          {TOURNAMENT_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      {geoError && <p className="mt-2 text-sm text-amber-700">{geoError}</p>}

      <Tabs
        className="mt-4"
        label="Registration status"
        items={(['all', ...TOURNAMENT_AVAILABILITY] as const).map((v) => ({
          value: v,
          label: AVAILABILITY_LABELS[v],
        }))}
        value={status ?? 'all'}
        onChange={(v) => update({ status: v === 'all' ? undefined : v })}
      />

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeFilters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update({ [k]: undefined })}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-primary-50 px-3 text-xs font-semibold text-primary-800 hover:bg-primary-100"
              aria-label={`Remove filter ${params.get(k)}`}
            >
              {k === 'sport'
                ? (sports.find((s) => s.slug === params.get(k))?.name ?? params.get(k))
                : params.get(k)}
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[272px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="card sticky top-24 p-5">
            <h2 className="mb-4 font-semibold">Filters</h2>
            {filterFields}
          </div>
        </aside>

        <section aria-live="polite" aria-busy={isLoading || isPlaceholderData}>
          {data && (
            <p className="mb-4 text-sm text-ink-soft">
              {data.meta.total} {data.meta.total === 1 ? 'tournament' : 'tournaments'}
              {query.sort === 'nearest' && ' within 150 km'}
            </p>
          )}
          {isLoading ? (
            <TournamentGridSkeleton />
          ) : isError ? (
            <div className="card">
              <ErrorState error={error} onRetry={() => void refetch()} />
            </div>
          ) : !data?.items.length ? (
            <div className="card">
              <EmptyState
                icon={<Search className="size-7" />}
                title="No tournaments match your search"
                description="Try a different sport, widen the dates or clear some filters."
                action={
                  (activeFilters.length > 0 || query.search || status) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchText('');
                        setParams({}, { replace: true });
                      }}
                    >
                      Reset all filters
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
              <TournamentGrid className="lg:grid-cols-2 xl:grid-cols-3">
                {data.items.map((t, i) => (
                  <TournamentCard key={t.id} tournament={t} priority={i < 2} />
                ))}
              </TournamentGrid>
              <Pagination
                meta={data.meta}
                onPage={(p) => {
                  update({ page: String(p) }, false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </section>
      </div>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <Button fullWidth onClick={() => setFiltersOpen(false)}>
            Show {data?.meta.total ?? ''} results
          </Button>
        }
      >
        {filterFields}
      </Modal>
    </div>
  );
}
