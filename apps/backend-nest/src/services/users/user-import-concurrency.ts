export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  action: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('Invalid concurrency');
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await action(items[index]);
      }
    }),
  );
  return results;
}
