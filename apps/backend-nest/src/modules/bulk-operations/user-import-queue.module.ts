import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { USER_IMPORT_ATTEMPTS, USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import { redisConnection } from '@core/config/bulk-import.config';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: USER_IMPORT_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection({
          REDIS_HOST: config.get<string>('REDIS_HOST'),
          REDIS_PORT: config.get<string>('REDIS_PORT'),
          REDIS_PASSWORD: config.get<string>('REDIS_PASSWORD'),
        }),
        defaultJobOptions: {
          attempts: USER_IMPORT_ATTEMPTS,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class UserImportQueueModule {}
