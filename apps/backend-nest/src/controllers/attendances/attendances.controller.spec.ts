import { Test, TestingModule } from '@nestjs/testing';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from 'src/services/attendances/attendances.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('AttendancesController', () => {
  let controller: AttendancesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [{ provide: AttendancesService, useValue: mockTestService }],
    }).compile();

    controller = module.get<AttendancesController>(AttendancesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
