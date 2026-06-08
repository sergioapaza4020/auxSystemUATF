'use client'

import { useEffect, useState } from 'react'

import DeleteIcon from '@mui/icons-material/Delete'
import moment from 'moment'
import Swal, { type SweetAlertTheme } from 'sweetalert2'
import Cookies from 'js-cookie'

import {
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'

import { getAllSessions, revokeSessionById } from '@/api/sessions.service'
import type { ISession } from '@/interfaces/sessions/session.interface'

const getSessionActivity = (lastUsedAt: Date | null, isActive: boolean): string => {
  if (!lastUsedAt) {
    return 'Nunca'
  }

  const lastActivity = new Date(lastUsedAt)
  const isOnline = Date.now() - lastActivity.getTime() < 15 * 60 * 1000

  return isOnline && isActive ? 'En línea' : moment(lastUsedAt).format('DD/MM/YYYY HH:mm')
}

export const SessionsTable = () => {
  const [sessions, setSessions] = useState<ISession[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await getAllSessions()

        setSessions(sessions)
      } catch (error) {
        console.error(error)
      }

      setLoading(false)
    }

    void loadSessions()
  }, [])

  if (loading) return <h1>Cargando...</h1>

  const handleOpenDeleteButton = async (username: string, idSession: number) => {
    const cookieVal = Cookies.get('materio-mui-next-free-demo')
    let themeMode: SweetAlertTheme = 'light'

    if (cookieVal) {
      const cookieObj = JSON.parse(cookieVal)

      themeMode = cookieObj.mode
    }

    const result = await Swal.fire({
      theme: `${themeMode}`,
      title: `Eliminando la sesión de ${username}`,
      text: '¿Estás seguro?',
      icon: 'warning',
      showDenyButton: true,
      confirmButtonText: 'Si',
      denyButtonText: 'No'
    })

    if (!result.isConfirmed) return

    try {
      await revokeSessionById(idSession)

      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.idSession === idSession
            ? {
                ...session,
                isActive: false
              }
            : session
        )
      )

      await Swal.fire('Sesión eliminada con éxito', '', 'success')
    } catch (error) {
      console.error(error)

      await Swal.fire('Error al eliminar la sesión', '', 'error')
    }
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label='simple table'>
        <TableHead>
          <TableRow>
            <TableCell>id</TableCell>
            <TableCell align='center'>Usuario</TableCell>
            <TableCell align='center'>Navegador</TableCell>
            <TableCell align='center'>Sistema Operativo</TableCell>
            <TableCell align='center'>Dispositivo</TableCell>
            <TableCell align='center'>Dirección IP</TableCell>
            <TableCell align='center'>Estado</TableCell>
            <TableCell align='center'>Última vez activo</TableCell>
            <TableCell align='center'>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions?.map((session: ISession, idx: number) => (
            <TableRow key={idx} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell align='center' component='th' scope='row'>
                {idx + 1}
              </TableCell>
              <TableCell component='th' scope='row'>
                {session.user.username}
              </TableCell>
              <TableCell>{session.browser ? session.browser : 'No disponible'}</TableCell>
              <TableCell>{session.os ? session.os : 'No disponible'}</TableCell>
              <TableCell>{session.device ? session.device : 'No disponible'}</TableCell>
              <TableCell align='center'>{session.ipAddress}</TableCell>
              <TableCell align='center'>
                {session.isActive ? <Chip label='Activo' color='success' /> : <Chip label='Inactivo' color='error' />}
              </TableCell>
              <TableCell align='center'>{getSessionActivity(session.lastUsedAt, session.isActive)}</TableCell>
              <TableCell align='center'>
                <IconButton
                  onClick={() => handleOpenDeleteButton(session.user.username, session.idSession)}
                  disabled={!session.isActive}
                >
                  <DeleteIcon color={session.isActive ? 'error' : 'disabled'} />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
