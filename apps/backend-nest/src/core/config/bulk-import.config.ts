export function positiveSetting(
  value: string | undefined,
  name: string,
  fallback: number,
  max: number,
): number {
  const result = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > max)
    throw new Error(`Invalid ${name}: integer between 1 and ${max} required`);
  return result;
}

export function redisConnection(env: NodeJS.ProcessEnv, worker = false) {
  if (!env.REDIS_HOST?.trim()) throw new Error('REDIS_HOST is required');
  return {
    host: env.REDIS_HOST,
    port: positiveSetting(env.REDIS_PORT, 'REDIS_PORT', 6379, 65535),
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 3000,
  };
}

export function userImportSettings(env: NodeJS.ProcessEnv) {
  return {
    batchSize: positiveSetting(
      env.BULK_USER_IMPORT_BATCH_SIZE,
      'BULK_USER_IMPORT_BATCH_SIZE',
      250,
      1000,
    ),
    bcryptConcurrency: positiveSetting(
      env.BULK_USER_IMPORT_BCRYPT_CONCURRENCY,
      'BULK_USER_IMPORT_BCRYPT_CONCURRENCY',
      4,
      32,
    ),
    jobConcurrency: positiveSetting(
      env.BULK_USER_IMPORT_JOB_CONCURRENCY,
      'BULK_USER_IMPORT_JOB_CONCURRENCY',
      1,
      8,
    ),
  };
}
