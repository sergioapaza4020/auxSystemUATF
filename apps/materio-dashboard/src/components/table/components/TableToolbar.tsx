import type { ReactNode } from 'react';

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

interface TableToolbarProps {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  refreshReason?: string;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

export const tableToolbarSx = { px: 3, py: 2, mb: 2, minWidth: 0 } as const;

/** Composition only: the owner keeps search, filters, requests and dirty-state protection. */
export function TableToolbar({
  children,
  title,
  description,
  onRefresh,
  refreshDisabled = false,
  refreshReason,
  compact = false,
  sx,
}: TableToolbarProps) {
  return (
    <Box sx={[{ ...tableToolbarSx, px: compact ? 2 : 3 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {title && (
        <Typography variant='h6' sx={{ mb: children || onRefresh ? 2 : 0 }}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant='body2' color='text.secondary' sx={{ mb: children || onRefresh ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {(children || onRefresh) && (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
          useFlexGap
          flexWrap='wrap'
          sx={{ minWidth: 0, '& > .MuiTextField-root': { minWidth: 0, flex: { xs: '1 1 auto', md: '1 1 180px' } } }}
        >
          {children}
          {onRefresh && (
            <Tooltip title={refreshDisabled && refreshReason ? refreshReason : 'Actualizar la consulta actual'}>
              <span style={{ marginInlineStart: 'auto' }}>
                <Button
                  startIcon={<i className='ri-refresh-line' aria-hidden='true' />}
                  disabled={refreshDisabled}
                  onClick={() => {
                    if (!refreshDisabled) onRefresh();
                  }}
                >
                  Actualizar
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  );
}
