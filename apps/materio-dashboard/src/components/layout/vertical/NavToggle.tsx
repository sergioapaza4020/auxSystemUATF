'use client';

// MUI Imports
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';

const NavToggle = () => {
  const { toggleVerticalNav } = useVerticalNav();

  const handleClick = () => {
    toggleVerticalNav();
  };

  return (
    <Tooltip title='Menú'>
      <IconButton
        aria-label='Abrir o cerrar menú'
        onClick={handleClick}
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 2.5,

          color: 'text.secondary',

          '&:hover': {
            color: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <i className='ri-menu-line text-xl' />
      </IconButton>
    </Tooltip>
  );
};

export default NavToggle;
