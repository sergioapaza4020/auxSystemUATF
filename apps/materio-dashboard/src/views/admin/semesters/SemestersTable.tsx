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
  createSemester,
  deactivateSemester,
  getSemesters,
  reactivateSemester,
  updateSemester,
} from '@/api/semesters.service';
import { EnhancedTableHead, PaginationTable } from '@/components/table';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useAdministrativeCatalog } from '@/hooks/catalogs/useAdministrativeCatalog';
import { useAdministrativeCurrentSemester } from '@/hooks/semesters/useAdministrativeCurrentSemester';
import { useDataTable } from '@/hooks/table';
import type { ISemester, ISemesterWrite } from '@/interfaces/semesters/semester.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { CatalogToolbar } from '../catalogs/CatalogToolbar';
import { SemesterEditDialog } from './components/SemesterEditDialog';
import { SemesterRow } from './components/SemesterRow';
import type { SemesterTableRecord } from './components/SemesterRow';
import { semesterHeadCells } from './data/head-cells.data';

const fetchSemesters = () => getSemesters('all');

export function SemestersTable() {
  const { user, loading: authLoading } = useAuth();
  const can = (action: string) => hasPermission(user, `semester.${action}`);
  const catalog = useAdministrativeCatalog(fetchSemesters, !authLoading && can('get-all'));
  const canReadCurrent = can('get-current-semester');
  const current = useAdministrativeCurrentSemester(!authLoading && can('get-all') && canReadCurrent);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RecordStatus>('all');
  const [editing, setEditing] = useState<ISemester | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = useMemo(
    () =>
      catalog.records
        .filter(
          (semester) =>
            `${semester.period}-${semester.year}`
              .toLowerCase()
              .includes(search.trim().toLowerCase().replace(/\s+/g, '-')) &&
            (status === 'all' || semester.isActive === (status === 'active')),
        )
        .map((semester) => ({
          ...semester,
          current:
            !canReadCurrent || current.loading || current.error ? null : current.currentId === semester.idSemester,
        })),
    [catalog.records, search, status, canReadCurrent, current.loading, current.error, current.currentId],
  );

  const table = useDataTable<SemesterTableRecord, typeof semesterHeadCells>(filtered, 'year', 10);
  const { page, rowsPerPage, handleChangePage } = table;

  useEffect(() => {
    if (page > Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1)) handleChangePage(null, 0);
  }, [filtered.length, page, rowsPerPage, handleChangePage]);

  if (authLoading) return <LoadingTable />;
  if (!can('get-all')) return <Alert severity='warning'>No tienes permiso para consultar semestres.</Alert>;

  const reload = () => {
    void catalog.load();
    void current.load();
  };

  const openEditor = (semester: ISemester | null) => {
    if (catalog.busy || catalog.loading || catalog.error || (semester && !semester.isActive)) return;
    catalog.clearMutationError();
    setEditing(semester);
    setEditorOpen(true);
  };

  const save = async (value: ISemesterWrite) => {
    if (!can(editing ? 'update' : 'create')) return;
    await catalog.mutate(
      () => (editing ? updateSemester(editing.idSemester, value) : createSemester(value)),
      editing ? 'Semestre actualizado.' : 'Semestre creado.',
      () => {
        setEditorOpen(false);
        void current.load();
      },
    );
  };

  const changeState = async (semester: ISemester) => {
    if (!can(semester.isActive ? 'delete' : 'reactivate')) return;
    await catalog.mutate(
      () => (semester.isActive ? deactivateSemester(semester.idSemester) : reactivateSemester(semester.idSemester)),
      semester.isActive ? 'Semestre desactivado.' : 'Semestre reactivado.',
      () => void current.load(),
      {
        title: `${semester.isActive ? 'Desactivar' : 'Reactivar'} semestre ${semester.period}-${semester.year}`,
        text: semester.isActive
          ? `${semester.idSemester === current.currentId ? 'Este es el semestre actual. ' : ''}Dejará de estar disponible para nuevas matrículas y para la consulta de semestre actual. Podrás reactivarlo después.`
          : 'Volverá a estar disponible. Solo será actual si el sistema lo identifica dentro de su vigencia.',
        confirmButtonText: semester.isActive ? 'Desactivar' : 'Reactivar',
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
          Semestres
        </Typography>
        {can('create') && (
          <Button
            variant='contained'
            disabled={catalog.busy || catalog.loading || !!catalog.error}
            onClick={() => openEditor(null)}
            startIcon={<i className='ri-add-line' />}
          >
            Crear semestre
          </Button>
        )}
      </Stack>
      <Typography color='text.secondary'>
        «Activo» permite utilizar el semestre. «Actual» identifica el semestre vigente que devuelve el sistema. Las
        fechas se muestran en tu zona horaria local.
      </Typography>
      {!canReadCurrent && (
        <Alert severity='info'>
          No tienes permiso para consultar cuál es el semestre actual. Puedes gestionar el catálogo.
        </Alert>
      )}
      {canReadCurrent && current.error && (
        <Alert
          severity='warning'
          action={
            <Button onClick={() => void current.load()} disabled={current.loading || catalog.busy}>
              Reintentar
            </Button>
          }
        >
          No se pudo confirmar el semestre actual. {current.error}
        </Alert>
      )}
      {canReadCurrent && !current.loading && !current.error && current.currentId === null && (
        <Alert severity='info'>No hay un semestre actual para la fecha de hoy.</Alert>
      )}
      {!editorOpen && catalog.mutationError && <Alert severity='error'>{catalog.mutationError}</Alert>}
      <Paper variant='outlined' sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <CatalogToolbar
          search={search}
          searchLabel='Buscar período o año (II-2026)'
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
          onReload={reload}
        />
        {catalog.loading ? (
          <Box sx={{ p: 3 }} role='status' aria-label='Cargando semestres'>
            <LoadingTable />
          </Box>
        ) : catalog.error ? (
          <Alert severity='error' sx={{ m: 3 }} action={<Button onClick={reload}>Reintentar</Button>}>
            No se pudieron cargar los semestres. {catalog.error}
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table aria-label='Semestres' sx={{ minWidth: 820 }}>
                <EnhancedTableHead<SemesterTableRecord, typeof semesterHeadCells>
                  headCells={semesterHeadCells}
                  order={table.order}
                  orderBy={table.orderBy}
                  onRequestSort={table.handleRequestSort}
                />
                <TableBody>
                  {table.visibleRows.map((semester) => (
                    <SemesterRow
                      key={semester.idSemester}
                      semester={semester}
                      busy={catalog.busy}
                      onEdit={can('update') ? () => openEditor(semester) : undefined}
                      onDeactivate={can('delete') ? () => void changeState(semester) : undefined}
                      onReactivate={can('reactivate') ? () => void changeState(semester) : undefined}
                    />
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={7} align='center' sx={{ py: 6 }}>
                        <Typography>
                          {catalog.records.length
                            ? 'No hay semestres que coincidan con la búsqueda y el estado.'
                            : 'Todavía no hay semestres registrados.'}
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
        <SemesterEditDialog
          semester={editing}
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
