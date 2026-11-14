import * as dotenv from 'dotenv';

import { DataSourceOptions } from 'typeorm';

dotenv.config();

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  // Extensions belong to reviewed migrations, never application startup/CLI inspection.
  installExtensions: false,
};
