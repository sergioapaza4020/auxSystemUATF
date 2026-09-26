import { TableCell, TableRow, Typography } from '@mui/material';

import { ChipList } from '@/components/table/components/ChipList';
import { StatusChip } from '@/components/table/components/StatusChip';
import { TableActions } from '@/components/table/components/TableActions';

import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

import { formatDescription } from '@/helpers/formatDescription';

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
      hover
      sx={{
        transition: (theme) =>
          theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shorter,
          }),

        '&:last-child td, &:last-child th': {
          border: 0,
        },

        // Registros inactivos ligeramente atenuados
        ...(!gradeScheme.isActive && {
          bgcolor: 'action.hover',
        }),
      }}
    >
      {/* ID */}
      <TableCell align='center' component='th' scope='row' padding='none'>
        <Typography variant='body2' color='text.secondary'>
          {gradeScheme.idGradeScheme}
        </Typography>
      </TableCell>

      {/* Nombre */}
      <TableCell component='th' scope='row'>
        <Typography
          variant='body2'
          color='text.primary'
          sx={{
            fontWeight: 600,
          }}
        >
          {gradeScheme.name}
        </Typography>
      </TableCell>

      {/* Descripción */}
      <TableCell>
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{
            maxWidth: 300,

            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',

            overflow: 'hidden',
          }}
        >
          {formatDescription(gradeScheme.description)}
        </Typography>
      </TableCell>

      {/* Detalles */}
      <TableCell>
        <ChipList
          items={gradeScheme.details}
          getLabel={(detail) => detail.gradeItem.name}
          getBadgeContent={(detail) => `${detail.percentage}%`}
          keyExtractor={(detail) => detail.gradeItem.idGradeItem}
          maxVisible={2}
        />
      </TableCell>

      {/* Estado */}
      <TableCell>
        <StatusChip active={gradeScheme.isActive} />
      </TableCell>

      {/* Acciones */}
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
