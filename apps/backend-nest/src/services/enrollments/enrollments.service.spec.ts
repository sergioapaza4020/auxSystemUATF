import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentsService } from './enrollments.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: EnrollmentsService, useValue: mockTestService }],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
