import { describe, expect, it, vi } from 'vitest';

import { getAvatar, removeAvatar, replaceAvatar } from './avatars.service';
import { instance } from './config/config';

vi.mock('./config/config', () => ({ instance: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

describe('Fotografías privadas', () => {
  const signal = new AbortController().signal;

  it('loads a private WebP using the authenticated Axios client and the expected session', async () => {
    const image = new Blob(['webp'], { type: 'image/webp' });

    vi.mocked(instance.get).mockResolvedValue({ data: image });
    await expect(getAvatar(1, true, 20, signal)).resolves.toBe(image);
    await expect(getAvatar(7, false, 20, signal)).resolves.toBe(image);
    const config = { params: { expectedSession: 20 }, responseType: 'blob', signal, timeout: 20000 };

    expect(instance.get).toHaveBeenCalledWith('/users/me/avatar', config);
    expect(instance.get).toHaveBeenCalledWith('/users/id/7/avatar', config);
  });

  it('rejects a response with an unexpected type', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: new Blob(['html'], { type: 'text/html' }) });
    await expect(getAvatar(1, true, 20, signal)).rejects.toThrow('Formato de fotografía no esperado.');
  });

  it('uploads only the file and removes only the current user avatar', async () => {
    const data = { avatarVersion: 'new-version' };
    const config = { params: { expectedSession: 20 }, signal };
    const image = new File(['image'], 'fixture.jpeg', { type: 'image/jpeg' });

    vi.mocked(instance.put).mockResolvedValue({ data: { data } });
    vi.mocked(instance.delete).mockResolvedValue({ data: { data: { avatarVersion: null } } });
    await expect(replaceAvatar(20, image, signal)).resolves.toEqual(data);
    expect(instance.put).toHaveBeenCalledWith('/users/me/avatar', expect.any(FormData), { ...config, timeout: 30000 });
    const form = vi.mocked(instance.put).mock.calls[0][1] as FormData;

    expect([...form.keys()]).toEqual(['file']);
    expect(form.get('file')).toBe(image);
    await expect(removeAvatar(20, signal)).resolves.toEqual({ avatarVersion: null });
    expect(instance.delete).toHaveBeenCalledWith('/users/me/avatar', { ...config, timeout: 20000 });
  });
});
