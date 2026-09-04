'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';

import { ChevronRight } from '@mui/icons-material';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

interface EnrollmentStudentsCardProps {
  students: IEnrollmentStudent[];
  loading: boolean;
  onSelectStudent: (student: IEnrollmentStudent) => void;
}

export function EnrollmentStudentsCard({ students, loading, onSelectStudent }: EnrollmentStudentsCardProps) {
  return (
    <Card>
      <CardHeader title='Estudiantes' subheader={`${students.length} estudiante(s) matriculado(s)`} />

      <CardContent>
        {loading ? (
          <CircularProgress size={24} />
        ) : students.length === 0 ? (
          <Typography color='text.secondary'>No hay estudiantes matriculados en esta materia.</Typography>
        ) : (
          <List>
            {students.map((student) => (
              <ListItem key={student.idEnrollment} divider disablePadding>
                <ListItemButton onClick={() => onSelectStudent(student)}>
                  <ListItemText
                    primary={`${student.user.name} ${student.user.lastname}`}
                    secondary={`CI: ${student.user.ci} · RU: ${student.user.ru}`}
                  />

                  <ChevronRight />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
