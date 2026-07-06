import { Test, TestingModule } from '@nestjs/testing';
import { GradeItemsService } from './grade-items.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeItemsService', () => {
  let service: GradeItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: GradeItemsService, useValue: mockTestService }],
    }).compile();

    service = module.get<GradeItemsService>(GradeItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
