'use client';

import { Card, CardContent, Chip, Divider, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';
import { getRoleLabel } from '@/utils/roles/getRoleLabel';

interface CourseCardProps {
  enrollment: IEnrollment;
}

export function CourseCard({ enrollment }: CourseCardProps) {
  const { course, semester, role } = enrollment;

  const isStudent = role === UserRole.STUDENT;
  const isAssistant = role === UserRole.ASSISTANT;

  const gradeScheme = course.gradeScheme;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {/* Cabecera */}
          <Stack direction='row' justifyContent='space-between' alignItems='flex-start' gap={2}>
            <div>
              <Typography variant='overline' color='text.secondary'>
                {course.code}
              </Typography>

              <Typography variant='h5'>{course.name}</Typography>

              <Typography variant='body2' color='text.secondary'>
                {semester.period}-{semester.year}
              </Typography>
            </div>

            <Chip label={getRoleLabel(role as UserRole)} color={isStudent ? 'primary' : 'secondary'} size='small' />
          </Stack>

          <Divider />

          {/* Esquema de calificaciones */}
          <div>
            <Typography variant='h6' gutterBottom>
              Esquema de calificaciones
            </Typography>

            {!gradeScheme ? (
              <Typography variant='body2' color='text.secondary'>
                Esta materia todavía no tiene un esquema de calificaciones.
              </Typography>
            ) : (
              <>
                <Typography variant='subtitle1'>{gradeScheme.name}</Typography>

                {gradeScheme.description && (
                  <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                    {gradeScheme.description}
                  </Typography>
                )}

                <List dense disablePadding>
                  {[...gradeScheme.details]
                    .sort((a, b) => a.order - b.order)
                    .map((detail) => (
                      <ListItem key={detail.idGradeSchemeDetail} disableGutters>
                        <ListItemText primary={detail.gradeItem.name} />

                        <Typography variant='body2' fontWeight={600}>
                          {detail.percentage}%
                        </Typography>
                      </ListItem>
                    ))}
                </List>
              </>
            )}
          </div>

          {/* Estado según rol */}
          {isStudent && (
            <Typography variant='body2' color='text.secondary'>
              Aquí podrás consultar tus calificaciones.
            </Typography>
          )}

          {isAssistant && (
            <Typography variant='body2' color='text.secondary'>
              Aquí podrás gestionar las calificaciones de los estudiantes.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
