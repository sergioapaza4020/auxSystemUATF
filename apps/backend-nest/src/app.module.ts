import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { join } from 'path';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { FacultiesModule } from './modules/faculties/faculties.module';
import { CareersModule } from './modules/careers/careers.module';
import { CoursesModule } from './modules/courses/courses.module';
import { GradeItemsModule } from './modules/grade-items/grade-items.module';
import { GradeSchemesModule } from './modules/grade-schemes/grade-schemes.module';
import { databaseConfig } from './core/config/database/database.config';
import { SemestersModule } from './modules/semesters/semesters.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { GradesModule } from './modules/grades/grades.module';
import { ActivitiesModule } from './modules/activities/activities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      autoLoadEntities: true,
    }),
    UsersModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    FacultiesModule,
    CareersModule,
    CoursesModule,
    GradeItemsModule,
    GradeSchemesModule,
    SemestersModule,
    EnrollmentsModule,
    GradesModule,
    ActivitiesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
