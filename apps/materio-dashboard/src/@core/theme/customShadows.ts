// MUI Imports
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { SystemMode } from '@core/types';

const customShadows = (mode: SystemMode): Theme['customShadows'] => {
  const color = `var(--mui-mainColorChannels-${mode}Shadow)`;

  return {
    xs: `0px 1px 3px rgb(${color} / ${mode === 'light' ? 0.08 : 0.12})`,
    sm: `0px 2px 6px rgb(${color} / ${mode === 'light' ? 0.1 : 0.14})`,
    md: `0px 4px 12px rgb(${color} / ${mode === 'light' ? 0.12 : 0.16})`,
    lg: `0px 6px 18px rgb(${color} / ${mode === 'light' ? 0.14 : 0.18})`,
    xl: `0px 10px 30px rgb(${color} / ${mode === 'light' ? 0.16 : 0.2})`,
  };
};

export default customShadows;
