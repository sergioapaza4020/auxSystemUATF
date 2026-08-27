import { Permission } from 'src/entities/permissions/permissions.entity';
import { DeepPartial } from 'typeorm';

export const permissionsData: DeepPartial<Permission>[] = [
  {
    name: 'user.get-all',
    description: 'Get all users',
  },
  {
    name: 'user.create',
    description: 'Create users',
  },
  {
    name: 'user.get-one-by-email',
    description: 'Get one user by email',
  },
  {
    name: 'user.get-one-by-username',
    description: 'Get one user by username',
  },
  {
    name: 'user.get-one-by-id',
    description: 'Get one user by id',
  },
  {
    name: 'user.assign-roles',
    description: 'Assign roles to a user',
  },
  {
    name: 'user.delete',
    description: 'Delete an user',
  },
  {
    name: 'user.reactivate',
    description: 'Reactivate an user',
  },

  {
    name: 'sessions.get-all',
    description: 'Get all sessions',
  },
  {
    name: 'sessions.revoke-one',
    description: 'Revoke a specific session',
  },
  {
    name: 'sessions.revoke-all',
    description: 'Revoke all sessions for a user',
  },

  {
    name: 'permission.get-all',
    description: 'Get all permissions',
  },
  {
    name: 'permission.create',
    description: 'Create permissions',
  },
  {
    name: 'permission.get-one-by-name',
    description: 'Get one permission by name',
  },
  {
    name: 'permission.get-one-by-id',
    description: 'Get one permission by id',
  },
  {
    name: 'permission.delete',
    description: 'Delete a permission',
  },
  {
    name: 'permission.reactivate',
    description: 'Reactivate a permission',
  },

  {
    name: 'role.get-all',
    description: 'Get all roles',
  },
  {
    name: 'role.create',
    description: 'Create roles',
  },
  {
    name: 'role.get-one-by-name',
    description: 'Get one role by name',
  },
  {
    name: 'role.get-one-by-id',
    description: 'Get one role by id',
  },
  {
    name: 'role.assign-permissions',
    description: 'Assign permissions to a role',
  },
  {
    name: 'role.delete',
    description: 'Delete a role',
  },
  {
    name: 'role.reactivate',
    description: 'Reactivate a role',
  },

  {
    name: 'course.create',
    description: 'Create courses',
  },
  {
    name: 'course.get-all',
    description: 'Get all courses',
  },
  {
    name: 'course.get-one-by-name',
    description: 'Get one course by name',
  },
  {
    name: 'course.get-one-by-id',
    description: 'Get one course by id',
  },
  {
    name: 'course.delete',
    description: 'Delete a course',
  },
  {
    name: 'course.reactivate',
    description: 'Reactivate a course',
  },

  {
    name: 'faculty.get-all',
    description: 'Get all faculties',
  },
  {
    name: 'faculty.create',
    description: 'Create faculties',
  },
  {
    name: 'faculty.get-one-by-name',
    description: 'Get one faculty by name',
  },
  {
    name: 'faculty.get-one-by-id',
    description: 'Get one faculty by id',
  },
  {
    name: 'faculty.delete',
    description: 'Delete a faculty',
  },
  {
    name: 'faculty.reactivate',
    description: 'Reactivate a faculty',
  },

  {
    name: 'career.get-all',
    description: 'Get all careers',
  },
  {
    name: 'career.create',
    description: 'Create careers',
  },
  {
    name: 'career.get-one-by-name',
    description: 'Get one career by name',
  },
  {
    name: 'career.get-one-by-id',
    description: 'Get one career by id',
  },
  {
    name: 'career.delete',
    description: 'Delete a career',
  },
  {
    name: 'career.reactivate',
    description: 'Reactivate a career',
  },

  {
    name: 'grade-item.get-all',
    description: 'Get all grade items',
  },
  {
    name: 'grade-item.create',
    description: 'Create grade items',
  },
  {
    name: 'grade-item.get-one-by-name',
    description: 'Get one grade item by name',
  },
  {
    name: 'grade-item.get-one-by-id',
    description: 'Get one grade item by id',
  },
  {
    name: 'grade-item.delete',
    description: 'Delete a grade item',
  },
  {
    name: 'grade-item.reactivate',
    description: 'Reactivate a grade item',
  },

  {
    name: 'grade-scheme.get-all',
    description: 'Get all grade schemes',
  },
  {
    name: 'grade-scheme.create',
    description: 'Create grade schemes',
  },
  {
    name: 'grade-scheme.get-one-by-name',
    description: 'Get one grade scheme by name',
  },
  {
    name: 'grade-scheme.get-one-by-id',
    description: 'Get one grade scheme by id',
  },
  {
    name: 'grade-scheme.update',
    description: 'Update a grade scheme by id',
  },
  {
    name: 'grade-scheme.delete',
    description: 'Delete a grade scheme',
  },
  {
    name: 'grade-scheme.reactivate',
    description: 'Reactivate a grade scheme',
  },

  {
    name: 'semester.get-all',
    description: 'Get all grade schemes',
  },
  {
    name: 'semester.create',
    description: 'Create semesters',
  },
  {
    name: 'semester.get-one-by-id',
    description: 'Get one semester by id',
  },
  {
    name: 'semester.delete',
    description: 'Delete a semester',
  },
  {
    name: 'semester.reactivate',
    description: 'Reactivate a semester',
  },
];
