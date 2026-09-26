'use client';

import { useId } from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

import type { ConfirmDialogOptions } from '@/contexts/DialogContext';

interface AppConfirmDialogProps {
  options: ConfirmDialogOptions;
  onClose: (confirmed: boolean) => void;
}

export function AppConfirmDialog({ options, onClose }: AppConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open
      fullWidth
      maxWidth='xs'
      aria-labelledby={titleId}
      aria-describedby={options.text ? descriptionId : undefined}
      onClose={() => onClose(false)}
    >
      <DialogTitle id={titleId}>{options.title}</DialogTitle>
      {options.text && (
        <DialogContent>
          <DialogContentText id={descriptionId}>{options.text}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button autoFocus variant='outlined' color='secondary' onClick={() => onClose(false)}>
          {options.cancelButtonText ?? 'Cancelar'}
        </Button>
        <Button variant='contained' color='primary' onClick={() => onClose(true)}>
          {options.confirmButtonText ?? 'Aceptar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
