import { Test, TestingModule } from '@nestjs/testing';
import { CareersService } from './careers.service';
import { mockCareersService } from '@common/test-mocks/careers.mock';

describe('CareersService', () => {
  let service: CareersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: CareersService, useValue: mockCareersService }],
    }).compile();

    service = module.get<CareersService>(CareersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
