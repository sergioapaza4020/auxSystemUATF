import { Box, Checkbox, CircularProgress, FormControlLabel, FormGroup, TextField, Typography } from '@mui/material';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { getDetail } from '@/hooks/grade-schemes/helpers';
import type { IGradeSchemeDetailBase } from '@/interfaces/grade-schemes/grade-scheme-detail.interface';

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

  if (loading) {
    return <CircularProgress size={20} color='secondary' />;
  }

  return (
    <FormGroup style={{ gap: 5 }}>
      <Typography variant='h6'>Elementos</Typography>
      {gradeItems.map((gradeItem: IGradeItem) => {
        const detail = getDetail(gradeItem.idGradeItem, details);

        return (
          <Box
            key={gradeItem.idGradeItem}
            sx={{
              display: 'flex',
              align: 'center',
              gap: 2,
            }}
          >
            <FormControlLabel
              sx={{ minWidth: 220 }}
              label={gradeItem.name}
              control={<Checkbox checked={!!detail} onChange={(e) => onGradeItemChange(gradeItem, e.target.checked)} />}
            />
            <TextField
              size='small'
              type='number'
              sx={{ width: 70 }}
              disabled={!detail}
              value={detail && detail.percentage > 0 ? detail.percentage : ''}
              onChange={(e) => onPercentageChange(gradeItem.idGradeItem, Number(e.target.value))}
              inputProps={{
                min: 0,
                max: 100,
              }}
            />
          </Box>
        );
      })}
      <Typography color={totalPercentage === 100 ? 'success.main' : 'error.main'}>
        Total: <b>{totalPercentage}%</b>
      </Typography>
    </FormGroup>
  );
}
