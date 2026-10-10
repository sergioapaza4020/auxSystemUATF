import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';

export function GradeChangesBar({
  count,
  invalidCount,
  saving,
  disabled,
  onDiscard,
  onSave,
}: {
  count: number;
  invalidCount: number;
  saving: boolean;
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!count) return null;

  return (
    <Paper
      variant='outlined'
      role='region'
      aria-label='Cambios pendientes'
      sx={{
        position: 'sticky',
        bottom: 12,
        zIndex: 5,
        mt: 2,
        px: 3,
        py: 2,
        borderRadius: 3,
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
        boxShadow: 2,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
        justifyContent='space-between'
      >
        <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
          <Box>
            <Typography variant='body2' fontWeight={700} color='primary.main'>
              {count} {count === 1 ? 'calificación modificada' : 'calificaciones modificadas'}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {count > 1000
                ? 'Hay más de 1000 cambios. Revierte algunas celdas antes de guardar.'
                : 'Los cambios no se han guardado todavía.'}
            </Typography>
          </Box>
          {!!invalidCount && (
            <Chip
              color='error'
              variant='tonal'
              label={`${invalidCount} ${invalidCount === 1 ? 'valor inválido' : 'valores inválidos'}`}
              icon={<i className='ri-error-warning-line' />}
            />
          )}
        </Stack>
        <Stack direction='row' spacing={2}>
          <Button variant='outlined' disabled={saving} onClick={onDiscard}>
            Descartar cambios
          </Button>
          <Button
            variant='contained'
            disabled={disabled || saving || !!invalidCount || count > 1000}
            onClick={onSave}
            startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <i className='ri-save-line' />}
          >
            {saving ? 'Guardando...' : `Guardar ${count} cambios`}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
