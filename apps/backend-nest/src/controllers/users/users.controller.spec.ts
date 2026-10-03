import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from 'src/services/users/users.service';
import { mockUsersService } from '@common/test-mocks/users.mock';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { UserImportPreviewQueryDto } from 'src/dtos/users/users-import-preview.dto';
import { UserImportJobsService } from 'src/services/users/user-import-jobs.service';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserImportJobsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

describe('User import preview controller', () => {
  const actor: JwtPayload = {
    idUser: 17,
    idSession: 1,
    username: 'actor',
    email: 'actor@example.test',
    roles: ['SUPERADMIN'],
    permissions: ['user.create'],
  };
  const preview = {
    operationId: 'b73a79d0-02ca-4a3a-8a47-5516cae13e47',
    total: 1,
    valid: 1,
    invalid: 0,
    data: [],
    meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
  };
  const service = {
    previewImport: jest.fn().mockResolvedValue(preview),
    getImportPreview: jest.fn().mockResolvedValue(preview),
  };
  const controller = new UsersController(
    service as unknown as UsersService,
    {} as UserImportJobsService,
  );

  it('uses the authenticated actor for POST and wraps the full preview', async () => {
    const file = { originalname: 'users.xlsx' } as Express.Multer.File;
    expect(await controller.previewImport(file, 'STUDENT', actor)).toEqual({ data: preview });
    expect(service.previewImport).toHaveBeenCalledWith(file, 'STUDENT', actor.idUser);
  });

  it('uses the authenticated actor for GET and passes validated query parameters', async () => {
    const query = Object.assign(new UserImportPreviewQueryDto(), {
      page: 2,
      status: 'invalid',
      search: 'Quispe',
    });
    expect(await controller.getImportPreview(preview.operationId, query, actor)).toEqual({
      data: preview,
    });
    expect(service.getImportPreview).toHaveBeenCalledWith(preview.operationId, actor.idUser, query);
  });
});
