'use client';

import { Box, Button, Card, CardContent, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';

import type { IAssistantGradeScheme } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

interface AssistantGradeSchemeCardProps {
  scheme: IAssistantGradeScheme | null;
  loading: boolean;

  onConfigure: () => void;

  onManageActivities: (idGradeSchemeDetail: number, gradeItemName: string) => void;

  onManageAttendance: () => void;
}

export function AssistantGradeSchemeCard({
  scheme,
  loading,
  onConfigure,
  onManageActivities,
  onManageAttendance,
}: AssistantGradeSchemeCardProps) {
  if (loading) {
    return (
      <Card
        variant='outlined'
        sx={{
          height: '100%',
          borderRadius: 3,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Skeleton width='45%' height={32} />

          <Skeleton width='70%' height={22} />

          <Skeleton variant='rounded' height={180} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  if (!scheme) {
    return (
      <Card
        variant='outlined'
        sx={{
          height: '100%',
          borderRadius: 3,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <CardContent
          sx={{
            p: 3,
            height: '100%',
          }}
        >
          <Stack
            alignItems='center'
            justifyContent='center'
            textAlign='center'
            spacing={2}
            sx={{
              minHeight: 240,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                borderRadius: 2.5,

                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
              }}
            >
              <Box
                component='i'
                className='ri-settings-3-line'
                sx={{
                  fontSize: '1.5rem',
                }}
              />
            </Box>

            <Box>
              <Typography variant='h6' fontWeight={600}>
                Mi evaluación como auxiliar
              </Typography>

              <Typography
                variant='body2'
                color='text.secondary'
                sx={{
                  mt: 0.5,
                  maxWidth: 480,
                }}
              >
                Todavía no has configurado la distribución de tus calificaciones para esta materia.
              </Typography>
            </Box>

            <Button variant='contained' onClick={onConfigure} startIcon={<i className='ri-settings-3-line' />}>
              Configurar evaluación
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const isAttendance = (name: string) => name.trim().toLocaleLowerCase().includes('asistencia');

  return (
    <Card
      variant='outlined'
      sx={{
        height: '100%',
        borderRadius: 3,
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent
        sx={{
          p: 3,

          '&:last-child': {
            pb: 3,
          },
        }}
      >
        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          alignItems={{
            xs: 'stretch',
            sm: 'center',
          }}
          justifyContent='space-between'
          spacing={2}
        >
          <Stack direction='row' alignItems='center' spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                flexShrink: 0,

                borderRadius: 2,

                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
              }}
            >
              <i className='ri-settings-3-line' />
            </Box>

            <Box>
              <Typography variant='h6' fontWeight={600}>
                Mi evaluación como auxiliar
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                Configuración de evaluación del auxiliar
              </Typography>
            </Box>
          </Stack>

          <Button variant='outlined' size='small' onClick={onConfigure} startIcon={<i className='ri-edit-line' />}>
            Editar configuración
          </Button>
        </Stack>

        <Box
          sx={{
            mt: 2.5,
            px: 2,
            py: 1.25,

            display: 'flex',
            alignItems: 'center',
            gap: 1,

            borderRadius: 2,

            bgcolor: 'primary.lighterOpacity',
            color: 'primary.main',
          }}
        >
          <i className='ri-information-line' />

          <Typography variant='body2' color='inherit'>
            Tu evaluación como auxiliar representa el{' '}
            <Box component='strong' sx={{ fontWeight: 700 }}>
              {scheme.assistantPercentage}%
            </Box>{' '}
            de la nota total de la materia.
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 2.5,

            border: (theme) => `1px solid ${theme.palette.divider}`,

            borderRadius: 2,

            overflow: 'hidden',
          }}
        >
          {details.map((detail, index) => {
            const attendance = isAttendance(detail.gradeItem.name);

            return (
              <Box
                key={detail.idGradeSchemeDetail}
                sx={{
                  px: 2,
                  py: 1.75,

                  borderBottom:
                    index < details.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined,
                }}
              >
                <Stack
                  direction={{
                    xs: 'column',
                    sm: 'row',
                  }}
                  alignItems={{
                    xs: 'stretch',
                    sm: 'center',
                  }}
                  spacing={2}
                >
                  <Stack
                    direction='row'
                    alignItems='center'
                    spacing={1.5}
                    sx={{
                      width: {
                        sm: 170,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,

                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',

                        flexShrink: 0,

                        borderRadius: 2,

                        bgcolor: attendance ? 'secondary.lighterOpacity' : 'success.lighterOpacity',

                        color: attendance ? 'secondary.main' : 'success.main',
                      }}
                    >
                      <Box component='i' className={attendance ? 'ri-user-follow-line' : 'ri-file-list-3-line'} />
                    </Box>

                    <Typography variant='body2' fontWeight={600}>
                      {detail.gradeItem.name}
                    </Typography>
                  </Stack>

                  <Stack
                    direction='row'
                    alignItems='center'
                    spacing={1.5}
                    sx={{
                      flex: 1,
                      minWidth: 140,
                    }}
                  >
                    <LinearProgress
                      variant='determinate'
                      value={detail.percentage}
                      sx={{
                        flexGrow: 1,
                        height: 6,
                        borderRadius: 10,

                        bgcolor: 'action.selected',

                        '& .MuiLinearProgress-bar': {
                          borderRadius: 10,
                        },
                      }}
                    />

                    <Typography
                      variant='body2'
                      fontWeight={700}
                      sx={{
                        minWidth: 42,
                        textAlign: 'right',
                      }}
                    >
                      {detail.percentage}%
                    </Typography>
                  </Stack>

                  <Box
                    sx={{
                      width: {
                        sm: 190,
                      },
                    }}
                  >
                    {attendance ? (
                      <>
                        <Typography variant='body2' fontWeight={600}>
                          Asistencia
                        </Typography>

                        <Typography variant='caption' color='text.secondary'>
                          Registro por sesiones
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant='body2' fontWeight={600}>
                          {detail.activities.length === 0
                            ? 'Sin actividades'
                            : `${detail.activities.length} ${
                                detail.activities.length === 1 ? 'actividad' : 'actividades'
                              }`}
                        </Typography>

                        <Typography variant='caption' color='text.secondary'>
                          Actividades calificables
                        </Typography>
                      </>
                    )}
                  </Box>

                  <Button
                    size='small'
                    variant='outlined'
                    startIcon={<i className={attendance ? 'ri-calendar-check-line' : 'ri-folder-line'} />}
                    onClick={() => {
                      if (attendance) {
                        onManageAttendance();

                        return;
                      }

                      onManageActivities(detail.idGradeSchemeDetail, detail.gradeItem.name);
                    }}
                    sx={{
                      minWidth: 170,
                    }}
                  >
                    {attendance ? 'Ver asistencia' : 'Gestionar actividades'}
                  </Button>
                </Stack>
              </Box>
            );
          })}

          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant='body2' fontWeight={700}>
              Total
            </Typography>

            <Typography variant='body2' fontWeight={700}>
              100%
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
