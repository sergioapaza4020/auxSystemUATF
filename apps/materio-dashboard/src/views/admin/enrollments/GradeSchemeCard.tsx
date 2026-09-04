import { Card, CardContent, CardHeader, Divider, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

interface GradeSchemeCardProps {
  enrollment: IEnrollment;
}

export function GradeSchemeCard({ enrollment }: GradeSchemeCardProps) {
  const scheme = enrollment.course.gradeScheme;

  if (!scheme) {
    return (
      <Card>
        <CardHeader title='Esquema de calificaciones' />

        <CardContent>
          <Typography color='text.secondary'>Esta materia todavía no tiene un esquema de calificaciones.</Typography>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const total = details.reduce((sum, detail) => sum + detail.percentage, 0);

  return (
    <Card>
      <CardHeader title={scheme.name} subheader={scheme.description || 'Esquema de calificaciones'} />

      <CardContent>
        <Stack spacing={2}>
          {details.map((detail) => (
            <Stack key={detail.idGradeSchemeDetail} direction='row' justifyContent='space-between' alignItems='center'>
              <Typography>{detail.gradeItem.name}</Typography>

              <Typography fontWeight={700}>{detail.percentage}%</Typography>
            </Stack>
          ))}

          <Divider />

          <Stack direction='row' justifyContent='space-between'>
            <Typography fontWeight={700}>Total</Typography>

            <Typography fontWeight={700}>{total}%</Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
