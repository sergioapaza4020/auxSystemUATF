// MUI Imports
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { MenuProps } from '@menu/vertical-menu';

// Util Imports
import { menuClasses } from '@menu/utils/menuClasses';

const menuSectionStyles = (theme: Theme): MenuProps['menuSectionStyles'] => {
  return {
    root: {
      marginBlockStart: theme.spacing(3),

      [`& .${menuClasses.menuSectionContent}`]: {
        color: 'var(--mui-palette-text-disabled)',

        paddingInline: `${theme.spacing(4)} !important`,

        paddingBlock: `${theme.spacing(1)} !important`,

        gap: 0,

        // Eliminamos las líneas de Materio
        '&:before': {
          display: 'none',
        },

        '&:after': {
          display: 'none',
        },
      },

      [`& .${menuClasses.menuSectionLabel}`]: {
        flexGrow: 0,

        fontSize: '0.6875rem',

        lineHeight: 1.5,

        fontWeight: 700,

        textTransform: 'uppercase',

        letterSpacing: '0.08em',

        color: 'var(--mui-palette-text-disabled)',
      },
    },
  };
};

export default menuSectionStyles;
