import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { mockCoursesService } from '@common/test-mocks/courses.mock';

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: CoursesService, useValue: mockCoursesService }],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
