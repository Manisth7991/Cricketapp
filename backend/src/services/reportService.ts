import { Types } from 'mongoose';
import { ERROR_CODES, PUBLIC_TOURNAMENT_STATUSES, type ReportReason } from '@playlocal/shared';
import { Report, Tournament } from '../models';
import { ApiError } from '../utils/ApiError';

export async function createReport(
  tournamentId: string,
  actor: { id: string },
  input: { reason: ReportReason; description: string },
) {
  if (!Types.ObjectId.isValid(tournamentId)) throw ApiError.notFound('Tournament not found.');
  const t = await Tournament.findById(tournamentId).select('status organizerId').lean();
  if (!t || !(PUBLIC_TOURNAMENT_STATUSES as readonly string[]).includes(t.status))
    throw ApiError.notFound('Tournament not found.');
  if (t.organizerId.toString() === actor.id)
    throw ApiError.badRequest("You can't report your own tournament.");
  try {
    await Report.create({
      reporterId: actor.id,
      tournamentId,
      reason: input.reason,
      description: input.description,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw ApiError.conflict(
        'You have already reported this tournament. Our team is reviewing it.',
        ERROR_CODES.ALREADY_REPORTED,
      );
    }
    throw err;
  }
}
