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

  'enrollment.get-my-enrollment',

  'grade.get-by-enrollment',
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

  'enrollment.get-managed-enrollment',
  'enrollment.get-students-by-enrollment',

  'grade.get-one',
  'grade.create',
  'grade.update',
  'grade.remove',

  'activity.get-all',
  'activity.create',
  'activity.get-by-grade-scheme-detail',
  'activity.update',
  'activity.delete',
  'activity.reactivate',

  'assistant-grade-scheme.get-one',
  'assistant-grade-scheme.create',
  'assistant-grade-scheme.update',
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
