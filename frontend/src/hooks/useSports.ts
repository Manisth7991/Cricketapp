import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SportDTO } from '@playlocal/shared';
import { sportService } from '@/services/sportService';
import { qk } from '@/lib/queryKeys';

/** Sports change rarely — cache for an hour and share across the app. */
export function useSports() {
  const query = useQuery({
    queryKey: qk.sports,
    queryFn: sportService.list,
    staleTime: 60 * 60_000,
    gcTime: Infinity,
  });
  const bySlug = useMemo(() => new Map((query.data ?? []).map((s) => [s.slug, s])), [query.data]);
  return { ...query, sports: query.data ?? [], bySlug };
}

export function sportLabel(bySlug: Map<string, SportDTO>, slug: string): string {
  const s = bySlug.get(slug);
  return s ? s.name : slug.charAt(0).toUpperCase() + slug.slice(1);
}
