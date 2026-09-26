import { Box, Chip, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';

import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

import type { IGrade } from '@/interfaces/grades/grade.interface';

interface DirectGradeSectionProps {
  name: string;
  percentage: number;
  score: string;
  grade?: IGrade;
  saving: boolean;
  invalid: boolean;
  schemeMultiplier: number;

  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function DirectGradeSection({
  name,
  percentage,
  score,
  grade,
  saving,
  invalid,
  schemeMultiplier,
  onChange,
  onSave,
  onDelete,
}: DirectGradeSectionProps) {
  const contribution = grade ? (Number(grade.score) * percentage * schemeMultiplier) / 100 : null;

  const canSave = score.trim() !== '' && !invalid && !saving;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={3}
        >
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AssignmentOutlinedIcon fontSize='small' />
            </Box>

            <Box>
              <Stack direction='row' spacing={1.5} alignItems='center'>
                <Typography fontWeight={600}>{name}</Typography>

                <Chip size='small' variant='tonal' label={`${percentage}%`} />
              </Stack>

              <Typography variant='body2' color='text.secondary'>
                Calificación directa
              </Typography>
            </Box>
          </Stack>

          <Stack direction='row' spacing={1} alignItems='flex-start'>
            <TextField
              size='small'
              type='number'
              value={score}
              onChange={(event) => onChange(event.target.value)}
              error={invalid}
              placeholder='0'
              inputProps={{
                min: 0,
                max: 100,
                step: 0.01,
              }}
              InputProps={{
                endAdornment: <Typography color='text.secondary'>/ 100</Typography>,
              }}
              sx={{ width: 150 }}
            />

            <Tooltip title={grade ? 'Actualizar nota' : 'Guardar nota'}>
              <span>
                <IconButton
                  color='primary'
                  disabled={!canSave}
                  onClick={onSave}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                  }}
                >
                  {saving ? <CircularProgress size={20} /> : <SaveOutlinedIcon />}
                </IconButton>
              </span>
            </Tooltip>

            {grade && onDelete && (
              <Tooltip title='Eliminar calificación'>
                <span>
                  <IconButton
                    color='error'
                    disabled={saving}
                    onClick={onDelete}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1.5,
                    }}
                  >
                    <DeleteOutlineOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {invalid && (
          <Typography variant='caption' color='error.main' sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
            La nota debe estar entre 0 y 100.
          </Typography>
        )}

        {contribution !== null && (
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
            Aporte actual: {contribution.toFixed(2)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
