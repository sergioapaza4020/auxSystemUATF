import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemeItemsService } from './grade-scheme-items.service';

describe('GradeSchemeItemsService', () => {
  let service: GradeSchemeItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GradeSchemeItemsService],
    }).compile();

    service = module.get<GradeSchemeItemsService>(GradeSchemeItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
