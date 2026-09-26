import { Chip, TableCell, TableRow, Typography } from '@mui/material';

import { StatusChip, TableActions } from '@/components/table';
import type { ISemester } from '@/interfaces/semesters/semester.interface';
import { formatSemesterDate } from '../semester-dates';

export type SemesterTableRecord = ISemester & { current: boolean | null };

interface Props {
  semester: SemesterTableRecord;
  busy: boolean;
  onEdit?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
}

export function SemesterRow({ semester, busy, onEdit, onDeactivate, onReactivate }: Props) {
  return (
    <TableRow hover>
      <TableCell>{semester.period}</TableCell>
      <TableCell>{semester.year}</TableCell>
      <TableCell>{formatSemesterDate(semester.startDate)}</TableCell>
      <TableCell>{formatSemesterDate(semester.endDate)}</TableCell>
      <TableCell>
        {semester.current === null ? (
          <Typography variant='caption'>Sin confirmar</Typography>
        ) : semester.current ? (
          <Chip size='small' color='primary' label='Actual' />
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <StatusChip active={semester.isActive} />
      </TableCell>
      <TableCell align='center'>
        <TableActions
          active={semester.isActive}
          disabled={busy}
          onEdit={onEdit}
          onDelete={onDeactivate}
          onRestore={onReactivate}
        />
      </TableCell>
    </TableRow>
  );
}
