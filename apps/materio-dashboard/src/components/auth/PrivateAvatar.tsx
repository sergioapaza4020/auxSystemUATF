'use client';

import Avatar from '@mui/material/Avatar';
import type { AvatarProps } from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';

import { useAvatar } from '@/hooks/useAvatar';

type Props = Omit<AvatarProps, 'src' | 'srcSet'> & { idUser?: number; avatarVersion?: string | null };

export default function PrivateAvatar({ idUser, avatarVersion, children, imgProps, sx, variant, ...props }: Props) {
  const { src, loading, discardImage } = useAvatar(idUser, avatarVersion);

  return (
    <Avatar
      {...props}
      src={src}
      variant={src ? 'circular' : variant}
      aria-busy={loading || undefined}
      imgProps={{
        ...imgProps,
        onError: (event) => {
          discardImage();
          imgProps?.onError?.(event);
        },
      }}
      sx={[
        { bgcolor: 'primary.main', color: 'primary.contrastText' },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ...(src ? [{ bgcolor: 'background.paper', '& .MuiAvatar-img': { objectFit: 'cover' } }] : []),
      ]}
    >
      {loading ? <CircularProgress size={15} color='inherit' aria-label='Cargando fotografía' /> : children}
    </Avatar>
  );
}
