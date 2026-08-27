import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [{ provide: EnrollmentsService, useValue: mockTestService }],
    }).compile();

    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
