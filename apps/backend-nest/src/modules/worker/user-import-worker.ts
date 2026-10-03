import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { USER_IMPORT_JOB, USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import type { UserImportJob } from '@common/types/user-import-job';
import { redisConnection, userImportSettings } from '@core/config/bulk-import.config';
import { UserImportProcessor } from 'src/services/users/user-import-processor';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';

@Injectable()
export class UserImportWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(UserImportWorker.name);
  private worker?: Worker<UserImportJob>;
  private timer?: ReturnType<typeof setTimeout>;
  private closing = false;
  constructor(
    private readonly source: DataSource,
    private readonly processor: UserImportProcessor,
    private readonly config: ConfigService,
    @InjectQueue(USER_IMPORT_QUEUE) private readonly queue: Queue<UserImportJob>,
  ) {}

  onApplicationBootstrap() {
    const setting = userImportSettings({
      BULK_USER_IMPORT_JOB_CONCURRENCY: this.config.get<string>('BULK_USER_IMPORT_JOB_CONCURRENCY'),
    });
    this.worker = new Worker<UserImportJob>(USER_IMPORT_QUEUE, (job) => this.handle(job), {
      connection: redisConnection(
        {
          REDIS_HOST: this.config.get<string>('REDIS_HOST'),
          REDIS_PORT: this.config.get<string>('REDIS_PORT'),
          REDIS_PASSWORD: this.config.get<string>('REDIS_PASSWORD'),
        },
        true,
      ),
      concurrency: setting.jobConcurrency,
      maxStalledCount: 2,
    });
    this.worker.on('error', () =>
      this.logger.warn('Conexión de worker no disponible; se reintentará'),
    );
    this.worker.on('active', (job) =>
      this.logger.log(`USER_IMPORT started operation=${job.data.operationId} pid=${process.pid}`),
    );
    this.worker.on('completed', (job) =>
      this.logger.log(`USER_IMPORT finished operation=${job.data.operationId}`),
    );
    this.worker.on('failed', (job) => {
      if (
        job &&
        (job.attemptsMade >= (job.opts.attempts ?? 3) || job.failedReason.includes('stalled'))
      ) {
        void this.processor
          .markFailed(job.data.operationId)
          .catch(() => this.logger.warn('Estado FAILED pendiente de recuperación'));
      }
    });
    void this.recover();
  }

  async handle(job: Job<UserImportJob>) {
    if (
      job.name !== USER_IMPORT_JOB ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        job.data?.operationId ?? '',
      )
    )
      throw new UnrecoverableError('Invalid import job');
    try {
      await this.processor.process(job.data.operationId);
    } catch (error) {
      const permanent = error instanceof UnrecoverableError;
      if (permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
        await this.processor
          .markFailed(job.data.operationId)
          .catch(() => this.logger.warn('Estado FAILED pendiente de recuperación'));
      }
      // No SQL parameters, CI-derived password or hashes enter Redis error payloads/logs.
      throw permanent
        ? new UnrecoverableError('Contexto de importación inválido')
        : new Error('Fallo técnico de importación');
    }
  }

  private async recover() {
    try {
      const repo = this.source.getRepository(BulkOperation);
      for (let offset = 0; !this.closing; offset += 100) {
        const operations = await repo.find({
          where: { type: BulkOperationType.USER_IMPORT, status: BulkOperationStatus.IMPORTING },
          select: { idBulkOperation: true },
          order: { createdAt: 'ASC', idBulkOperation: 'ASC' },
          skip: offset,
          take: 100,
        });
        for (const operation of operations) {
          if (this.closing) break;
          const job = await this.queue.getJob(operation.idBulkOperation);
          const state = job ? await job.getState() : undefined;
          if (state === 'failed') await this.processor.markFailed(operation.idBulkOperation);
          else if (state === 'completed')
            await this.processor.markFailed(operation.idBulkOperation); // Inconsistent queue completion must not look successful.
          else if (!job)
            await this.queue.add(
              USER_IMPORT_JOB,
              { operationId: operation.idBulkOperation },
              { jobId: operation.idBulkOperation },
            );
        }
        if (operations.length < 100) break;
      }
    } catch {
      this.logger.warn(
        'Encolado durable pendiente; se recuperará cuando los servicios estén disponibles',
      );
    } finally {
      if (!this.closing) this.timer = setTimeout(() => void this.recover(), 30000);
    }
  }

  async onApplicationShutdown() {
    this.closing = true;
    if (this.timer) clearTimeout(this.timer);
    await this.worker?.close();
  }
}
