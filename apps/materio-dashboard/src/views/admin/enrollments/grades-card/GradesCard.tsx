'use client';

import { useEffect, useState } from 'react';

import { Box, Card, CardContent, Typography } from '@mui/material';

import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';

import { createGrade, deleteGrade, updateGrade } from '@/api/grades.service';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';

import { EditableGradesView } from './EditableGradesView';
import { StudentGradesView } from './StudentGradesView';

interface GradesCardProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  loading: boolean;

  onGradesChanged?: () => void;

  isEditable?: boolean;

  gradeScheme?: IGradeScheme;

  /**
   * Multiplicador aplicado al aporte del esquema.
   *
   * Ejemplo:
   * - esquema general: 1
   * - esquema del auxiliar que vale 20%: 0.2
   */
  schemeMultiplier?: number;

  /**
   * Determina de dónde debe obtenerse el esquema.
   * En modo auxiliar se utiliza gradeScheme.
   */
  assistantMode?: boolean;

  /**
   * Nota máxima que puede aportar el auxiliar
   * a la calificación general.
   *
   * Ejemplo: 20
   */
  assistantPercentage?: number;

  attendance?: IStudentAttendance | null;
  attendanceLoading?: boolean;
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
  attendance,
  attendanceLoading = false,
}: GradesCardProps) {
  const [scores, setScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  /**
   * En modo auxiliar necesitamos específicamente
   * el esquema recibido mediante gradeScheme.
   *
   * En el modo normal podemos utilizar el esquema recibido
   * o el configurado directamente en la materia.
   */
  const scheme = assistantMode ? gradeScheme : (gradeScheme ?? enrollment.course.gradeScheme);

  /**
   * StudentGradesView no necesita conocer conceptos
   * como assistantMode o assistantPercentage.
   *
   * GradesCard traduce ese contexto a una nota máxima.
   */
  const maximumScore = assistantMode && assistantPercentage !== undefined ? assistantPercentage : 100;

  /**
   * Inicializa los inputs con las calificaciones
   * existentes.
   *
   * Para actividades usamos idActivity.
   * Para componentes directos usamos idGradeSchemeDetail.
   */
  useEffect(() => {
    const initialScores: Record<number, string> = {};

    grades.forEach((grade) => {
      if (grade.activity) {
        initialScores[grade.activity.idActivity] = String(grade.score);

        return;
      }

      initialScores[grade.gradeSchemeDetail.idGradeSchemeDetail] = String(grade.score);
    });

    setScores(initialScores);
  }, [grades]);

  /**
   * Comprueba que la nota introducida esté
   * entre 0 y 100.
   *
   * Un campo vacío no se considera inválido porque
   * simplemente representa que todavía no se introdujo
   * una calificación.
   */
  const isInvalidScore = (value: string) => {
    if (value.trim() === '') {
      return false;
    }

    const score = Number(value);

    return Number.isNaN(score) || score < 0 || score > 100;
  };

  /**
   * Actualiza únicamente el estado local del input.
   */
  const handleScoreChange = (id: number, value: string) => {
    setScores((current) => ({
      ...current,
      [id]: value,
    }));
  };

  /**
   * Guarda o actualiza una calificación asociada
   * directamente a un detalle del esquema.
   */
  const handleSaveDetail = async (idGradeSchemeDetail: number) => {
    const value = scores[idGradeSchemeDetail];

    if (value === undefined || value.trim() === '' || isInvalidScore(value)) {
      return;
    }

    const score = Number(value);

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

  /**
   * Guarda o actualiza la calificación correspondiente
   * a una actividad.
   */
  const handleSaveActivity = async (idActivity: number, idGradeSchemeDetail: number) => {
    const value = scores[idActivity];

    if (value === undefined || value.trim() === '' || isInvalidScore(value)) {
      return;
    }

    const score = Number(value);

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

  /**
   * Elimina una calificación y limpia el input
   * correspondiente.
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

  /**
   * Estado vacío cuando todavía no existe
   * un esquema de calificación.
   */
  if (!scheme) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
                color: 'text.secondary',
              }}
            >
              {isEditable ? <EditNoteOutlinedIcon /> : <SchoolOutlinedIcon />}
            </Box>

            <Box>
              <Typography variant='h5' fontWeight={700}>
                {isEditable ? 'Gestión de calificaciones' : 'Mis calificaciones'}
              </Typography>

              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                Esta materia todavía no tiene una forma de calificar.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  /**
   * Vista utilizada para registrar y modificar
   * calificaciones.
   */
  if (isEditable) {
    return (
      <EditableGradesView
        scheme={scheme}
        grades={grades}
        scores={scores}
        loading={loading}
        saving={saving}
        schemeMultiplier={schemeMultiplier}
        attendance={attendance}
        attendanceLoading={attendanceLoading}
        onScoreChange={handleScoreChange}
        onSaveDetail={handleSaveDetail}
        onSaveActivity={handleSaveActivity}
        onDelete={handleDelete}
        isInvalidScore={isInvalidScore}
      />
    );
  }

  /**
   * Vista de solo lectura.
   *
   * No recibe assistantMode ni assistantPercentage.
   * GradesCard ya resolvió esos conceptos mediante
   * schemeMultiplier y maximumScore.
   */
  return (
    <StudentGradesView
      scheme={scheme}
      grades={grades}
      loading={loading}
      schemeMultiplier={schemeMultiplier}
      maximumScore={maximumScore}
      attendance={attendance}
      attendanceLoading={attendanceLoading}
    />
  );
}
