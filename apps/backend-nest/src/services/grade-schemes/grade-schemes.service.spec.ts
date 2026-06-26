import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemesService } from './grade-schemes.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeSchemesService', () => {
  let service: GradeSchemesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: GradeSchemesService, useValue: mockTestService }],
    }).compile();

    service = module.get<GradeSchemesService>(GradeSchemesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
