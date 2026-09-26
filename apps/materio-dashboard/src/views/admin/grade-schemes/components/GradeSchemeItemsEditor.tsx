import {
  Box,
  Checkbox,
  CircularProgress,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IGradeSchemeDetailBase } from '@/interfaces/grade-schemes/grade-scheme-detail.interface';

import { getDetail } from '@/hooks/grade-schemes/helpers';

interface GradeSchemeItemsEditorProps<T extends IGradeSchemeDetailBase> {
  gradeItems: IGradeItem[];
  details: T[];

  loading: boolean;

  totalPercentage: number;

  onGradeItemChange(gradeItem: IGradeItem, checked: boolean): void;

  onPercentageChange(idGradeItem: number, percentage: number): void;
}

export function GradeSchemeItemsEditor<T extends IGradeSchemeDetailBase>(props: GradeSchemeItemsEditorProps<T>) {
  const { gradeItems, details, loading, totalPercentage, onGradeItemChange, onPercentageChange } = props;

  const totalIsValid = totalPercentage === 100;

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 180,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Cabecera */}
      <Stack
        direction={{
          xs: 'column',
          sm: 'row',
        }}
        alignItems={{
          xs: 'flex-start',
          sm: 'center',
        }}
        justifyContent='space-between'
        spacing={1.5}
        sx={{
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant='h6'
            color='text.primary'
            sx={{
              fontWeight: 600,
            }}
          >
            Elementos del esquema
          </Typography>

          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            Selecciona los elementos que formarán parte del esquema y asigna su porcentaje.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,

            px: 1.5,
            py: 1,

            borderRadius: 2,

            bgcolor: 'primary.lighterOpacity',
            color: 'primary.main',
          }}
        >
          <i className='ri-information-line' />

          <Typography
            variant='caption'
            color='inherit'
            sx={{
              fontWeight: 500,
            }}
          >
            La suma de los porcentajes debe ser 100%.
          </Typography>
        </Box>
      </Stack>

      {/* Lista */}
      <Box
        sx={{
          overflow: 'hidden',

          border: (theme) => `1px solid ${theme.palette.divider}`,

          borderRadius: 2.5,
        }}
      >
        {gradeItems.map((gradeItem: IGradeItem, index) => {
          const detail = getDetail(gradeItem.idGradeItem, details);

          const percentage = detail?.percentage ?? 0;

          return (
            <Box
              key={gradeItem.idGradeItem}
              sx={{
                display: 'grid',

                gridTemplateColumns: {
                  xs: 'auto 1fr',
                  sm: 'auto minmax(180px, 1fr) 120px minmax(120px, 1fr)',
                },

                alignItems: 'center',

                columnGap: 2,
                rowGap: 1,

                px: 2,
                py: 1.25,

                bgcolor: detail ? 'transparent' : 'action.hover',

                borderBottom: index < gradeItems.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : 'none',

                transition: (theme) =>
                  theme.transitions.create(['background-color', 'opacity'], {
                    duration: theme.transitions.duration.shorter,
                  }),
              }}
            >
              {/* Checkbox */}
              <Checkbox
                checked={!!detail}
                onChange={(event) => onGradeItemChange(gradeItem, event.target.checked)}
                inputProps={{
                  'aria-label': `Seleccionar ${gradeItem.name}`,
                }}
                sx={{
                  p: 0.5,
                }}
              />

              {/* Nombre */}
              <Stack
                direction='row'
                alignItems='center'
                spacing={1.5}
                sx={{
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,

                    flexShrink: 0,

                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 2,

                    bgcolor: 'primary.lighterOpacity',

                    color: detail ? 'primary.main' : 'text.disabled',
                  }}
                >
                  <i className='ri-file-list-3-line' />
                </Box>

                <Typography
                  variant='body2'
                  color={detail ? 'text.primary' : 'text.secondary'}
                  sx={{
                    fontWeight: detail ? 600 : 400,

                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {gradeItem.name}
                </Typography>
              </Stack>

              {/* Porcentaje */}
              <TextField
                size='small'
                type='number'
                disabled={!detail}
                value={detail && detail.percentage > 0 ? detail.percentage : ''}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  onPercentageChange(gradeItem.idGradeItem, value);
                }}
                inputProps={{
                  min: 0,
                  max: 100,
                  'aria-label': `Porcentaje de ${gradeItem.name}`,
                }}
                InputProps={{
                  endAdornment: <InputAdornment position='end'>%</InputAdornment>,
                }}
                sx={{
                  width: '100%',

                  gridColumn: {
                    xs: '2',
                    sm: 'auto',
                  },
                }}
              />

              {/* Distribución */}
              <Stack
                direction='row'
                alignItems='center'
                spacing={1.5}
                sx={{
                  minWidth: 0,

                  gridColumn: {
                    xs: '2',
                    sm: 'auto',
                  },
                }}
              >
                <LinearProgress
                  variant='determinate'
                  value={Math.min(Math.max(percentage, 0), 100)}
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
                  variant='caption'
                  color={detail ? 'text.secondary' : 'text.disabled'}
                  sx={{
                    minWidth: 34,
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  {percentage}%
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Box>

      {/* Total */}
      <Box
        sx={{
          mt: 2,

          display: 'flex',
          flexDirection: {
            xs: 'column',
            sm: 'row',
          },

          alignItems: {
            xs: 'stretch',
            sm: 'center',
          },

          gap: 2,

          px: 2,
          py: 1.5,

          borderRadius: 2.5,

          bgcolor: totalIsValid ? 'success.lighterOpacity' : 'warning.lighterOpacity',

          color: totalIsValid ? 'success.main' : 'warning.main',
        }}
      >
        <Stack
          direction='row'
          alignItems='center'
          spacing={1}
          sx={{
            minWidth: 210,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: '50%',

              bgcolor: 'currentColor',
            }}
          >
            <Box
              component='i'
              className={totalIsValid ? 'ri-check-line' : 'ri-error-warning-line'}
              sx={{
                color: 'background.paper',
                fontSize: '1rem',
              }}
            />
          </Box>

          <Typography variant='body2' color='text.primary'>
            Total de porcentajes:{' '}
            <Box
              component='span'
              sx={{
                color: 'inherit',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              {totalPercentage}%
            </Box>
          </Typography>
        </Stack>

        <LinearProgress
          variant='determinate'
          value={Math.min(Math.max(totalPercentage, 0), 100)}
          color={totalIsValid ? 'success' : 'warning'}
          sx={{
            flexGrow: 1,

            height: 7,

            borderRadius: 10,

            bgcolor: 'action.selected',

            '& .MuiLinearProgress-bar': {
              borderRadius: 10,
            },
          }}
        />
      </Box>
    </Box>
  );
}
