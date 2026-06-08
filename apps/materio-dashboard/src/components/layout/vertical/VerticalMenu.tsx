// MUI Imports
import Chip from '@mui/material/Chip'
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu }: { scrollMenu: (container: any, isPerfectScrollbar: boolean) => void }) => {
  // Hooks
  const theme = useTheme()
  const { isBreakpointReached, transitionDuration } = useVerticalNav()

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        menuItemStyles={menuItemStyles(theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(theme)}
      >
        <MenuSection label='Pruebas'>
          <MenuItem href='/dashboard/admin/sessions' icon={<i className='ri-admin-line' />}>
            Sesiones
          </MenuItem>
        </MenuSection>
        <MenuSection label='Ejemplos'>
          <MenuItem href='/dashboard/account-settings' icon={<i className='ri-user-settings-line' />}>
            Configuración de cuenta
          </MenuItem>
          <SubMenu label='Autenticación' icon={<i className='ri-shield-keyhole-line' />}>
            <MenuItem href='/login' target='_blank'>
              Inicio de sesión
            </MenuItem>
            <MenuItem href='/register' target='_blank'>
              Registro de usuario
            </MenuItem>
            <MenuItem href='/forgot-password' target='_blank'>
              Olvidé mi contraseña
            </MenuItem>
          </SubMenu>
          <SubMenu label='Miscelánea' icon={<i className='ri-question-line' />}>
            <MenuItem href='/error' target='_blank'>
              Error
            </MenuItem>
            <MenuItem href='/under-maintenance' target='_blank'>
              Bajo mantenimiento
            </MenuItem>
          </SubMenu>
          <MenuItem href='/dashboard/card-basic' icon={<i className='ri-bar-chart-box-line' />}>
            Tarjetas
          </MenuItem>
          <MenuItem href='/dashboard/form-layouts' icon={<i className='ri-layout-4-line' />}>
            Diseño de formularios
          </MenuItem>
          <MenuItem suffix={<Chip label='New' size='small' color='info' />}>Item con chip</MenuItem>
          <SubMenu label='Niveles de menú'>
            <MenuItem>Nivel de menú 2</MenuItem>
            <SubMenu label='Nivel de menú 2'>
              <MenuItem>Nivel de menú 3</MenuItem>
              <MenuItem>Nivel de menú 3</MenuItem>
            </SubMenu>
          </SubMenu>
          <MenuItem disabled>Menú deshabilitado</MenuItem>
        </MenuSection>
        <MenuSection label='Enlaces'>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/components`}
            icon={<i className='ri-toggle-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            Componentes
          </MenuItem>
          <MenuItem
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/menu-examples/overview`}
            icon={<i className='ri-menu-search-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            Ejemplos de menú
          </MenuItem>
          <MenuItem
            href={process.env.NEXT_PUBLIC_DOCS_URL}
            icon={<i className='ri-book-line' />}
            suffix={<i className='ri-external-link-line text-xl' />}
            target='_blank'
          >
            Documentación
          </MenuItem>
        </MenuSection>
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
