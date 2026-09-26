'use client';

import { useState } from 'react';

import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';

import type { SvgIconComponent } from '@mui/icons-material';

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

export function EnrollmentCreate({
  users,
  courses,
  semester,
  loadingUsers,
  loadingCourses,
  loadingSemester,
  userRoles,
  onEnroll,
}: EnrollmentCreateProps) {
  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<ICourse | null>(null);

  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);

  const [creating, setCreating] = useState(false);

  const canSubmit = selectedUsers.length > 0 && selectedCourse !== null && semester !== null && !creating;

  const semesterLabel = semester ? `${semester.period}-${semester.year}` : 'No disponible';

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

  const handleCancel = () => {
    setSelectedUsers([]);
    setSelectedCourse(null);
    setSelectedRole(UserRole.STUDENT);
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={4}>
          {/* ENCABEZADO */}
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GroupOutlinedIcon />
            </Box>

            <Box>
              <Typography variant='h5' fontWeight={700}>
                Sistema de matriculación
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                Registra uno o varios usuarios en una materia del semestre actual.
              </Typography>
            </Box>
          </Stack>

          {/* SEMESTRE */}
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarMonthOutlinedIcon fontSize='small' />
            </Box>

            <Box>
              <Typography variant='body2' color='text.secondary'>
                Semestre actual
              </Typography>

              {loadingSemester ? (
                <CircularProgress size={20} />
              ) : semester ? (
                <Typography variant='h6' fontWeight={700}>
                  {semesterLabel}
                </Typography>
              ) : (
                <Typography variant='body2' color='error'>
                  No existe un semestre activo
                </Typography>
              )}
            </Box>
          </Stack>

          <Divider />

          <Grid container spacing={3}>
            {/* USUARIOS */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                disableCloseOnSelect
                filterSelectedOptions
                options={users}
                value={selectedUsers}
                loading={loadingUsers}
                onChange={(_, value) => setSelectedUsers(value)}
                getOptionLabel={(user) => `${user.name} ${user.lastname} ${user.username} ${user.ru ?? ''}`}
                isOptionEqualToValue={(option, value) => option.idUser === value.idUser}
                ListboxProps={{
                  style: {
                    maxHeight: 360,
                  },
                }}
                renderTags={(value, getTagProps) => {
                  const visibleUsers = value.slice(0, 2);
                  const remaining = value.length - visibleUsers.length;

                  return (
                    <>
                      {visibleUsers.map((user, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={user.idUser}
                          size='small'
                          avatar={
                            <Avatar>
                              {user.name.charAt(0)}
                              {user.lastname.charAt(0)}
                            </Avatar>
                          }
                          label={`${user.name} ${user.lastname}`}
                        />
                      ))}

                      {remaining > 0 && <Chip size='small' label={`+${remaining}`} sx={{ ml: 0.5 }} />}
                    </>
                  );
                }}
                renderOption={(props, user, { selected }) => (
                  <Box
                    component='li'
                    {...props}
                    key={user.idUser}
                    sx={{
                      gap: 1.5,
                      py: '10px !important',
                    }}
                  >
                    <Checkbox checked={selected} size='small' sx={{ p: 0.5 }} />

                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        fontSize: '0.75rem',
                        bgcolor: 'primary.lighterOpacity',
                        color: 'primary.main',
                      }}
                    >
                      {user.name.charAt(0)}
                      {user.lastname.charAt(0)}
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='body2' fontWeight={500} noWrap>
                        {user.name} {user.lastname}
                      </Typography>

                      <Typography variant='caption' color='text.secondary' noWrap>
                        {user.username}
                        {user.ru ? ` · RU: ${user.ru}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label='Usuarios'
                    placeholder={selectedUsers.length === 0 ? 'Buscar usuario por nombre, usuario o RU...' : ''}
                    helperText={
                      selectedUsers.length > 0
                        ? `${selectedUsers.length} ${
                            selectedUsers.length === 1 ? 'usuario seleccionado' : 'usuarios seleccionados'
                          }`
                        : 'Busca y selecciona uno o varios usuarios.'
                    }
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          {selectedUsers.length === 0 && (
                            <InputAdornment position='start'>
                              <SearchOutlinedIcon fontSize='small' color='action' />
                            </InputAdornment>
                          )}

                          {params.InputProps.startAdornment}
                        </>
                      ),
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

            {/* MATERIA */}
            <Grid item xs={12}>
              <Autocomplete
                options={courses}
                value={selectedCourse}
                loading={loadingCourses}
                onChange={(_, value) => setSelectedCourse(value)}
                getOptionLabel={(course) => `${course.code} - ${course.name}`}
                isOptionEqualToValue={(option, value) => option.idCourse === value.idCourse}
                ListboxProps={{
                  style: {
                    maxHeight: 320,
                  },
                }}
                renderOption={(props, course) => (
                  <Box
                    component='li'
                    {...props}
                    key={course.idCourse}
                    sx={{
                      gap: 1.5,
                      py: '10px !important',
                    }}
                  >
                    <MenuBookOutlinedIcon fontSize='small' color='action' />

                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='body2' noWrap>
                        <Box component='span' sx={{ fontWeight: 600 }}>
                          {course.code}
                        </Box>

                        {' - '}

                        {course.name}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label='Materia'
                    placeholder='Buscar materia por código o nombre...'
                    helperText='Selecciona la materia en la que se matricularán los usuarios.'
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position='start'>
                          <SearchOutlinedIcon fontSize='small' color='action' />
                        </InputAdornment>
                      ),
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

            {/* ROL */}
            <Grid item xs={12}>
              <Stack direction='row' spacing={2} alignItems='flex-start'>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    display: {
                      xs: 'none',
                      sm: 'flex',
                    },
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldOutlinedIcon fontSize='small' />
                </Box>

                <FormControl>
                  <FormLabel>Rol de matriculación</FormLabel>

                  <RadioGroup
                    row
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as UserRole)}
                    sx={{
                      mt: 0.5,
                      gap: {
                        xs: 0,
                        md: 1,
                      },
                    }}
                  >
                    {userRoles.map((userRole) => (
                      <FormControlLabel
                        key={userRole}
                        value={userRole}
                        control={<Radio size='small' />}
                        label={getRoleLabel(userRole as UserRole)}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              </Stack>
            </Grid>
          </Grid>

          {/* RESUMEN */}
          <Box
            sx={{
              border: 1,
              borderColor: 'primary.main',
              bgcolor: 'primary.lighterOpacity',
              borderRadius: 2,
              p: { xs: 2.5, md: 3 },
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction='row' spacing={1.5} alignItems='center'>
                <AssignmentOutlinedIcon color='primary' />

                <Typography variant='subtitle1' fontWeight={700}>
                  Resumen de matriculación
                </Typography>
              </Stack>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} lg={3}>
                  <SummaryItem icon={CalendarMonthOutlinedIcon} label='Semestre' value={semesterLabel} />
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <SummaryItem
                    icon={GroupOutlinedIcon}
                    label='Usuarios seleccionados'
                    value={`${selectedUsers.length} ${selectedUsers.length === 1 ? 'usuario' : 'usuarios'}`}
                  />
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <SummaryItem
                    icon={MenuBookOutlinedIcon}
                    label='Materia'
                    value={selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : 'No seleccionada'}
                  />
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <SummaryItem icon={ShieldOutlinedIcon} label='Rol' value={getRoleLabel(selectedRole)} />
                </Grid>
              </Grid>
            </Stack>
          </Box>

          {/* ACCIONES */}
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent='flex-end' spacing={2}>
            <Button variant='outlined' size='large' disabled={creating} onClick={handleCancel}>
              Cancelar
            </Button>

            <Button
              variant='contained'
              size='large'
              disabled={!canSubmit}
              onClick={handleEnroll}
              startIcon={creating ? <CircularProgress size={18} color='inherit' /> : <PersonAddAltOutlinedIcon />}
            >
              {creating ? 'Matriculando...' : 'Matricular usuarios'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface SummaryItemProps {
  icon: SvgIconComponent;
  label: string;
  value: string;
}

function SummaryItem({ icon: Icon, label, value }: SummaryItemProps) {
  return (
    <Stack direction='row' spacing={1.5} alignItems='center'>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          bgcolor: 'background.paper',
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,

          '& svg': {
            fontSize: 20,
          },
        }}
      >
        <Icon />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant='caption' color='text.secondary' display='block'>
          {label}
        </Typography>

        <Typography variant='body2' fontWeight={600} noWrap title={value}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
