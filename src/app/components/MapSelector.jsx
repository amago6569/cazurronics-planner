"use client";
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, ImageOverlay, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LIMITES_LEON = [ [41.8, -7.35], [43.45, -4.45] ];

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom || map.getZoom(), { animate: true, duration: 1.5 }); }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ setCenter }) {
  useMapEvents({ click(e) { setCenter([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

export default function MapSelector({ radiusKm, setRadiusKm, center, setCenter, itinerario }) {
  const [busqueda, setBusqueda] = useState("");

  const buscarUbicacion = async (e) => {
    if (e) e.preventDefault();
    if (!busqueda) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda + ", provincia de León, España")}`);
      const data = await res.json();
      if (data && data.length > 0) { setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]); setBusqueda(""); }
      else { alert("¡Ay guaje, no encuentro ese sitio en León!"); }
    } catch (error) { console.error("Error ubicación:", error); }
  };

  const coordenadasRuta = itinerario ? itinerario.filter(p => p.lat && p.lon).map(p => [p.lat, p.lon]) : [];

  const calculateBounds = (center, radiusKm) => {
    const lat = center[0]; const lng = center[1];
    // Si la caja está vacía, usamos 1km temporalmente para dibujar el círculo
    const radioSeguro = radiusKm === '' ? 1 : radiusKm;
    const latOffset = radioSeguro / 111.32; 
    const lngOffset = radioSeguro / (111.32 * Math.cos((lat * Math.PI) / 180));
    return [ [lat - latOffset, lng - lngOffset], [lat + latOffset, lng + lngOffset] ];
  };
  const rosetonBounds = calculateBounds(center, radiusKm);

  return (
    <div className="w-full flex flex-col gap-3">
      {!itinerario && (
        <div className="flex gap-2 mb-1 px-1">
          <input 
            type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarUbicacion(); } }}
            placeholder="Ej: Ponferrada, Astorga..." 
            className="flex-1 bg-white/90 border-0 text-slate-700 text-sm font-bold rounded-full px-5 py-2 outline-none shadow-inner focus:ring-2 focus:ring-indigo-200 transition-all"
          />
          <button type="button" onClick={buscarUbicacion} className="bg-white text-indigo-500 font-black px-5 py-2 rounded-full shadow-[0_5px_15px_rgba(99,102,241,0.2)] hover:shadow-[0_8px_20px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 transition-all">
            🔍 Buscar
          </button>
        </div>
      )}

      <div className="h-[250px] w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] relative z-0">
        <MapContainer center={center} zoom={14} minZoom={9} maxBounds={LIMITES_LEON} maxBoundsViscosity={1.0} scrollWheelZoom={true} className="h-full w-full" attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {!itinerario && <Marker position={center} />}
          
          {itinerario && itinerario.map((parada, idx) => {
            if (!parada.lat || !parada.lon) return null;
            const numberedIcon = L.divIcon({
              className: 'custom-numbered-icon',
              html: `<div style="background: linear-gradient(135deg, #fb7185, #f97316); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; font-weight: 900; border: 3px solid white; box-shadow: 0px 5px 15px rgba(244,63,94,0.5); font-size: 16px;">${idx + 1}</div>`,
              iconSize: [32, 32], iconAnchor: [16, 16]
            });
            return (
              <Marker key={idx} position={[parada.lat, parada.lon]} icon={numberedIcon}>
                <Popup><b className="text-rose-500">Parada {idx + 1} ({parada.hora})</b><br/><span className="font-bold text-slate-700">{parada.titulo}</span></Popup>
              </Marker>
            );
          })}

          {coordenadasRuta.length > 1 && <Polyline positions={coordenadasRuta} color="#3b82f6" weight={5} opacity={0.6} dashArray="10, 10" />}
          {!itinerario && <ImageOverlay url="/roseton.png" bounds={rosetonBounds} opacity={0.4} className="animate-pulse" />}
          
          <MapUpdater center={coordenadasRuta.length > 0 ? coordenadasRuta[0] : center} zoom={itinerario ? 15 : undefined} />
          {!itinerario && <MapClickHandler setCenter={setCenter} />}
        </MapContainer>
      </div>

      {!itinerario && (
        <div className="px-2 mt-1">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-black text-slate-600 ml-1">Distancia máxima</label>
            <div className="relative flex items-center shrink-0 shadow-sm rounded-full overflow-hidden">
              {/* CAJA DE DISTANCIA AHORA PERMITE VACIARLA TOTALMENTE */}
              <input 
                type="number" 
                min="1" 
                max="150" 
                value={radiusKm} 
                onChange={(e) => { 
                  if (e.target.value === '') { setRadiusKm(''); return; }
                  let val = Number(e.target.value); 
                  if (val > 150) val = 150; 
                  setRadiusKm(val); 
                }} 
                className="w-20 pr-8 pl-3 py-1 bg-white border-0 text-sm font-black text-indigo-500 text-center outline-none" 
              />
              <span className="absolute right-3 text-xs font-black text-indigo-300">km</span>
            </div>
          </div>
          <input 
            type="range" 
            min="1" 
            max="150" 
            step="1" 
            value={radiusKm === '' ? 1 : radiusKm} 
            onChange={(e) => setRadiusKm(Number(e.target.value))} 
            className="w-full h-3 bg-white rounded-full appearance-none cursor-pointer roseton-slider shadow-inner" 
          />
        </div>
      )}
    </div>
  );
}