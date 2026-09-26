import { Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';

interface GradesSummaryProps {
  evaluatedPercentage: number;
  currentScore: number;
  maximumScore: number;
}

export function GradesSummary({ evaluatedPercentage, currentScore, maximumScore }: GradesSummaryProps) {
  return (
    <Box
      sx={{
        mt: 3,
        p: 3,
        borderRadius: 2,
        bgcolor: 'action.hover',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress
            variant='determinate'
            value={100}
            size={92}
            thickness={4}
            sx={{ color: 'action.selected' }}
          />

          <CircularProgress
            variant='determinate'
            value={Math.min(evaluatedPercentage, 100)}
            size={92}
            thickness={4}
            sx={{
              position: 'absolute',
              left: 0,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant='h6' fontWeight={700}>
              {evaluatedPercentage}%
            </Typography>
          </Box>
        </Box>

        <Divider
          orientation='vertical'
          flexItem
          sx={{
            display: {
              xs: 'none',
              sm: 'block',
            },
          }}
        />

        <Stack spacing={0.5}>
          <Typography variant='h6' fontWeight={600}>
            Resultado actual
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            Según las calificaciones registradas hasta el momento.
          </Typography>

          <Typography variant='body2' color='text.secondary' sx={{ pt: 1 }}>
            Acumulado
          </Typography>

          <Typography variant='h4' color='primary.main' fontWeight={700}>
            {currentScore.toFixed(2)} / {maximumScore.toFixed(0)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
