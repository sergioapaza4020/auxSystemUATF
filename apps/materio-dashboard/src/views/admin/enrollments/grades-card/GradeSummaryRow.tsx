import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

import type { SvgIconComponent } from '@mui/icons-material';

interface GradeSummaryRowProps {
  name: string;
  description: string;
  percentage: number;
  score: number | null;
  icon: SvgIconComponent;
  iconColor: string;
  iconBackgroundColor: string;
}

export function GradeSummaryRow({
  name,
  description,
  percentage,
  score,
  icon: Icon,
  iconColor,
  iconBackgroundColor,
}: GradeSummaryRowProps) {
  const hasScore = score !== null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(260px, 1.4fr) 100px minmax(220px, 1fr) 180px',
        },
        gap: 3,
        alignItems: 'center',
        px: 3,
        py: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': {
          borderBottom: 0,
        },
      }}
    >
      <Stack direction='row' spacing={2} alignItems='center'>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            bgcolor: iconBackgroundColor,
            '& svg': {
              fontSize: 22,
            },
          }}
        >
          <Icon />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={600} color='text.primary'>
            {name}
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            {description}
          </Typography>
        </Box>
      </Stack>

      <Typography
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
        }}
      >
        {percentage}%
      </Typography>

      <Stack direction='row' spacing={2} alignItems='center'>
        <LinearProgress
          variant='determinate'
          value={score ?? 0}
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 10,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 10,
            },
          }}
        />

        <Typography
          variant='body2'
          color='text.secondary'
          sx={{
            minWidth: 38,
            textAlign: 'right',
          }}
        >
          {score !== null ? `${score.toFixed(0)}%` : '0%'}
        </Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
        {hasScore ? (
          <Chip size='small' color='primary' variant='tonal' label={`${score.toFixed(2)} / 100`} />
        ) : (
          <Chip size='small' variant='tonal' label='Sin calificar' icon={<span>−</span>} />
        )}
      </Box>
    </Box>
  );
}
