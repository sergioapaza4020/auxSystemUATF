'use client';

import { useState } from 'react';

import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';

import type { ICourse } from '@/interfaces/courses/course.interface';
import type { IUser } from '@/interfaces/users/user.interface';
import type { ISemester } from '@/interfaces/semesters/semester.interface';

import { UserRole } from '@/enums/userRole';
import { getRoleLabel } from '@/utils/roles/getRoleLabel';

interface EnrollmentCreateProps {
  users: IUser[];
  courses: ICourse[];

  semester: ISemester | null;

  loadingUsers: boolean;
  loadingCourses: boolean;
  loadingSemester: boolean;

  userRoles: string[];

  onEnroll: (usernames: string[], courseCode: string, role: UserRole) => Promise<void>;
}

export function EnrollmentCreate(props: EnrollmentCreateProps) {
  const { users, courses, semester, loadingUsers, loadingCourses, loadingSemester, userRoles, onEnroll } = props;

  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<ICourse | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);

  const [creating, setCreating] = useState(false);

  const canSubmit = selectedUsers.length > 0 && selectedCourse !== null && semester !== null && !creating;

  const handleEnroll = async () => {
    if (!canSubmit || !selectedCourse || !semester) {
      return;
    }

    setCreating(true);

    try {
      await onEnroll(
        selectedUsers.map((user) => user.username),
        selectedCourse.code,
        selectedRole,
      );

      setSelectedUsers([]);
      setSelectedCourse(null);
      setSelectedRole(UserRole.STUDENT);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title='Sistema de matriculación'
        subheader='Registra uno o varios usuarios en una materia del semestre actual'
      />

      <CardContent>
        <Grid container spacing={5}>
          <Grid item xs={12}>
            <Typography variant='body2' color='text.secondary'>
              Semestre actual
            </Typography>

            {loadingSemester ? (
              <CircularProgress size={20} />
            ) : semester ? (
              <Typography variant='h5'>
                {semester.period}-{semester.year}
              </Typography>
            ) : (
              <Typography color='error'>No existe un semestre activo para la fecha actual</Typography>
            )}
          </Grid>

          <Grid item xs={12}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={users}
              value={selectedUsers}
              loading={loadingUsers}
              onChange={(_, value) => setSelectedUsers(value)}
              getOptionLabel={(user) => `${user.name} ${user.lastname} (${user.username})`}
              isOptionEqualToValue={(option, value) => option.idUser === value.idUser}
              renderOption={(props, user, { selected }) => (
                <li {...props} key={user.idUser}>
                  <Checkbox checked={selected} sx={{ mr: 1 }} />

                  <div>
                    <Typography>
                      {user.name} {user.lastname}
                    </Typography>

                    <Typography variant='caption' color='text.secondary'>
                      {user.username} · RU: {user.ru}
                    </Typography>
                  </div>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label='Usuarios'
                  placeholder='Buscar usuario...'
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUsers && <CircularProgress size={20} />}

                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Autocomplete
              options={courses}
              value={selectedCourse}
              loading={loadingCourses}
              onChange={(_, value) => setSelectedCourse(value)}
              getOptionLabel={(course) => `${course.code} - ${course.name}`}
              isOptionEqualToValue={(option, value) => option.idCourse === value.idCourse}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label='Materia'
                  placeholder='Seleccionar materia...'
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingCourses && <CircularProgress size={20} />}

                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl>
              <FormLabel>Rol de matriculación</FormLabel>

              <RadioGroup
                row
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as UserRole)}
              >
                {userRoles.map((userRole) => (
                  <FormControlLabel
                    key={userRole}
                    value={userRole}
                    control={<Radio />}
                    label={getRoleLabel(userRole as UserRole)}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* RESUMEN */}
          <Grid item xs={12}>
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='subtitle1'>Resumen de matriculación</Typography>

                <Typography variant='body2'>
                  Semestre: <strong>{semester ? `${semester.period}-${semester.year}` : 'No disponible'}</strong>
                </Typography>

                <Typography variant='body2'>
                  Usuarios seleccionados: <strong>{selectedUsers.length}</strong>
                </Typography>

                <Typography variant='body2'>
                  Materia:{' '}
                  <strong>
                    {selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : 'No seleccionada'}
                  </strong>
                </Typography>

                <Typography variant='body2'>
                  Rol: <strong>{getRoleLabel(selectedRole)}</strong>
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Button variant='contained' size='large' disabled={!canSubmit} onClick={handleEnroll}>
              {creating ? 'Matriculando...' : 'Matricular usuarios'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
