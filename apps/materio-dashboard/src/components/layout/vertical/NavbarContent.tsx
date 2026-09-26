// MUI Imports
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Third-party Imports
import classnames from 'classnames';

// Component Imports
import NavToggle from './NavToggle';
import NavSearch from '@components/layout/shared/search';
import ModeDropdown from '@components/layout/shared/ModeDropdown';
import UserDropdown from '@components/layout/shared/UserDropdown';

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses';

const NavbarContent = () => {
  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center is-full')}>
      {/* Zona izquierda */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          gap: {
            xs: 1,
            sm: 2,
          },
        }}
      >
        <NavToggle />

        <NavSearch />
      </Box>

      {/* Acciones */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: {
            xs: 0.25,
            sm: 0.5,
          },
          ml: 2,
        }}
      >
        <ModeDropdown />

        <Tooltip title='Notificaciones'>
          <IconButton
            aria-label='Notificaciones'
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
            <i className='ri-notification-3-line text-xl' />
          </IconButton>
        </Tooltip>

        <UserDropdown />
      </Box>
    </div>
  );
};

export default NavbarContent;
