import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useQrFullscreen(container: RefObject<HTMLDivElement | null>) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const ownedElement = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    alive.current = true;
    const changed = () => setFullscreen(!!container.current && document.fullscreenElement === container.current);

    document.addEventListener('fullscreenchange', changed);

    return () => {
      alive.current = false;
      document.removeEventListener('fullscreenchange', changed);
      const element = ownedElement.current;

      if (element && document.fullscreenElement === element) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, [container]);

  useEffect(() => {
    if (fullscreen && container.current) container.current.scrollTop = 0;
  }, [fullscreen, container]);

  const toggle = async () => {
    setError('');
    const element = container.current;

    ownedElement.current = element;

    try {
      if (document.fullscreenElement === element && element) await document.exitFullscreen();
      else if (element?.requestFullscreen) await element.requestFullscreen();
      else setError('Este navegador no permite pantalla completa. Puedes usar el diálogo amplio.');
    } catch {
      if (alive.current) setError('No se pudo abrir pantalla completa. El código continúa disponible en el diálogo.');
    } finally {
      if (!alive.current && element && document.fullscreenElement === element)
        void document.exitFullscreen?.().catch(() => undefined);
    }
  };

  return { fullscreen, error, toggle };
}
