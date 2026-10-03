import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import { UserImportProcessor } from 'src/services/users/user-import-processor';
import { WorkerModule } from './worker.module';
import { UserImportWorker } from './user-import-worker';

it('initializes the real worker module with isolated infrastructure, without an HTTP listener', async () => {
  const source = { manager: {}, isInitialized: false };
  const consumer = { onApplicationBootstrap: jest.fn() };
  const module = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(DataSource)
    .useValue(source)
    .overrideProvider(ConfigService)
    .useValue(new ConfigService({ REDIS_HOST: 'localhost' }))
    .overrideProvider(getQueueToken(USER_IMPORT_QUEUE))
    .useValue({})
    .overrideProvider(UserImportWorker)
    .useValue(consumer)
    .compile();
  try {
    await module.init();
    expect(module.get(UserImportProcessor)).toBeInstanceOf(UserImportProcessor);
    expect(module.get(DataSource)).toBe(source);
    expect(consumer.onApplicationBootstrap).toHaveBeenCalledTimes(1);
    expect('getHttpServer' in module).toBe(false);
  } finally {
    await module.close();
  }
});
