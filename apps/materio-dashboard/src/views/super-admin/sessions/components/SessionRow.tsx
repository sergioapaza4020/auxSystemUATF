import { TableCell, TableRow } from '@mui/material';

import { StatusChip } from '@/components/table/components/StatusChip';
import { TableActions } from '@/components/table/components/TableActions';
import { useAuth } from '@/hooks/useAuth';
import type { ISession } from '@/interfaces/sessions/session.interface';

import { getSessionActivity } from '../utils/getSessionActivity';

interface SessionRowProps {
  session: ISession;
  onDelete: (idSession: number) => void;
}

export function SessionRow(props: SessionRowProps) {
  const { session, onDelete } = props;

  const { user } = useAuth();

  const isDeleteDisabled = !session.isActive || session.idSession === user?.idSession;

  return (
    <TableRow
      key={session.idSession}
      hover={session.isActive && user?.idSession !== session.idSession}
      sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
    >
      <TableCell align='center' component='th' scope='row' padding='none'>
        {session.idSession}
      </TableCell>
      <TableCell component='th' scope='row'>
        {session.idSession !== user?.idSession ? session.user.username : 'Sesión actual'}
      </TableCell>
      <TableCell>{session.browser ? session.browser : 'No disponible'}</TableCell>
      <TableCell>{session.os ? session.os : 'No disponible'}</TableCell>
      <TableCell>{session.device ? session.device : 'No disponible'}</TableCell>
      <TableCell align='center'>{session.ipAddress}</TableCell>
      <TableCell align='center'>
        <StatusChip active={session.isActive} />
      </TableCell>
      <TableCell align='center'>{getSessionActivity(session.lastUsedAt, session.isActive)}</TableCell>
      <TableCell align='center'>
        <TableActions active={!isDeleteDisabled} onDelete={() => onDelete(session.idSession)} />
      </TableCell>
    </TableRow>
  );
}
