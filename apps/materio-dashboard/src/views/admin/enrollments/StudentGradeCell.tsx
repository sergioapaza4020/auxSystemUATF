import { Typography } from '@mui/material';

import type { GradeDisplayMode } from './GradeViewToggle';

export type StudentGradesMode = GradeDisplayMode;

export function StudentGradeCell({
  score,
  maximum,
  total = false,
}: {
  score: number | null | undefined;
  maximum?: number;
  total?: boolean;
}) {
  return (
    <Typography
      variant='body2'
      fontWeight={total ? 700 : 500}
      sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
    >
      {score === null || score === undefined ? (
        '--'
      ) : (
        <>
          {score.toFixed(1)}
          {maximum !== undefined && (
            <Typography component='span' variant='body2' color='text.secondary'>
              {' '}
              / {Number(maximum.toFixed(2))}
            </Typography>
          )}
        </>
      )}
    </Typography>
  );
}
