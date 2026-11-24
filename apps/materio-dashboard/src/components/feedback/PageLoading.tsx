import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

export interface PageLoadingProps {
  variant?: 'fullscreen' | 'content';
  message?: string;
  minHeight?: number | string;
  className?: string;
  sx?: SxProps<Theme>;
}

/** Presentation only; the surrounding view keeps ownership of its loading state. */
export function PageLoading({
  variant = 'content',
  message = 'Cargando...',
  minHeight,
  className,
  sx,
}: PageLoadingProps) {
  const fullscreen = variant === 'fullscreen';

  return (
    <Box
      role='status'
      aria-live='polite'
      aria-atomic='true'
      className={className}
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          minHeight: minHeight ?? (fullscreen ? 0 : 160),
          ...(fullscreen && { flex: '1 1 auto', alignSelf: 'stretch' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack direction='row' alignItems='center' spacing={2} sx={{ maxWidth: '100%', minWidth: 0 }}>
        <CircularProgress
          size={fullscreen ? 32 : 26}
          color='primary'
          aria-hidden='true'
          sx={{
            flexShrink: 0,
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              '& .MuiCircularProgress-circle': { animation: 'none' },
            },
          }}
        />
        <Typography
          variant={fullscreen ? 'body1' : 'body2'}
          color='text.secondary'
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {message}
        </Typography>
      </Stack>
    </Box>
  );
}
