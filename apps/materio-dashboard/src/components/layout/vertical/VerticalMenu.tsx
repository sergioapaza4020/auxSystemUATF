'use client';

// MUI Imports
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar';

// Type Imports
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu';

// Component Imports
import { Menu, MenuItem, MenuSection } from '@menu/vertical-menu';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon';

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles';
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles';

type RenderExpandIconProps = {
  open?: boolean;

  transitionDuration?: VerticalMenuContextProps['transitionDuration'];
};

type VerticalMenuProps = {
  scrollMenu: (container: any, isPerfectScrollbar: boolean) => void;
};

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
);

const VerticalMenu = ({ scrollMenu }: VerticalMenuProps) => {
  const theme = useTheme();
  const { user } = useAuth();

  const { isBreakpointReached, transitionDuration } = useVerticalNav();

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar;

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',

            onScroll: (container) => scrollMenu(container, false),
          }
        : {
            options: {
              wheelPropagation: false,
              suppressScrollX: true,
            },

            onScrollY: (container) => scrollMenu(container, true),
          })}
    >
      <Box
        sx={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',

          pt: 1.5,
          pb: 3,
        }}
      >
        <Menu
          menuItemStyles={menuItemStyles(theme)}
          menuSectionStyles={menuSectionStyles(theme)}
          renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
          renderExpandedMenuItemIcon={{
            icon: <i className='ri-circle-line' />,
          }}
        >
          {/* Inicio */}
          <MenuItem href='/dashboard' icon={<i className='ri-home-5-line' />}>
            Inicio
          </MenuItem>

          {/* SUPER ADMIN */}
          <MenuSection label='Super Admininistración'>
            {hasPermission(user, 'permission.get-all') && (
              <MenuItem href='/dashboard/super-admin/permissions' icon={<i className='ri-key-2-line' />}>
                Permisos
              </MenuItem>
            )}
            <MenuItem href='/dashboard/super-admin/sessions' icon={<i className='ri-shield-user-line' />}>
              Sesiones
            </MenuItem>

            <MenuItem href='/dashboard/super-admin/roles' icon={<i className='ri-user-settings-line' />}>
              Roles
            </MenuItem>
            {hasPermission(user, 'faculty.get-all') && (
              <MenuItem href='/dashboard/admin/faculties' icon={<i className='ri-community-line' />}>
                Facultades
              </MenuItem>
            )}
            {hasPermission(user, 'career.get-all') && (
              <MenuItem href='/dashboard/admin/careers' icon={<i className='ri-bookmark-3-line' />}>
                Carreras
              </MenuItem>
            )}
            {hasPermission(user, 'course.get-all') && (
              <MenuItem href='/dashboard/admin/courses' icon={<i className='ri-book-2-line' />}>
                Cursos
              </MenuItem>
            )}
            {hasPermission(user, 'semester.get-all') && (
              <MenuItem href='/dashboard/admin/semesters' icon={<i className='ri-calendar-line' />}>
                Semestres
              </MenuItem>
            )}
          </MenuSection>

          {/* ADMINISTRACIÓN */}
          <MenuSection label='Administración'>
            {hasPermission(user, 'user.get-all') && (
              <MenuItem href='/dashboard/super-admin/users' icon={<i className='ri-user-line' />}>
                Usuarios
              </MenuItem>
            )}
            {hasPermission(user, 'grade-item.get-all') && (
              <MenuItem href='/dashboard/admin/grade-items' icon={<i className='ri-list-check' />}>
                Ítems de calificación
              </MenuItem>
            )}
            <MenuItem href='/dashboard/admin/grade-schemes' icon={<i className='ri-file-list-3-line' />}>
              Formas de calificar
            </MenuItem>

            <MenuItem href='/dashboard/admin/enrollments' icon={<i className='ri-group-line' />}>
              Matriculaciones
            </MenuItem>
          </MenuSection>
        </Menu>

        {/* Información inferior */}
        <Box
          sx={{
            mt: 'auto',
            px: 4,
            pt: 4,
          }}
        >
          <Divider sx={{ mb: 2.5 }} />

          <Typography
            variant='caption'
            color='text.disabled'
            sx={{
              display: 'block',
              lineHeight: 1.5,
            }}
          >
            Sistema Auxiliares UATF
          </Typography>
        </Box>
      </Box>
    </ScrollWrapper>
  );
};

export default VerticalMenu;
