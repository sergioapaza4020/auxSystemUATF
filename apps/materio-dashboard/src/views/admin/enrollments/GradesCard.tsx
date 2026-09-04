import { Card, CardContent, CardHeader, Divider, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';

interface GradesCardProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  loading: boolean;
}

export function GradesCard({ enrollment, grades, loading }: GradesCardProps) {
  const scheme = enrollment.course.gradeScheme;

  if (!scheme) {
    return (
      <Card>
        <CardHeader title='Mis calificaciones' />

        <CardContent>
          <Typography color='text.secondary'>Esta materia todavía no tiene un esquema de calificaciones.</Typography>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const evaluatedPercentage = details.reduce((sum, detail) => {
    const grade = grades.find((item) => item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail);

    return grade ? sum + detail.percentage : sum;
  }, 0);

  const currentScore = grades.reduce((sum, grade) => {
    const contribution = (grade.score * grade.gradeSchemeDetail.percentage) / 100;

    return sum + contribution;
  }, 0);

  return (
    <Card>
      <CardHeader title={enrollment.role === 'ASSISTANT' ? 'Gestión de calificaciones' : 'Mis calificaciones'} />

      <CardContent>
        {loading ? (
          <Typography color='text.secondary'>Cargando calificaciones...</Typography>
        ) : (
          <Stack spacing={2}>
            {details.map((detail) => {
              const grade = grades.find(
                (item) => item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
              );

              const contribution = grade ? (grade.score * detail.percentage) / 100 : null;

              return (
                <Stack key={detail.idGradeSchemeDetail} spacing={0.5}>
                  <Stack direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography fontWeight={600}>{detail.gradeItem.name}</Typography>

                    <Typography fontWeight={700} color={grade ? 'text.primary' : 'text.secondary'}>
                      {grade ? `${grade.score}/100` : 'Sin calificar'}
                    </Typography>
                  </Stack>

                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Vale {detail.percentage}%
                    </Typography>

                    {contribution !== null && (
                      <Typography variant='body2' color='text.secondary'>
                        Aporte: {contribution.toFixed(2)}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              );
            })}

            <Divider />

            <Stack spacing={0.5}>
              <Stack direction='row' justifyContent='space-between'>
                <Typography fontWeight={700}>Evaluado</Typography>

                <Typography fontWeight={700}>{evaluatedPercentage}%</Typography>
              </Stack>

              <Stack direction='row' justifyContent='space-between'>
                <Typography fontWeight={700}>Acumulado</Typography>

                <Typography fontWeight={700}>{currentScore.toFixed(2)} / 100</Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
