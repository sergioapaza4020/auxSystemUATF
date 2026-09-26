import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { firstValueFrom, of } from 'rxjs';
import { User } from 'src/entities/users/users.entity';

function responseFor(data: unknown) {
  return firstValueFrom(
    new ResponseInterceptor().intercept(new ExecutionContextHost([{}, { statusCode: 200 }]), {
      handle: () => of(data),
    }),
  );
}

describe('ResponseInterceptor', () => {
  it('should be defined', () => {
    expect(new ResponseInterceptor()).toBeDefined();
  });

  it.each([null, 'ok', [1, 2], { id: 1 }])('preserves unwrapped responses: %p', async (data) => {
    expect(await responseFor(data)).toEqual({
      status: true,
      statusCode: 200,
      message: undefined,
      data,
    });
  });

  it('preserves the existing envelope and pagination metadata without nesting data', async () => {
    const meta = { page: 2, limit: 20, total: 25, totalPages: 2 };
    expect(await responseFor({ message: 'Users', data: [{ idUser: 21 }], meta })).toEqual({
      status: true,
      statusCode: 200,
      message: 'Users',
      data: [{ idUser: 21 }],
      meta,
    });
  });

  it('removes passwords from saved entities, projections and nested sessions without mutating them', async () => {
    const createdAt = new Date('2026-01-01');
    const entity = Object.assign(new User(), { idUser: 1, password: 'hash', createdAt });
    const result = await responseFor({
      data: { user: entity, sessions: [{ user: { password: 'hash', username: 'test' } }] },
    });
    expect(result).toEqual({
      status: true,
      statusCode: 200,
      message: undefined,
      data: { user: { idUser: 1, createdAt }, sessions: [{ user: { username: 'test' } }] },
    });
    expect(entity.password).toBe('hash');
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
