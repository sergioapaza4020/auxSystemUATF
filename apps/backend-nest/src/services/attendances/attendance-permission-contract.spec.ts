import { Server } from 'node:http';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { Test } from '@nestjs/testing';
import { AssistantGradeSchemesController } from 'src/controllers/grade-schemes/assistant-grade-schemes.controller';
import { AssistantGradeSchemesService } from 'src/services/grade-schemes/assistant-grade-schemes.service';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { AssistantGradeSchemeUpdateDto } from 'src/dtos/assistant-grade-schemes/assistant-grade-scheme.dto';

const payload = (permissionWeight: number, assistantPercentage: number | string = 20) => ({
  assistantPercentage,
  details: [{ percentage: 100, permissionWeight, order: 1, gradeItem: { idGradeItem: 5 } }],
});
describe('Permission configuration update contract', () => {
  it('reproduces the 400 validation response for a PostgreSQL numeric string forwarded unchanged', async () => {
    const pipe = createValidationPipe();
    try {
      await pipe.transform(payload(0.505, '20.00'), {
        type: 'body',
        metatype: AssistantGradeSchemeUpdateDto,
      });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      if (!(error instanceof BadRequestException)) throw error;
      expect(error.getStatus()).toBe(400);
      expect(JSON.stringify(error.getResponse())).toContain(
        'assistantPercentage must be a number conforming to the specified constraints',
      );
    }
  });
  it.each([0, 0.25, 0.333, 0.5, 0.505, 1])(
    'accepts normalized decimal %s with the actual global validation pipe',
    async (weight) => {
      const dto: unknown = await createValidationPipe().transform(payload(weight), {
        type: 'body',
        metatype: AssistantGradeSchemeUpdateDto,
      });
      if (!(dto instanceof AssistantGradeSchemeUpdateDto))
        throw new Error('Expected transformed DTO');
      expect(dto.details[0].permissionWeight).toBe(weight);
    },
  );
  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid normalized weight %s',
    async (weight) => {
      await expect(
        createValidationPipe().transform(payload(weight), {
          type: 'body',
          metatype: AssistantGradeSchemeUpdateDto,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('Permission HTTP response contract (isolated, without database)', () => {
  it('captures the failing PUT and accepts the normalized payload through the current controller/interceptor', async () => {
    const wire = {
      idGradeScheme: 8,
      assistantPercentage: '20.00',
      details: [
        { percentage: 100, permissionWeight: 0.5, order: 1, gradeItem: { idGradeItem: 5 } },
      ],
    };
    const service = {
      getMyScheme: jest.fn().mockResolvedValue(wire),
      update: jest.fn((_user: number, _scheme: number, dto: AssistantGradeSchemeUpdateDto) =>
        Promise.resolve({ ...wire, details: dto.details }),
      ),
    };
    const module = await Test.createTestingModule({
      controllers: [AssistantGradeSchemesController],
      providers: [{ provide: AssistantGradeSchemesService, useValue: service }],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user: { idUser: 2 } });
      next();
    });
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    try {
      await app.init();
      const server: unknown = app.getHttpServer();
      if (!(server instanceof Server)) throw new Error('Expected HTTP server');
      const initial = await request(server)
        .get('/api/assistant-grade-schemes/course/3?enrollmentId=20')
        .expect(200);
      expect(initial.body).toMatchObject({
        status: true,
        statusCode: 200,
        data: { assistantPercentage: '20.00' },
      });
      const failed = await request(server)
        .put('/api/assistant-grade-schemes/8')
        .send(payload(0.505, '20.00'))
        .expect(400);
      expect(JSON.stringify(failed.body)).toContain(
        'assistantPercentage must be a number conforming to the specified constraints',
      );
      expect(service.update).not.toHaveBeenCalled();
      const saved = await request(server)
        .put('/api/assistant-grade-schemes/8')
        .send(payload(0.505, 20))
        .expect(200);
      expect(saved.body).toMatchObject({
        status: true,
        statusCode: 200,
        data: { details: [{ permissionWeight: 0.505 }] },
      });
      expect(service.update).toHaveBeenCalledWith(2, 8, payload(0.505, 20));
    } finally {
      await app.close();
    }
  });
});
