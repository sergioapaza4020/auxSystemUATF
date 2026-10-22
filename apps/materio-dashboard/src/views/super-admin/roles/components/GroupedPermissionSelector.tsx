'use client';

import { useId, useMemo, useState } from 'react';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type { IPermission } from '@/interfaces/permissions/permission.interface';
import { groupPermissions, normalizePermissionSearch, permissionLabel } from './permission-selector';

type Filter = 'all' | 'selected' | 'unselected';
interface Props {
  permissions: IPermission[];
  selectedPermissionNames: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}

export function GroupedPermissionSelector({ permissions, selectedPermissionNames, onChange, disabled = false }: Props) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selected = new Set(selectedPermissionNames);
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const query = normalizePermissionSearch(search);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      visible: group.permissions.filter(
        (permission) =>
          (filter === 'all' ||
            (filter === 'selected' ? selected.has(permission.name) : !selected.has(permission.name))) &&
          normalizePermissionSearch(
            `${group.label} ${permissionLabel(permission)} ${permission.name} ${permission.description ?? ''}`,
          ).includes(query),
      ),
    }))
    .filter((group) => group.visible.length > 0);

  const missing = selectedPermissionNames.filter(
    (name) => !permissions.some((permission) => permission.name === name),
  ).length;

  const changeGroup = (names: string[], checked: boolean) => {
    const next = new Set(selectedPermissionNames);

    names.forEach((name) => (checked ? next.add(name) : next.delete(name)));
    onChange([...next]);
  };

  return (
    <Stack spacing={2}>
      <Stack direction='row' justifyContent='space-between' alignItems='baseline' flexWrap='wrap' gap={1}>
        <Typography variant='h6'>Permisos</Typography>
        <Typography variant='body2' color='text.secondary' role='status'>
          {selected.size} asignados · {permissions.length} disponibles
        </Typography>
      </Stack>
      <TextField
        fullWidth
        size='small'
        label='Buscar permisos'
        value={search}
        disabled={disabled}
        onChange={(event) => {
          setSearch(event.target.value);
          setExpanded({});
        }}
      />
      <ToggleButtonGroup
        exclusive
        size='small'
        value={filter}
        disabled={disabled}
        aria-label='Filtrar permisos'
        sx={{ flexWrap: 'wrap' }}
        onChange={(_event, value: Filter | null) => {
          if (value) {
            setFilter(value);
            setExpanded({});
          }
        }}
      >
        <ToggleButton value='all'>Todos</ToggleButton>
        <ToggleButton value='selected'>Seleccionados</ToggleButton>
        <ToggleButton value='unselected'>Sin seleccionar</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant='caption' color='text.secondary'>
        La casilla del grupo selecciona o quita todos sus permisos disponibles, incluidos los ocultos por los filtros.
      </Typography>
      {missing > 0 && (
        <Typography variant='caption' color='text.secondary'>
          {missing} asignados fuera del catálogo disponible; se conservan.
        </Typography>
      )}
      <Box sx={{ maxHeight: { xs: '45vh', sm: 420 }, overflowY: 'auto' }}>
        {visibleGroups.length === 0 ? (
          <Typography color='text.secondary'>No hay permisos que coincidan con los filtros.</Typography>
        ) : (
          visibleGroups.map((group, index) => {
            const count = group.permissions.filter((permission) => selected.has(permission.name)).length;
            const all = count === group.permissions.length;
            const summaryId = `${id}-group-${index}`;

            return (
              <Box
                key={group.key}
                sx={{ display: 'flex', alignItems: 'flex-start', border: 1, borderColor: 'divider' }}
              >
                <Checkbox
                  checked={all}
                  indeterminate={count > 0 && !all}
                  disabled={disabled}
                  sx={{ mt: 0.5 }}
                  inputProps={{
                    'aria-label': `Seleccionar todos los permisos de ${group.label}`,
                    'aria-checked': count > 0 && !all ? 'mixed' : all,
                  }}
                  onChange={(_event, checked) =>
                    changeGroup(
                      group.permissions.map((permission) => permission.name),
                      checked,
                    )
                  }
                />
                <Accordion
                  expanded={Object.hasOwn(expanded, group.key) ? expanded[group.key] : !!query || filter !== 'all'}
                  disableGutters
                  elevation={0}
                  onChange={(_event, open) => setExpanded((current) => ({ ...current, [group.key]: open }))}
                  sx={{ flex: 1, minWidth: 0, '&:before': { display: 'none' } }}
                >
                  <AccordionSummary
                    id={summaryId}
                    aria-controls={`${summaryId}-content`}
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <Stack direction='row' justifyContent='space-between' gap={1} sx={{ width: '100%' }}>
                      <Typography fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                        {group.label}
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'nowrap' }}>
                        {count} / {group.permissions.length}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormGroup>
                      {group.visible.map((permission) => (
                        <FormControlLabel
                          key={permission.idPermission}
                          sx={{ mx: 0, my: 0.5, alignItems: 'flex-start' }}
                          control={
                            <Checkbox
                              checked={selected.has(permission.name)}
                              disabled={disabled}
                              onChange={(_event, checked) => changeGroup([permission.name], checked)}
                            />
                          }
                          label={
                            <Box sx={{ py: 0.75, overflowWrap: 'anywhere' }}>
                              <Typography variant='body2'>{permissionLabel(permission)}</Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {permission.name}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </FormGroup>
                  </AccordionDetails>
                </Accordion>
              </Box>
            );
          })
        )}
      </Box>
    </Stack>
  );
}
