// MUI Imports
import Box from '@mui/material/Box';

// Third-party Imports
import classnames from 'classnames';

// Component Imports
import NavToggle from './NavToggle';
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
        <UserDropdown />
      </Box>
    </div>
  );
};

export default NavbarContent;
