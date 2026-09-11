import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: ActivitiesService, useValue: mockTestService }],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
