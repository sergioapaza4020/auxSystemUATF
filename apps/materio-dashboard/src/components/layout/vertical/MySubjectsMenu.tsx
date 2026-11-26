'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { getMyEnrollments } from '@/api/enrollments.service';
import { UserRole } from '@/enums/userRole';
import { useAuth } from '@/hooks/useAuth';
import type { IMyEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { hasPermission } from '@/utils/hasPermission';
import { MenuItem, SubMenu } from '@menu/vertical-menu';

type EnrollmentLoadState = {
  userId: number | null;
  enrollments: IMyEnrollment[];
  loading: boolean;
  error: boolean;
};

const initialState: EnrollmentLoadState = { userId: null, enrollments: [], loading: false, error: false };

export function renderMySubjectsMenuItems(
  state: {
    enrollments: IMyEnrollment[];
    loading: boolean;
    error: boolean;
  },
  onRetry: () => void,
) {
  if (state.loading) {
    return (
      <MenuItem disabled>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={16} aria-label='Cargando materias' />
          <Typography variant='body2' color='text.secondary'>
            Cargando materias...
          </Typography>
        </Box>
      </MenuItem>
    );
  }

  if (state.error) {
    const handleRetryKeyUp = (event: KeyboardEvent<HTMLAnchorElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      onRetry();
    };

    return (
      <MenuItem
        role='button'
        aria-label='Reintentar carga de materias'
        onClick={onRetry}
        onKeyUp={handleRetryKeyUp}
        onKeyDown={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
      >
        <Typography variant='body2' color='error'>
          No se pudieron cargar. Reintentar
        </Typography>
      </MenuItem>
    );
  }

  if (state.enrollments.length === 0) {
    return (
      <MenuItem disabled>
        <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'normal' }}>
          No tienes materias asignadas.
        </Typography>
      </MenuItem>
    );
  }

  return state.enrollments.map((enrollment) => {
    const roleLabel = enrollment.role === UserRole.ASSISTANT ? 'Auxiliar' : 'Estudiante';
    const subjectLabel = `${enrollment.course.name} - ${roleLabel} - Grupo ${enrollment.course.group}`;

    return (
      <MenuItem
        key={enrollment.idEnrollment}
        href={`/dashboard/enrollments/${enrollment.idEnrollment}`}
        aria-label={subjectLabel}
        rootStyles={{
          minHeight: '52px',
          height: 'auto',
          paddingBlock: '7px',
          '& > a': { minHeight: '52px', height: 'auto', alignItems: 'flex-start', paddingBlock: '7px' },
        }}
      >
        <Tooltip title={enrollment.course.name} placement='right' enterDelay={500}>
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%', py: 0.25 }}>
            <Typography
              variant='body2'
              color='text.primary'
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
            >
              {enrollment.course.name}
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.4 }}>
              {roleLabel} - Grupo {enrollment.course.group}
            </Typography>
          </Box>
        </Tooltip>
      </MenuItem>
    );
  });
}

export default function MySubjectsMenu() {
  const theme = useTheme();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.idUser ?? null;
  const canRead = hasPermission(user, 'enrollment.get-my-enrollments');
  const [loadState, setLoadState] = useState(initialState);
  const [retry, setRetry] = useState(0);

  const retryLoad = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (authLoading || !userId || !canRead) {
      setLoadState(initialState);

      return;
    }

    const controller = new AbortController();
    let current = true;

    setLoadState({ userId, enrollments: [], loading: true, error: false });

    void getMyEnrollments(controller.signal)
      .then((enrollments) => {
        if (current) setLoadState({ userId, enrollments, loading: false, error: false });
      })
      .catch(() => {
        if (current && !controller.signal.aborted)
          setLoadState({ userId, enrollments: [], loading: false, error: true });
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [authLoading, canRead, retry, userId]);

  if (authLoading || !user || !canRead) return null;

  // Never render a previous account's list while the new user's request is starting.
  const state = loadState.userId === userId ? loadState : { ...initialState, userId, loading: true };

  return (
    <SubMenu
      label='Mis materias'
      icon={<i className='ri-stack-line' />}
      defaultOpen
      rootStyles={{
        marginTop: theme.spacing(1),
        paddingTop: theme.spacing(1),
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      {renderMySubjectsMenuItems(state, retryLoad)}
    </SubMenu>
  );
}
