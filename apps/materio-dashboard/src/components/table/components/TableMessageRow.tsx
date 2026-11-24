import type { ReactNode } from 'react';

import { TableCell, TableRow, Typography } from '@mui/material';

import { PageLoading } from '@/components/feedback/PageLoading';

export function TableMessageRow({
  colSpan,
  children,
  loading = false,
}: {
  colSpan: number;
  children?: ReactNode;
  loading?: boolean;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align='center' sx={{ py: 4 }}>
        {loading ? (
          <PageLoading minHeight={0} />
        ) : (
          <Typography role='status' color='text.secondary'>
            {children}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
