import { Test, TestingModule } from '@nestjs/testing';
import { AttendancesService } from './attendances.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('AttendancesService', () => {
  let service: AttendancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: AttendancesService, useValue: mockTestService }],
    }).compile();

    service = module.get<AttendancesService>(AttendancesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
