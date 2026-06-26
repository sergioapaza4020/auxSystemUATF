import { Test, TestingModule } from '@nestjs/testing';
import { GradeSchemeItemsController } from './grade-scheme-items.controller';
import { GradeSchemeItemsService } from 'src/services/grade-scheme-items/grade-scheme-items.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('GradeSchemeItemsController', () => {
  let controller: GradeSchemeItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeSchemeItemsController],
      providers: [{ provide: GradeSchemeItemsService, useValue: mockTestService }],
    }).compile();

    controller = module.get<GradeSchemeItemsController>(GradeSchemeItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
