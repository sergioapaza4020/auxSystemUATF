import 'dotenv/config';
import 'tsconfig-paths/register';

import { databaseConfig } from '../core/config/database/database.config';
import { DataSource } from 'typeorm';
import { extname, join } from 'node:path';

// Load one runtime only: source TS for development, compiled JS for deployment.
const extension = extname(__filename).slice(1);
const runtimePath = (path: string) => join(__dirname, path).replace(/\\/g, '/');

const AppDataSource = new DataSource({
  ...databaseConfig,
  entities: [runtimePath(`../**/*.entity.${extension}`)],
  migrations: [runtimePath(`migrations/*.${extension}`)],
});

export default AppDataSource;
