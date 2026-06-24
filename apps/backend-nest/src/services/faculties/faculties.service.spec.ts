import { Test, TestingModule } from '@nestjs/testing';
import { FacultiesService } from './faculties.service';
import { mockFacultiesService } from '@common/test-mocks/faculties.mock';

describe('FacultiesService', () => {
  let service: FacultiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: FacultiesService, useValue: mockFacultiesService }],
    }).compile();

    service = module.get<FacultiesService>(FacultiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
