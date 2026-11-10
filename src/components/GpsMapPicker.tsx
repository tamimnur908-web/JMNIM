import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, ExternalLink, Search, Crosshair } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatNumber } from '../utils/formatters';

// Fix Leaflet default marker icon paths in browser
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GpsMapPickerProps {
  lat: number;
  lng: number;
  radius: number;
  onChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
}

export const GpsMapPicker: React.FC<GpsMapPickerProps> = ({
  lat,
  lng,
  radius,
  onChange,
  onRadiusChange,
}) => {
  const { t, language } = useLanguage();
  const isBn = language === 'bn';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = lat || 23.8103;
      const initialLng = lng || 90.4125;

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
      }).addTo(map);

      marker.bindPopup(`<b>${t.institutionName}</b><br/>${t.mapInstruction}`).openPopup();

      const circle = L.circle([initialLat, initialLng], {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: radius || 100,
      }).addTo(map);

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        circle.setLatLng(position);
        onChange(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        circle.setLatLng([clickLat, clickLng]);
        onChange(Number(clickLat.toFixed(6)), Number(clickLng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentLatLng = markerRef.current.getLatLng();
      if (currentLatLng.lat !== lat || currentLatLng.lng !== lng) {
        markerRef.current.setLatLng([lat, lng]);
        circleRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom());
      }
      circleRef.current.setRadius(radius);
    }
  }, [lat, lng, radius]);

  const handleUseCurrentLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert(isBn ? 'আপনার ডিভাইসে জিপিএস সমর্থিত নয়।' : 'Geolocation not supported on this device.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = Number(pos.coords.latitude.toFixed(6));
        const curLng = Number(pos.coords.longitude.toFixed(6));

        onChange(curLat, curLng);
        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.setView([curLat, curLng], 17);
          markerRef.current.setLatLng([curLat, curLng]);
          circleRef.current.setLatLng([curLat, curLng]);
        }
        setLocating(false);
      },
      (err) => {
        alert((isBn ? 'লোকেশন পাওয়া যায়নি: ' : 'Location error: ') + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[3]);
      onChange(parsedLat, parsedLng);
      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        mapInstanceRef.current.setView([parsedLat, parsedLng], 17);
        markerRef.current.setLatLng([parsedLat, parsedLng]);
        circleRef.current.setLatLng([parsedLat, parsedLng]);
      }
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=bd`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        onChange(foundLat, foundLng);
        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.setView([foundLat, foundLng], 17);
          markerRef.current.setLatLng([foundLat, foundLng]);
          circleRef.current.setLatLng([foundLat, foundLng]);
        }
      } else {
        alert(isBn ? 'ঠিকানাটি ম্যাপে পাওয়া যায়নি।' : 'Address could not be found on the map.');
      }
    } catch (err: any) {
      alert((isBn ? 'অনুসন্ধানে ত্রুটি: ' : 'Search error: ') + err.message);
    } finally {
      setSearching(false);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="space-y-3">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.searchAddressOrCoords}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0"
          >
            {searching ? (isBn ? 'খোঁজা হচ্ছে...' : 'Searching...') : t.searchBtn}
          </button>
        </form>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? (isBn ? 'লোকেশন লোড হচ্ছে...' : 'Locating...') : t.myCurrentLocationBtn}</span>
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition"
            title={t.viewOnGoogleMaps}
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Google Maps</span>
          </a>
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-blue-500/30 shadow-md">
        <div ref={mapContainerRef} className="w-full h-80 z-10" />

        {/* Floating Instruction Badge */}
        <div className="absolute top-2 right-2 z-20 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 shadow-md border border-slate-200 flex items-center space-x-1.5 pointer-events-none">
          <Crosshair className="w-3.5 h-3.5 text-blue-600" />
          <span>{t.mapInstruction}</span>
        </div>
      </div>

      {/* Coordinates Display & Radius Range Slider */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
        <div>
          <span className="text-slate-500 block text-[11px]">{t.selectedLat}</span>
          <span className="font-mono font-bold text-slate-900">{lat}</span>
        </div>

        <div>
          <span className="text-slate-500 block text-[11px]">{t.selectedLng}</span>
          <span className="font-mono font-bold text-slate-900">{lng}</span>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-500 text-[11px]">{t.selectedRadius}</span>
            <span className="font-bold text-blue-700">{formatNumber(radius, isBn)} {t.metersUnit}</span>
          </div>
          <input
            type="range"
            min="20"
            max="500"
            step="10"
            value={radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};
