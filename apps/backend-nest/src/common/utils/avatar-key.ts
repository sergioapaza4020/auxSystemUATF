import { createHash } from 'node:crypto';

export function avatarVersion(idUser: number, key: string | null | undefined): string | null {
  const match = key?.match(
    /^avatars\/([1-9]\d*)\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.webp$/,
  );
  if (!key || match?.[0] !== key || match[1] !== String(idUser)) return null;
  return createHash('sha256').update(key).digest('hex');
}
