import { Test, TestingModule } from '@nestjs/testing';
import { FacultiesController } from './faculties.controller';
import { FacultiesService } from 'src/services/faculties/faculties.service';
import { mockFacultiesService } from '@common/test-mocks/faculties.mock';

describe('FacultiesController', () => {
  let controller: FacultiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacultiesController],
      providers: [{ provide: FacultiesService, useValue: mockFacultiesService }],
    }).compile();

    controller = module.get<FacultiesController>(FacultiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
