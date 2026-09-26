'use client';

// React Imports
import * as React from 'react';

// MUI Imports
import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableContainer,
  TextField,
  Typography,
} from '@mui/material';

// Type Imports
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

// Data Imports
import { gradeSchemeHeadCellsData } from '@/views/admin/grade-schemes/data/head-cells.data';

// Components Imports
import { EnhancedTableHead, PaginationTable } from '@/components/table';

import { LoadingTable } from '@/components/skeletons/table/LoadingTable';

import { GradeSchemeRow } from './components/GradeSchemeRow';
import { GradeSchemeEditDialog } from './components/GradeSchemeEditDialog';

// Hooks Imports
import { useDialog } from '@/hooks/useDialog';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useDataTable } from '@/hooks/table';

import { useGradeSchemes, useGradeSchemeEditor, useGradeSchemeMutations } from '@/hooks/grade-schemes';

type StatusFilter = 'all' | 'active' | 'inactive';

export const GradeSchemesTable = () => {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const snackbar = useSnackbar();

  const dialog = useDialog();

  const [search, setSearch] = React.useState('');

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

  const { gradeSchemes, loading, load: loadGS } = useGradeSchemes();

  const {
    create: createGS,
    update: updateGS,
    remove: removeGS,
    restore: restoreGS,
  } = useGradeSchemeMutations({
    reload: loadGS,
  });

  const editor = useGradeSchemeEditor({
    update: updateGS,
  });

  const handleCreate = async (gradeScheme: IGradeSchemeCreateOrEdit) => {
    if (creating) return;

    setCreating(true);

    try {
      await createGS(gradeScheme);
      setCreateOpen(false);
      snackbar.success('Esquema creado correctamente');
      await loadGS();
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  /*
   * Búsqueda + filtro.
   *
   * useMemo evita recalcular innecesariamente
   * al renderizar diálogos u otros estados.
   */
  const filteredGradeSchemes = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return gradeSchemes.filter((gradeScheme) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        gradeScheme.name.toLowerCase().includes(normalizedSearch) ||
        gradeScheme.description?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && gradeScheme.isActive) ||
        (statusFilter === 'inactive' && !gradeScheme.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [gradeSchemes, search, statusFilter]);

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    visibleRows,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
  } = useDataTable<IGradeScheme, typeof gradeSchemeHeadCellsData>(filteredGradeSchemes, 'idGradeScheme');

  if (loading) {
    return <LoadingTable />;
  }

  const handleOpenDeleteButton = async (name: string, idGradeScheme: number) => {
    const confirmed = await dialog.confirm({
      title: `Desactivando "${name}"`,
      text: 'El esquema dejará de estar disponible. Podrás restaurarlo posteriormente.',
    });

    if (!confirmed) return;

    try {
      await removeGS(idGradeScheme);

      await dialog.success('Esquema desactivado con éxito');
    } catch (error) {
      await dialog.error('No se pudo desactivar');

      throw error;
    }
  };

  const handleOpenReactivateButton = async (name: string, idGradeScheme: number) => {
    try {
      await restoreGS(idGradeScheme);

      await dialog.success(`El esquema "${name}" fue restaurado correctamente`);
    } catch (error) {
      await dialog.error('No se pudo restaurar');

      throw error;
    }
  };

  return (
    <Stack spacing={3}>
      {/* Cabecera de página */}
      <Stack
        direction={{
          xs: 'column',
          sm: 'row',
        }}
        alignItems={{
          xs: 'stretch',
          sm: 'center',
        }}
        justifyContent='flex-end'
      >
        <Button
          variant='contained'
          startIcon={<i className='ri-add-line' />}
          onClick={() => setCreateOpen(true)}
          sx={{
            minHeight: 44,

            px: 2.5,

            alignSelf: {
              xs: 'stretch',
              sm: 'flex-end',
            },

            borderRadius: 2,
          }}
        >
          Registrar nueva forma de calificar
        </Button>
      </Stack>

      {/* Tabla */}
      <Paper
        variant='outlined'
        sx={{
          width: '100%',

          overflow: 'hidden',

          borderRadius: 3,

          borderColor: 'divider',

          boxShadow: 'none',
        }}
      >
        {/* Toolbar */}
        <Stack
          direction={{
            xs: 'column',
            md: 'row',
          }}
          alignItems={{
            xs: 'stretch',
            md: 'center',
          }}
          spacing={2}
          sx={{
            p: 2.5,

            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          {/* Buscar */}
          <TextField
            size='small'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Buscar esquemas de notas...'
            sx={{
              width: {
                xs: '100%',
                md: 360,
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-search-line' />
                </InputAdornment>
              ),
            }}
          />

          {/* Estado */}
          <TextField
            select
            size='small'
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            sx={{
              width: {
                xs: '100%',
                md: 210,
              },
            }}
          >
            <MenuItem value='all'>Todos los estados</MenuItem>

            <MenuItem value='active'>Activos</MenuItem>

            <MenuItem value='inactive'>Inactivos</MenuItem>
          </TextField>

          <Box sx={{ flexGrow: 1 }} />

          <Typography
            variant='body2'
            color='text.secondary'
            sx={{
              display: {
                xs: 'none',
                lg: 'block',
              },
            }}
          >
            {filteredGradeSchemes.length} {filteredGradeSchemes.length === 1 ? 'resultado' : 'resultados'}
          </Typography>
        </Stack>

        {/* Contenido */}
        <TableContainer>
          <Table
            sx={{
              minWidth: 950,

              '& .MuiTableCell-root': {
                px: 2.5,
              },

              '& .MuiTableBody-root .MuiTableCell-root': {
                py: 2.25,
              },
            }}
            aria-label='Tabla de esquemas de notas'
          >
            <EnhancedTableHead<IGradeScheme, typeof gradeSchemeHeadCellsData>
              headCells={gradeSchemeHeadCellsData}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />

            <TableBody>
              {visibleRows.length > 0 ? (
                visibleRows.map((gradeScheme) => (
                  <GradeSchemeRow
                    key={gradeScheme.idGradeScheme}
                    gradeScheme={gradeScheme}
                    loadingEdit={editor.loading && editor.editingId === gradeScheme.idGradeScheme}
                    disableEdit={!gradeScheme.isActive}
                    onEdit={({ idGradeScheme }) => editor.openEditor(idGradeScheme)}
                    onDelete={(gs) => handleOpenDeleteButton(gs.name, gs.idGradeScheme)}
                    onRestore={(gs) => handleOpenReactivateButton(gs.name, gs.idGradeScheme)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={gradeSchemeHeadCellsData.length}>
                    <Box
                      sx={{
                        py: 8,

                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',

                        textAlign: 'center',
                      }}
                    >
                      <Box
                        component='i'
                        className='ri-search-line'
                        sx={{
                          mb: 1.5,

                          fontSize: '2rem',

                          color: 'text.disabled',
                        }}
                      />

                      <Typography
                        variant='body1'
                        color='text.primary'
                        sx={{
                          fontWeight: 600,
                        }}
                      >
                        No se encontraron esquemas
                      </Typography>

                      <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                        Prueba con otros términos o filtros.
                      </Typography>
                    </Box>
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <PaginationTable
          count={filteredGradeSchemes.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {createOpen && (
        <GradeSchemeEditDialog
          mode='create'
          open={createOpen}
          loading={creating}
          onClose={() => {
            if (!creating) setCreateOpen(false);
          }}
          onSubmit={handleCreate}
        />
      )}

      <GradeSchemeEditDialog
        open={editor.open}
        initialValue={editor.initialValue}
        loading={editor.loading}
        onClose={editor.close}
        onSubmit={editor.submit}
      />
    </Stack>
  );
};
