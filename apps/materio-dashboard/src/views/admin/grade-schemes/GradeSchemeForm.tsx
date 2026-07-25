'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  Snackbar,
  type SnackbarCloseReason,
  TextField,
  Typography,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';

import Form from '@components/Form';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { getGradeItems } from '@/api/grade-items.service';
import { createGradeScheme } from '@/api/grade-scheme.service';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

const INITIAL_STATUS: IGradeSchemeCreateOrEdit = {
  name: '',
  description: '',
  details: [],
};

export const GradeSchemeForm = () => {
  const [gradeItems, setGradeItems] = useState<IGradeItem[]>([]);
  const [newGradeScheme, setNewGradeScheme] = useState<IGradeSchemeCreateOrEdit>(INITIAL_STATUS);
  const [loadingGradeItems, setLoadingGradeItems] = useState<boolean>(true);

  const [openBackdrop, setOpenBackdrop] = useState<boolean>(false);
  const [openSnackbar, setOpenSnackbar] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const router = useRouter();

  const loadGradeItems = async () => {
    const gradeItems = await getGradeItems();

    setGradeItems(gradeItems);

    setLoadingGradeItems(false);
  };

  useEffect(() => {
    void loadGradeItems();
  }, []);

  const updateSetState = <K extends keyof IGradeScheme>(key: K, value: IGradeScheme[K]) => {
    setNewGradeScheme((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleCreateForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newGradeScheme) return;

    setOpenBackdrop(true);

    try {
      await createGradeScheme({
        name: newGradeScheme.name,
        description: newGradeScheme.description,
        details: newGradeScheme.details,
      });
      setError(false);
    } catch (error) {
      setError(true);
    }

    setOpenBackdrop(false);
    setOpenSnackbar(true);

    setNewGradeScheme(INITIAL_STATUS);
  };

  const handleGradeItemChange = (gradeItem: IGradeItem, checked: boolean) => {
    if (!newGradeScheme) return;

    if (checked) {
      setNewGradeScheme({
        ...newGradeScheme,
        details: [
          ...newGradeScheme.details,
          {
            percentage: 0,
            gradeItem,
          },
        ],
      });
    } else {
      setNewGradeScheme({
        ...newGradeScheme,
        details: newGradeScheme.details.filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem),
      });
    }
  };

  const getDetail = (idGradeItem: number) =>
    newGradeScheme?.details?.find((detail) => detail.gradeItem.idGradeItem === idGradeItem);

  const totalPercentage = newGradeScheme?.details?.reduce((sum, detail) => sum + detail.percentage, 0) ?? 0;

  const handlePercentageChange = (idGradeItem: number, percentage: number) => {
    percentage = Math.max(0, Math.min(100, percentage));

    setNewGradeScheme((prev) => {
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

  const isFormValid = (): boolean => {
    if (!newGradeScheme) return false;
    if (!newGradeScheme.name.trim()) return false;
    if (newGradeScheme.details.length === 0) return false;
    if (totalPercentage !== 100) return false;

    return newGradeScheme.details.every((detail) => detail.percentage > 0);
  };

  const handleCloseSnackbar = (event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') return;

    setOpenSnackbar(false);
  };

  const snackbarAction = (
    <React.Fragment>
      <Button size='small' onClick={() => router.push('/dashboard/admin/grade-schemes')}>
        Ver tabla
      </Button>
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

  return (
    <Card>
      <CardHeader title='Registrar nuevo esquema de notas' />
      <CardContent>
        <Form onSubmit={handleCreateForm} id='create-grade-scheme'>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TextField
                autoFocus
                required
                fullWidth
                type='text'
                id='name'
                name='name'
                label='Nombre'
                placeholder='Nombre del esquema'
                value={newGradeScheme?.name}
                onChange={(e) => updateSetState('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                rows={4}
                multiline
                id='description'
                name='description'
                label='Descripción'
                placeholder='Descripción (opcional)'
                sx={{ '& .MuiOutlinedInput-root': { alignItems: 'baseline' } }}
                value={newGradeScheme?.description}
                onChange={(e) => updateSetState('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={11}>
              <Typography variant='h6'>Elementos</Typography>
              {!loadingGradeItems ? (
                <FormGroup style={{ gap: 5 }}>
                  {gradeItems.map((gradeItem: IGradeItem) => {
                    const detail = getDetail(gradeItem.idGradeItem);

                    return (
                      <Box
                        key={gradeItem.idGradeItem}
                        style={{
                          width: '20%',
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
                          value={detail?.percentage || ''}
                          disabled={!detail}
                          onChange={(e) => handlePercentageChange(gradeItem.idGradeItem, Number(e.target.value))}
                          inputProps={{
                            min: 0,
                            max: 100,
                          }}
                        />
                      </Box>
                    );
                  })}
                </FormGroup>
              ) : (
                <CircularProgress color='secondary' size={20} />
              )}
              <Typography color={totalPercentage === 100 ? 'success.main' : 'error.main'}>
                Total: {totalPercentage}%
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Button variant='contained' type='submit' form='create-grade-scheme' disabled={!isFormValid()}>
                Registrar
              </Button>
            </Grid>
          </Grid>
        </Form>
      </CardContent>

      <Backdrop open={openBackdrop}>
        <CircularProgress />
      </Backdrop>
      <Snackbar
        open={openSnackbar}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        message={!error ? 'Esquema de notas creado correctamente' : ''}
        action={!error ? snackbarAction : snackbarErrorAction}
      />
    </Card>
  );
};
