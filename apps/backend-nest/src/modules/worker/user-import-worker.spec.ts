import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { Worker, UnrecoverableError } from 'bullmq';
import type { Job, Queue } from 'bullmq';
import { USER_IMPORT_JOB, USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import type { UserImportJob } from '@common/types/user-import-job';
import type { UserImportProcessor } from 'src/services/users/user-import-processor';
import { UserImportWorker } from './user-import-worker';

jest.mock('bullmq', () => {
  const actual: object = jest.requireActual('bullmq');
  return {
    ...actual,
    Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })),
  };
});
const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const processor = {
    process: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
  const repo = { find: jest.fn().mockResolvedValue([{ idBulkOperation: id }]) };
  const source = { getRepository: () => repo };
  const queue = {
    getJob: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
  };
  const worker = new UserImportWorker(
    source as unknown as DataSource,
    processor as unknown as UserImportProcessor,
    new ConfigService({ REDIS_HOST: 'localhost' }),
    queue as unknown as Queue<UserImportJob>,
  );
  const job = {
    name: USER_IMPORT_JOB,
    data: { operationId: id },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<UserImportJob>;
  return { worker, processor, repo, queue, job };
}

describe('Independent worker orchestration', () => {
  beforeEach(() => jest.clearAllMocks());
  it('consumes one heavy job by default and repairs missing stable jobs from durable IMPORTING state', async () => {
    const f = fixture();
    f.worker.onApplicationBootstrap();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(Worker).toHaveBeenCalledWith(
      USER_IMPORT_QUEUE,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 1,
        connection: expect.objectContaining({ maxRetriesPerRequest: null }) as unknown,
      }),
    );
    expect(f.queue.add).toHaveBeenCalledWith(USER_IMPORT_JOB, { operationId: id }, { jobId: id });
    await f.worker.onApplicationShutdown();
  });
  it('does not recreate existing jobs and recovers terminal technical failure into PostgreSQL', async () => {
    const f = fixture();
    f.queue.getJob.mockResolvedValue({ getState: () => Promise.resolve('failed') });
    f.worker.onApplicationBootstrap();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.queue.add).not.toHaveBeenCalled();
    expect(f.processor.markFailed).toHaveBeenCalledWith(id);
    await f.worker.onApplicationShutdown();
  });
  it('rethrows sanitized technical failures for BullMQ retries and marks FAILED only on the last attempt', async () => {
    const f = fixture();
    f.processor.process.mockRejectedValue(new Error('SQL parameters hash:secret'));
    await expect(f.worker.handle(f.job)).rejects.toThrow('Fallo técnico de importación');
    expect(f.processor.markFailed).not.toHaveBeenCalled();
    f.job.attemptsMade = 2;
    await expect(f.worker.handle(f.job)).rejects.toThrow('Fallo técnico de importación');
    expect(f.processor.markFailed).toHaveBeenCalledWith(id);
  });
  it('does not retry permanently invalid domain context', async () => {
    const f = fixture();
    f.processor.process.mockRejectedValue(new UnrecoverableError('role invalid'));
    await expect(f.worker.handle(f.job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(f.processor.markFailed).toHaveBeenCalledWith(id);
  });
  it('rejects malformed jobs before touching PostgreSQL', async () => {
    const f = fixture();
    f.job.data.operationId = '------------------------------------';
    await expect(f.worker.handle(f.job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(f.processor.process).not.toHaveBeenCalled();
  });
});
