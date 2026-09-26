// MUI Imports
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { MenuItemStyles } from '@menu/types';

// Util Imports
import { menuClasses } from '@menu/utils/menuClasses';

const menuItemStyles = (theme: Theme): MenuItemStyles => {
  return {
    root: {
      marginBlockStart: theme.spacing(0.75),
      paddingInline: theme.spacing(2),

      // Submenu abierto o activo
      [`&.${menuClasses.subMenuRoot}.${menuClasses.open} > .${menuClasses.button},
         &.${menuClasses.subMenuRoot} > .${menuClasses.button}.${menuClasses.active}`]: {
        color: 'var(--mui-palette-primary-main)',
        backgroundColor: `${alpha(theme.palette.primary.main, 0.08)} !important`,
      },

      // Elemento deshabilitado
      [`&.${menuClasses.disabled} > .${menuClasses.button}`]: {
        color: 'var(--mui-palette-text-disabled)',

        [`& .${menuClasses.icon}`]: {
          color: 'inherit',
        },
      },

      // Item activo
      [`&:not(.${menuClasses.subMenuRoot}) > .${menuClasses.button}.${menuClasses.active}`]: {
        position: 'relative',

        color: 'var(--mui-palette-primary-main)',

        background: alpha(theme.palette.primary.main, 0.09),

        fontWeight: 600,

        [`& .${menuClasses.icon}`]: {
          color: 'var(--mui-palette-primary-main)',
        },

        // Indicador lateral
        '&::before': {
          content: '""',

          position: 'absolute',

          insetInlineStart: theme.spacing(-2),

          top: '50%',
          transform: 'translateY(-50%)',

          inlineSize: 4,
          blockSize: 28,

          borderStartEndRadius: 4,
          borderEndEndRadius: 4,

          backgroundColor: 'var(--mui-palette-primary-main)',
        },
      },
    },

    button: ({ active }) => ({
      minBlockSize: 48,

      paddingBlock: theme.spacing(1.5),

      paddingInlineStart: theme.spacing(2),
      paddingInlineEnd: theme.spacing(2),

      // Antes Materio utilizaba 50px únicamente a la derecha.
      // Ahora queremos una tarjeta suave completa.
      borderRadius: 10,

      color: active ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-text-secondary)',

      transition: theme.transitions.create(['background-color', 'color', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),

      '&:has(.MuiChip-root)': {
        paddingBlock: theme.spacing(1.25),
      },

      ...(!active && {
        '&:hover, &:focus-visible': {
          color: 'var(--mui-palette-primary-main)',

          backgroundColor: alpha(theme.palette.primary.main, 0.06),

          [`& .${menuClasses.icon}`]: {
            color: 'var(--mui-palette-primary-main)',
          },
        },

        '&[aria-expanded="true"]': {
          color: 'var(--mui-palette-primary-main)',

          backgroundColor: alpha(theme.palette.primary.main, 0.07),
        },
      }),
    }),

    icon: ({ level }) => ({
      flexShrink: 0,

      transition: theme.transitions.create('color', {
        duration: theme.transitions.duration.shorter,
      }),

      ...(level === 0 && {
        fontSize: '1.375rem',

        color: 'var(--mui-palette-text-secondary)',

        marginInlineEnd: theme.spacing(2),
      }),

      ...(level > 0 && {
        fontSize: '0.75rem',

        color: 'var(--mui-palette-text-secondary)',

        marginInlineEnd: theme.spacing(3),
      }),

      ...(level === 1 && {
        marginInlineStart: theme.spacing(1.5),
      }),

      ...(level > 1 && {
        marginInlineStart: theme.spacing(1.5 + 2.5 * (level - 1)),
      }),

      '& > i, & > svg': {
        fontSize: 'inherit',
      },
    }),

    prefix: {
      marginInlineEnd: theme.spacing(2),
    },

    suffix: {
      marginInlineStart: theme.spacing(2),
    },

    subMenuExpandIcon: {
      fontSize: '1.25rem',

      color: 'var(--mui-palette-text-secondary)',

      marginInlineStart: 'auto',

      transition: theme.transitions.create('color', {
        duration: theme.transitions.duration.shorter,
      }),

      '& i, & svg': {
        fontSize: 'inherit',
      },
    },

    subMenuContent: {
      backgroundColor: 'transparent',
    },
  };
};

export default menuItemStyles;
