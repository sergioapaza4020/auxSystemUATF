import { RoleSeed } from '../interfaces/roles.interface';

const adminPermissions: string[] = [
  'user.get-all',
  'user.get-one-by-email',
  'user.get-one-by-username',
  'user.get-one-by-id',
  'sessions.get-all',
  'sessions.revoke-one',
  'sessions.revoke-all',
  'course.create',
  'course.get-all',
  'course.get-one-by-name',
  'course.get-one-by-id',
  'course.delete',
  'course.reactivate',
  'grade-item.get-all',
  'grade-item.create',
  'grade-item.get-one-by-name',
  'grade-item.get-one-by-id',
  'grade-item.delete',
  'grade-item.reactivate',
  'grade-scheme.get-all',
  'grade-scheme.create',
  'grade-scheme.get-one-by-name',
  'grade-scheme.get-one-by-id',
  'grade-scheme.delete',
  'grade-scheme.reactivate',
];

const studentPermissions: string[] = [
  'course.get-all',
  'grade-scheme.get-all',
  'grade-scheme.get-one-by-name',
];

const assistantPermissions: string[] = [
  ...studentPermissions,
  'grade-item.get-all',
  'grade-item.create',
  'grade-item.delete',
  'grade-item.reactivate',
  'grade-scheme.create',
  'grade-scheme.update',
  'grade-scheme.delete',
  'grade-scheme.reactivate',
];

const teacherPermissions: string[] = [];

const directorPermissions: string[] = [...teacherPermissions];

const deanPermissions: string[] = [...directorPermissions];

export const rolesData: RoleSeed[] = [
  {
    name: 'SUPERADMIN',
    description: 'Role with full access to all resources and permissions.',
    permissions: [],
  },
  {
    name: 'ADMIN',
    description: 'Role with administrative access to manage users and auditories per career.',
    permissions: adminPermissions,
  },
  {
    name: 'STUDENT',
    description: 'Student role',
    permissions: studentPermissions,
  },
  {
    name: 'ASSISTANT',
    description: 'Assitant role, this is the main role of the system',
    permissions: assistantPermissions,
  },
  {
    name: 'TEACHER',
    description: 'Teacher role just to see courses grades',
    permissions: teacherPermissions,
  },
  {
    name: 'DIRECTOR',
    description: 'Director role to watch all course grades of his/her career',
    permissions: directorPermissions,
  },
  {
    name: 'DEAN',
    description: 'Dean role to watch all course grades of his/her faculty',
    permissions: deanPermissions,
  },
];

// 'user.get-all',
// 'user.create',
// 'user.get-one-by-email',
// 'user.get-one-by-username',
// 'user.get-one-by-id',
// 'user.assign-roles',
// 'user.delete',
// 'user.reactivate',

// 'sessions.get-all',
// 'sessions.revoke-one',
// 'sessions.revoke-all',

// 'permission.get-all',
// 'permission.create',
// 'permission.get-one-by-name',
// 'permission.get-one-by-id',
// 'permission.delete',
// 'permission.reactivate',

// 'role.get-all',
// 'role.create',
// 'role.get-one-by-name',
// 'role.get-one-by-id',
// 'role.assign-permissions',
// 'role.delete',
// 'role.reactivate',

// 'course.create',
// 'course.get-all',
// 'course.get-one-by-name',
// 'course.get-one-by-id',
// 'course.delete',
// 'course.reactivate',

// 'faculty.get-all',
// 'faculty.create',
// 'faculty.get-one-by-name',
// 'faculty.get-one-by-id',
// 'faculty.delete',
// 'faculty.reactivate',

// 'career.get-all',
// 'career.create',
// 'career.get-one-by-name',
// 'career.get-one-by-id',
// 'career.delete',
// 'career.reactivate',

// 'grade-item.get-all',
// 'grade-item.create',
// 'grade-item.get-one-by-name',
// 'grade-item.get-one-by-id',
// 'grade-item.delete',
// 'grade-item.reactivate',

// 'grade-scheme.get-all',
// 'grade-scheme.create',
// 'grade-scheme.get-one-by-name',
// 'grade-scheme.get-one-by-id',
// 'grade-scheme.update',
// 'grade-scheme.delete',
// 'grade-scheme.reactivate',

// 'semester.get-all',
// 'semester.create',
// 'semester.get-one-by-id',
// 'semester.delete',
// 'semester.reactivate',
