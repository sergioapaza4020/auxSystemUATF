import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import Form from '@components/Form';

import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

import { useGradeSchemeForm } from '@/hooks/grade-schemes';
import { GradeSchemeFields } from './GradeSchemeFields';
import { useGradeItems } from '@/hooks/grade-items';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

interface GradeSchemeEditDialogProps {
  open: boolean;
  initialValue?: IGradeSchemeCreateOrEdit;
  loading: boolean;
  onClose: () => void;
  onSubmit: (gradeScheme: IGradeSchemeCreateOrEdit) => Promise<void>;
}

export function GradeSchemeEditDialog(props: GradeSchemeEditDialogProps) {
  const { open, initialValue, loading, onClose, onSubmit } = props;

  const { gradeScheme, updateField, handleGradeItemChange, handlePercentageChange, totalPercentage, isValid } =
    useGradeSchemeForm({ initialValue });

  const { gradeItems, loading: loadingGradeItems } = useGradeItems();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!gradeScheme) return;

    await onSubmit(gradeScheme);
  };

  if (!gradeScheme) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle style={{ textAlign: 'center', textTransform: 'uppercase', fontWeight: 600 }}>
        Editar esquema de notas
      </DialogTitle>
      <DialogContent>
        <Form onSubmit={handleSubmit} id='update-grade-scheme'>
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
      <DialogActions>
        <Button variant='contained' color='error' onClick={onClose}>
          Cerrar
        </Button>
        <Button
          variant='contained'
          color='info'
          type='submit'
          form='update-grade-scheme'
          disabled={loading || !isValid}
        >
          Editar
        </Button>
        <LoadingOverlay open={loading} />
      </DialogActions>
    </Dialog>
  );
}
