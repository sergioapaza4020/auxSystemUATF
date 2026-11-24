import * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AttendanceGeolocationMap from './AttendanceGeolocationMap';

const mocks = vi.hoisted(() => {
  const map = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };

  const layers = { addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() };
  const circle = { addTo: vi.fn().mockReturnThis(), getBounds: vi.fn(() => 'bounds') };

  return {
    map,
    layers,
    circle,
    create: vi.fn(() => map),
    tile: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      getLatLng: () => ({ lat: -18, wrap: () => ({ lng: -64 }) }),
    })),
    radius: vi.fn(() => circle),
    disconnect: vi.fn(),
  };
});

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useRef: vi.fn(),
  useEffect: vi.fn(),
}));
vi.mock('@mui/material/styles', () => ({ useTheme: () => ({ palette: { primary: { main: '#123456' } } }) }));
vi.mock('leaflet', () => ({
  default: {
    map: mocks.create,
    tileLayer: mocks.tile,
    layerGroup: () => mocks.layers,
    marker: mocks.marker,
    divIcon: vi.fn(),
    circle: mocks.radius,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = mocks.disconnect;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(disabled: boolean, latitude: number | null = -19, longitude: number | null = -65) {
  const effects: React.EffectCallback[] = [];
  const onLocationChange = vi.fn();
  const refs: { current: unknown }[] = [];

  vi.mocked(React.useRef).mockImplementation(((value: unknown) => {
    const ref = { current: value };

    refs.push(ref);

    return ref;
  }) as typeof React.useRef);
  vi.mocked(React.useEffect).mockImplementation((effect) => {
    effects.push(effect);
  });
  AttendanceGeolocationMap({ latitude, longitude, radiusMeters: 123, disabled, onLocationChange });
  refs[0].current = {} as HTMLElement;
  const cleanups = effects.map((effect) => effect());

  return {
    onLocationChange,
    unmount: () =>
      cleanups.forEach((cleanup) => {
        if (cleanup) cleanup();
      }),
  };
}

describe('Leaflet adapter contract', () => {
  it('renders center/radius, preserves attribution, forwards a click, and cleans resources', () => {
    const h = mount(false);

    expect(mocks.radius).toHaveBeenCalledWith([-19, -65], expect.objectContaining({ radius: 123 }));
    expect(mocks.tile).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ attribution: expect.stringContaining('OpenStreetMap') }),
    );
    const click = mocks.map.on.mock.calls.find(([event]) => event === 'click')?.[1] as (event: unknown) => void;

    click({ latlng: { lat: -18, wrap: () => ({ lng: -64 }) } });
    expect(h.onLocationChange).toHaveBeenCalledWith(-18, -64);
    h.unmount();
    expect(mocks.map.remove).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
  it('disabled prevents selection while retaining read-only navigation', () => {
    const h = mount(true);
    const click = mocks.map.on.mock.calls.find(([event]) => event === 'click')?.[1] as (event: unknown) => void;

    click({ latlng: { lat: -18, wrap: () => ({ lng: -64 }) } });
    expect(h.onLocationChange).not.toHaveBeenCalled();
    h.unmount();
  });
  it('does not create a selected center or circle for an empty draft', () => {
    const h = mount(false, null, null);

    expect(mocks.marker).not.toHaveBeenCalled();
    expect(mocks.radius).not.toHaveBeenCalled();
    h.unmount();
  });
});

it('forwards a dragged reference marker and disables dragging for frozen configuration', () => {
  const h = mount(false);

  expect(mocks.marker).toHaveBeenCalledWith([-19, -65], expect.objectContaining({ draggable: true }));
  const marker = mocks.marker.mock.results[0].value;
  const callbacks = marker.on.mock.calls as unknown as [string, () => void][];
  const drag = callbacks.find(([event]) => event === 'dragend')?.[1] as (() => void) | undefined;

  drag?.();
  expect(h.onLocationChange).toHaveBeenCalledWith(-18, -64);
  h.unmount();
  mount(true).unmount();
  expect(mocks.marker).toHaveBeenLastCalledWith([-19, -65], expect.objectContaining({ draggable: false }));
});
