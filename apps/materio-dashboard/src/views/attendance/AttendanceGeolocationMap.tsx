'use client';

import { useEffect, useRef } from 'react';

import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface AttendanceGeolocationMapProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  disabled: boolean;
  onLocationChange: (latitude: number, longitude: number) => void;
}

// Loaded exclusively through next/dynamic({ ssr: false }). No default marker asset paths.
export default function AttendanceGeolocationMap(props: AttendanceGeolocationMapProps) {
  const element = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const current = useRef(props);
  const theme = useTheme();
  const { latitude, longitude, radiusMeters } = props;

  current.current = props;
  useEffect(() => {
    if (!element.current) return;

    // Bolivia is only a visual starting view, never a selected/saved center.
    const instance = L.map(element.current).setView([-17, -65], 5);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!current.current.disabled) current.current.onLocationChange(event.latlng.lat, event.latlng.wrap().lng);
    });
    const observer = new ResizeObserver(() => instance.invalidateSize());

    observer.observe(element.current);

    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    layers.current?.clearLayers();
    if (latitude === null || longitude === null || !map.current || !layers.current) return;
    const center: L.LatLngTuple = [latitude, longitude];

    const marker = L.marker(center, {
      draggable: !props.disabled,
      keyboard: true,
      title: 'Ubicación del aula',
      icon: L.divIcon({
        className: '',
        html: '<span style="display:block;width:16px;height:16px;background:#1976d2;border:2px solid white;border-radius:50%;box-shadow:0 0 2px black"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(layers.current);

    marker.on('dragend', () => {
      if (current.current.disabled) return;
      const point = marker.getLatLng();

      current.current.onLocationChange(point.lat, point.wrap().lng);
    });
    if (Number.isFinite(radiusMeters) && radiusMeters > 0) {
      const circle = L.circle(center, { radius: radiusMeters, color: theme.palette.primary.main, fillOpacity: 0.12 });

      circle.addTo(layers.current);
      map.current.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18 });
    } else map.current.setView(center, 17);
  }, [latitude, longitude, radiusMeters, props.disabled, theme.palette.primary.main]);

  return (
    <Box
      ref={element}
      role='region'
      aria-label={props.disabled ? 'Ubicación de la sesión (solo lectura)' : 'Seleccionar punto central en el mapa'}
      sx={{
        width: '100%',
        height: { xs: 280, md: 440 },
        zIndex: 0,
        borderRadius: 1,
        '& .leaflet-control-attribution': { fontSize: 11 },
      }}
    />
  );
}
