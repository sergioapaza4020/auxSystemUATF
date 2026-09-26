import { Box, Chip, Stack, Typography } from '@mui/material';

interface StatusChipProps {
  active: boolean;
}

export function StatusChip({ active }: StatusChipProps) {
  const label = active ? 'Activo' : 'Inactivo';

  return (
    <Chip
      size='small'
      color={active ? 'success' : 'error'}
      label={
        <Stack component='span' direction='row' alignItems='center' spacing={0.75}>
          <Box
            component='span'
            sx={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: 'currentColor',
            }}
          />

          <Typography
            component='span'
            variant='caption'
            sx={{
              color: 'inherit',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {label}
          </Typography>
        </Stack>
      }
      sx={{
        height: 28,

        bgcolor: active ? 'success.lighterOpacity' : 'error.lighterOpacity',

        color: active ? 'success.main' : 'error.main',

        '& .MuiChip-label': {
          display: 'flex',
          alignItems: 'center',
          px: 1.25,
        },
      }}
    />
  );
}
