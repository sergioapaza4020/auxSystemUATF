import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import type { IActivity } from '@/interfaces/activities/activity.interface';

interface ActivityListItemProps {
  activity: IActivity;
  divider?: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityListItem({ activity, divider, disabled, onEdit, onDelete }: ActivityListItemProps) {
  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        borderBottom: divider ? 1 : 0,
        borderColor: 'divider',
        transition: (theme) =>
          theme.transitions.create('background-color', {
            duration: theme.transitions.duration.shortest,
          }),

        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={3}>
        <Stack direction='row' spacing={3} alignItems='flex-start' sx={{ minWidth: 0 }}>
          <Box
            sx={{
              minWidth: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1.5,
              bgcolor: 'action.selected',
              color: 'text.secondary',
              fontWeight: 600,
            }}
          >
            {activity.order}
          </Box>

          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography fontWeight={600}>{activity.name}</Typography>

            {activity.description && (
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {activity.description}
              </Typography>
            )}

            <Stack direction='row' spacing={1} alignItems='center'>
              <CalendarTodayOutlinedIcon
                sx={{
                  fontSize: 16,
                  color: 'text.secondary',
                }}
              />

              <Typography variant='body2' color='text.secondary'>
                {activity.date}
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Stack direction='row' spacing={0.5}>
          <Tooltip title='Editar'>
            <span>
              <IconButton size='small' onClick={onEdit} disabled={disabled}>
                <EditOutlinedIcon fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title='Eliminar'>
            <span>
              <IconButton size='small' color='error' onClick={onDelete} disabled={disabled}>
                <DeleteOutlineIcon fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
