import { TableCell, TableRow } from '@mui/material';

import { ChipList } from '@/components/table/components/ChipList';
import { StatusChip } from '@/components/table/components/StatusChip';
import { TableActions } from '@/components/table/components/TableActions';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

interface GradeSchemeRowProps {
  gradeScheme: IGradeScheme;
  loadingEdit: boolean;
  disableEdit?: boolean;
  onEdit: (gradeScheme: IGradeScheme) => void;
  onDelete: (gradeScheme: IGradeScheme) => void;
  onRestore: (gradeScheme: IGradeScheme) => void;
}

export function GradeSchemeRow(props: GradeSchemeRowProps) {
  const { gradeScheme, loadingEdit, disableEdit, onEdit, onDelete, onRestore } = props;

  return (
    <TableRow
      key={gradeScheme.idGradeScheme}
      hover={gradeScheme.isActive}
      sx={{
        cursor: 'pointer',
        '&:last-child td, &:last-child th': {
          border: 0,
        },
      }}
    >
      <TableCell align='center' component='th' scope='row' padding='none'>
        {gradeScheme.idGradeScheme}
      </TableCell>
      <TableCell component='th' scope='row'>
        {gradeScheme.name}
      </TableCell>
      <TableCell>{gradeScheme.description ?? 'Sin descripción'}</TableCell>
      <TableCell>
        <ChipList
          items={gradeScheme.details}
          getLabel={(detail) => detail.gradeItem.name}
          getBadgeContent={(detail) => `${detail.percentage}%`}
          keyExtractor={(detail) => detail.gradeItem.idGradeItem}
        />
      </TableCell>
      <TableCell>
        <StatusChip active={gradeScheme.isActive} />
      </TableCell>
      <TableCell align='center'>
        <TableActions
          active={gradeScheme.isActive}
          loadingEdit={loadingEdit}
          disableEdit={disableEdit}
          onEdit={() => onEdit(gradeScheme)}
          onDelete={() => onDelete(gradeScheme)}
          onRestore={() => onRestore(gradeScheme)}
        />
      </TableCell>
    </TableRow>
  );
}
