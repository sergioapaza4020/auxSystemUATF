'use client';

// React Imports
import { useRef } from 'react';

// Next Imports
import Link from 'next/link';

// MUI Imports
import IconButton from '@mui/material/IconButton';
import { styled, useTheme } from '@mui/material/styles';

// Component Imports
import Logo from '@components/layout/shared/Logo';
import NavHeader from '@menu/components/vertical-menu/NavHeader';
import VerticalNav from '@menu/components/vertical-menu/VerticalNav';
import VerticalMenu from './VerticalMenu';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';

// Style Imports
import navigationCustomStyles from '@core/styles/vertical/navigationCustomStyles';

const StyledBoxForShadow = styled('div')(({ theme }) => ({
  top: 80,
  left: 0,
  right: 0,

  zIndex: 2,

  opacity: 0,

  position: 'absolute',

  pointerEvents: 'none',

  height: 24,

  transition: 'opacity 0.2s ease-in-out',

  background: `linear-gradient(
    to bottom,
    rgb(${theme.vars.palette.background.defaultChannel} / 0.8),
    transparent
  )`,

  '&.scrolled': {
    opacity: 1,
  },
}));

const Navigation = () => {
  const theme = useTheme();

  const { isBreakpointReached, toggleVerticalNav } = useVerticalNav();

  const shadowRef = useRef<HTMLDivElement | null>(null);

  const scrollMenu = (container: any, isPerfectScrollbar: boolean) => {
    const scrollContainer = isBreakpointReached || !isPerfectScrollbar ? container.target : container;

    if (!shadowRef.current) return;

    if (scrollContainer.scrollTop > 0) {
      shadowRef.current.classList.add('scrolled');
    } else {
      shadowRef.current.classList.remove('scrolled');
    }
  };

  return (
    <VerticalNav customStyles={navigationCustomStyles(theme)}>
      <NavHeader>
        <Link
          href='/dashboard'
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <Logo />
        </Link>

        {isBreakpointReached && (
          <IconButton
            size='small'
            aria-label='Cerrar menú'
            onClick={() => toggleVerticalNav(false)}
            sx={{
              width: 36,
              height: 36,

              color: 'text.secondary',

              borderRadius: 2,

              '&:hover': {
                color: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <i className='ri-close-line text-xl' />
          </IconButton>
        )}
      </NavHeader>

      <StyledBoxForShadow ref={shadowRef} />

      <VerticalMenu scrollMenu={scrollMenu} />
    </VerticalNav>
  );
};

export default Navigation;
