import { useEffect, useState } from 'react';

import { Button, Card, CardContent, CardHeader, Divider, Stack, TextField, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';

import { createGrade, deleteGrade, updateGrade } from '@/api/grades.service';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

interface GradesCardProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  loading: boolean;
  onGradesChanged?: () => void;
  isEditable?: boolean;
  gradeScheme?: IGradeScheme;
  schemeMultiplier?: number;
  assistantMode?: boolean;
  assistantPercentage?: number;
}

export function GradesCard({
  enrollment,
  grades,
  loading,
  onGradesChanged,
  isEditable = false,
  gradeScheme,
  schemeMultiplier = 1,
  assistantMode = false,
  assistantPercentage,
}: GradesCardProps) {
  const [scores, setScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const scheme = assistantMode ? gradeScheme : (gradeScheme ?? enrollment.course.gradeScheme);

  useEffect(() => {
    const initialScores: Record<number, string> = {};

    grades.forEach((grade) => {
      if (grade.activity) {
        initialScores[grade.activity.idActivity] = String(grade.score);
      } else {
        initialScores[grade.gradeSchemeDetail.idGradeSchemeDetail] = String(grade.score);
      }
    });

    setScores(initialScores);
  }, [grades]);

  if (!scheme) {
    return (
      <Card>
        <CardHeader title={isEditable ? 'Gestión de calificaciones' : 'Mis calificaciones'} />

        <CardContent>
          <Typography color='text.secondary'>Esta materia todavía no tiene una forma de calificar.</Typography>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  /*
   * Comprueba si el valor introducido está entre 0 y 100.
   */
  const isInvalidScore = (value: string) => {
    if (value.trim() === '') {
      return false;
    }

    const score = Number(value);

    return Number.isNaN(score) || score < 0 || score > 100;
  };

  /*
   * Cambia una nota en el estado local.
   */
  const handleScoreChange = (id: number, value: string) => {
    setScores((current) => ({
      ...current,
      [id]: value,
    }));
  };

  /*
   * Guarda una nota de un componente normal.
   */
  const handleSaveDetail = async (idGradeSchemeDetail: number) => {
    const value = scores[idGradeSchemeDetail];

    if (value === undefined || value.trim() === '') {
      return;
    }

    const score = Number(value);

    if (Number.isNaN(score) || score < 0 || score > 100) {
      return;
    }

    setSaving(idGradeSchemeDetail);

    try {
      const existingGrade = grades.find(
        (grade) => !grade.activity && grade.gradeSchemeDetail.idGradeSchemeDetail === idGradeSchemeDetail,
      );

      if (existingGrade) {
        await updateGrade(existingGrade.idGrade, score);
      } else {
        await createGrade({
          enrollmentId: enrollment.idEnrollment,
          gradeSchemeDetailId: idGradeSchemeDetail,
          score,
        });
      }

      onGradesChanged?.();
    } finally {
      setSaving(null);
    }
  };

  /*
   * Guarda una nota perteneciente a una actividad.
   */
  const handleSaveActivity = async (idActivity: number, idGradeSchemeDetail: number) => {
    const value = scores[idActivity];

    if (value === undefined || value.trim() === '') {
      return;
    }

    const score = Number(value);

    if (Number.isNaN(score) || score < 0 || score > 100) {
      return;
    }

    setSaving(idActivity);

    try {
      const existingGrade = grades.find((grade) => grade.activity?.idActivity === idActivity);

      if (existingGrade) {
        await updateGrade(existingGrade.idGrade, score);
      } else {
        await createGrade({
          enrollmentId: enrollment.idEnrollment,
          gradeSchemeDetailId: idGradeSchemeDetail,
          activityId: idActivity,
          score,
        });
      }

      onGradesChanged?.();
    } finally {
      setSaving(null);
    }
  };

  /*
   * Elimina una nota.
   */
  const handleDelete = async (idGrade: number, id: number) => {
    setSaving(id);

    try {
      await deleteGrade(idGrade);

      setScores((current) => ({
        ...current,
        [id]: '',
      }));

      onGradesChanged?.();
    } finally {
      setSaving(null);
    }
  };

  const evaluatedPercentage = details.reduce((sum, detail) => {
    if (detail.activities.length === 0) {
      const grade = grades.find(
        (item) => !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
      );

      return grade ? sum + Number(detail.percentage) : sum;
    }

    const activitiesWithGrades = detail.activities.filter((activity) =>
      grades.some((grade) => grade.activity?.idActivity === activity.idActivity),
    );

    return activitiesWithGrades.length === detail.activities.length ? sum + Number(detail.percentage) : sum;
  }, 0);

  const currentScore = details.reduce((sum, detail) => {
    if (detail.activities.length === 0) {
      const grade = grades.find(
        (item) => !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
      );

      if (!grade) {
        return sum;
      }

      const contribution = (Number(grade.score) * Number(detail.percentage) * schemeMultiplier) / 100;

      return sum + contribution;
    }

    const activityGrades = detail.activities
      .map((activity) => grades.find((grade) => grade.activity?.idActivity === activity.idActivity))
      .filter((grade): grade is IGrade => grade !== undefined);

    if (activityGrades.length === 0) {
      return sum;
    }

    const average =
      activityGrades.reduce((activitySum, grade) => activitySum + Number(grade.score), 0) / activityGrades.length;

    const contribution = (average * Number(detail.percentage) * schemeMultiplier) / 100;

    return sum + contribution;
  }, 0);

  return (
    <Card>
      <CardHeader title={isEditable ? 'Gestión de calificaciones' : 'Mis calificaciones'} />

      <CardContent>
        {loading ? (
          <Typography color='text.secondary'>Cargando calificaciones...</Typography>
        ) : (
          <Stack spacing={2}>
            {details.map((detail) => {
              if (detail.activities.length === 0) {
                const grade = grades.find(
                  (item) => !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
                );

                const contribution = grade ? (Number(grade.score) * detail.percentage * schemeMultiplier) / 100 : null;

                return (
                  <Stack key={detail.idGradeSchemeDetail} spacing={0.5}>
                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                      <Typography fontWeight={600}>{detail.gradeItem.name}</Typography>

                      {isEditable ? (
                        <Stack direction='row' spacing={1} alignItems='center'>
                          <TextField
                            size='small'
                            type='number'
                            value={scores[detail.idGradeSchemeDetail] ?? ''}
                            onChange={(event) => handleScoreChange(detail.idGradeSchemeDetail, event.target.value)}
                            error={isInvalidScore(scores[detail.idGradeSchemeDetail] ?? '')}
                            helperText={
                              isInvalidScore(scores[detail.idGradeSchemeDetail] ?? '')
                                ? 'La nota debe estar entre 0 y 100'
                                : ''
                            }
                            inputProps={{
                              min: 0,
                              max: 100,
                              step: 0.01,
                            }}
                            sx={{ width: 110 }}
                          />

                          <Typography>/ 100</Typography>
                        </Stack>
                      ) : (
                        <Typography fontWeight={700} color={grade ? 'text.primary' : 'text.secondary'}>
                          {grade ? `${grade.score}/100` : 'Sin calificar'}
                        </Typography>
                      )}
                    </Stack>

                    {isEditable && (
                      <Stack direction='row' spacing={1} justifyContent='flex-end'>
                        <Button
                          size='small'
                          variant='contained'
                          onClick={() => handleSaveDetail(detail.idGradeSchemeDetail)}
                          disabled={
                            saving === detail.idGradeSchemeDetail ||
                            isInvalidScore(scores[detail.idGradeSchemeDetail] ?? '')
                          }
                        >
                          {saving === detail.idGradeSchemeDetail ? 'Guardando...' : grade ? 'Actualizar' : 'Guardar'}
                        </Button>

                        {grade && (
                          <Button
                            size='small'
                            color='error'
                            onClick={() => handleDelete(grade.idGrade, detail.idGradeSchemeDetail)}
                            disabled={saving === detail.idGradeSchemeDetail}
                          >
                            Eliminar
                          </Button>
                        )}
                      </Stack>
                    )}

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
              }

              /*
               * ==================================================
               * COMPONENTE CON ACTIVIDADES
               * ==================================================
               */

              const activityGrades = detail.activities.map((activity) =>
                grades.find((grade) => grade.activity?.idActivity === activity.idActivity),
              );

              const evaluatedActivities = activityGrades.filter((grade) => grade !== undefined);

              const average =
                evaluatedActivities.length > 0
                  ? evaluatedActivities.reduce((sum, grade) => sum + Number(grade.score), 0) /
                    evaluatedActivities.length
                  : null;

              const contribution = average !== null ? (average * detail.percentage * schemeMultiplier) / 100 : null;

              return (
                <Stack key={detail.idGradeSchemeDetail} spacing={1.5}>
                  <Stack direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography fontWeight={600}>{detail.gradeItem.name}</Typography>

                    <Typography fontWeight={700} color={average !== null ? 'text.primary' : 'text.secondary'}>
                      {average !== null ? `Promedio de prácticas: ${average.toFixed(2)}/100` : 'Sin calificar'}
                    </Typography>
                  </Stack>

                  <Stack spacing={1} sx={{ pl: 2 }}>
                    {detail.activities
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((activity) => {
                        const grade = grades.find((item) => item.activity?.idActivity === activity.idActivity);

                        const score = scores[activity.idActivity] ?? '';

                        return (
                          <Stack key={activity.idActivity} spacing={0.5}>
                            <Stack direction='row' justifyContent='space-between' alignItems='center'>
                              <Typography>
                                {activity.order}. {activity.name}
                              </Typography>

                              {isEditable ? (
                                <Stack direction='row' spacing={1} alignItems='center'>
                                  <TextField
                                    size='small'
                                    type='number'
                                    value={score}
                                    onChange={(event) => handleScoreChange(activity.idActivity, event.target.value)}
                                    error={isInvalidScore(score)}
                                    inputProps={{
                                      min: 0,
                                      max: 100,
                                      step: 0.01,
                                    }}
                                    sx={{
                                      width: 110,
                                    }}
                                  />

                                  <Typography>/ 100</Typography>
                                </Stack>
                              ) : (
                                <Typography fontWeight={700} color={grade ? 'text.primary' : 'text.secondary'}>
                                  {grade ? `${grade.score}/100` : 'Sin calificar'}
                                </Typography>
                              )}
                            </Stack>

                            {isEditable && (
                              <Stack direction='row' spacing={1} justifyContent='flex-end'>
                                <Button
                                  size='small'
                                  variant='contained'
                                  onClick={() => handleSaveActivity(activity.idActivity, detail.idGradeSchemeDetail)}
                                  disabled={saving === activity.idActivity || isInvalidScore(score)}
                                >
                                  {saving === activity.idActivity ? 'Guardando...' : grade ? 'Actualizar' : 'Guardar'}
                                </Button>

                                {grade && (
                                  <Button
                                    size='small'
                                    color='error'
                                    onClick={() => handleDelete(grade.idGrade, activity.idActivity)}
                                    disabled={saving === activity.idActivity}
                                  >
                                    Eliminar
                                  </Button>
                                )}
                              </Stack>
                            )}

                            {activity.description && (
                              <Typography variant='body2' color='text.secondary'>
                                {activity.description}
                              </Typography>
                            )}

                            <Typography variant='body2' color='text.secondary'>
                              Fecha: {activity.date}
                            </Typography>
                          </Stack>
                        );
                      })}
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

                <Typography fontWeight={700}>
                  {currentScore.toFixed(2)} /{' '}
                  {assistantMode && assistantPercentage !== undefined ? assistantPercentage.toFixed(2) : '100'}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
