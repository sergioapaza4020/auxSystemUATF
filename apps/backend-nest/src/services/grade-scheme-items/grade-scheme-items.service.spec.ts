import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemeItemsService } from './grade-scheme-items.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeSchemeItemsService', () => {
  let service: GradeSchemeItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: GradeSchemeItemsService, useValue: mockTestService }],
    }).compile();

    service = module.get<GradeSchemeItemsService>(GradeSchemeItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
