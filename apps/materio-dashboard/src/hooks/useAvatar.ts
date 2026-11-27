'use client';

import { useEffect, useState } from 'react';

import { getAvatar } from '@/api/avatars.service';
import { useAuth } from '@/hooks/useAuth';

interface AvatarEntry {
  users: number;
  controller: AbortController;
  result: Promise<string | undefined>;
  url?: string;
}

const requests = new Map<string, AvatarEntry>();

function subscribe(key: string, idUser: number, own: boolean, idSession: number) {
  const current = requests.get(key);

  if (current) {
    current.users++;

    return current;
  }

  const controller = new AbortController();

  const entry: AvatarEntry = {
    users: 1,
    controller,
    result: getAvatar(idUser, own, idSession, controller.signal)
      .then(async (blob) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const image = new Image();

        entry.url = url;
        image.src = url;
        await image.decode();

        return controller.signal.aborted ? undefined : url;
      })
      .catch(() => {
        if (entry.url) URL.revokeObjectURL(entry.url);
        entry.url = undefined;

        return undefined;
      }),
  };

  requests.set(key, entry);

  return entry;
}

export function useAvatar(idUser?: number, versionOverride?: string | null) {
  const { user } = useAuth();
  const idSession = user?.idSession;
  const own = Boolean(user && user.idUser === idUser);
  const version = versionOverride !== undefined ? versionOverride : user?.avatarVersion;

  const key =
    user && idUser && (!own || version)
      ? `${user.idUser}:${user.idSession}:${idUser}:${own ? version : 'profile'}`
      : undefined;

  const [loaded, setLoaded] = useState<{ key: string; url?: string }>();

  useEffect(() => {
    if (!key || !idUser || !idSession) return;
    const entry = subscribe(key, idUser, own, idSession);
    let active = true;

    void entry.result.then((url) => {
      if (active) setLoaded({ key, url });
    });

    return () => {
      active = false;
      if (--entry.users > 0) return;
      if (entry.url) URL.revokeObjectURL(entry.url);
      entry.url = undefined;
      entry.controller.abort();
      requests.delete(key);
    };
  }, [key, idUser, own, idSession]);

  const src = key && loaded?.key === key ? loaded.url : undefined;

  function discardImage() {
    if (!key || !src) return;
    const entry = requests.get(key);

    if (entry?.url === src) {
      URL.revokeObjectURL(src);
      entry.url = undefined;
      entry.result = Promise.resolve(undefined);
    }

    setLoaded((current) => (current?.url === src ? { key } : current));
  }

  return { src, discardImage, loading: Boolean(key && loaded?.key !== key) };
}
