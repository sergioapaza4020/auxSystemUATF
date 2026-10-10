import { Test, TestingModule } from '@nestjs/testing';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from 'src/services/attendances/attendances.service';
import { mockTestService } from '@common/test-mocks/base.mock';

describe('AttendancesController', () => {
  let controller: AttendancesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [{ provide: AttendancesService, useValue: mockTestService }],
    }).compile();

    controller = module.get<AttendancesController>(AttendancesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('protects the own attendance endpoint with the existing own enrollment permission', () => {
    expect(
      Reflect.getMetadata(
        'permissions',
        Reflect.get(AttendancesController.prototype, 'getMyAttendance') as object,
      ),
    ).toEqual(['enrollment.get-my-enrollment']);
  });

  it('passes the authenticated user to the ownership enforcing service', async () => {
    const summary = {
      totalSessions: 0,
      presentSessions: 0,
      excusedSessions: 0,
      absentSessions: 0,
      percentage: 0,
    };
    const getMyStudentAttendance = jest.fn().mockResolvedValue(summary);
    const ownController = new AttendancesController({
      getMyStudentAttendance,
    } as unknown as AttendancesService);

    expect(
      await ownController.getMyAttendance(
        {
          idUser: 5,
          idSession: 1,
          username: 'student',
          email: '',
          roles: ['STUDENT'],
          permissions: ['enrollment.get-my-enrollment'],
        },
        10,
      ),
    ).toEqual(summary);
    expect(getMyStudentAttendance).toHaveBeenCalledWith(5, 10);
  });
});
