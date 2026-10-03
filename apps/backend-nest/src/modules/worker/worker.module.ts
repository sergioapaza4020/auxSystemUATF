import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { databaseConfig } from '@core/config/database/database.config';
import { UserImportQueueModule } from '../bulk-operations/user-import-queue.module';
import { UserImportProcessor } from 'src/services/users/user-import-processor';
import { UserImportWorker } from './user-import-worker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '../../../.env') }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      entities: [join(__dirname, '../../entities/**/*.entity{.ts,.js}')],
    }),
    UserImportQueueModule,
  ],
  providers: [UserImportProcessor, UserImportWorker],
})
export class WorkerModule {}
