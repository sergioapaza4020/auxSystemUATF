import type { ReactNode } from 'react';

import { InputAdornment, MenuItem, TextField } from '@mui/material';

import { TableToolbar } from '@/components/table';

import type { RecordStatus } from '@/interfaces/status-query.interface';

interface Props {
  search: string;
  searchLabel: string;
  onSearch: (value: string) => void;
  status: RecordStatus;
  onStatus: (value: RecordStatus) => void;
  onReload: () => void;
  disabled: boolean;
  children?: ReactNode;
}

export function CatalogToolbar({
  search,
  searchLabel,
  onSearch,
  status,
  onStatus,
  onReload,
  disabled,
  children,
}: Props) {
  return (
    <TableToolbar onRefresh={onReload} refreshDisabled={disabled}>
      <TextField
        size='small'
        label={searchLabel}
        placeholder={`${searchLabel}...`}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        sx={{ flex: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <i className='ri-search-line' />
            </InputAdornment>
          ),
        }}
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
      {children}
    </TableToolbar>
  );
}
