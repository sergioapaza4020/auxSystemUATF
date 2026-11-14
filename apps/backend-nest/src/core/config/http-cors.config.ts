import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function httpCorsOptions(origin: string | undefined): CorsOptions {
  return {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-custom-header',
    ],
    // Browsers otherwise hide Retry-After on cross-origin QR responses.
    exposedHeaders: ['Retry-After'],
  };
}
