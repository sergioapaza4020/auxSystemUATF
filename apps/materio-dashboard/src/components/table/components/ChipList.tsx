import type { ReactElement } from 'react';

import { Badge, Box, Chip, type ChipProps } from '@mui/material';

interface ChipListProps<T> {
  items: readonly T[];
  getLabel: (item: T) => string | ReactElement;
  getBadgeContent?: (item: T) => string | number;
  getChipColor?: (item: T) => ChipProps['color'];
  keyExtractor?: (item: T, idx: number) => React.Key;
}

export function ChipList<T>(props: ChipListProps<T>) {
  const { items, getLabel, getBadgeContent, getChipColor, keyExtractor } = props;

  return (
    <Box maxWidth={0.9} display='flex' flexWrap='wrap' columnGap={6.5} rowGap={4}>
      {items.map((item, idx) => {
        const chip = <Chip label={getLabel(item)} size='small' color={getChipColor?.(item)} />;

        if (!getBadgeContent) {
          return <Box key={keyExtractor?.(item, idx) ?? idx}>{chip}</Box>;
        }

        return (
          <Badge key={keyExtractor?.(item, idx) ?? idx} color='primary' badgeContent={getBadgeContent(item)}>
            {chip}
          </Badge>
        );
      })}
    </Box>
  );
}
