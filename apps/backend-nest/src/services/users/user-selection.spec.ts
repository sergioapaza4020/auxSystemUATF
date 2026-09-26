import { DataSource } from 'typeorm';
import { User } from 'src/entities/users/users.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

class MetadataDataSource extends DataSource {
  async prepareMetadata() {
    await this.buildMetadatas();
  }
}

describe('User password query selection', () => {
  const source = new MetadataDataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });

  beforeAll(async () => {
    await source.prepareMetadata();
  });

  it('excludes the password from ordinary user and relation queries', () => {
    expect(source.getRepository(User).createQueryBuilder('user').getSql()).not.toContain(
      'password',
    );
    expect(
      source
        .getRepository(Enrollment)
        .createQueryBuilder('enrollment')
        .leftJoinAndSelect('enrollment.user', 'user')
        .getSql(),
    ).not.toContain('password');
  });

  it('allows the authentication query to explicitly select the password', () => {
    expect(
      source.getRepository(User).createQueryBuilder('user').addSelect('user.password').getSql(),
    ).toContain('password');
  });
});
