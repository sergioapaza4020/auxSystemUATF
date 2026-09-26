import { Box, CircularProgress, IconButton, Tooltip, Zoom } from '@mui/material';

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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
      }}
    >
      {/* Acciones disponibles únicamente para activos */}
      {active && (
        <>
          {onEdit && (
            <Tooltip
              title='Editar'
              slots={{
                transition: Zoom,
              }}
            >
              <span>
                <IconButton
                  size='small'
                  disabled={disableEdit || disabled || loadingEdit}
                  onClick={onEdit}
                  aria-label='Editar'
                  sx={{
                    width: 36,
                    height: 36,

                    borderRadius: 2,

                    color: 'info.main',

                    bgcolor: 'info.lighterOpacity',

                    '&:hover': {
                      bgcolor: 'info.lightOpacity',
                    },
                  }}
                >
                  {loadingEdit ? <CircularProgress color='inherit' size={18} /> : <i className='ri-pencil-line' />}
                </IconButton>
              </span>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip
              title='Desactivar'
              slots={{
                transition: Zoom,
              }}
            >
              <span>
                <IconButton
                  size='small'
                  disabled={disabled}
                  onClick={onDelete}
                  aria-label='Desactivar'
                  sx={{
                    width: 36,
                    height: 36,

                    borderRadius: 2,

                    color: 'error.main',

                    bgcolor: 'error.lighterOpacity',

                    '&:hover': {
                      bgcolor: 'error.lightOpacity',
                    },
                  }}
                >
                  <i className='ri-delete-bin-6-line' />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </>
      )}

      {/* Inactivo -> solamente restaurar */}
      {!active && onRestore && (
        <Tooltip
          title='Restaurar'
          slots={{
            transition: Zoom,
          }}
        >
          <span>
            <IconButton
              size='small'
              disabled={disabled}
              onClick={onRestore}
              aria-label='Restaurar'
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                color: 'warning.main',
                bgcolor: 'warning.lighterOpacity',
                '&:hover': {
                  bgcolor: 'warning.lightOpacity',
                },
              }}
            >
              <i className='ri-restart-line' />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
