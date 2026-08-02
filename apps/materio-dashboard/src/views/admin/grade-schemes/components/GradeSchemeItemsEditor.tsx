import { Box, Checkbox, FormControlLabel, FormGroup, TextField, Typography } from '@mui/material';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IDetail } from '@/interfaces/grade-schemes/grade-scheme.interface';

interface GradeSchemeItemsEditorProps {
  gradeItems: IGradeItem[];
  details: IDetail[];
  totalPercentage: number;
  onChange(details: IDetail[]): void;
}

export function GradeSchemeItemsEditor(props: GradeSchemeItemsEditorProps) {
  const { gradeItems, details, totalPercentage, onChange } = props;

  const getDetail = (idGradeItem: number) => details.find((detail) => detail.gradeItem.idGradeItem === idGradeItem);

  const handlePercentageChange = (idGradeItem: number, percentage: number) => {
    percentage = Math.max(0, Math.min(100, percentage));

    onChange(
      details.map((detail) =>
        detail.gradeItem.idGradeItem === idGradeItem
          ? {
              ...detail,
              percentage,
            }
          : detail,
      ),
    );
  };

  const handleGradeItemChange = (gradeItem: IGradeItem, checked: boolean) => {
    if (checked) {
      onChange([
        ...details,
        {
          percentage: 0,
          gradeItem,
        },
      ]);

      return;
    }

    onChange(details.filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem));
  };

  return (
    <FormGroup style={{ gap: 5 }}>
      <Typography variant='h6'>Elementos</Typography>
      {gradeItems.map((gradeItem: IGradeItem) => {
        const detail = getDetail(gradeItem.idGradeItem);

        return (
          <Box
            key={gradeItem.idGradeItem}
            style={{
              width: '55%',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <FormControlLabel
              label={gradeItem.name}
              control={
                <Checkbox checked={!!detail} onChange={(e) => handleGradeItemChange(gradeItem, e.target.checked)} />
              }
            />
            <TextField
              size='small'
              type='number'
              sx={{ width: 90 }}
              disabled={!detail}
              value={detail?.percentage ?? ''}
              onChange={(e) => handlePercentageChange(gradeItem.idGradeItem, Number(e.target.value))}
              inputProps={{
                min: 0,
                max: 100,
              }}
            />
          </Box>
        );
      })}
      <Typography color={totalPercentage === 100 ? 'success.main' : 'error.main'}>Total: {totalPercentage}%</Typography>
    </FormGroup>
  );
}
