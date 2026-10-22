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
import { getMenuSectionAccess } from './menuSectionAccess';

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
  const { user, loading } = useAuth();
  const can = (permission: string) => !loading && hasPermission(user, permission);
  const sectionAccess = getMenuSectionAccess(loading ? null : user);

  const visible = {
    permissions: can('permission.get-all'),
    sessions: can('sessions.get-all'),
    roles: can('role.get-all'),
    faculties: can('faculty.get-all'),
    careers: can('career.get-all'),
    courses: can('course.get-all'),
    semesters: can('semester.get-all'),
    users: can('user.get-all'),
    gradeItems: can('grade-item.get-all'),
    gradeSchemes: can('grade-scheme.get-all'),
    enrollments: can('enrollment.get-all'),
  };

  const showSuperAdministration =
    sectionAccess.superAdministration && (visible.permissions || visible.sessions || visible.roles);

  const showAdministration =
    sectionAccess.administration &&
    (visible.users ||
      visible.gradeItems ||
      visible.gradeSchemes ||
      visible.enrollments ||
      visible.faculties ||
      visible.careers ||
      visible.courses ||
      visible.semesters);

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
          {showSuperAdministration && (
            <MenuSection label='Superadministración'>
              {visible.permissions && (
                <MenuItem href='/dashboard/super-admin/permissions' icon={<i className='ri-key-2-line' />}>
                  Permisos
                </MenuItem>
              )}
              {visible.sessions && (
                <MenuItem href='/dashboard/super-admin/sessions' icon={<i className='ri-shield-user-line' />}>
                  Sesiones
                </MenuItem>
              )}

              {visible.roles && (
                <MenuItem href='/dashboard/super-admin/roles' icon={<i className='ri-user-settings-line' />}>
                  Roles
                </MenuItem>
              )}
            </MenuSection>
          )}

          {/* ADMINISTRACIÓN */}
          {showAdministration && (
            <MenuSection label='Administración'>
              {visible.faculties && (
                <MenuItem href='/dashboard/admin/faculties' icon={<i className='ri-community-line' />}>
                  Facultades
                </MenuItem>
              )}
              {visible.careers && (
                <MenuItem href='/dashboard/admin/careers' icon={<i className='ri-bookmark-3-line' />}>
                  Carreras
                </MenuItem>
              )}
              {visible.courses && (
                <MenuItem href='/dashboard/admin/courses' icon={<i className='ri-book-2-line' />}>
                  Cursos
                </MenuItem>
              )}
              {visible.semesters && (
                <MenuItem href='/dashboard/admin/semesters' icon={<i className='ri-calendar-line' />}>
                  Semestres
                </MenuItem>
              )}
              {visible.users && (
                <MenuItem href='/dashboard/super-admin/users' icon={<i className='ri-user-line' />}>
                  Usuarios
                </MenuItem>
              )}
              {visible.gradeItems && (
                <MenuItem href='/dashboard/admin/grade-items' icon={<i className='ri-list-check' />}>
                  Ítems de calificación
                </MenuItem>
              )}
              {visible.gradeSchemes && (
                <MenuItem href='/dashboard/admin/grade-schemes' icon={<i className='ri-file-list-3-line' />}>
                  Formas de calificar
                </MenuItem>
              )}

              {visible.enrollments && (
                <MenuItem href='/dashboard/admin/enrollments' icon={<i className='ri-group-line' />}>
                  Matriculaciones
                </MenuItem>
              )}
            </MenuSection>
          )}
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
            Sistema de Gestión de Auxiliaturas de Docencia
          </Typography>
        </Box>
      </Box>
    </ScrollWrapper>
  );
};

export default VerticalMenu;
