// MUI Imports
import type { Theme } from '@mui/material/styles';

// Type Imports
import type { SystemMode } from '@core/types';

const shadows = (mode: SystemMode): Theme['shadows'] => {
  const color = `var(--mui-mainColorChannels-${mode}Shadow)`;

  return [
    'none',

    `0px 1px 2px rgb(${color} / 0.08), 0px 1px 3px rgb(${color} / 0.06)`,
    `0px 2px 4px rgb(${color} / 0.09), 0px 1px 3px rgb(${color} / 0.06)`,
    `0px 3px 6px rgb(${color} / 0.1), 0px 2px 4px rgb(${color} / 0.07)`,
    `0px 4px 8px rgb(${color} / 0.1), 0px 2px 5px rgb(${color} / 0.07)`,
    `0px 5px 10px rgb(${color} / 0.11), 0px 3px 6px rgb(${color} / 0.08)`,

    `0px 6px 12px rgb(${color} / 0.11), 0px 3px 7px rgb(${color} / 0.08)`,
    `0px 7px 14px rgb(${color} / 0.11), 0px 4px 8px rgb(${color} / 0.08)`,
    `0px 8px 16px rgb(${color} / 0.12), 0px 4px 9px rgb(${color} / 0.08)`,
    `0px 9px 18px rgb(${color} / 0.12), 0px 5px 10px rgb(${color} / 0.08)`,
    `0px 10px 20px rgb(${color} / 0.12), 0px 5px 11px rgb(${color} / 0.09)`,

    `0px 11px 22px rgb(${color} / 0.12), 0px 6px 12px rgb(${color} / 0.09)`,
    `0px 12px 24px rgb(${color} / 0.12), 0px 6px 13px rgb(${color} / 0.09)`,
    `0px 13px 26px rgb(${color} / 0.13), 0px 7px 14px rgb(${color} / 0.09)`,
    `0px 14px 28px rgb(${color} / 0.13), 0px 7px 15px rgb(${color} / 0.09)`,
    `0px 15px 30px rgb(${color} / 0.13), 0px 8px 16px rgb(${color} / 0.1)`,

    `0px 16px 32px rgb(${color} / 0.13), 0px 8px 17px rgb(${color} / 0.1)`,
    `0px 17px 34px rgb(${color} / 0.13), 0px 9px 18px rgb(${color} / 0.1)`,
    `0px 18px 36px rgb(${color} / 0.14), 0px 9px 19px rgb(${color} / 0.1)`,
    `0px 19px 38px rgb(${color} / 0.14), 0px 10px 20px rgb(${color} / 0.1)`,
    `0px 20px 40px rgb(${color} / 0.14), 0px 10px 21px rgb(${color} / 0.1)`,

    `0px 21px 42px rgb(${color} / 0.14), 0px 11px 22px rgb(${color} / 0.1)`,
    `0px 22px 44px rgb(${color} / 0.14), 0px 11px 23px rgb(${color} / 0.1)`,
    `0px 23px 46px rgb(${color} / 0.14), 0px 12px 24px rgb(${color} / 0.1)`,
    `0px 24px 48px rgb(${color} / 0.14), 0px 12px 25px rgb(${color} / 0.1)`,
  ];
};

export default shadows;
