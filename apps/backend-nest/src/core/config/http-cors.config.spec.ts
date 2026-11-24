import type { Server } from 'node:http';
import { Controller, Get, HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpCorsOptions } from './http-cors.config';

@Controller('probe')
class CorsProbe {
  @Get()
  get() {
    throw new HttpException('Too many attempts', 429);
  }
}
describe('browser access to QR rate-limit headers', () => {
  let app: INestApplication<Server>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [CorsProbe] }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.enableCors(httpCorsOptions('https://frontend.test.invalid'));
    app.use(
      (
        _request: unknown,
        response: { setHeader: (name: string, value: string) => void },
        next: () => void,
      ) => {
        response.setHeader('Retry-After', '60');
        next();
      },
    );
    await app.init();
  });
  afterAll(async () => app.close());
  it('exposes Retry-After without widening the trusted origin', async () => {
    const result = await request(app.getHttpServer())
      .get('/probe')
      .set('Origin', 'https://frontend.test.invalid')
      .expect(429);
    expect(result.headers['access-control-expose-headers']).toBe('Retry-After,X-Request-ID');
    expect(result.headers['access-control-allow-origin']).toBe('https://frontend.test.invalid');
    expect(result.headers['retry-after']).toBe('60');
  });
  it('retains the existing allowed request headers and methods', () => {
    const options = httpCorsOptions('https://frontend.test.invalid');
    expect(options.credentials).toBe(true);
    expect(options.allowedHeaders).toContain('Authorization');
    expect(options.allowedHeaders).toContain('x-custom-header');
    expect(options.methods).toContain('POST');
    expect(options.methods).toContain('PATCH');
  });
});
