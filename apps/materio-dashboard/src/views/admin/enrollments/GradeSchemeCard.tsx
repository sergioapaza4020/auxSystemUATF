import { Box, Card, CardContent, Divider, LinearProgress, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

interface GradeSchemeCardProps {
  enrollment: IEnrollment;
}

export function GradeSchemeCard({ enrollment }: GradeSchemeCardProps) {
  const scheme = enrollment.course.gradeScheme;

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
        <CardContent sx={{ p: 3 }}>
          <Typography variant='h6' fontWeight={600}>
            Esquema general de la materia
          </Typography>

          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            Esta materia todavía no tiene un esquema de calificaciones.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const total = details.reduce((sum, detail) => sum + detail.percentage, 0);

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
        <Stack direction='row' alignItems='center' spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: 2,

              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
            }}
          >
            <i className='ri-file-list-3-line' />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant='h6' fontWeight={600}>
              Esquema general de la materia
            </Typography>

            <Typography variant='body2' color='text.secondary' noWrap>
              {scheme.name}
            </Typography>
          </Box>
        </Stack>

        {scheme.description && (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
            {scheme.description}
          </Typography>
        )}

        <Box
          sx={{
            mt: 2.5,
            overflow: 'hidden',

            border: (theme) => `1px solid ${theme.palette.divider}`,

            borderRadius: 2,
          }}
        >
          {details.map((detail, index) => (
            <Stack
              key={detail.idGradeSchemeDetail}
              direction='row'
              alignItems='center'
              spacing={2}
              sx={{
                px: 2,
                py: 1.75,

                borderBottom: index < details.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined,
              }}
            >
              <Typography
                variant='body2'
                sx={{
                  width: 130,
                  minWidth: 0,
                  fontWeight: 500,
                }}
              >
                {detail.gradeItem.name}
              </Typography>

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
                sx={{
                  width: 42,
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {detail.percentage}%
              </Typography>
            </Stack>
          ))}

          <Divider />

          <Stack
            direction='row'
            alignItems='center'
            spacing={2}
            sx={{
              px: 2,
              py: 1.75,
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant='body2'
              sx={{
                width: 130,
                fontWeight: 700,
              }}
            >
              Total
            </Typography>

            <LinearProgress
              variant='determinate'
              value={Math.min(total, 100)}
              sx={{
                flexGrow: 1,
                height: 6,
                borderRadius: 10,

                '& .MuiLinearProgress-bar': {
                  borderRadius: 10,
                },
              }}
            />

            <Typography
              variant='body2'
              sx={{
                width: 42,
                textAlign: 'right',
                fontWeight: 700,
              }}
            >
              {total}%
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
