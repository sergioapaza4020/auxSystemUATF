import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemeItemsController } from './grade-scheme-items.controller';

describe('GradeSchemeItemsController', () => {
  let controller: GradeSchemeItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeSchemeItemsController],
    }).compile();

    controller = module.get<GradeSchemeItemsController>(GradeSchemeItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
