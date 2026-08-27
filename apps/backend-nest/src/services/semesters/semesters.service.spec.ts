import { Test, TestingModule } from '@nestjs/testing';
import { SemestersService } from './semesters.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('SemestersService', () => {
  let service: SemestersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SemestersService, { provide: SemestersService, useValue: mockTestService }],
    }).compile();

    service = module.get<SemestersService>(SemestersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
