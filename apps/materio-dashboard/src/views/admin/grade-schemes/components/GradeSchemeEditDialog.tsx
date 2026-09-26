import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';

import Form from '@components/Form';

import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

import { useGradeSchemeForm } from '@/hooks/grade-schemes';
import { useGradeItems } from '@/hooks/grade-items';

import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

import { GradeSchemeFields } from './GradeSchemeFields';

interface GradeSchemeEditDialogProps {
  mode?: 'create' | 'edit';
  open: boolean;
  initialValue?: IGradeSchemeCreateOrEdit;
  loading: boolean;
  onClose: () => void;
  onSubmit: (gradeScheme: IGradeSchemeCreateOrEdit) => Promise<void>;
}

export function GradeSchemeEditDialog(props: GradeSchemeEditDialogProps) {
  const { mode = 'edit', open, initialValue, loading, onClose, onSubmit } = props;

  const formId = mode === 'create' ? 'create-grade-scheme' : 'update-grade-scheme';

  const { gradeScheme, updateField, handleGradeItemChange, handlePercentageChange, totalPercentage, isValid } =
    useGradeSchemeForm({
      initialValue,
    });

  const { gradeItems, loading: loadingGradeItems } = useGradeItems();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!gradeScheme) return;

    await onSubmit(gradeScheme);
  };

  if (!gradeScheme) return null;

  const isCreate = mode === 'create';

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth='md'
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        component='div'
        sx={{
          px: { xs: 3, sm: 4 },
          pt: 3.5,
          pb: 2,
        }}
      >
        <Stack direction='row' alignItems='flex-start' spacing={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              flexShrink: 0,

              display: {
                xs: 'none',
                sm: 'flex',
              },

              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: 2.5,

              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
            }}
          >
            <i className={isCreate ? 'ri-file-add-line' : 'ri-file-edit-line'} style={{ fontSize: 24 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant='h5'
              component='h2'
              sx={{
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {isCreate ? 'Registrar esquema de notas' : 'Editar esquema de notas'}
            </Typography>

            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
              {isCreate
                ? 'Define la información y los porcentajes que formarán parte del esquema.'
                : 'Modifica la información y los porcentajes de cada elemento del esquema.'}
            </Typography>
          </Box>

          <IconButton
            onClick={onClose}
            disabled={loading}
            aria-label='Cerrar'
            sx={{
              mt: -0.5,
              mr: -1,
            }}
          >
            <i className='ri-close-line' />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          px: { xs: 3, sm: 4 },
          pt: '24px !important',
          pb: 2,
        }}
      >
        <Form onSubmit={handleSubmit} id={formId}>
          <GradeSchemeFields
            form={gradeScheme}
            gradeItems={gradeItems}
            loadingGradeItems={loadingGradeItems}
            updateField={updateField}
            handleGradeItemChange={handleGradeItemChange}
            handlePercentageChange={handlePercentageChange}
            totalPercentage={totalPercentage}
          />
        </Form>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 3, sm: 4 },
          pt: 2,
          pb: 3.5,
          gap: 1,
        }}
      >
        <Button
          variant='outlined'
          color='inherit'
          onClick={onClose}
          disabled={loading}
          sx={{
            minWidth: 110,
          }}
        >
          Cerrar
        </Button>

        <Button
          variant='contained'
          type='submit'
          form={formId}
          disabled={loading || !isValid}
          startIcon={<i className={isCreate ? 'ri-add-line' : 'ri-save-line'} />}
          sx={{
            minWidth: 160,
          }}
        >
          {isCreate ? 'Registrar esquema' : 'Guardar cambios'}
        </Button>

        <LoadingOverlay open={loading} />
      </DialogActions>
    </Dialog>
  );
}
