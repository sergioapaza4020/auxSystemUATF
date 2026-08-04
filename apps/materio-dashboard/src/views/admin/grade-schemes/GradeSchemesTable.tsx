'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Box, Button, Paper, Table, TableBody, TableContainer } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';

import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { gradeSchemeHeadCellsData } from '@/views/admin/grade-schemes/data/head-cells.data';
import { EnhancedTableHead, PaginationTable } from '@/components/table';

import { LoadingTable } from '@/components/skeletons/table/LoadingTable';

import { useSettings } from '@/@core/hooks/useSettings';

import { GradeSchemeRow } from './components/GradeSchemeRow';
import { GradeSchemeEditDialog } from './components/GradeSchemeEditDialog';
import { useDialog } from '@/hooks/useDialog';
import { useDataTable } from '@/hooks/table';
import { useGradeSchemes, useGradeSchemeEditor, useGradeSchemeMutations } from '@/hooks/grade-schemes';

export const GradeSchemesTable = () => {
  const router = useRouter();

  const { settings } = useSettings();

  const dialog = useDialog();

  const { gradeSchemes, loading, load: loadGS } = useGradeSchemes();

  const { update: updateGS, remove: removeGS, restore: restoreGS } = useGradeSchemeMutations({ reload: loadGS });

  const editor = useGradeSchemeEditor({ update: updateGS });

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    visibleRows,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
  } = useDataTable<IGradeScheme, typeof gradeSchemeHeadCellsData>(gradeSchemes, 'idGradeScheme');

  if (loading) return <LoadingTable />;

  const handleOpenDeleteButton = async (name: string, idGradeScheme: number) => {
    const confirmed = await dialog.confirm({
      title: `Desactivando "${name}"`,
      text: '¿Estás seguro?',
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
    const confirmed = await dialog.confirm({
      title: `Restaurando "${name}"`,
      text: '¿Estás seguro?',
    });

    if (!confirmed) return;

    try {
      await restoreGS(idGradeScheme);

      await dialog.success('Esquema restaurado con éxito');
    } catch (error) {
      await dialog.error('No se pudo restaurar');

      throw error;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Button
        variant='contained'
        sx={{ alignSelf: 'flex-end' }}
        startIcon={<AddIcon />}
        onClick={() => router.replace('/dashboard/admin/grade-schemes/create')}
      >
        Registrar esquema de notas
      </Button>
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label='gradeSchemes-table'>
            <EnhancedTableHead<IGradeScheme, typeof gradeSchemeHeadCellsData>
              headCells={gradeSchemeHeadCellsData}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {visibleRows.map((gradeScheme) => (
                <GradeSchemeRow
                  key={gradeScheme.idGradeScheme}
                  gradeScheme={gradeScheme}
                  loadingEdit={editor.loading && editor.editingId === gradeScheme.idGradeScheme}
                  disableEdit={!gradeScheme.isActive}
                  onEdit={({ idGradeScheme }) => editor.openEditor(idGradeScheme)}
                  onDelete={(gs) => handleOpenDeleteButton(gs.name, gs.idGradeScheme)}
                  onRestore={(gs) => handleOpenReactivateButton(gs.name, gs.idGradeScheme)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <PaginationTable
          count={gradeSchemes.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          darkMode={settings.mode === 'dark'}
        />
      </Paper>

      <GradeSchemeEditDialog
        open={editor.open}
        initialValue={editor.initialValue}
        loading={editor.loading}
        onClose={editor.close}
        onSubmit={editor.submit}
      />
    </Box>
  );
};
