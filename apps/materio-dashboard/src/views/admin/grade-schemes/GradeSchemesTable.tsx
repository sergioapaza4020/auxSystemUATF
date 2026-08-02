'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Box, Button, Paper, Table, TableBody, TableContainer } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';

import {
  deleteGradeScheme,
  getGradeSchemeById,
  getGradeSchemes,
  reactivateGradeScheme,
  updateGradeScheme,
} from '@/api/grade-scheme.service';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { EnhancedTableHead } from '@/components/table/components/HeaderTable';
import { gradeSchemeHeadCellsData } from '@/views/admin/grade-schemes/data/head-cells.data';
import type { Order } from '@/components/table/types/order';
import { getComparator } from '@/components/table/utils/getComparator';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';

import { useSettings } from '@/@core/hooks/useSettings';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { getGradeItems } from '@/api/grade-items.service';
import type { SortableIds } from '@/components/table/types/sortableIds';
import { PaginationTable } from '@/components/table/components/PaginationTable';
import { GradeSchemeRow } from './components/GradeSchemeRow';
import { GradeSchemeEditDialog } from './components/GradeSchemeEditDialog';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useDialog } from '@/hooks/useDialog';

type OrderBy = SortableIds<IGradeScheme, typeof gradeSchemeHeadCellsData>;

export const GradeSchemesTable = () => {
  const [gradeSchemes, setGradeSchemes] = useState<IGradeScheme[]>([]);
  const [gradeItems, setGradeItems] = useState<IGradeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedGradeScheme, setSelectedGradeScheme] = useState<IGradeScheme>();
  const [idGradeScheme, setIdGradeScheme] = useState<number>(0);

  const [openEditForm, setOpenEditForm] = useState<boolean>(false);

  const [openBackdrop, setOpenBackdrop] = useState<boolean>(false);

  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<OrderBy>('idGradeScheme');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  const router = useRouter();

  const { settings } = useSettings();

  const snackbar = useSnackbar();
  const dialog = useDialog();

  const visibleRows = useMemo(
    () =>
      [...gradeSchemes].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [gradeSchemes, order, orderBy, page, rowsPerPage],
  );

  const updateGradeSchemeState = (idGradeScheme: number, isActive: boolean) => {
    setGradeSchemes((prevGradeSchemes) =>
      prevGradeSchemes.map((gradeScheme) =>
        gradeScheme.idGradeScheme === idGradeScheme
          ? {
              ...gradeScheme,
              isActive: isActive,
            }
          : gradeScheme,
      ),
    );
  };

  const loadGradeSchemes = async () => {
    const gradeSchemes = await getGradeSchemes();

    setGradeSchemes(gradeSchemes);

    setLoading(false);
  };

  const loadGradeItems = async () => {
    const gradeItems = await getGradeItems();

    setGradeItems(gradeItems);
  };

  useEffect(() => {
    void loadGradeSchemes();
    void loadGradeItems();
  }, []);

  if (loading) return <LoadingTable />;

  const handleEditForm = async (gradeScheme: IGradeScheme) => {
    setOpenBackdrop(true);

    try {
      await updateGradeScheme(gradeScheme.idGradeScheme, {
        name: gradeScheme.name,
        description: gradeScheme.description,
        details: gradeScheme.details,
      });

      snackbar.success('Esquema editado correctamente');

      void loadGradeSchemes();

      handleCloseEditButton();
    } catch (error) {
      snackbar.error('No se pudo editar el esquema');
    } finally {
      setOpenBackdrop(false);
    }
  };

  const handleOpenDeleteButton = async (name: string, idGradeScheme: number) => {
    const confirmed = await dialog.confirm({
      title: `Desactivando "${name}"`,
      text: '¿Estás seguro?',
    });

    if (!confirmed) return;

    try {
      await deleteGradeScheme(idGradeScheme);

      updateGradeSchemeState(idGradeScheme, false);

      await dialog.success('Esquema desactivado con éxito');
    } catch (error: any) {
      console.error(error.response.data);

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
      await reactivateGradeScheme(idGradeScheme);

      updateGradeSchemeState(idGradeScheme, true);

      await dialog.success('Esquema restaurado con éxito');
    } catch (error: any) {
      console.error(error.response.data);

      await dialog.error('No se pudo restaurar');

      throw error;
    }
  };

  const handleOpenEditButton = async (gradeScheme: IGradeScheme) => {
    setIdGradeScheme(gradeScheme.idGradeScheme);
    console.log('entrando a editar');

    try {
      const gs = await getGradeSchemeById(gradeScheme.idGradeScheme);

      setSelectedGradeScheme(gs);

      setOpenEditForm(true);
    } finally {
      setIdGradeScheme(0);
    }
  };

  const handleCloseEditButton = () => {
    setOpenEditForm(false);
  };

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';

    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
                  loadingEdit={idGradeScheme === gradeScheme.idGradeScheme}
                  disableEdit={!gradeScheme.isActive}
                  onEdit={(gs) => handleOpenEditButton(gs)}
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
        open={openEditForm}
        gradeScheme={selectedGradeScheme}
        gradeItems={gradeItems}
        loading={openBackdrop}
        onClose={handleCloseEditButton}
        onSubmit={handleEditForm}
      />
      <LoadingOverlay open={openBackdrop} />
    </Box>
  );
};
