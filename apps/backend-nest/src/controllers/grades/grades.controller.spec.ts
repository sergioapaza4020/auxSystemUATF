import { Test, TestingModule } from '@nestjs/testing';
import { GradesController } from './grades.controller';
import { GradesService } from 'src/services/grades/grades.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradesController', () => {
  let controller: GradesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradesController],
      providers: [{ provide: GradesService, useValue: mockTestService }],
    }).compile();

    controller = module.get<GradesController>(GradesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
