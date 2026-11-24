'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { DataTableContainer, DataTableSurface, PaginationTable, TableAction } from '@/components/table';

import { useCatalogPage } from '@/hooks/useCatalogPage';
import { useDataTable } from '@/hooks/table';

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

import { createCourse, deactivateCourse, getCoursesPage, reactivateCourse, updateCourse } from '@/api/courses.service';

import type { ICareer, ICareerCreate } from '@/interfaces/careers/career.interface';

import type { ICourse } from '@/interfaces/courses/course.interface';
import type { IUser } from '@/interfaces/users/user.interface';

import { RemoteUserSelect } from '@/components/users/RemoteUserSelect';

import { CatalogToolbar } from './CatalogToolbar';
import type { RecordStatus } from '@/interfaces/status-query.interface';

type Kind = 'careers' | 'courses';

type RecordItem = ICareer | ICourse;
const careerColumns = [{ id: 'name', label: 'Carrera', sortable: true }] as const;
const courseColumns = [{ id: 'code', label: 'Código', sortable: true }] as const;

export function ReferenceCatalogTable({ kind }: { kind: Kind }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();

  const prefix = kind === 'careers' ? 'career' : 'course';

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const request = useRef<AbortController | null>(null);
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
  const canRead = can('get-all');
  const courses = useCatalogPage(getCoursesPage, kind === 'courses' && !authLoading && canRead);
  const { reload: reloadCourses } = courses;

  const courseTable = useDataTable<ICourse, typeof courseColumns>(courses.rows, 'code', 5, {
    remote: { page: courses.query.page, limit: courses.query.limit, changeQuery: courses.changeQuery },
  });

  const load = useCallback(async () => {
    if (kind === 'courses') {
      await reloadCourses();

      return;
    }

    request.current?.abort();
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setLoadError('');

    try {
      const result = await getCareers('all', controller.signal);

      if (controller.signal.aborted) return;
      setRecords(result);

      if (kind === 'careers') {
        const faculties = await getCareerFaculties();

        if (!controller.signal.aborted) setFaculty(faculties);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setLoadError(getApiErrorMessage(e));
        snackbar.error(getApiErrorMessage(e));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [kind, snackbar, reloadCourses]);

  useEffect(() => {
    if (kind === 'careers' && !authLoading && canRead) void load();

    return () => request.current?.abort();
  }, [load, authLoading, canRead, kind]);

  const localFiltered = useMemo(
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

  const careerTable = useDataTable<RecordItem, typeof careerColumns>(localFiltered, 'name', 5, { preserveOrder: true });
  const filtered = kind === 'courses' ? courseTable.visibleRows : careerTable.visibleRows;
  const tableLoading = kind === 'courses' ? courses.loading : loading;

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

  if (!canRead) {
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
        search={kind === 'courses' ? courses.query.search : search}
        searchLabel={kind === 'careers' ? 'Buscar carrera' : 'Buscar código, nombre o grupo'}
        onSearch={(value) => {
          if (kind === 'courses') courses.changeQuery({ search: value });
          else {
            setSearch(value);
            careerTable.handleChangePage(null, 0);
          }
        }}
        status={kind === 'courses' ? courses.query.status : (status as RecordStatus)}
        onStatus={(value) => {
          if (kind === 'courses') courses.changeQuery({ status: value });
          else {
            setStatus(value);
            careerTable.handleChangePage(null, 0);
          }
        }}
        onReload={() => void load()}
        disabled={busy || (kind === 'careers' ? loading : courses.loading)}
      />

      {kind === 'courses' && courses.error && <Alert severity='error'>{courses.error}</Alert>}
      {kind === 'careers' && loadError && <Alert severity='error'>{loadError}</Alert>}
      {tableLoading ? (
        <Typography sx={{ p: 4 }}>Cargando…</Typography>
      ) : (
        <DataTableSurface>
          <DataTableContainer>
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
                        {kind === 'careers' && can('update') && (
                          <TableAction
                            intent='import'
                            label='Importar estudiantes'
                            onClick={() =>
                              router.push(`/dashboard/admin/careers/${(item as ICareer).idCareer}/students/import`)
                            }
                            disabled={busy || !item.isActive}
                          />
                        )}
                        <TableAction
                          intent='edit'
                          label='Editar'
                          onClick={() => open(item)}
                          disabled={!can('update') || !item.isActive || busy}
                        />

                        <TableAction
                          intent={item.isActive ? 'deactivate' : 'activate'}
                          label={item.isActive ? 'Desactivar' : 'Reactivar'}
                          onClick={() => void toggle(item)}
                          disabled={busy || !can(item.isActive ? 'delete' : 'reactivate')}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

                {!filtered.length && !(kind === 'courses' ? courses.error : loadError) && (
                  <TableRow>
                    <TableCell colSpan={4} align='center'>
                      Sin resultados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableContainer>
          {kind === 'careers' && (
            <PaginationTable
              count={localFiltered.length}
              page={careerTable.page}
              rowsPerPage={careerTable.rowsPerPage}
              onPageChange={careerTable.handleChangePage}
              onRowsPerPageChange={careerTable.handleChangeRowsPerPage}
              disabled={loading || busy}
            />
          )}
          {kind === 'courses' && (
            <PaginationTable
              count={courses.meta.total}
              page={courses.query.page - 1}
              rowsPerPage={courses.query.limit}
              onPageChange={(_, page) => courses.changeQuery({ page: page + 1 })}
              onRowsPerPageChange={(event) => courses.changeQuery({ limit: Number(event.target.value) })}
            />
          )}
        </DataTableSurface>
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
