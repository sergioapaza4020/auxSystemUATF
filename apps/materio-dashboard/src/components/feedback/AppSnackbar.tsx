'use client';

import type { SyntheticEvent } from 'react';

import { Alert, IconButton, Snackbar } from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';

import type { SnackbarState } from '@/contexts/SnackbarContext';

interface AppSnackbarProps {
  snackbar: SnackbarState;
  onClose: () => void;
}

export function AppSnackbar(props: AppSnackbarProps) {
  const { snackbar, onClose } = props;

  const handleClose = (_: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;

    onClose();
  };

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={snackbar.autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
    >
      <Alert
        severity={snackbar.severity}
        variant='filled'
        onClose={onClose}
        action={
          <>
            {snackbar.action ?? snackbar.action}

            <IconButton color='inherit' size='small' onClick={onClose}>
              <CloseIcon fontSize='small' />
            </IconButton>
          </>
        }
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}
