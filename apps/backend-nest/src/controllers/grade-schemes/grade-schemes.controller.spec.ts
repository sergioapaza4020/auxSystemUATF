import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemesController } from './grade-schemes.controller';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeSchemesController', () => {
  let controller: GradeSchemesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeSchemesController],
      providers: [{ provide: GradeSchemesService, useValue: mockTestService }],
    }).compile();

    controller = module.get<GradeSchemesController>(GradeSchemesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
