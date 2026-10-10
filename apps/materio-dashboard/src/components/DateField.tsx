'use client';

import { useEffect, useState } from 'react';

import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { esES } from '@mui/x-date-pickers/locales';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/es';

dayjs.extend(customParseFormat);

type DateFieldProps = Pick<
  TextFieldProps,
  'label' | 'size' | 'fullWidth' | 'required' | 'disabled' | 'error' | 'helperText' | 'sx'
> & {
  value: string;
  onChange: (value: string) => void;
};

const calendarSx: SxProps<Theme> = (theme) => ({
  bgcolor: 'background.paper',
  backgroundImage: 'none',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: theme.shadows[4],
  '& .MuiCalendarPicker-root': { mx: 0 },
  '& .MuiPickersCalendarHeader-root': { mt: 2, mb: 1, px: 2.5 },
  '& .MuiPickersCalendarHeader-label': { fontWeight: 600, color: 'text.primary', textTransform: 'capitalize' },
  '& .MuiDayPicker-weekDayLabel': { color: 'text.secondary', fontWeight: 500 },
  '& .MuiIconButton-root': {
    color: 'text.secondary',
    '&:hover': { bgcolor: 'action.hover' },
    '&.Mui-disabled': { color: 'text.disabled' },
  },
  '& .MuiDialogActions-root': {
    borderTop: '1px solid',
    borderColor: 'divider',
    px: 2,
    py: 1,
    justifyContent: 'space-between',
    '& .MuiButton-root': { color: 'primary.main', '&:hover': { bgcolor: 'action.hover' } },
  },
  '& .Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
});

const daySx: SxProps<Theme> = {
  color: 'text.primary',
  '&:hover': { bgcolor: 'action.hover' },
  '&.MuiPickersDay-dayOutsideMonth, &.Mui-disabled': { color: 'text.disabled' },
  '&.MuiPickersDay-today:not(.Mui-selected)': { borderColor: 'primary.main' },
  '&.Mui-selected': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '&:hover, &:focus': { bgcolor: 'primary.dark' },
  },
  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
};

export function DateField({ value, onChange, ...fieldProps }: DateFieldProps) {
  const [draft, setDraft] = useState<Dayjs | null>(() => (value ? dayjs(value, 'YYYY-MM-DD', true) : null));

  useEffect(() => {
    setDraft(value ? dayjs(value, 'YYYY-MM-DD', true) : null);
  }, [value]);

  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale='es'
      localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <DatePicker
        label={fieldProps.label}
        disabled={fieldProps.disabled}
        value={draft}
        onChange={(next: Dayjs | null) => {
          setDraft(next);

          // Keep partial keyboard input local; never send invalid dates to the form.
          if (next === null) onChange('');
          else if (next.isValid()) onChange(next.format('YYYY-MM-DD'));
        }}
        inputFormat='DD/MM/YYYY'
        minDate={dayjs('2001-01-01').year(1)}
        maxDate={dayjs('9999-12-31', 'YYYY-MM-DD', true)}
        showDaysOutsideCurrentMonth
        showToolbar={false}
        reduceAnimations
        dayOfWeekFormatter={(day) => day.charAt(0).toUpperCase() + day.slice(1, 2)}
        componentsProps={{ actionBar: { actions: ['clear', 'today'] } }}
        OpenPickerButtonProps={{ sx: { color: 'text.secondary', '&.Mui-disabled': { color: 'text.disabled' } } }}
        PaperProps={{ sx: calendarSx }}
        DialogProps={{ PaperProps: { sx: calendarSx } }}
        renderDay={(day, _selected, props) => <PickersDay {...props} key={day.format('YYYY-MM-DD')} sx={daySx} />}
        renderInput={(params) => (
          <TextField
            {...params}
            {...fieldProps}
            error={fieldProps.error || params.error}
            InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          />
        )}
      />
    </LocalizationProvider>
  );
}
