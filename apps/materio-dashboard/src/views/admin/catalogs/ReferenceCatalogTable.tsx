'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';

import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

import {
  createCareer,
  deactivateCareer,
  getCareerFaculties,
  getCareers,
  reactivateCareer,
  updateCareer,
} from '@/api/careers.service';

import { createCourse, deactivateCourse, getCourses, reactivateCourse, updateCourse } from '@/api/courses.service';

import type { ICareer, ICareerCreate } from '@/interfaces/careers/career.interface';

import type { ICourse } from '@/interfaces/courses/course.interface';
import type { IUser } from '@/interfaces/users/user.interface';

import { RemoteUserSelect } from '@/components/users/RemoteUserSelect';

import { CatalogToolbar } from './CatalogToolbar';
import type { RecordStatus } from '@/interfaces/status-query.interface';

type Kind = 'careers' | 'courses';

type RecordItem = ICareer | ICourse;

export function ReferenceCatalogTable({ kind }: { kind: Kind }) {
  const { user, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();

  const prefix = kind === 'careers' ? 'career' : 'course';

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editor, setEditor] = useState<RecordItem | null | undefined>(undefined);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [group, setGroup] = useState('1');

  const [faculty, setFaculty] = useState<{ idFaculty: number; name: string }[]>([]);

  const [facultyId, setFacultyId] = useState('');

  const [director, setDirector] = useState<IUser[]>([]);
  const [members, setMembers] = useState<IUser[]>([]);

  const can = (action: string) => hasPermission(user, `${prefix}.${action}`);

  const load = async () => {
    setLoading(true);

    try {
      setRecords(await (kind === 'careers' ? getCareers('all') : getCourses('all')));

      if (kind === 'careers') {
        setFaculty(await getCareerFaculties());
      }
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const text =
          kind === 'careers'
            ? (item as ICareer).name
            : `${(item as ICourse).code} ${(item as ICourse).name} ${(item as ICourse).group}`;

        const matchesSearch = text.toLowerCase().includes(search.toLowerCase());

        const matchesStatus = status === 'all' || item.isActive === (status === 'active');

        return matchesSearch && matchesStatus;
      }),
    [records, search, status, kind],
  );

  const open = (item: RecordItem | null) => {
    setEditor(item);
    setName(item ? item.name : '');

    if (kind === 'courses' && item) {
      const course = item as ICourse;

      setCode(course.code);
      setGroup(String(course.group));

      return;
    }

    setCode('');
    setGroup('1');

    setFacultyId(item && (item as ICareer).faculty ? String((item as ICareer).faculty?.idFaculty) : '');

    setDirector(item && (item as ICareer).director ? [(item as ICareer).director as IUser] : []);

    setMembers([]);
  };

  const save = async () => {
    setBusy(true);

    try {
      if (kind === 'courses') {
        const data = {
          name: name.trim(),
          code: code.trim(),
          group: Number(group),
        };

        if (editor) {
          await updateCourse((editor as ICourse).idCourse, data);
        } else {
          await createCourse(data);
        }
      } else {
        const data: ICareerCreate = {
          name: name.trim(),
          idFaculty: Number(facultyId),
          idDirector: director[0]?.idUser ?? 0,
          idMembers: members.map((item) => item.idUser),
        };

        if (editor) {
          await updateCareer((editor as ICareer).idCareer, data);
        } else {
          await createCareer(data);
        }
      }

      snackbar.success(editor ? 'Registro actualizado.' : 'Registro creado.');

      setEditor(undefined);

      await load();
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: RecordItem) => {
    setBusy(true);

    try {
      if (kind === 'courses') {
        if (item.isActive) {
          await deactivateCourse((item as ICourse).idCourse);
        } else {
          await reactivateCourse((item as ICourse).idCourse);
        }
      } else {
        if (item.isActive) {
          await deactivateCareer((item as ICareer).idCareer);
        } else {
          await reactivateCareer((item as ICareer).idCareer);
        }
      }

      snackbar.success(item.isActive ? 'Registro desactivado.' : 'Registro reactivado.');

      await load();
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <Typography>Cargando…</Typography>;
  }

  if (!can('get-all')) {
    return <Alert severity='warning'>No tienes permiso para consultar este catálogo.</Alert>;
  }

  return (
    <Stack spacing={4}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='h5'>{kind === 'careers' ? 'Carreras' : 'Cursos'}</Typography>

        {can('create') && (
          <Button variant='contained' onClick={() => open(null)} disabled={busy}>
            Crear {kind === 'careers' ? 'carrera' : 'curso'}
          </Button>
        )}
      </Stack>

      <CatalogToolbar
        search={search}
        searchLabel={kind === 'careers' ? 'Buscar carrera' : 'Buscar código, nombre o grupo'}
        onSearch={setSearch}
        status={status as RecordStatus}
        onStatus={setStatus}
        onReload={() => void load()}
        disabled={loading || busy}
      />

      {loading ? (
        <Typography sx={{ p: 4 }}>Cargando…</Typography>
      ) : (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{kind === 'careers' ? 'Carrera' : 'Código'}</TableCell>

                <TableCell>{kind === 'careers' ? 'Facultad / director' : 'Nombre / grupo'}</TableCell>

                <TableCell>Estado</TableCell>

                <TableCell align='right'>Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.map((item) => (
                <TableRow key={kind === 'careers' ? (item as ICareer).idCareer : (item as ICourse).idCourse}>
                  <TableCell>{kind === 'careers' ? item.name : (item as ICourse).code}</TableCell>

                  <TableCell>
                    {kind === 'careers'
                      ? `${(item as ICareer).faculty?.name ?? '—'} · ${(item as ICareer).director?.name ?? '—'}`
                      : `${item.name} · grupo ${(item as ICourse).group}`}
                  </TableCell>

                  <TableCell>{item.isActive ? 'Activo' : 'Inactivo'}</TableCell>

                  <TableCell align='right'>
                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                      <Button
                        size='small'
                        onClick={() => open(item)}
                        disabled={!can('update') || !item.isActive || busy}
                      >
                        Editar
                      </Button>

                      <Button
                        size='small'
                        color={item.isActive ? 'error' : 'success'}
                        onClick={() => void toggle(item)}
                        disabled={busy || !can(item.isActive ? 'delete' : 'reactivate')}
                      >
                        {item.isActive ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={4} align='center'>
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog
        open={editor !== undefined}
        onClose={() => {
          if (!busy) {
            setEditor(undefined);
          }
        }}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>
          {editor ? 'Editar' : 'Crear'} {kind === 'careers' ? 'carrera' : 'curso'}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label='Nombre' value={name} onChange={(e) => setName(e.target.value)} required />

            {kind === 'courses' ? (
              <>
                <TextField label='Código' value={code} onChange={(e) => setCode(e.target.value)} required />

                <TextField select label='Grupo' value={group} onChange={(e) => setGroup(e.target.value)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            ) : (
              <>
                <TextField
                  select
                  label='Facultad'
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  required
                >
                  {faculty.map((item) => (
                    <MenuItem key={item.idFaculty} value={item.idFaculty}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>

                <RemoteUserSelect
                  label='Director'
                  role='DIRECTOR'
                  value={director}
                  onChange={setDirector}
                  multiple={false}
                />

                <RemoteUserSelect label='Miembros' value={members} onChange={setMembers} />
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setEditor(undefined)} disabled={busy}>
            Cancelar
          </Button>

          <Button
            variant='contained'
            onClick={() => void save()}
            disabled={busy || !name.trim() || (kind === 'courses' ? !code.trim() : !facultyId || !director.length)}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
