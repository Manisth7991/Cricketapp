import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Crosshair, MapPin } from 'lucide-react';
import { INDIAN_STATES } from '@playlocal/shared';
import { useUserLocation } from '@/context/LocationContext';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { geoService } from '@/services/geoService';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { safeNext } from '@/components/layout/Guards';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/context/ToastContext';

export default function LocationPage() {
  useDocumentTitle('Choose your location');
  const { location, setLocation, requestCoords } = useUserLocation();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const welcome = params.get('welcome') === '1';

  const [state, setState] = useState(location.state ?? '');
  const [city, setCity] = useState(location.city ?? '');
  const [coords, setCoords] = useState(location.coords);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  async function useGps() {
    setError(null);
    setLocating(true);
    try {
      const c = await requestCoords();
      setCoords(c);
      // Best-effort reverse geocode to prefill city/state (works when enabled on the server).
      const place = await geoService.reverse(c.lat, c.lng).catch(() => null);
      if (place?.state)
        setState((INDIAN_STATES as readonly string[]).includes(place.state) ? place.state : state);
      if (place?.city) setCity(place.city);
      toast.success(
        place?.city
          ? `Located near ${place.city}`
          : 'Location found — tournaments will show distance',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!state || city.trim().length < 2) return;
    setSaving(true);
    setError(null);
    const loc = { state, city: city.trim(), coords };
    try {
      if (user) setUser(await authService.updateProfile({ location: { state, city: loc.city } }));
      setLocation(loc);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-[var(--animate-fade-in)]">
      <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-600">
        <MapPin className="size-7" aria-hidden />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">
        {welcome ? 'Where do you play?' : 'Your location'}
      </h1>
      <p className="mt-2 text-ink-soft">We'll show tournaments happening near you first.</p>

      <form onSubmit={save} noValidate className="mt-8 flex flex-col gap-5">
        {error && <InlineAlert tone="amber">{error}</InlineAlert>}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          loading={locating}
          onClick={useGps}
          leftIcon={<Crosshair className="size-5" />}
        >
          {coords ? 'Location detected — refresh' : 'Use my current location'}
        </Button>
        <div className="flex items-center gap-3 text-xs font-medium text-ink-faint uppercase">
          <span className="h-px flex-1 bg-line" /> or choose manually{' '}
          <span className="h-px flex-1 bg-line" />
        </div>
        <Field label="State" required error={touched && !state ? 'Select your state' : undefined}>
          <Select
            value={state}
            onChange={(e) => setState(e.target.value)}
            autoComplete="address-level1"
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Village / Town / City"
          required
          error={touched && city.trim().length < 2 ? 'Enter your village, town or city' : undefined}
        >
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Sikar"
            autoComplete="address-level2"
            maxLength={80}
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={saving}>
          Continue
        </Button>
        {welcome && (
          <button
            type="button"
            onClick={() => navigate(next, { replace: true })}
            className="text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Skip for now
          </button>
        )}
      </form>
    </div>
  );
}
