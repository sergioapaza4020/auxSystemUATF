import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';

import { attendanceStatusColor } from '@/utils/attendance-status';
import { permissionWeightToPercentage } from '@/utils/attendance-permission';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { useDataTable } from '@/hooks/table/useDataTable';
import { PaginationTable, type HeadCell } from '@/components/table';
import { AttendanceStudentRow } from './AttendanceStudentRow';

const columns = [
  { id: 'idEnrollment', label: 'N°', sortable: true },
] as const satisfies readonly HeadCell<IEnrollmentStudent>[];

interface AttendanceSheetProps {
  students: IEnrollmentStudent[];
  totalStudents: number;
  attendance: Record<number, AttendanceStatus>;
  observations?: Record<number, string | null>;
  onChangeObservation?: (id: number, value: string) => void;
  loading: boolean;
  saving: boolean;
  readOnly?: boolean;
  saveDisabled?: boolean;
  search: string;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  hasChanges: boolean;
  modifiedStudentIds: number[];
  permissionWeight: number | null;
  permissionWeightLoading: boolean;
  permissionWeightError: boolean;
  onSearchChange: (value: string) => void;
  onChangeAttendance: (idEnrollment: number, status: AttendanceStatus) => void;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onCancelChanges: () => void;
  onSave: () => void;
}

export function AttendanceSheet({
  students,
  totalStudents,
  attendance,
  observations = {},
  onChangeObservation,
  loading,
  saving,
  readOnly = false,
  saveDisabled = false,
  search,
  presentCount,
  excusedCount,
  absentCount,
  hasChanges,
  modifiedStudentIds,
  permissionWeight,
  permissionWeightLoading,
  permissionWeightError,
  onSearchChange,
  onChangeAttendance,
  onMarkAllPresent,
  onMarkAllAbsent,
  onCancelChanges,
  onSave,
}: AttendanceSheetProps) {
  const [observationStudent, setObservationStudent] = useState<IEnrollmentStudent | null>(null);
  const table = useDataTable<IEnrollmentStudent, typeof columns>(students, 'idEnrollment', 25, { preserveOrder: true });
  const disabled = loading || saving || readOnly || totalStudents === 0;

  const permissionLabel = permissionWeightLoading
    ? 'Cargando valor del permiso…'
    : permissionWeightError
      ? 'Valor del permiso no disponible'
      : permissionWeight === null
        ? 'Sin criterio de asistencia configurado'
        : `Permiso = ${permissionWeightToPercentage(permissionWeight)}% de una asistencia`;

  return (
    <Card sx={{ overflow: 'visible' }}>
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={1}>
          <Box>
            <Typography variant='h6' fontWeight={700}>
              Planilla de estudiantes
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Marca todos presentes y ajusta las excepciones antes de guardar.
            </Typography>
          </Box>
          <Tooltip title='El valor del permiso se configura en el esquema académico de la materia.'>
            <Stack
              direction='row'
              spacing={0.75}
              alignItems='center'
              tabIndex={0}
              sx={{ color: 'text.secondary', alignSelf: 'flex-start' }}
            >
              <InfoOutlinedIcon fontSize='small' />
              <Typography variant='caption'>{permissionLabel}</Typography>
            </Stack>
          </Tooltip>
        </Stack>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent='space-between' spacing={2}>
          <Stack
            direction='row'
            flexWrap='wrap'
            useFlexGap
            spacing={1}
            aria-label='Resumen de asistencia'
            aria-live='polite'
          >
            <CountIndicator value={totalStudents} label='Estudiantes' icon={<GroupsOutlinedIcon fontSize='small' />} />
            <CountIndicator
              value={presentCount}
              label='Presentes'
              color={attendanceStatusColor(AttendanceStatus.PRESENT)}
              icon={<CheckOutlinedIcon fontSize='small' />}
            />
            <CountIndicator
              value={excusedCount}
              label={excusedCount === 1 ? 'Permiso' : 'Permisos'}
              color={attendanceStatusColor(AttendanceStatus.EXCUSED)}
              icon={<ScheduleOutlinedIcon fontSize='small' />}
            />
            <CountIndicator
              value={absentCount}
              label='Ausentes'
              color={attendanceStatusColor(AttendanceStatus.ABSENT)}
              icon={<CloseOutlinedIcon fontSize='small' />}
            />
          </Stack>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            <Button
              size='small'
              variant='outlined'
              color='success'
              startIcon={<CheckOutlinedIcon />}
              disabled={disabled}
              onClick={onMarkAllPresent}
            >
              Marcar todos presentes
            </Button>
            <Button
              size='small'
              variant='text'
              color='error'
              startIcon={<CloseOutlinedIcon />}
              disabled={disabled}
              onClick={onMarkAllAbsent}
            >
              Marcar todos ausentes
            </Button>
          </Stack>
        </Stack>
        <TextField
          size='small'
          value={search}
          onChange={(event) => {
            onSearchChange(event.target.value);
            table.handleChangePage(null, 0);
          }}
          placeholder='Buscar estudiante por nombre, CI o RU…'
          inputProps={{ 'aria-label': 'Buscar estudiante por nombre, CI o RU' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchOutlinedIcon fontSize='small' />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant='caption' color='text.secondary'>
          Los estudiantes sin una marca explícita se consideran ausentes.
        </Typography>
      </Stack>
      {loading ? (
        <Box sx={{ height: 200, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} aria-label='Cargando planilla' />
        </Box>
      ) : totalStudents === 0 ? (
        <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
          <Typography color='text.secondary'>No hay estudiantes matriculados en esta materia.</Typography>
        </Box>
      ) : (
        <>
          <TableContainer sx={{ maxHeight: 560, borderTop: 1, borderColor: 'divider' }}>
            <Table
              stickyHeader
              size='small'
              aria-label='Planilla de asistencia'
              sx={{ minWidth: 780, '& .MuiTableCell-root': { py: 1.25 } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell align='center' sx={{ width: 64 }}>
                    N°
                  </TableCell>
                  <TableCell>Estudiante</TableCell>
                  <TableCell sx={{ width: 180 }}>CI / RU</TableCell>
                  <TableCell sx={{ width: 390 }}>Asistencia</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align='center' sx={{ py: 5 }}>
                      <Typography color='text.secondary'>No se encontraron estudiantes para esta búsqueda.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.visibleRows.map((student, index) => (
                    <AttendanceStudentRow
                      key={student.idEnrollment}
                      number={table.page * table.rowsPerPage + index + 1}
                      student={student}
                      status={attendance[student.idEnrollment] ?? AttendanceStatus.ABSENT}
                      modified={modifiedStudentIds.includes(student.idEnrollment)}
                      observation={observations[student.idEnrollment]}
                      onEditObservation={onChangeObservation ? () => setObservationStudent(student) : undefined}
                      disabled={saving || readOnly}
                      onChange={(status) => onChangeAttendance(student.idEnrollment, status)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {students.length > 0 && (
            <PaginationTable
              count={students.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.handleChangePage}
              onRowsPerPageChange={table.handleChangeRowsPerPage}
            />
          )}
        </>
      )}
      <Paper
        variant='outlined'
        role='region'
        aria-label='Guardar asistencia'
        sx={{
          position: 'sticky',
          bottom: 12,
          zIndex: 5,
          mx: { xs: 1, sm: 2 },
          mb: 2,
          px: 2,
          py: 1.25,
          borderRadius: 2,
          borderColor: hasChanges ? 'primary.main' : 'divider',
          bgcolor: 'background.paper',
          boxShadow: hasChanges ? 2 : 0,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent='space-between'
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Stack direction='row' spacing={1} alignItems='center' role='status'>
            {hasChanges ? (
              <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
            ) : (
              <CheckOutlinedIcon fontSize='small' color='disabled' />
            )}
            <Typography variant='body2' color='text.secondary'>
              {hasChanges
                ? `${modifiedStudentIds.length} ${modifiedStudentIds.length === 1 ? 'estudiante modificado' : 'estudiantes modificados'}`
                : 'Sin cambios pendientes'}
            </Typography>
          </Stack>
          <Stack direction='row' spacing={1} justifyContent='flex-end'>
            <Button
              size='small'
              variant='text'
              color='inherit'
              disabled={!hasChanges || saving || loading}
              onClick={onCancelChanges}
            >
              Cancelar cambios
            </Button>
            <Button
              size='small'
              variant='contained'
              aria-label='Guardar asistencia'
              disabled={!hasChanges || disabled || saveDisabled}
              onClick={onSave}
              startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <SaveOutlinedIcon />}
            >
              {saving ? 'Guardando…' : 'Guardar asistencia'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog
        open={!!observationStudent && attendance[observationStudent.idEnrollment] === AttendanceStatus.EXCUSED}
        onClose={() => setObservationStudent(null)}
        maxWidth='xs'
        fullWidth
        aria-labelledby='attendance-observation-title'
      >
        <DialogTitle id='attendance-observation-title'>Observación opcional</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            {observationStudent?.user.name} {observationStudent?.user.lastname}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label='Observación'
            value={observationStudent ? (observations[observationStudent.idEnrollment] ?? '') : ''}
            disabled={saving || readOnly}
            inputProps={{ maxLength: 500 }}
            helperText='Opcional. Se guardará junto con la asistencia.'
            onChange={(event) => {
              if (observationStudent && attendance[observationStudent.idEnrollment] === AttendanceStatus.EXCUSED)
                onChangeObservation?.(observationStudent.idEnrollment, event.target.value);
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setObservationStudent(null)}>Listo</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function CountIndicator({
  value,
  label,
  color = 'text.secondary',
  icon,
}: {
  value: number;
  label: string;
  color?: string;
  icon: ReactNode;
}) {
  return (
    <Stack
      direction='row'
      spacing={0.75}
      alignItems='center'
      sx={{ px: 1.25, py: 0.75, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography variant='body2' color={color}>
        <Box component='span' fontWeight={700}>
          {value}
        </Box>{' '}
        {label}
      </Typography>
    </Stack>
  );
}
