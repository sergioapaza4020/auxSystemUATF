'use client';

// React Imports
import { useMemo } from 'react';

// MUI Imports
import { deepmerge } from '@mui/utils';
import {
  Experimental_CssVarsProvider as CssVarsProvider,
  experimental_extendTheme as extendTheme,
} from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import type {} from '@mui/material/themeCssVarsAugmentation'; //! Do not remove this import otherwise you will get type errors while making a production build
import type {} from '@mui/lab/themeAugmentation'; //! Do not remove this import otherwise you will get type errors while making a production build

// Type Imports
import type { ChildrenType, Direction } from '@core/types';

// Component Imports
import ModeChanger from './ModeChanger';

// Config Imports
import themeConfig from '@configs/themeConfig';
import primaryColorConfig from '@configs/primaryColorConfig';

// Hook Imports
import { useSettings } from '@core/hooks/useSettings';

// Core Theme Imports
import defaultCoreTheme from '@core/theme';

type Props = ChildrenType & {
  direction: Direction;
};

const ThemeProvider = (props: Props) => {
  // Props
  const { children, direction } = props;

  // Hooks
  const { settings } = useSettings();

  // Merge the primary color scheme override with the core theme
  const theme = useMemo(() => {
    const primaryColor = primaryColorConfig[0];

    const newColorScheme = {
      colorSchemes: {
        light: {
          palette: {
            primary: {
              main: primaryColor.light.main,
              light: primaryColor.light.light,
              dark: primaryColor.light.dark,
              contrastText: '#FFFFFF',
            },
          },
        },

        dark: {
          palette: {
            primary: {
              main: primaryColor.dark.main,
              light: primaryColor.dark.light,
              dark: primaryColor.dark.dark,
              contrastText: '#FFFFFF',
            },
          },
        },
      },
    };

    const coreTheme = deepmerge(defaultCoreTheme(settings.mode || 'light', direction), newColorScheme);

    return extendTheme(coreTheme);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode]);

  return (
    <AppRouterCacheProvider options={{ prepend: true }}>
      <CssVarsProvider
        theme={theme}
        defaultMode={settings.mode}
        modeStorageKey={`${themeConfig.templateName.toLowerCase().split(' ').join('-')}-mui-template-mode`}
      >
        <>
          <ModeChanger />
          <CssBaseline />
          {children}
        </>
      </CssVarsProvider>
    </AppRouterCacheProvider>
  );
};

export default ThemeProvider;
