'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';

import {
  createGradeItem,
  deactivateGradeItem,
  getGradeItems,
  reactivateGradeItem,
  updateGradeItem,
} from '@/api/grade-items.service';
import { EnhancedTableHead, PaginationTable } from '@/components/table';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useAdministrativeCatalog } from '@/hooks/catalogs/useAdministrativeCatalog';
import { useDataTable } from '@/hooks/table';
import type { IGradeItem, IGradeItemWrite } from '@/interfaces/grade-items/grade-item.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { CatalogToolbar } from '../catalogs/CatalogToolbar';
import { GradeItemEditDialog } from './components/GradeItemEditDialog';
import { GradeItemRow } from './components/GradeItemRow';
import { gradeItemHeadCells } from './data/head-cells.data';
import { gradeItemNameError, isAttendanceItem } from './grade-item-rules';

const fetchItems = () => getGradeItems('all');

export function GradeItemsTable() {
  const { user, loading: authLoading } = useAuth();
  const can = (action: string) => hasPermission(user, `grade-item.${action}`);
  const catalog = useAdministrativeCatalog(fetchItems, !authLoading && can('get-all'));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RecordStatus>('all');
  const [editing, setEditing] = useState<IGradeItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = useMemo(
    () =>
      catalog.records.filter(
        (item) =>
          item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (status === 'all' || item.isActive === (status === 'active')),
      ),
    [catalog.records, search, status],
  );

  const table = useDataTable<IGradeItem, typeof gradeItemHeadCells>(filtered, 'name', 10);
  const { page, rowsPerPage, handleChangePage } = table;

  useEffect(() => {
    if (page > Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1)) handleChangePage(null, 0);
  }, [filtered.length, page, rowsPerPage, handleChangePage]);

  if (authLoading) return <LoadingTable />;
  if (!can('get-all')) return <Alert severity='warning'>No tienes permiso para consultar ítems de calificación.</Alert>;

  const openEditor = (item: IGradeItem | null) => {
    if (catalog.busy || catalog.loading || catalog.error || (item && (!item.isActive || isAttendanceItem(item.name))))
      return;
    catalog.clearMutationError();
    setEditing(item);
    setEditorOpen(true);
  };

  const save = async (value: IGradeItemWrite) => {
    if (!can(editing ? 'update' : 'create') || gradeItemNameError(value.name, catalog.records, editing)) return;
    await catalog.mutate(
      () => (editing ? updateGradeItem(editing.idGradeItem, value) : createGradeItem(value)),
      editing ? 'Ítem actualizado.' : 'Ítem creado.',
      () => setEditorOpen(false),
    );
  };

  const changeState = async (item: IGradeItem) => {
    if (!can(item.isActive ? 'delete' : 'reactivate') || (item.isActive && isAttendanceItem(item.name))) return;
    await catalog.mutate(
      () => (item.isActive ? deactivateGradeItem(item.idGradeItem) : reactivateGradeItem(item.idGradeItem)),
      item.isActive ? 'Ítem desactivado.' : 'Ítem reactivado.',
      undefined,
      {
        title: `${item.isActive ? 'Desactivar' : 'Reactivar'} «${item.name}»`,
        text: item.isActive
          ? 'Dejará de estar disponible para nuevas selecciones. Podrás reactivarlo después.'
          : 'Volverá a estar disponible para seleccionarlo en los esquemas.',
        confirmButtonText: item.isActive ? 'Desactivar' : 'Reactivar',
      },
    );
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent='space-between'
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Typography variant='h4' component='h1'>
          Ítems de calificación
        </Typography>
        {can('create') && (
          <Button
            variant='contained'
            disabled={catalog.busy || catalog.loading || !!catalog.error}
            onClick={() => openEditor(null)}
            startIcon={<i className='ri-add-line' />}
          >
            Crear ítem
          </Button>
        )}
      </Stack>
      <Alert severity='info'>
        Los ítems de asistencia tienen nombre y estado protegidos porque el registro de asistencia depende de ellos. Si
        están inactivos, puedes reactivarlos.
      </Alert>
      {!editorOpen && catalog.mutationError && <Alert severity='error'>{catalog.mutationError}</Alert>}
      <Paper variant='outlined' sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <CatalogToolbar
          search={search}
          searchLabel='Buscar por nombre'
          onSearch={(value) => {
            setSearch(value);
            handleChangePage(null, 0);
          }}
          status={status}
          onStatus={(value) => {
            setStatus(value);
            handleChangePage(null, 0);
          }}
          disabled={catalog.loading || catalog.busy}
          onReload={() => void catalog.load()}
        />
        {catalog.loading ? (
          <Box sx={{ p: 3 }} role='status' aria-label='Cargando ítems'>
            <LoadingTable />
          </Box>
        ) : catalog.error ? (
          <Alert
            severity='error'
            sx={{ m: 3 }}
            action={<Button onClick={() => void catalog.load()}>Reintentar</Button>}
          >
            No se pudieron cargar los ítems. {catalog.error}
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table aria-label='Ítems de calificación' sx={{ minWidth: 480 }}>
                <EnhancedTableHead<IGradeItem, typeof gradeItemHeadCells>
                  headCells={gradeItemHeadCells}
                  order={table.order}
                  orderBy={table.orderBy}
                  onRequestSort={table.handleRequestSort}
                />
                <TableBody>
                  {table.visibleRows.map((item) => (
                    <GradeItemRow
                      key={item.idGradeItem}
                      item={item}
                      busy={catalog.busy}
                      onEdit={can('update') ? () => openEditor(item) : undefined}
                      onDeactivate={can('delete') ? () => void changeState(item) : undefined}
                      onReactivate={can('reactivate') ? () => void changeState(item) : undefined}
                    />
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={3} align='center' sx={{ py: 6 }}>
                        <Typography>
                          {catalog.records.length
                            ? 'No hay ítems que coincidan con la búsqueda y el estado.'
                            : 'Todavía no hay ítems de calificación.'}
                        </Typography>
                        {(search || status !== 'all') && (
                          <Button
                            onClick={() => {
                              setSearch('');
                              setStatus('all');
                              handleChangePage(null, 0);
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <PaginationTable
              count={filtered.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handleChangePage}
              onRowsPerPageChange={table.handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>
      {editorOpen && (
        <GradeItemEditDialog
          item={editing}
          records={catalog.records}
          busy={catalog.busy}
          error={catalog.mutationError}
          onClose={() => {
            if (!catalog.busy) setEditorOpen(false);
          }}
          onSubmit={save}
        />
      )}
    </Stack>
  );
}
