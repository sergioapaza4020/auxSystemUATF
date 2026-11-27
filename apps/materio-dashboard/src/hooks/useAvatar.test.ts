import { useEffect, useState } from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAvatar } from '@/api/avatars.service';
import { useAuth } from '@/hooks/useAuth';

import { useAvatar } from './useAvatar';

vi.mock('react', () => ({ useEffect: vi.fn(), useState: vi.fn() }));
vi.mock('@/api/avatars.service', () => ({ getAvatar: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

describe('useAvatar', () => {
  const decode = vi.fn<() => Promise<void>>();
  const setLoaded = vi.fn();
  let dispose: ReturnType<Parameters<typeof useEffect>[0]>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      'Image',
      class {
        decode = decode;
      },
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: {
        idUser: 1,
        idSession: 20,
        username: 'perfil',
        name: 'Perfil',
        email: 'test@example.test',
        avatarVersion: 'version',
        roles: [],
        permissions: [],
      },
      loading: false,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(useState).mockReturnValue([undefined, setLoaded]);
    vi.mocked(useEffect).mockImplementation((effect) => {
      dispose = effect();
    });
  });

  afterEach(() => {
    if (typeof dispose === 'function') dispose();
    dispose = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('falls back when the photo is missing without creating a URL', async () => {
    vi.mocked(getAvatar).mockRejectedValue(new Error('404'));
    expect(useAvatar(1).src).toBeUndefined();
    await vi.waitFor(() => expect(setLoaded).toHaveBeenCalledWith({ key: '1:20:1:version', url: undefined }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('discards undecodable images and revokes the URL', async () => {
    vi.mocked(getAvatar).mockResolvedValue(new Blob(['invalid'], { type: 'image/webp' }));
    decode.mockRejectedValue(new Error('Invalid image'));
    useAvatar(1);
    await vi.waitFor(() => expect(setLoaded).toHaveBeenCalledWith({ key: '1:20:1:version', url: undefined }));
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:avatar');
  });

  it('publishes a decoded photo and revokes it when the last consumer leaves', async () => {
    vi.mocked(getAvatar).mockResolvedValue(new Blob(['image'], { type: 'image/webp' }));
    decode.mockResolvedValue(undefined);
    useAvatar(1);
    await vi.waitFor(() => expect(setLoaded).toHaveBeenCalledWith({ key: '1:20:1:version', url: 'blob:avatar' }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    if (typeof dispose === 'function') dispose();
    dispose = undefined;
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:avatar');
  });
});
