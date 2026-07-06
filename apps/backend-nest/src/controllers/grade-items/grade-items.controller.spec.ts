import { Test, TestingModule } from '@nestjs/testing';
import { GradeItemsController } from './grade-items.controller';
import { GradeItemsService } from 'src/services/grade-items/grade-items.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeItemsController', () => {
  let controller: GradeItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeItemsController],
      providers: [{ provide: GradeItemsService, useValue: mockTestService }],
    }).compile();

    controller = module.get<GradeItemsController>(GradeItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
