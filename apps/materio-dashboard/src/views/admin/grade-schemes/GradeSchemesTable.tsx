'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Backdrop,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Paper,
  Snackbar,
  type SnackbarCloseReason,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Zoom,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';

import Swal, { type SweetAlertTheme } from 'sweetalert2';

import {
  deleteGradeScheme,
  getGradeSchemeById,
  getGradeSchemes,
  reactivateGradeScheme,
  updateGradeScheme,
} from '@/api/grade-scheme.service';
import type { IDetail, IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { EnhancedTableHead } from '@/components/table/HeaderTable';
import { gradeSchemeHeadCellsData } from '@/views/admin/grade-schemes/data/head-cells.data';
import type { Order } from '@/components/table/types/order';
import { getComparator } from '@/components/table/utils/getComparator';
import type { SortableColumn } from './types/sortableColumn';
import { LoadingTable } from '@/components/loading-skeletons/table/LoadingTable';

import { useSettings } from '@/@core/hooks/useSettings';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { getGradeItems } from '@/api/grade-items.service';

export const GradeSchemesTable = () => {
  const [gradeSchemes, setGradeSchemes] = useState<IGradeScheme[]>([]);
  const [gradeItems, setGradeItems] = useState<IGradeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedGradeScheme, setSelectedGradeScheme] = useState<IGradeScheme>();
  const [idGradeScheme, setIdGradeScheme] = useState<number>(0);

  const [openEditForm, setOpenEditForm] = useState<boolean>(false);
  const [openBackdrop, setOpenBackdrop] = useState<boolean>(false);
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<SortableColumn>('idGradeScheme');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);

  const router = useRouter();

  const { settings } = useSettings();

  const visibleRows = useMemo(
    () =>
      [...gradeSchemes].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [gradeSchemes, order, orderBy, page, rowsPerPage],
  );

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

  const handleEditForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedGradeScheme) return;

    setOpenBackdrop(true);

    try {
      await updateGradeScheme(selectedGradeScheme.idGradeScheme, {
        name: selectedGradeScheme.name,
        description: selectedGradeScheme.description,
        details: selectedGradeScheme.details,
      });

      setError(false);
    } catch (error) {
      setError(true);
    }

    setOpenBackdrop(false);
    setOpenSnackbar(true);

    void loadGradeSchemes();
    handleCloseEditButton();
  };

  const updateSelectedGradeScheme = <K extends keyof IGradeScheme>(key: K, value: IGradeScheme[K]) => {
    setSelectedGradeScheme((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const getDetail = (idGradeItem: number) =>
    selectedGradeScheme?.details?.find((detail) => detail.gradeItem.idGradeItem === idGradeItem);

  const handlePercentageChange = (idGradeItem: number, percentage: number) => {
    percentage = Math.max(0, Math.min(100, percentage));

    setSelectedGradeScheme((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        details: prev.details.map((detail) =>
          detail.gradeItem.idGradeItem === idGradeItem
            ? {
                ...detail,
                percentage,
              }
            : detail,
        ),
      };
    });
  };

  const totalPercentage = selectedGradeScheme?.details?.reduce((sum, detail) => sum + detail.percentage, 0) ?? 0;

  const isFormValid = (): boolean => {
    if (!selectedGradeScheme) return false;
    if (!selectedGradeScheme.name.trim()) return false;
    if (selectedGradeScheme.details.length === 0) return false;
    if (totalPercentage !== 100) return false;

    return selectedGradeScheme.details.every((detail) => detail.percentage > 0);
  };

  const handleGradeItemChange = (gradeItem: IGradeItem, checked: boolean) => {
    if (!selectedGradeScheme) return;

    if (checked) {
      setSelectedGradeScheme({
        ...selectedGradeScheme,
        details: [
          ...selectedGradeScheme.details,
          {
            percentage: 0,
            gradeItem,
          },
        ],
      });
    } else {
      setSelectedGradeScheme({
        ...selectedGradeScheme,
        details: selectedGradeScheme.details.filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem),
      });
    }
  };

  const handleOpenDeleteButton = async (name: string, idGradeScheme: number) => {
    let themeMode: SweetAlertTheme = 'light';

    if (settings.mode) themeMode = settings.mode;

    const result = await Swal.fire({
      theme: `${themeMode}`,
      title: `Desactivando el esquema de notas "${name}"`,
      text: '¿Estás seguro?',
      icon: 'warning',
      showDenyButton: true,
      confirmButtonText: 'Si',
      denyButtonText: 'No',
    });

    if (!result.isConfirmed) return;

    try {
      await deleteGradeScheme(idGradeScheme);

      setGradeSchemes((prevGradeSchemes) =>
        prevGradeSchemes.map((gradeScheme) =>
          gradeScheme.idGradeScheme === idGradeScheme
            ? {
                ...gradeScheme,
                isActive: false,
              }
            : gradeScheme,
        ),
      );

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Esquema de notas desactivado con éxito',
        text: '',
        icon: 'success',
      });
    } catch (error) {
      console.error(error);

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Error al desactivar el esquema de notas',
        text: '',
        icon: 'error',
      });
    }
  };

  const handleOpenReactivateButton = async (name: string, idGradeScheme: number) => {
    let themeMode: SweetAlertTheme = 'light';

    if (settings.mode) themeMode = settings.mode;

    const result = await Swal.fire({
      theme: `${themeMode}`,
      title: `Restaurando el esquema de notas "${name}"`,
      text: '¿Estás seguro?',
      icon: 'warning',
      showDenyButton: true,
      confirmButtonText: 'Si',
      denyButtonText: 'No',
    });

    if (!result.isConfirmed) return;

    try {
      await reactivateGradeScheme(idGradeScheme);

      setGradeSchemes((prevGradeSchemes) =>
        prevGradeSchemes.map((gradeScheme) =>
          gradeScheme.idGradeScheme === idGradeScheme
            ? {
                ...gradeScheme,
                isActive: true,
              }
            : gradeScheme,
        ),
      );

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Esquema de notas restaurado con éxito',
        text: '',
        icon: 'success',
      });
    } catch (error) {
      console.error(error);

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Error al restaurar el esquema de notas',
        text: '',
        icon: 'error',
      });
    }
  };

  const handleOpenEditButton = async (gradeScheme: IGradeScheme) => {
    setIdGradeScheme(gradeScheme.idGradeScheme);

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

  const handleCloseSnackbar = (event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') return;

    setOpenSnackbar(false);
  };

  const snackbarAction = (
    <React.Fragment>
      <IconButton size='small' onClick={handleCloseSnackbar}>
        <CloseIcon />
      </IconButton>
    </React.Fragment>
  );

  const snackbarErrorAction = (
    <React.Fragment>
      <Alert onClose={handleCloseSnackbar} severity='error' variant='filled' sx={{ width: '100%' }}>
        Ha ocurrido un error
      </Alert>
      <IconButton size='small' onClick={handleCloseSnackbar}>
        <CloseIcon />
      </IconButton>
    </React.Fragment>
  );

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: SortableColumn) => {
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
            <EnhancedTableHead<IGradeScheme>
              headCells={gradeSchemeHeadCellsData}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {visibleRows.map((gradeScheme: IGradeScheme) => {
                return (
                  <TableRow
                    key={gradeScheme.idGradeScheme}
                    hover={gradeScheme.isActive}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td, &:last-child th': {
                        border: 0,
                      },
                    }}
                  >
                    <TableCell align='center' component='th' scope='row' padding='none'>
                      {gradeScheme.idGradeScheme}
                    </TableCell>
                    <TableCell component='th' scope='row'>
                      {gradeScheme.name}
                    </TableCell>
                    <TableCell>{gradeScheme.description ? gradeScheme.description : 'Sin descripción'}</TableCell>
                    <TableCell>
                      <Box maxWidth={0.9} display='flex' flexWrap='wrap' columnGap={6.5} rowGap={4}>
                        {gradeScheme.details.map((detail: IDetail, idx: number) => {
                          return (
                            <Badge key={idx} color='primary' badgeContent={`${detail.percentage}%`}>
                              <Chip label={detail.gradeItem.name} size='small' />
                            </Badge>
                          );
                        })}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {gradeScheme.isActive ? (
                        <Chip label='Activo' color='success' />
                      ) : (
                        <Chip label='Inactivo' color='error' />
                      )}
                    </TableCell>
                    <TableCell align='center'>
                      <Box display='flex' gap={2} alignItems='center'>
                        <Tooltip title='Editar' slots={{ transition: Zoom }}>
                          <IconButton
                            disabled={!gradeScheme.isActive || idGradeScheme !== 0}
                            onClick={() => {
                              handleOpenEditButton(gradeScheme);
                            }}
                          >
                            {idGradeScheme !== gradeScheme.idGradeScheme ? (
                              <EditIcon color={gradeScheme.isActive ? 'info' : 'disabled'} />
                            ) : (
                              <CircularProgress color='info' size={20} />
                            )}
                          </IconButton>
                        </Tooltip>

                        {gradeScheme.isActive ? (
                          <Tooltip title='Desactivar' slots={{ transition: Zoom }}>
                            <IconButton
                              onClick={() => handleOpenDeleteButton(gradeScheme.name, gradeScheme.idGradeScheme)}
                            >
                              <DeleteIcon color='error' />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title='Restaurar' slots={{ transition: Zoom }}>
                            <IconButton
                              onClick={() => handleOpenReactivateButton(gradeScheme.name, gradeScheme.idGradeScheme)}
                            >
                              <RestoreFromTrashIcon color='warning' />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          labelRowsPerPage='Filas por página:'
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          rowsPerPageOptions={[5, 10, 25]}
          component='div'
          count={gradeSchemes.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          slotProps={{
            select: {
              MenuProps: {
                PaperProps: {
                  sx: {
                    '& .MuiMenuItem-root.Mui-selected': {
                      ...(settings.mode === 'dark' && { color: '#fff' }),
                    },
                  },
                },
              },
            },
          }}
        />
        <Dialog open={openEditForm} onClose={handleCloseEditButton}>
          <DialogTitle style={{ textAlign: 'center', textTransform: 'uppercase', fontWeight: 600 }}>
            Editar esquema de notas
          </DialogTitle>
          <DialogContent>
            <form onSubmit={handleEditForm} id='update-grade-scheme'>
              <TextField
                autoFocus
                required
                margin='dense'
                id='name'
                name='name'
                label='Nombre'
                type='text'
                fullWidth
                value={selectedGradeScheme?.name}
                onChange={(e) => updateSelectedGradeScheme('name', e.target.value)}
              />
              <TextField
                margin='dense'
                id='description'
                name='description'
                label='Descripción'
                type='text'
                maxRows={4}
                multiline
                fullWidth
                value={selectedGradeScheme?.description ?? ''}
                onChange={(e) => updateSelectedGradeScheme('description', e.target.value)}
              />
              <FormGroup style={{ gap: 5 }}>
                <Typography variant='h5'>Elementos</Typography>
                {gradeItems.map((gradeItem: IGradeItem) => {
                  const detail = getDetail(gradeItem.idGradeItem);

                  return (
                    <Box
                      key={gradeItem.idGradeItem}
                      style={{
                        width: '55%',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <FormControlLabel
                        label={gradeItem.name}
                        control={
                          <Checkbox
                            checked={!!detail}
                            onChange={(e) => handleGradeItemChange(gradeItem, e.target.checked)}
                          />
                        }
                      />
                      <TextField
                        size='small'
                        type='number'
                        sx={{ width: 90 }}
                        disabled={!detail}
                        value={detail?.percentage ?? ''}
                        onChange={(e) => handlePercentageChange(gradeItem.idGradeItem, Number(e.target.value))}
                        inputProps={{
                          min: 0,
                          max: 100,
                        }}
                      />
                    </Box>
                  );
                })}
                <Typography color={totalPercentage === 100 ? 'success.main' : 'error.main'}>
                  Total: {totalPercentage}%
                </Typography>
              </FormGroup>
            </form>
          </DialogContent>
          <DialogActions>
            <Button variant='contained' color='error' onClick={handleCloseEditButton}>
              Cerrar
            </Button>
            <Button variant='contained' color='info' type='submit' form='update-grade-scheme' disabled={!isFormValid()}>
              Editar
            </Button>
          </DialogActions>

          <Backdrop open={openBackdrop}>
            <CircularProgress />
          </Backdrop>
        </Dialog>
      </Paper>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        message={!error ? 'Esquema de notas creado correctamente' : ''}
        action={!error ? snackbarAction : snackbarErrorAction}
      />
    </Box>
  );
};
