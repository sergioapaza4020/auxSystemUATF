import { Test, TestingModule } from '@nestjs/testing';
import { UserCoursesController } from './user-courses.controller';

describe('UserCoursesController', () => {
  let controller: UserCoursesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserCoursesController],
    }).compile();

    controller = module.get<UserCoursesController>(UserCoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
