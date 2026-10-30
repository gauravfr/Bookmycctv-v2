import { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import type { AppLogger } from '../../config/logger.js';
import type { NotificationService } from '../notifications/notification.service.js';
import { JobModel } from './job.model.js';
export class JobRunner {
  private timer?: NodeJS.Timeout;
  private running = false;
  public constructor(
    private readonly config: AppConfig,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
  ) {}
  public start() {
    if (!this.config.JOB_WORKER_ENABLED || this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.config.JOB_POLL_INTERVAL_MS);
    this.timer.unref();
  }
  public stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  public async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < this.config.JOB_BATCH_SIZE; i++) {
        const job = await JobModel.findOneAndUpdate(
          {
            status: { $in: ['PENDING', 'FAILED'] },
            availableAt: { $lte: new Date() },
            attempts: { $lt: 5 },
          },
          { $set: { status: 'PROCESSING', lockedAt: new Date() }, $inc: { attempts: 1 } },
          { new: true, sort: { createdAt: 1 } },
        );
        if (!job) break;
        try {
          if (job.type === 'NOTIFICATION_DISPATCH')
            await this.notifications.dispatch(
              new Types.ObjectId(String(job.payload.eventId)),
              new Types.ObjectId(String(job.payload.ruleId)),
            );
          else if (job.type === 'PUSH_RECEIPTS')
            await JobModel.updateOne({ _id: job._id }, { status: 'COMPLETED' });
          job.status = 'COMPLETED';
          await job.save();
        } catch (error) {
          job.status = job.attempts >= job.maxAttempts ? 'DEAD' : 'FAILED';
          job.lastErrorCode = error instanceof Error ? error.name : 'JOB_FAILED';
          job.availableAt = new Date(Date.now() + Math.min(300000, 1000 * 2 ** job.attempts));
          await job.save();
          this.logger.error(
            { jobId: job.id, type: job.type, code: job.lastErrorCode },
            'Background job failed',
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
  public async health() {
    return {
      enabled: this.config.JOB_WORKER_ENABLED,
      pending: await JobModel.countDocuments({ status: { $in: ['PENDING', 'FAILED'] } }),
      dead: await JobModel.countDocuments({ status: 'DEAD' }),
    };
  }
}
