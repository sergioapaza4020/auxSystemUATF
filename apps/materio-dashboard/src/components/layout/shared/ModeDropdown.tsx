'use client';

// React Imports
import { useState } from 'react';

// MUI Imports
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

// Hook Imports
import { useSettings } from '@core/hooks/useSettings';

const ModeDropdown = () => {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const { settings, updateSettings } = useSettings();

  const isDarkMode = settings.mode === 'dark';

  const handleToggle = () => {
    updateSettings({
      mode: isDarkMode ? 'light' : 'dark',
    });
  };

  return (
    <Tooltip
      title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onOpen={() => setTooltipOpen(true)}
      onClose={() => setTooltipOpen(false)}
      open={tooltipOpen}
    >
      <IconButton
        aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        onClick={handleToggle}
        sx={{
          width: 40,
          height: 40,

          borderRadius: 2.5,

          color: 'text.secondary',

          '&:hover': {
            color: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <i className={isDarkMode ? 'ri-sun-line text-xl' : 'ri-moon-clear-line text-xl'} />
      </IconButton>
    </Tooltip>
  );
};

export default ModeDropdown;
