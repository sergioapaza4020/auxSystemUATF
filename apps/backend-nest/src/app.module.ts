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
import { GradeSchemeItemsModule } from './modules/grade-scheme-items/grade-scheme-items.module';
import { GradeSchemesModule } from './modules/grade-schemes/grade-schemes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    FacultiesModule,
    CareersModule,
    CoursesModule,
    GradeSchemeItemsModule,
    GradeSchemesModule,
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
