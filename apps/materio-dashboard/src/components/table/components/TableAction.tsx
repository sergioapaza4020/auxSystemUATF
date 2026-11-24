import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import type { IconButtonProps } from '@mui/material';

const actions = {
  view: ['info', 'ri-eye-line'],
  edit: ['warning', 'ri-pencil-line'],
  delete: ['error', 'ri-delete-bin-line'],
  deactivate: ['error', 'ri-delete-bin-line'],
  activate: ['success', 'ri-checkbox-circle-line'],
  restore: ['success', 'ri-restart-line'],
  history: ['info', 'ri-history-line'],
  download: ['primary', 'ri-download-line'],
  export: ['primary', 'ri-file-download-line'],
  configure: ['secondary', 'ri-settings-3-line'],
  assign: ['primary', 'ri-user-settings-line'],
  import: ['primary', 'ri-upload-line'],
  close: ['warning', 'ri-logout-box-r-line'],
  other: ['secondary', 'ri-more-2-fill'],
} as const;

export interface TableActionProps extends Omit<IconButtonProps, 'children' | 'color' | 'size'> {
  intent: keyof typeof actions;
  label: string;
  loading?: boolean;
  disabledReason?: string;
}

export function TableAction({
  intent,
  label,
  loading = false,
  disabled,
  disabledReason,
  sx,
  ...props
}: TableActionProps) {
  const [color, icon] = actions[intent];

  return (
    <Tooltip title={disabled && disabledReason ? `${label}: ${disabledReason}` : label}>
      <span style={{ display: 'inline-flex' }}>
        <IconButton
          {...props}
          size='small'
          color={color}
          aria-label={props['aria-label'] ?? label}
          aria-busy={loading || undefined}
          disabled={disabled || loading}
          sx={[
            {
              minWidth: 36,
              minHeight: 36,
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {loading ? <CircularProgress size={18} color='inherit' /> : <i className={icon} aria-hidden='true' />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
