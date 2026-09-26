'use client';

// React Imports
import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';

// Next Imports
import { useRouter } from 'next/navigation';

// MUI Imports
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import Fade from '@mui/material/Fade';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';

import capitalize from '@mui/utils/capitalize';

// Hooks
import { useAuth } from '@/hooks/useAuth';

const UserDropdown = () => {
  const [open, setOpen] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const { user, loading, logout } = useAuth();

  const username = capitalize(user?.username ?? 'Usuario');

  const role = user?.roles?.[0] ?? 'Usuario';

  /**
   * Iniciales.
   *
   * "sergio apaza" -> "SA"
   * "sergio"       -> "SE"
   */
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  };

  const handleDropdownOpen = () => {
    setOpen((current) => !current);
  };

  const handleDropdownClose = async (event?: MouseEvent<HTMLLIElement> | MouseEvent | TouchEvent, url?: string) => {
    if (url === '/login') {
      setOpen(false);

      await logout();

      router.replace('/login');

      return;
    }

    if (url) {
      setOpen(false);

      router.push(url);

      return;
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return;
    }

    setOpen(false);
  };

  if (loading) {
    return (
      <Box
        sx={{
          width: 48,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={22} aria-label='Cargando usuario' />
      </Box>
    );
  }

  return (
    <>
      {/* Trigger */}
      <Box
        ref={anchorRef}
        onClick={handleDropdownOpen}
        role='button'
        tabIndex={0}
        sx={{
          ml: {
            xs: 0.5,
            sm: 1,
          },

          display: 'flex',
          alignItems: 'center',

          gap: 1.25,

          p: 0.5,

          pr: {
            xs: 0.5,
            md: 1,
          },

          borderRadius: 2.5,

          cursor: 'pointer',

          transition: (theme) =>
            theme.transitions.create('background-color', {
              duration: theme.transitions.duration.shorter,
            }),

          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,

            bgcolor: 'primary.main',

            color: 'primary.contrastText',

            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {getInitials(username)}
        </Avatar>

        {/* Información visible solo en escritorio */}
        <Box
          sx={{
            display: {
              xs: 'none',
              md: 'block',
            },

            minWidth: 0,
            maxWidth: 150,
          }}
        >
          <Typography
            variant='body2'
            color='text.primary'
            noWrap
            sx={{
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            {username}
          </Typography>

          <Typography
            variant='caption'
            color='text.secondary'
            noWrap
            sx={{
              display: 'block',
              lineHeight: 1.4,
            }}
          >
            {role}
          </Typography>
        </Box>

        <Box
          component='i'
          className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}
          sx={{
            display: {
              xs: 'none',
              md: 'block',
            },

            fontSize: '1.15rem',

            color: 'text.disabled',
          }}
        />
      </Box>

      {/* Dropdown */}
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        sx={{
          zIndex: (theme) => theme.zIndex.appBar + 10,

          mt: '10px !important',
        }}
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: 280,

                overflow: 'hidden',

                borderRadius: 3,

                border: (theme) => `1px solid ${theme.palette.divider}`,

                boxShadow: '0 12px 40px rgba(24, 39, 75, 0.12)',
              }}
            >
              <ClickAwayListener onClickAway={(event) => handleDropdownClose(event as MouseEvent | TouchEvent)}>
                <MenuList
                  disablePadding
                  sx={{
                    py: 1,
                  }}
                >
                  {/* Usuario */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',

                      gap: 1.5,

                      px: 2,
                      py: 2,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,

                        bgcolor: 'primary.main',

                        color: 'primary.contrastText',

                        fontWeight: 600,
                      }}
                    >
                      {getInitials(username)}
                    </Avatar>

                    <Box
                      sx={{
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant='body2'
                        color='text.primary'
                        noWrap
                        sx={{
                          fontWeight: 600,
                        }}
                      >
                        {username}
                      </Typography>

                      <Typography
                        variant='caption'
                        color='text.secondary'
                        noWrap
                        sx={{
                          display: 'block',
                          mt: 0.25,
                        }}
                      >
                        {role}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider />

                  {/* Perfil */}
                  <Box sx={{ py: 1 }}>
                    <MenuItem
                      onClick={(event) => handleDropdownClose(event, '/dashboard/profile')}
                      sx={{
                        mx: 1,
                        minHeight: 44,

                        gap: 1.5,

                        borderRadius: 2,
                      }}
                    >
                      <i className='ri-user-3-line text-xl' />

                      <Typography variant='body2' color='text.primary'>
                        Mi perfil
                      </Typography>
                    </MenuItem>

                    <MenuItem
                      onClick={(event) => handleDropdownClose(event, '/dashboard/settings')}
                      sx={{
                        mx: 1,
                        minHeight: 44,

                        gap: 1.5,

                        borderRadius: 2,
                      }}
                    >
                      <i className='ri-settings-3-line text-xl' />

                      <Typography variant='body2' color='text.primary'>
                        Configuración
                      </Typography>
                    </MenuItem>
                  </Box>

                  <Divider />

                  {/* Logout */}
                  <Box sx={{ p: 1.5 }}>
                    <Button
                      fullWidth
                      color='error'
                      startIcon={<i className='ri-logout-box-r-line' />}
                      onClick={(event) => handleDropdownClose(event, '/login')}
                      sx={{
                        minHeight: 42,
                        borderRadius: 2,
                      }}
                    >
                      Cerrar sesión
                    </Button>
                  </Box>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

export default UserDropdown;
