import { get } from './api';

export const geoService = {
  reverse: (lat: number, lng: number) =>
    get<{ city?: string; state?: string } | null>('/geo/reverse', { params: { lat, lng } }),
};
