import { Skeleton, Stack } from '@mui/material';

export const LoadingTable = () => {
  return (
    <Stack spacing={1.5}>
      <Skeleton variant='rectangular' height={40} />
      <Stack spacing={1}>
        <Skeleton variant='rectangular' height={45} />
        <Skeleton variant='rectangular' height={45} />
        <Skeleton variant='rectangular' height={45} />
        <Skeleton variant='rectangular' height={45} />
        <Skeleton variant='rectangular' height={45} />
      </Stack>
      <Skeleton variant='rectangular' height={40} />
    </Stack>
  );
};
