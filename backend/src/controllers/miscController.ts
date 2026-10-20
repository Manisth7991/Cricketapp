import type { Request, Response } from 'express';
import { z } from 'zod';
import * as sportService from '../services/sportService';
import * as geoService from '../services/geoService';
import { parseInput } from '../utils/validate';
import { ok } from '../utils/respond';

export async function listSports(_req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=300');
  ok(res, await sportService.listActive());
}

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function reverseGeocode(req: Request, res: Response) {
  const { lat, lng } = parseInput(reverseSchema, req.query);
  ok(res, await geoService.reverseGeocode(lat, lng));
}
