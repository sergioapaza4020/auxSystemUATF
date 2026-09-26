import type { ReactElement } from 'react';

import { Box, Chip, Tooltip, Typography, type ChipProps } from '@mui/material';

interface ChipListProps<T> {
  items: readonly T[];
  getLabel: (item: T) => string | ReactElement;
  getBadgeContent?: (item: T) => string | number;
  getChipColor?: (item: T) => ChipProps['color'];
  keyExtractor?: (item: T, idx: number) => React.Key;

  maxVisible?: number;
}

export function ChipList<T>({
  items,
  getLabel,
  getBadgeContent,
  getChipColor,
  keyExtractor,
  maxVisible = 3,
}: ChipListProps<T>) {
  const visibleItems = items.slice(0, maxVisible);
  const hiddenItems = items.slice(maxVisible);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.75,
      }}
    >
      {visibleItems.map((item, idx) => {
        const extra = getBadgeContent?.(item);

        return (
          <Chip
            key={keyExtractor?.(item, idx) ?? idx}
            size='small'
            color={getChipColor?.(item)}
            variant='outlined'
            label={
              <Box
                component='span'
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                }}
              >
                <Box component='span'>{getLabel(item)}</Box>

                {extra !== undefined && (
                  <Typography
                    component='span'
                    variant='caption'
                    color='primary.main'
                    sx={{
                      fontWeight: 700,
                    }}
                  >
                    {extra}
                  </Typography>
                )}
              </Box>
            }
            sx={{
              height: 28,

              '& .MuiChip-label': {
                px: 1.25,
              },
            }}
          />
        );
      })}

      {hiddenItems.length > 0 && (
        <Tooltip
          arrow
          title={
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              {hiddenItems.map((item, index) => (
                <Box
                  component='span'
                  key={keyExtractor?.(item, maxVisible + index) ?? index}
                  sx={{
                    display: 'block',
                    color: 'inherit',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                  }}
                >
                  {getLabel(item)}
                  {getBadgeContent && ` — ${getBadgeContent(item)}`}
                </Box>
              ))}
            </Box>
          }
        >
          <Chip
            size='small'
            label={`+${hiddenItems.length}`}
            sx={{
              height: 28,
              fontWeight: 600,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
