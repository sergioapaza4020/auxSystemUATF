'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert, Autocomplete, Button, Stack, TextField, Typography } from '@mui/material';

import { getUsersPage } from '@/api/users.service';

import type { IUser } from '@/interfaces/users/user.interface';

import { useAuth } from '@/hooks/useAuth';

import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

interface Props {
  value: IUser[];
  onChange: (users: IUser[]) => void;
  label?: string;
  role?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export function RemoteUserSelect({
  value,
  onChange,
  label = 'Usuarios',
  role,
  multiple = true,
  disabled = false,
}: Props) {
  const { user } = useAuth();

  const allowed = hasPermission(user, 'user.get-all');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [options, setOptions] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [role]);

  useEffect(() => {
    if (!allowed || disabled) {
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      void getUsersPage(
        {
          page,
          limit: 20,
          status: 'active',
          search: search.trim() || undefined,
          role: role ? [role] : undefined,
        },
        controller.signal,
      )
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }

          setOptions(response.data);
          setPages(response.meta.totalPages);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setError(getApiErrorMessage(cause));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [allowed, disabled, page, role, search, revision]);

  const mergedOptions = useMemo(
    () => [...value, ...options.filter((option) => !value.some((selected) => selected.idUser === option.idUser))],
    [options, value],
  );

  const getOptionLabel = (option: IUser) => `${option.name} ${option.lastname} · ${option.username} · CI ${option.ci}`;

  if (!allowed) {
    return (
      <Alert severity='warning'>Se requiere permiso para consultar usuarios y seleccionar {label.toLowerCase()}.</Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {multiple ? (
        <Autocomplete
          multiple
          filterOptions={(items) => items}
          options={mergedOptions}
          value={value}
          onChange={(_, selected) => onChange(selected)}
          inputValue={search}
          onInputChange={(_, text, reason) => {
            if (reason === 'input' || reason === 'clear') {
              setSearch(text);
              setPage(1);
            }
          }}
          getOptionLabel={getOptionLabel}
          isOptionEqualToValue={(a, b) => a.idUser === b.idUser}
          loading={loading}
          disabled={disabled}
          noOptionsText={error || 'Sin resultados'}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              helperText='Busca por nombre, username, CI o RU. Los seleccionados se conservan al cambiar de página.'
            />
          )}
        />
      ) : (
        <Autocomplete
          filterOptions={(items) => items}
          options={mergedOptions}
          value={value[0] ?? null}
          onChange={(_, selected) => onChange(selected ? [selected] : [])}
          inputValue={search}
          onInputChange={(_, text, reason) => {
            if (reason === 'input' || reason === 'clear') {
              setSearch(text);
              setPage(1);
            }
          }}
          getOptionLabel={getOptionLabel}
          isOptionEqualToValue={(a, b) => a.idUser === b.idUser}
          loading={loading}
          disabled={disabled}
          noOptionsText={error || 'Sin resultados'}
          renderInput={(params) => (
            <TextField {...params} label={label} helperText='Busca por nombre, username, CI o RU.' />
          )}
        />
      )}

      {error && (
        <Alert
          severity='error'
          action={
            <Button disabled={disabled || loading} onClick={() => setRevision((value) => value + 1)}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Stack direction='row' alignItems='center' spacing={1}>
        <Button disabled={disabled || loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
          Anterior
        </Button>

        <Typography variant='caption'>
          Página {page} de {Math.max(1, pages)}
        </Typography>

        <Button disabled={disabled || loading || page >= pages} onClick={() => setPage((value) => value + 1)}>
          Siguiente
        </Button>
      </Stack>
    </Stack>
  );
}
