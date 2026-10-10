import { useState } from 'react';

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { isAttendanceCriterion } from '@repo/grade-calculations';

import { getMyAssistantGradeScheme, updateAssistantGradeScheme } from '@/api/assistant-grade-schemes.service';
import { parsePermissionPercentage, permissionWeightToPercentage } from '@/utils/attendance-permission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

interface Props {
  idCourse: number;
  idEnrollment: number;
  permissionWeight: number;
  onClose: () => void;
  onSaved: (weight: number) => Promise<void>;
}

export function AttendancePermissionDialog({ idCourse, idEnrollment, permissionWeight, onClose, onSaved }: Props) {
  const [value, setValue] = useState(String(permissionWeightToPercentage(permissionWeight)));
  const [saving, setSaving] = useState(false);
  const snackbar = useSnackbar();
  const weight = parsePermissionPercentage(value);
  const invalid = !Number.isFinite(weight);

  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);

    let confirmed = false;

    try {
      // Read the current scheme to preserve all other criteria in the existing update contract.
      const scheme = await getMyAssistantGradeScheme(idCourse, idEnrollment);
      const detail = scheme?.details.find((item) => isAttendanceCriterion(item.gradeItem.name));

      if (!scheme || !detail) throw new Error('No se encontró el criterio de asistencia en el esquema activo.');

      const updated = await updateAssistantGradeScheme(scheme.idGradeScheme, {
        assistantPercentage: scheme.assistantPercentage,
        name: scheme.name,
        description: scheme.description,
        details: scheme.details.map((item) => ({
          percentage: item.percentage,
          order: item.order,
          gradeItem: { idGradeItem: item.gradeItem.idGradeItem },
          permissionWeight: item.idGradeSchemeDetail === detail.idGradeSchemeDetail ? weight : item.permissionWeight,
        })),
      });

      const confirmedWeight = updated.details.find(
        (item) => item.gradeItem.idGradeItem === detail.gradeItem.idGradeItem,
      )?.permissionWeight;

      if (confirmedWeight == null || !Number.isFinite(confirmedWeight))
        throw new Error('La respuesta no confirmó el valor del permiso.');
      confirmed = true;
      setValue(String(permissionWeightToPercentage(confirmedWeight)));
      await onSaved(confirmedWeight);
      onClose();
      snackbar.success('Valor del permiso actualizado.');
    } catch (error) {
      snackbar.error(
        `${confirmed ? 'La configuración se guardó, pero no se pudo actualizar la vista.' : 'No se pudo actualizar la configuración.'} ${getApiErrorMessage(error)} El valor escrito se conserva.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      maxWidth='xs'
      fullWidth
      aria-labelledby='attendance-permission-title'
    >
      <DialogTitle id='attendance-permission-title'>Valor del permiso</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size='small'
          type='number'
          label='Valor del permiso'
          value={value}
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
          error={invalid}
          inputProps={{ min: 0, max: 100, step: 'any' }}
          InputProps={{ endAdornment: <InputAdornment position='end'>%</InputAdornment> }}
          helperText={
            invalid
              ? 'Ingresa un porcentaje válido entre 0 y 100.'
              : 'Define qué porcentaje de una asistencia completa aporta un permiso.'
          }
          sx={{ mt: 1 }}
        />
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 2 }}>
          100% equivale a una asistencia completa; 0% no aporta puntaje.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant='contained'
          disabled={invalid || saving || weight === permissionWeight}
          onClick={() => void save()}
          startIcon={saving ? <CircularProgress size={16} color='inherit' /> : undefined}
        >
          Guardar configuración
        </Button>
      </DialogActions>
    </Dialog>
  );
}
