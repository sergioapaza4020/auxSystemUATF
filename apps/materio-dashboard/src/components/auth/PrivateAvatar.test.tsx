import { renderToStaticMarkup } from 'react-dom/server';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';

import { useAvatar } from '@/hooks/useAvatar';

import PrivateAvatar from './PrivateAvatar';

vi.mock('@/hooks/useAvatar', () => ({ useAvatar: vi.fn() }));

describe('PrivateAvatar', () => {
  it.each([
    ['light', 40, '#f4f3ef'],
    ['light', 96, '#f4f3ef'],
    ['dark', 40, '#252731'],
    ['dark', 96, '#252731'],
  ] as const)('uses the %s theme for a %d px avatar with a photograph or fallback', (mode, size, paper) => {
    const theme = createTheme({ palette: { mode, background: { paper }, primary: { main: '#3266ab' } } });

    const render = () =>
      renderToStaticMarkup(
        <ThemeProvider theme={theme}>
          <PrivateAvatar
            idUser={1}
            alt='Fotografía'
            variant={size === 96 ? 'rounded' : 'circular'}
            sx={{ width: size, height: size, bgcolor: 'primary.main' }}
          >
            DM
          </PrivateAvatar>
        </ThemeProvider>,
      );

    const discardImage = vi.fn();

    vi.mocked(useAvatar).mockReturnValue({ src: 'blob:avatar', loading: false, discardImage });
    const photo = render();

    expect(photo).toContain(`background-color:${paper}`);
    expect(photo.lastIndexOf(`background-color:${paper}`)).toBeGreaterThan(
      photo.lastIndexOf('background-color:#3266ab'),
    );
    expect(photo).toContain('object-fit:cover');
    expect(photo).toContain('MuiAvatar-circular');
    expect(photo).toContain('src="blob:avatar"');
    expect(photo).toContain(`width:${size}px`);
    vi.mocked(useAvatar).mockReturnValue({ src: undefined, loading: false, discardImage });
    const fallback = render();

    expect(fallback).toContain('background-color:#3266ab');
    expect(fallback).toContain(size === 96 ? 'MuiAvatar-rounded' : 'MuiAvatar-circular');
    expect(fallback).toContain('>DM<');
    expect(fallback).not.toContain('<img');
  });
});
