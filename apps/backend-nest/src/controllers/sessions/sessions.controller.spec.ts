import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { mockSessionService } from '@common/test-mocks/sessions.mock';

describe('SessionsController', () => {
  let controller: SessionsController;
  const getAllSessions = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionsService, useValue: { ...mockSessionService, getAllSessions } },
      ],
    }).compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the page query and keeps data/meta at the interceptor level', async () => {
    const result = { data: [], meta: { page: 2, limit: 10, total: 43, totalPages: 5 } };

    getAllSessions.mockResolvedValueOnce(result);
    expect(await controller.getAllSessions({ page: 2, limit: 10 })).toEqual({
      message: 'Sesiones recuperadas con éxito',
      ...result,
    });
    expect(getAllSessions).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });
});
