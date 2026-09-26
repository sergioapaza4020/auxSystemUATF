'use client';

// MUI Imports
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';

const NavSearch = () => {
  const { isBreakpointReached } = useVerticalNav();

  // Mobile / tablet
  if (isBreakpointReached) {
    return (
      <IconButton
        aria-label='Buscar'
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2.5,

          color: 'text.secondary',

          '&:hover': {
            color: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <i className='ri-search-line text-xl' />
      </IconButton>
    );
  }

  return (
    <Box
      role='button'
      tabIndex={0}
      sx={{
        width: '100%',
        maxWidth: 440,
        minHeight: 44,

        display: 'flex',
        alignItems: 'center',

        px: 2,

        border: (theme) => `1px solid ${theme.palette.divider}`,

        borderRadius: 2.5,

        bgcolor: 'background.paper',

        color: 'text.secondary',

        cursor: 'pointer',

        transition: (theme) =>
          theme.transitions.create(['border-color', 'background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),

        '&:hover': {
          borderColor: 'primary.main',

          bgcolor: 'action.hover',
        },

        '&:focus-visible': {
          outline: 'none',

          borderColor: 'primary.main',

          boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}18`,
        },
      }}
    >
      <Box
        component='i'
        className='ri-search-line'
        sx={{
          fontSize: '1.25rem',
          color: 'text.disabled',
          mr: 1.5,
        }}
      />

      <Typography
        variant='body2'
        sx={{
          color: 'text.disabled',
          userSelect: 'none',
        }}
      >
        Buscar en el sistema...
      </Typography>

      {/* Atajo visual opcional */}
      <Box
        sx={{
          ml: 'auto',

          display: {
            xs: 'none',
            lg: 'flex',
          },

          alignItems: 'center',

          px: 1,
          py: 0.25,

          borderRadius: 1,

          border: (theme) => `1px solid ${theme.palette.divider}`,

          bgcolor: 'action.hover',

          color: 'text.disabled',

          fontSize: '0.6875rem',
          lineHeight: 1.6,
        }}
      >
        Ctrl K
      </Box>
    </Box>
  );
};

export default NavSearch;
