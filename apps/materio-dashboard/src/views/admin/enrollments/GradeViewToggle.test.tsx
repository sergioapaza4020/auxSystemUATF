import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_GRADE_DISPLAY_MODE, GradeViewToggle, type GradeDisplayMode } from './GradeViewToggle';

describe('Shared grade representation control', () => {
  it('keeps weighted as the common default and ignores deselection', () => {
    const onChange = vi.fn();

    const toggle = GradeViewToggle({ value: DEFAULT_GRADE_DISPLAY_MODE, onChange }) as ReactElement<{
      value: GradeDisplayMode;
      onChange: (event: null, value: GradeDisplayMode | null) => void;
    }>;

    expect(toggle.props.value).toBe('weighted');
    toggle.props.onChange(null, null);
    expect(onChange).not.toHaveBeenCalled();
    toggle.props.onChange(null, 'raw');
    expect(onChange).toHaveBeenCalledWith('raw');
  });
});
