import { Box, CircularProgress, IconButton, Tooltip, Zoom } from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';

interface TableActionsProps {
  active: boolean;
  loadingEdit?: boolean;
  disabled?: boolean;

  disableEdit?: boolean;

  onEdit?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
}

export function TableActions(props: TableActionsProps) {
  const { active, loadingEdit, disabled, disableEdit, onEdit, onDelete, onRestore } = props;

  return (
    <Box display='flex' gap={2} alignItems='center'>
      {onEdit ? (
        <Tooltip title='Editar' slots={{ transition: Zoom }}>
          <span>
            <IconButton disabled={disableEdit || disabled} onClick={onEdit}>
              {!loadingEdit ? (
                <EditIcon color={active ? 'info' : 'disabled'} />
              ) : (
                <CircularProgress color='info' size={20} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      ) : null}

      {onDelete ? (
        <Tooltip title='Desactivar' slots={{ transition: Zoom }}>
          <span>
            <IconButton disabled={!active || disabled} onClick={onDelete}>
              <DeleteIcon color={active ? 'error' : 'disabled'} />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      {onRestore ? (
        <Tooltip title='Restaurar' slots={{ transition: Zoom }}>
          <span>
            <IconButton disabled={active || disabled} onClick={onRestore}>
              <RestoreFromTrashIcon color={!active ? 'warning' : 'disabled'} />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
    </Box>
  );
}
