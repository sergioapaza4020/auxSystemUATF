import { Repository } from 'typeorm';
import { Career } from 'src/entities/careers/careers.entity';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { CareersService } from './careers.service';

describe('Career context lookup', () => {
  it('filters by the primary key in SQL while retaining faculty/director and inactive-context compatibility', async () => {
    const find = jest.fn().mockResolvedValue([{ idCareer: 7, isActive: false }]);
    const service = new CareersService({ find } as unknown as Repository<Career>);
    expect(await service.getAll(RecordStatus.ALL, 7)).toEqual([{ idCareer: 7, isActive: false }]);
    expect(find).toHaveBeenCalledWith({
      where: { idCareer: 7 },
      relations: { faculty: true, director: true },
    });
  });
  it('keeps the institutional catalog local and complete without an ID filter', async () => {
    const find = jest.fn().mockResolvedValue([]);
    await new CareersService({ find } as unknown as Repository<Career>).getAll(RecordStatus.ALL);
    expect(find).toHaveBeenCalledWith({ where: {}, relations: { faculty: true, director: true } });
  });
});
