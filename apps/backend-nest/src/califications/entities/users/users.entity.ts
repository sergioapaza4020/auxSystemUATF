import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  idUser: number;

  @Column({ nullable: true })
  idCourse: number;

  @Column({ default: 0 })
  idCareer: number;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  avatar: string;

  @Column()
  username: string;

  @Column()
  name: string;

  @Column()
  lastname: string;

  @Column()
  ci: string;

  @Column()
  ru: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  authorId: number;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @Column({ nullable: true, default: null })
  deletedAt: Date;
}
