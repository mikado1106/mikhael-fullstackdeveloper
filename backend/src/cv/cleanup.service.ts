import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from './supabase-storage.service';

const RETRY_DELAY_MS = 15 * 60 * 1000;
const BATCH_SIZE = 50;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /*
   * TODO scheduler: call runOnce() periodically (e.g. every 15 min).
   * Multiple workers are safe: each task row is lease-guarded.
   */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const tasks = await this.prisma.storageCleanupTask.findMany({
        where: {
          completedAt: null,
          nextRunAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        },
        orderBy: { nextRunAt: 'asc' },
        take: BATCH_SIZE,
      });

      for (const task of tasks) {
        const leaseToken = `cleanup-${task.id}-${Date.now()}`;
        const leaseUntil = new Date(Date.now() + 2 * 60 * 1000);

        // Acquire lease so concurrent workers don't double-process.
        const leased = await this.prisma.storageCleanupTask.updateMany({
          where: {
            id: task.id,
            OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
          },
          data: { leaseToken, leaseUntil },
        });
        if (leased.count === 0) continue;

        try {
          // Safety: never delete a path that is currently the active CV.
          const isActive = await this.prisma.cvDocument.findFirst({
            where: { activeObjectPath: task.objectPath },
            select: { id: true },
          });
          if (isActive) {
            await this.markDone(task.id, 'STILL_ACTIVE');
            continue;
          }

          // Safety: never delete a path tied to a live upload attempt.
          const liveAttempt = await this.prisma.cvUploadAttempt.findFirst({
            where: {
              OR: [
                { temporaryObjectPath: task.objectPath },
                { finalObjectPath: task.objectPath },
              ],
              status: { in: ['PENDING', 'VERIFYING'] },
              expiresAt: { gt: now },
            },
            select: { id: true },
          });
          if (liveAttempt) {
            await this.defer(task.id);
            continue;
          }

          // P0 fix: re-verify active status immediately before delete to
          // minimize TOCTOU window. No other awaits between check and delete.
          const recheck = await this.prisma.cvDocument.findFirst({
            where: { activeObjectPath: task.objectPath },
            select: { id: true },
          });
          if (recheck) {
            await this.markDone(task.id, 'BECAME_ACTIVE_RACE');
            continue;
          }

          await this.storage.remove(task.objectPath);
          await this.markDone(task.id, null);
        } catch {
          // Storage errors can contain URLs. Log only a constant message.
          this.logger.warn('CV cleanup task deferred');
          await this.defer(task.id).catch(() => undefined);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async markDone(id: string, lastErrorCode: string | null) {
    await this.prisma.storageCleanupTask.update({
      where: { id },
      data: {
        completedAt: new Date(),
        lastErrorCode,
        leaseToken: null,
        leaseUntil: null,
      },
    });
  }

  private async defer(id: string) {
    await this.prisma.storageCleanupTask.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        nextRunAt: new Date(Date.now() + RETRY_DELAY_MS),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  }
}
