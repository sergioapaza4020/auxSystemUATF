import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer, createConnection } from 'node:net';
import { Queue } from 'bullmq';
import { AttendanceRateLimitService } from './attendance-rate-limit.service';

const binary = process.env.ATTENDANCE_TEST_REDIS_BIN;
const isolated = binary ? describe : describe.skip;
isolated('Real Redis quota on an owned isolated server (no application store)', () => {
  it('executes the Lua atomically from two connections and admits 50 different users', async () => {
    const root = resolve(tmpdir());
    const directory = mkdtempSync(join(root, 'comb6-redis-'));
    const port = await new Promise<number>((accept, reject) => {
      const reserve = createServer();
      reserve.on('error', reject);
      reserve.listen(0, '127.0.0.1', () => {
        const address = reserve.address();
        if (!address || typeof address === 'string') return reject(new Error('No isolated port'));
        reserve.close(() => accept(address.port));
      });
    });
    const process = spawn(
      binary!,
      [
        '--bind',
        '127.0.0.1',
        '--port',
        String(port),
        '--save',
        '',
        '--appendonly',
        'no',
        '--dir',
        directory,
      ],
      { stdio: 'ignore', windowsHide: true },
    );
    let first: Queue | undefined;
    let second: Queue | undefined;
    try {
      // Read-only INFO before creating queue clients; verify the child owns this server.
      let verified = false;
      for (let retry = 0; retry < 100 && !verified; retry++) {
        verified = await new Promise<boolean>((accept) => {
          let text = '';
          const socket = createConnection({ host: '127.0.0.1', port });
          const finish = (value: boolean) => {
            socket.destroy();
            accept(value);
          };
          socket.setTimeout(500, () => finish(false));
          socket.on('error', () => finish(false));
          socket.on('connect', () => socket.write('INFO server\r\n'));
          socket.on('data', (chunk) => {
            text += chunk.toString();
            const match = /process_id:(\d+)/.exec(text);
            if (match) finish(Number(match[1]) === process.pid);
          });
        });
        if (!verified) await new Promise((accept) => setTimeout(accept, 50));
      }
      expect(verified).toBe(true);
      const options = {
        connection: { host: '127.0.0.1', port, maxRetriesPerRequest: 1, enableOfflineQueue: false },
      };
      first = new Queue('comb6-rate-first', options);
      second = new Queue('comb6-rate-second', options);
      await Promise.all([first.waitUntilReady(), second.waitUntilReady()]);
      const a = new AttendanceRateLimitService(first);
      const b = new AttendanceRateLimitService(second);
      const results = await Promise.allSettled(
        Array.from({ length: 31 }, (_, i) => (i % 2 ? a : b).check(7, 'emission')),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(30);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      await expect(
        Promise.all(
          Array.from({ length: 50 }, (_, i) => (i % 2 ? a : b).check(i + 1, 'challenge')),
        ),
      ).resolves.toHaveLength(50);
    } finally {
      await first?.close();
      await second?.close();
      process.kill();
      await new Promise((accept) => setTimeout(accept, 250));
      const target = resolve(directory);
      if (target.startsWith(root + sep) && target.includes('comb6-redis-'))
        rmSync(target, { recursive: true, force: true });
    }
  }, 30000);
});
