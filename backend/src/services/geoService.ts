import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Optional OpenStreetMap Nominatim integration (GEOCODING_ENABLED). Strictly
 * best-effort: every failure returns null and never blocks the user's action.
 * Respect Nominatim's usage policy (identifying User-Agent, low volume) or point
 * GEOCODER_URL at a self-hosted / commercial instance.
 */
const TIMEOUT_MS = 4000;
const reverseCache = new Map<string, { city?: string; state?: string } | null>();

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': env.GEOCODER_USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  return res.json();
}

export async function geocode(
  parts: (string | null | undefined)[],
): Promise<{ lat: number; lng: number } | null> {
  if (!env.GEOCODING_ENABLED) return null;
  const q = parts.filter(Boolean).join(', ');
  if (!q) return null;
  try {
    const data = (await fetchJson(
      `${env.GEOCODER_URL}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,
    )) as { lat: string; lon: string }[];
    const hit = data[0];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch (err) {
    logger.warn({ err, q }, 'Geocoding failed');
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city?: string; state?: string } | null> {
  if (!env.GEOCODING_ENABLED) return null;
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`; // ~1km buckets
  if (reverseCache.has(key)) return reverseCache.get(key)!;
  try {
    const data = (await fetchJson(
      `${env.GEOCODER_URL}/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`,
    )) as {
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const result = {
      city: a.city ?? a.town ?? a.village ?? a.county ?? a.state_district,
      state: a.state,
    };
    if (reverseCache.size > 5000) reverseCache.clear();
    reverseCache.set(key, result);
    return result;
  } catch (err) {
    logger.warn({ err }, 'Reverse geocoding failed');
    return null;
  }
}
