'use client';
import { useEffect, useRef } from 'react';

interface TripMapProps {
  from: string;
  to: string;
  incidents?: { type: string; position: number }[];
}

export function TripMap({ from, to, incidents = [] }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Generate coords from address strings (deterministic)
      const seed1 = from.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const seed2 = to.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

      const startLat = 35.6 + (seed1 % 20) * 0.01;
      const startLng = 139.6 + (seed1 % 15) * 0.01;
      const endLat = startLat + 0.02 + (seed2 % 10) * 0.005;
      const endLng = startLng + 0.03 + (seed2 % 10) * 0.005;

      const center: [number, number] = [(startLat + endLat) / 2, (startLng + endLng) / 2];

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
      }).setView(center, 14);

      // Dark map tiles (CartoDB dark matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
      }).addTo(map);

      // Route polyline with curve
      const midLat = (startLat + endLat) / 2 + 0.008;
      const midLng = (startLng + endLng) / 2 - 0.005;

      const routePoints: [number, number][] = [
        [startLat, startLng],
        [startLat + 0.005, startLng + 0.01],
        [midLat, midLng],
        [endLat - 0.005, endLng - 0.008],
        [endLat, endLng],
      ];

      L.polyline(routePoints, { color: '#6366f1', weight: 4, opacity: 0.9 }).addTo(map);

      // Start marker (cyan)
      L.circleMarker([startLat, startLng], { radius: 8, fillColor: '#22d3ee', color: '#22d3ee', weight: 2, fillOpacity: 0.8 }).addTo(map);

      // End marker (green)
      L.circleMarker([endLat, endLng], { radius: 8, fillColor: '#34d399', color: '#34d399', weight: 2, fillOpacity: 0.8 }).addTo(map);

      // Incident markers
      incidents.forEach((inc) => {
        const t = inc.position;
        const lat = startLat + (endLat - startLat) * t + (Math.random() - 0.5) * 0.005;
        const lng = startLng + (endLng - startLng) * t + (Math.random() - 0.5) * 0.005;
        const color = inc.type === 'speed' ? '#f87171' : inc.type === 'brake' ? '#fb923c' : inc.type === 'phone' ? '#a78bfa' : '#22d3ee';
        L.circleMarker([lat, lng], { radius: 5, fillColor: color, color: color, weight: 2, fillOpacity: 0.7 }).addTo(map);
      });

      // Fit bounds
      map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [30, 30] });

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [from, to, incidents]);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} className="w-full h-full rounded-xl" style={{ background: '#1a1a1e' }} />
    </>
  );
}
