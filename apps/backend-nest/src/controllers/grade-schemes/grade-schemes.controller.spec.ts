import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemesController } from './grade-schemes.controller';

describe('GradeSchemesController', () => {
  let controller: GradeSchemesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeSchemesController],
    }).compile();

    controller = module.get<GradeSchemesController>(GradeSchemesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
