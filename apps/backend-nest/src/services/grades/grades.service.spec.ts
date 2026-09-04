import { Test, TestingModule } from '@nestjs/testing';
import { GradesService } from './grades.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradesService', () => {
  let service: GradesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: GradesService, useValue: mockTestService }],
    }).compile();

    service = module.get<GradesService>(GradesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
