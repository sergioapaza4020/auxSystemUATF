import { Button, MenuItem, Stack, TextField } from '@mui/material';

import type { RecordStatus } from '@/interfaces/status-query.interface';

interface Props {
  search: string;
  searchLabel: string;
  onSearch: (value: string) => void;
  status: RecordStatus;
  onStatus: (value: RecordStatus) => void;
  onReload: () => void;
  disabled: boolean;
}

export function CatalogToolbar({ search, searchLabel, onSearch, status, onStatus, onReload, disabled }: Props) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 3 }}>
      <TextField
        size='small'
        label={searchLabel}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        sx={{ flex: 1 }}
      />
      <TextField
        select
        size='small'
        label='Estado'
        value={status}
        onChange={(event) => onStatus(event.target.value as RecordStatus)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value='all'>Todos</MenuItem>
        <MenuItem value='active'>Activos</MenuItem>
        <MenuItem value='inactive'>Inactivos</MenuItem>
      </TextField>
      <Button onClick={onReload} disabled={disabled} startIcon={<i className='ri-refresh-line' />}>
        Actualizar
      </Button>
    </Stack>
  );
}
