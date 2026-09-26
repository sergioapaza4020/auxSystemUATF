import { Box, Chip, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';

import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IActivity } from '@/interfaces/activities/activity.interface';

interface ActivitiesGradeSectionProps {
  name: string;
  percentage: number;
  activities: IActivity[];
  grades: IGrade[];
  scores: Record<number, string>;
  saving: number | null;
  schemeMultiplier: number;

  isInvalidScore: (value: string) => boolean;
  onScoreChange: (id: number, value: string) => void;
  onSave: (idActivity: number) => void;
  onDelete: (idGrade: number, idActivity: number) => void;
}

export function ActivitiesGradeSection({
  name,
  percentage,
  activities,
  grades,
  scores,
  saving,
  schemeMultiplier,
  isInvalidScore,
  onScoreChange,
  onSave,
  onDelete,
}: ActivitiesGradeSectionProps) {
  const sortedActivities = [...activities].sort((a, b) => a.order - b.order);

  const activityGrades = sortedActivities
    .map((activity) => grades.find((grade) => grade.activity?.idActivity === activity.idActivity))
    .filter((grade): grade is IGrade => grade !== undefined);

  const average =
    activityGrades.length > 0
      ? activityGrades.reduce((sum, grade) => sum + Number(grade.score), 0) / activityGrades.length
      : null;

  const contribution = average !== null ? (average * percentage * schemeMultiplier) / 100 : null;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2.5,
          bgcolor: 'action.hover',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: 'success.lighterOpacity',
                color: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScienceOutlinedIcon fontSize='small' />
            </Box>

            <Box>
              <Stack direction='row' spacing={1.5} alignItems='center'>
                <Typography fontWeight={600}>{name}</Typography>

                <Chip size='small' variant='tonal' label={`${percentage}%`} />
              </Stack>

              <Typography variant='body2' color='text.secondary'>
                {activityGrades.length} de {activities.length} actividades calificadas
              </Typography>
            </Box>
          </Stack>

          {average !== null && (
            <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Typography variant='body2' color='text.secondary'>
                Promedio
              </Typography>

              <Typography fontWeight={700}>{average.toFixed(2)} / 100</Typography>
            </Stack>
          )}
        </Stack>
      </Box>

      {sortedActivities.map((activity, index) => {
        const grade = grades.find((item) => item.activity?.idActivity === activity.idActivity);

        const score = scores[activity.idActivity] ?? '';
        const invalid = isInvalidScore(score);
        const isSaving = saving === activity.idActivity;

        return (
          <Box key={activity.idActivity}>
            {index > 0 && <Divider />}

            <Box sx={{ px: 3, py: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent='space-between'
                alignItems={{ xs: 'stretch', md: 'center' }}
                spacing={2}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={500}>
                    {activity.order}. {activity.name}
                  </Typography>

                  <Stack direction='row' spacing={1.5} sx={{ mt: 0.5 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {activity.date}
                    </Typography>

                    {activity.description && (
                      <>
                        <Typography variant='caption' color='text.disabled'>
                          •
                        </Typography>

                        <Typography variant='caption' color='text.secondary' noWrap sx={{ maxWidth: 300 }}>
                          {activity.description}
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Box>

                <Stack direction='row' spacing={1} alignItems='center'>
                  <TextField
                    size='small'
                    type='number'
                    value={score}
                    onChange={(event) => onScoreChange(activity.idActivity, event.target.value)}
                    error={invalid}
                    placeholder='0'
                    inputProps={{
                      min: 0,
                      max: 100,
                      step: 0.01,
                    }}
                    InputProps={{
                      endAdornment: <Typography color='text.secondary'>/100</Typography>,
                    }}
                    sx={{ width: 145 }}
                  />

                  <Tooltip title={grade ? 'Actualizar nota' : 'Guardar nota'}>
                    <span>
                      <IconButton
                        color='primary'
                        disabled={isSaving || invalid || score.trim() === ''}
                        onClick={() => onSave(activity.idActivity)}
                      >
                        {isSaving ? <CircularProgress size={20} /> : <SaveOutlinedIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>

                  {grade && (
                    <Tooltip title='Eliminar calificación'>
                      <span>
                        <IconButton
                          color='error'
                          disabled={isSaving}
                          onClick={() => onDelete(grade.idGrade, activity.idActivity)}
                        >
                          <DeleteOutlineOutlinedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>

              {invalid && (
                <Typography
                  variant='caption'
                  color='error.main'
                  sx={{
                    display: 'block',
                    mt: 1,
                    textAlign: 'right',
                  }}
                >
                  La nota debe estar entre 0 y 100.
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}

      {contribution !== null && (
        <>
          <Divider />

          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant='body2' color='text.secondary'>
              Aporte del componente
            </Typography>

            <Typography variant='body2' fontWeight={600}>
              {contribution.toFixed(2)}
            </Typography>
          </Stack>
        </>
      )}
    </Box>
  );
}
