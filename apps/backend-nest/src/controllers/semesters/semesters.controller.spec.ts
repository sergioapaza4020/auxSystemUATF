import { Test, TestingModule } from '@nestjs/testing';
import { SemestersController } from './semesters.controller';
import { SemestersService } from 'src/services/semesters/semesters.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('SemestersController', () => {
  let controller: SemestersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemestersController],
      providers: [{ provide: SemestersService, useValue: mockTestService }],
    }).compile();

    controller = module.get<SemestersController>(SemestersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
