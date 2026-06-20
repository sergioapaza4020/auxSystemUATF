import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { mockRolesService } from '@common/test-mocks/roles.mock';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService, { provide: RolesService, useValue: mockRolesService }],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
