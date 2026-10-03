"use client";
// Mapa de la provincia con una burbuja por zona. Se pincha en una burbuja (o en cualquier punto del mapa)
// y la agenda de abajo cambia a esa zona. Mapa quieto a propósito: en el móvil no "atrapa" el scroll.
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { zonaMasCercana } from "../../lib/zonas";

const LIMITES = [[41.95, -6.95], [43.2, -4.8]];
const RADIO_KM = { leon: 4.5, alfoz: 11 };

function icono(z, activa) {
  const n = z.total || 0;
  const grande = z.id === "leon";
  const lado = grande ? 42 : 34;
  const html = `
    <div class="cz-zona${activa ? " cz-zona-activa" : ""}${n ? "" : " cz-zona-vacia"}" style="width:${lado}px;height:${lado}px">
      <span class="cz-zona-emoji" style="font-size:${grande ? 20 : 16}px">${z.emoji}</span>
      ${n ? `<span class="cz-zona-n">${n > 99 ? "99+" : n}</span>` : ""}
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [lado, lado], iconAnchor: [lado / 2, lado / 2] });
}

function Clics({ onElegir }) {
  useMapEvents({ click(e) { onElegir(zonaMasCercana(e.latlng.lat, e.latlng.lng)); } });
  return null;
}

// Encaja la provincia en el ancho disponible (también al girar el móvil)
function Encajar() {
  const map = useMap();
  useEffect(() => {
    const ajustar = () => { map.invalidateSize(); map.fitBounds(LIMITES, { padding: [8, 8] }); };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [map]);
  return null;
}

export default function MapaZonas({ zonas, seleccionada, onElegir }) {
  const activa = zonas.find((z) => z.id === seleccionada);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cz-zona{position:relative;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.92);
          box-shadow:0 8px 20px -6px rgba(15,23,42,.45),0 0 0 2px #fff inset;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s;cursor:pointer}
        .cz-zona:hover{transform:scale(1.1)}
        .cz-zona-vacia{opacity:.6;filter:grayscale(.6)}
        .cz-zona-activa{background:linear-gradient(135deg,#fb7185,#f97316);transform:scale(1.12);box-shadow:0 12px 28px -6px rgba(244,63,94,.65),0 0 0 3px #fff;opacity:1;filter:none;z-index:2}
        .cz-zona-n{position:absolute;top:-7px;right:-9px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#0f172a;color:#fff;
          font:700 11px/19px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff}
        .leaflet-container{background:#f1f5f9;font-family:inherit}
        .cz-mapa-suave{filter:saturate(.55) brightness(1.06) contrast(.92)}
        @media (prefers-reduced-motion: reduce){.cz-zona{transition:none}}
      `}} />
      <MapContainer
        bounds={LIMITES}
        zoomSnap={0.1}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        dragging={false}
        className="h-full w-full"
      >
        {/* Mismo mapa que el resto de la web (OpenStreetMap): no necesita ninguna clave de API.
            Lo aclaramos un poco con CSS para que las burbujas destaquen. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          className="cz-mapa-suave"
        />
        <Encajar />
        <Clics onElegir={onElegir} />
        {activa && (
          <Circle
            center={activa.centroReal || [activa.lat, activa.lon]}
            radius={(RADIO_KM[activa.id] || 24) * 1000}
            pathOptions={{ color: "#f43f5e", weight: 1.5, fillColor: "#fb7185", fillOpacity: 0.12, dashArray: "4 6" }}
            interactive={false}
          />
        )}
        {zonas.map((z) => (
          <Marker
            key={`${z.id}-${z.id === seleccionada}-${z.total}`}
            position={[z.lat, z.lon]}
            icon={icono(z, z.id === seleccionada)}
            zIndexOffset={z.id === seleccionada ? 1000 : z.id === "leon" ? 500 : 0}
            eventHandlers={{ click: () => onElegir(z.id) }}
            keyboard
            title={`${z.nombre}: ${z.total || 0} planes`}
          />
        ))}
      </MapContainer>
    </>
  );
}
