import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export type GradeDisplayMode = 'weighted' | 'raw';
export const DEFAULT_GRADE_DISPLAY_MODE: GradeDisplayMode = 'weighted';

export function GradeViewToggle({
  value,
  onChange,
  sx,
}: {
  value: GradeDisplayMode;
  onChange: (value: GradeDisplayMode) => void;
  sx?: SxProps<Theme>;
}) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size='small'
      aria-label='Representación de calificaciones'
      onChange={(_, mode: GradeDisplayMode | null) => {
        if (mode) onChange(mode);
      }}
      sx={sx}
    >
      <ToggleButton value='weighted'>Ponderadas</ToggleButton>
      <ToggleButton value='raw'>Sobre 100%</ToggleButton>
    </ToggleButtonGroup>
  );
}
