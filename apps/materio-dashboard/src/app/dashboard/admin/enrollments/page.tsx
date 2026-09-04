'use client';

import { useEffect, useState } from 'react';

import { getCourses } from '@/api/courses.service';
import { createEnrollment } from '@/api/enrollments.service';
import { getUsers } from '@/api/users.service';

import { userRoles } from '@/data/user-role.data';
import { UserRole } from '@/enums/userRole';

import { useCurrentSemester } from '@/hooks/semesters';
import { useSnackbar } from '@/hooks/useSnackbar';

import type { ICourse } from '@/interfaces/courses/course.interface';
import type { IUser } from '@/interfaces/users/user.interface';

import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

import { EnrollmentCreate } from '@/views/admin/enrollments/EnrollmentForm';

export default function EnrollmentsPage() {
  const snackbar = useSnackbar();

  const [users, setUsers] = useState<IUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [courses, setCourses] = useState<ICourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const { semester, loading: loadingSemester } = useCurrentSemester();

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);

      try {
        const data = await getUsers({
          role: [UserRole.STUDENT, UserRole.ASSISTANT],
          page: 1,
          limit: 20,
        });

        setUsers(data);
      } catch (error) {
        snackbar.error(getApiErrorMessage(error));
      } finally {
        setLoadingUsers(false);
      }
    };

    const loadCourses = async () => {
      setLoadingCourses(true);

      try {
        const data = await getCourses();

        setCourses(data);
      } catch (error) {
        snackbar.error(getApiErrorMessage(error));
      } finally {
        setLoadingCourses(false);
      }
    };

    void loadUsers();
    void loadCourses();
  }, [snackbar]);

  const handleEnroll = async (usernames: string[], courseCode: string, role: UserRole) => {
    if (!semester) {
      snackbar.error('No existe un semestre activo');

      return;
    }

    try {
      for (const username of usernames) {
        await createEnrollment({
          username,
          courseCode,
          role,
          semester: `${semester.period}-${semester.year}`,
        });
      }

      snackbar.success(`${usernames.length} usuario(s) matriculado(s) correctamente`);
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    }
  };

  return (
    <EnrollmentCreate
      users={users}
      courses={courses}
      semester={semester}
      loadingUsers={loadingUsers}
      loadingCourses={loadingCourses}
      loadingSemester={loadingSemester}
      userRoles={userRoles}
      onEnroll={handleEnroll}
    />
  );
}
