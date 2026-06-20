import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemesService } from './grade-schemes.service';

describe('GradeSchemesService', () => {
  let service: GradeSchemesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GradeSchemesService],
    }).compile();

    service = module.get<GradeSchemesService>(GradeSchemesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
