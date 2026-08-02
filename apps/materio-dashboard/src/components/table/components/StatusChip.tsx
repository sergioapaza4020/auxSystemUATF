import { Chip } from '@mui/material';

interface StatusChipProps {
  active: boolean;
}

export function StatusChip(props: StatusChipProps) {
  const { active } = props;

  const label = active ? 'Activo' : 'Inactivo';
  const color = active ? 'success' : 'error';

  return <Chip label={label} color={color} />;
}
