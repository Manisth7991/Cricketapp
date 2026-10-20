import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

export interface UserLocation {
  city?: string;
  state?: string;
  coords?: { lat: number; lng: number };
}

interface LocationContextValue {
  location: UserLocation;
  hasLocation: boolean;
  setLocation: (loc: UserLocation) => void;
  clearLocation: () => void;
  /** Ask the browser for GPS. Resolves with coords or rejects with a user-facing message. */
  requestCoords: () => Promise<{ lat: number; lng: number }>;
}

const KEY = 'pl_location';
const LocationContext = createContext<LocationContextValue | null>(null);

function read(): UserLocation {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UserLocation) : {};
  } catch {
    return {};
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, setLoc] = useState<UserLocation>(read);

  // Fall back to the profile location when nothing has been chosen on this device.
  useEffect(() => {
    if (!location.city && !location.state && user?.location?.state) {
      setLoc({ city: user.location.city, state: user.location.state });
    }
  }, [user, location.city, location.state]);

  const setLocation = useCallback((loc: UserLocation) => {
    setLoc(loc);
    try {
      localStorage.setItem(KEY, JSON.stringify(loc));
    } catch {
      /* storage unavailable (private mode) — keep in memory */
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLoc({});
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const requestCoords = useCallback(
    () =>
      new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!('geolocation' in navigator))
          return reject(new Error('Location is not supported on this device.'));
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: +pos.coords.latitude.toFixed(5),
              lng: +pos.coords.longitude.toFixed(5),
            }),
          (err) =>
            reject(
              new Error(
                err.code === err.PERMISSION_DENIED
                  ? 'Location permission denied. You can still pick your city manually.'
                  : 'Could not get your location. Please pick your city manually.',
              ),
            ),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
        );
      }),
    [],
  );

  const value = useMemo(
    () => ({
      location,
      hasLocation: Boolean(location.state || location.coords),
      setLocation,
      clearLocation,
      requestCoords,
    }),
    [location, setLocation, clearLocation, requestCoords],
  );
  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useUserLocation(): LocationContextValue {
  const ctx = use(LocationContext);
  if (!ctx) throw new Error('useUserLocation must be used within LocationProvider');
  return ctx;
}
