import type * as React from 'react';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { hookHarness } from '@/test-utils/hook-harness';
import { useQrFullscreen } from './useQrFullscreen';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.unstubAllGlobals();
});
beforeEach(() => vi.clearAllMocks());
it('tracks fullscreen, Escape, rejection and exits on unmount', async () => {
  const doc = Object.assign(new EventTarget(), {
    fullscreenElement: null as unknown,
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null;
      doc.dispatchEvent(new Event('fullscreenchange'));
    }),
  });

  const element = {
    scrollTop: 200,
    requestFullscreen: vi.fn(async () => {
      doc.fullscreenElement = element;
      doc.dispatchEvent(new Event('fullscreenchange'));
    }),
  };

  vi.stubGlobal('document', doc);
  const ref = { current: null as HTMLDivElement | null };
  const h = hookHarness(() => useQrFullscreen(ref));

  cleanups.push(h.unmount);
  h.render();
  ref.current = element as unknown as HTMLDivElement;
  await h.render().toggle();
  expect(h.render().fullscreen).toBe(true);
  expect(element.scrollTop).toBe(0);
  doc.fullscreenElement = null;
  doc.dispatchEvent(new Event('fullscreenchange'));
  expect(h.render().fullscreen).toBe(false);
  element.requestFullscreen.mockRejectedValueOnce(new Error('denied'));
  await h.render().toggle();
  expect(h.render().error).toContain('No se pudo');
  await h.render().toggle();
  ref.current = null;
  h.unmount();
  expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
});
