import type { Types } from 'mongoose';
import type { NotificationType } from '@playlocal/shared';
import { Notification } from '../models';
import { logger } from '../config/logger';
import { toNotificationDTO } from './serializers';
import { getPaging } from '../utils/pagination';
import { pageMeta } from '../utils/respond';
import { ApiError } from '../utils/ApiError';

type Id = Types.ObjectId | string;

export interface NotifyInput {
  userId: Id;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedId?: Id;
}

/**
 * Fire-and-forget: a failed notification must never fail the business action
 * that triggered it, so errors are logged and swallowed.
 */
export async function notify(items: NotifyInput | NotifyInput[]): Promise<void> {
  const docs = (Array.isArray(items) ? items : [items]).filter(Boolean);
  if (!docs.length) return;
  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    logger.warn({ err }, 'Failed to create notifications');
  }
}

export async function listForUser(userId: string, q: { page?: number; limit?: number }) {
  const { page, limit, skip } = getPaging(q);
  const [items, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ userId }),
  ]);
  return { items: items.map(toNotificationDTO), meta: pageMeta(page, limit, total) };
}

export function unreadCount(userId: string) {
  return Notification.countDocuments({ userId, read: false });
}

export async function markRead(userId: string, id: string) {
  const res = await Notification.updateOne({ _id: id, userId }, { $set: { read: true } });
  if (!res.matchedCount) throw ApiError.notFound('Notification not found.');
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
}
