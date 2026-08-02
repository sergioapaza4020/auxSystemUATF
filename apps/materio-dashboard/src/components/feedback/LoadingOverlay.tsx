import { Backdrop, CircularProgress } from '@mui/material';

interface LoadingOverlayProps {
  open: boolean;
}

export function LoadingOverlay({ open }: LoadingOverlayProps) {
  return (
    <Backdrop
      open={open}
      sx={(theme) => ({
        color: theme.palette.common.white,
        zIndex: theme.zIndex.modal + 1,
      })}
    >
      <CircularProgress color='inherit' />
    </Backdrop>
  );
}
