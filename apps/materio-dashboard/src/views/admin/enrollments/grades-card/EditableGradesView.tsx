'use client';

import { Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';

import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';
import { DirectGradeSection } from './DirectGradeSection';
import { ActivitiesGradeSection } from './ActivitiesGradeSection';
import { AttendanceGradeSection } from './AttendanceGradeSection';

interface EditableGradesViewProps {
  scheme: IGradeScheme;
  grades: IGrade[];
  scores: Record<number, string>;

  loading: boolean;
  saving: number | null;

  schemeMultiplier: number;

  attendance?: IStudentAttendance | null;
  attendanceLoading?: boolean;

  onScoreChange: (id: number, value: string) => void;
  onSaveDetail: (idGradeSchemeDetail: number) => Promise<void>;
  onSaveActivity: (idActivity: number, idGradeSchemeDetail: number) => Promise<void>;
  onDelete: (idGrade: number, id: number) => Promise<void>;

  isInvalidScore: (value: string) => boolean;
}

export function EditableGradesView({
  scheme,
  grades,
  scores,
  loading,
  saving,
  schemeMultiplier,
  attendance,
  attendanceLoading = false,
  onScoreChange,
  onSaveDetail,
  onSaveActivity,
  onDelete,
  isInvalidScore,
}: EditableGradesViewProps) {
  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={4}>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EditNoteOutlinedIcon />
            </Box>

            <Box>
              <Typography variant='h5' fontWeight={700}>
                Gestión de calificaciones
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                Registra y actualiza las calificaciones del estudiante
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Stack alignItems='center' spacing={2} py={8}>
              <CircularProgress size={32} />

              <Typography variant='body2' color='text.secondary'>
                Cargando calificaciones...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={3}>
              {details.map((detail) => {
                const isAttendance = detail.gradeItem.name.toLowerCase() === 'asistencias';

                if (isAttendance) {
                  return (
                    <AttendanceGradeSection
                      key={detail.idGradeSchemeDetail}
                      name={detail.gradeItem.name}
                      percentage={Number(detail.percentage)}
                      attendance={attendance}
                      loading={attendanceLoading}
                      schemeMultiplier={schemeMultiplier}
                    />
                  );
                }

                if (detail.activities.length === 0) {
                  const grade = grades.find(
                    (item) =>
                      !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
                  );

                  const score = scores[detail.idGradeSchemeDetail] ?? '';

                  return (
                    <DirectGradeSection
                      key={detail.idGradeSchemeDetail}
                      name={detail.gradeItem.name}
                      percentage={Number(detail.percentage)}
                      score={score}
                      grade={grade}
                      saving={saving === detail.idGradeSchemeDetail}
                      invalid={isInvalidScore(score)}
                      schemeMultiplier={schemeMultiplier}
                      onChange={(value) => onScoreChange(detail.idGradeSchemeDetail, value)}
                      onSave={() => onSaveDetail(detail.idGradeSchemeDetail)}
                      onDelete={grade ? () => onDelete(grade.idGrade, detail.idGradeSchemeDetail) : undefined}
                    />
                  );
                }

                return (
                  <ActivitiesGradeSection
                    key={detail.idGradeSchemeDetail}
                    name={detail.gradeItem.name}
                    percentage={Number(detail.percentage)}
                    activities={detail.activities}
                    grades={grades}
                    scores={scores}
                    saving={saving}
                    schemeMultiplier={schemeMultiplier}
                    isInvalidScore={isInvalidScore}
                    onScoreChange={onScoreChange}
                    onSave={(idActivity) => onSaveActivity(idActivity, detail.idGradeSchemeDetail)}
                    onDelete={onDelete}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
