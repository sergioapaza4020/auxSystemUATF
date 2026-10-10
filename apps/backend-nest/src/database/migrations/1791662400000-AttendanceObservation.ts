import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceObservation1791662400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "attendances" ADD "observation" character varying(500)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "attendances" DROP COLUMN "observation"');
  }
}
