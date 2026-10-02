"use client";
import { useState } from "react";
import dynamic from 'next/dynamic'; 
import BusinessModal from './components/BusinessModal';

const MapSelectorDynamic = dynamic(() => import('./components/MapSelector'), { ssr: false });

export default function Home() {
  const [estaCargando, setEstaCargando] = useState(false);
  const [itinerario, setItinerario] = useState(null); 
  const [paradaSeleccionada, setParadaSeleccionada] = useState(null); 
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(null);
  const [climaPrevision, setClimaPrevision] = useState(null);
  const [instruccionRetoque, setInstruccionRetoque] = useState("");
  const [retocando, setRetocando] = useState(false);
  
  const [fecha, setFecha] = useState("");
  const [apetece, setApetece] = useState("");
  const [presupuestoMin, setPresupuestoMin] = useState(10);
  const [presupuestoMax, setPresupuestoMax] = useState(50);
  const [distancia, setDistancia] = useState(15); 
  const [centroMapa, setCentroMapa] = useState([42.5987, -5.5671]); 

  const generarPlan = async (e) => {
    if (e) e.preventDefault(); 
    if (!fecha) { alert("¡Necesito una fecha!"); return; }
    setEstaCargando(true); setItinerario(null); setParadaSeleccionada(null); setClimaPrevision(null);

    // Aseguramos que si dejaron la caja vacía, se envíe un 0 (o un 1 en la distancia)
    const minSeguro = presupuestoMin === "" ? 0 : Number(presupuestoMin);
    const maxSeguro = presupuestoMax === "" ? 0 : Number(presupuestoMax);
    const radioSeguro = distancia === "" ? 1 : Number(distancia);

    try {
      const respuesta = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, apetece, presupuestoMin: minSeguro, presupuestoMax: maxSeguro, radio: radioSeguro, lat: centroMapa[0], lon: centroMapa[1] })
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        setItinerario(datos.plan); setClimaPrevision(datos.prevision || null);
      } else { alert("🚨 Error: " + datos.mensaje); }
    } catch (error) { alert("Error de conexión."); } finally { setEstaCargando(false); }
  };

  const retocarParada = async () => {
    if (!instruccionRetoque.trim() || indiceSeleccionado === null) return;
    setRetocando(true);
    
    const minSeguro = presupuestoMin === "" ? 0 : Number(presupuestoMin);
    const maxSeguro = presupuestoMax === "" ? 0 : Number(presupuestoMax);
    const radioSeguro = distancia === "" ? 1 : Number(distancia);

    try {
      const respuesta = await fetch('/api/retocar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerarioActual: itinerario, indice: indiceSeleccionado, instruccion: instruccionRetoque, fecha, presupuestoMin: minSeguro, presupuestoMax: maxSeguro, radio: radioSeguro, lat: centroMapa[0], lon: centroMapa[1] })
      });
      const datos = await respuesta.json();
      if (datos.exito) {
        const nuevoItinerario = [...itinerario];
        nuevoItinerario[indiceSeleccionado] = datos.parada;
        setItinerario(nuevoItinerario); setParadaSeleccionada(datos.parada); setInstruccionRetoque("");
      } else { alert("🚨 " + datos.mensaje); }
    } catch (error) { alert("Error al intentar cambiar sitio."); } finally { setRetocando(false); }
  };

  return (
    <main className={`min-h-screen flex flex-col items-center p-4 py-8 relative font-sans ${itinerario ? 'justify-start' : 'justify-center'}`} style={{ cursor: "url('/leon.png'), auto" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .roseton-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 32px; height: 32px; background-image: url('/roseton.png'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer; border: none; border-radius: 50%; filter: drop-shadow(0px 5px 10px rgba(0,0,0,0.2)); transition: transform 0.2s; }
        .roseton-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
        .roseton-slider::-moz-range-thumb { width: 32px; height: 32px; background-image: url('/roseton.png'); background-size: contain; background-repeat: no-repeat; background-position: center; cursor: pointer; border: none; background-color: transparent; filter: drop-shadow(0px 5px 10px rgba(0,0,0,0.2)); transition: transform 0.2s; }
        .roseton-slider::-moz-range-thumb:hover { transform: scale(1.1); }
        
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; }
      `}} />

    <div className="fixed inset-0 bg-gradient-to-br from-rose-400 via-rose-300 to-rose-500 -z-20"></div>
      <div className="fixed inset-0 bg-black/5 backdrop-blur-[2px] -z-10"></div>

      {estaCargando ? (
        <div className="flex flex-col items-center justify-center text-center z-10 relative bg-white/80 backdrop-blur-xl border-4 border-white p-10 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] mt-auto mb-auto">
          <div className="text-7xl mb-6 animate-bounce drop-shadow-md">🦁</div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">Creando el plan maestro...</h2>
          <p className="text-slate-500 font-bold text-base">Comprobando previsión del tiempo y fotos reales...</p>
        </div>
      ) : itinerario ? (
        <div className="relative z-10 w-full max-w-5xl transition-all duration-300 flex flex-col gap-6 pb-12 pt-2 px-2">
          
          <div className="bg-white/90 backdrop-blur-md p-4 px-6 rounded-full border-4 border-white shadow-[0_15px_30px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center sticky top-4 z-50">
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent leading-none ml-2">Tu Planazo</h2>
            <button onClick={() => { setItinerario(null); setClimaPrevision(null); }} className="bg-slate-100 text-slate-700 font-black px-5 py-2 rounded-full hover:bg-slate-200 hover:shadow-md transition-all">Volver</button>
          </div>

          {climaPrevision && (
            <div className="bg-sky-50/90 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-white shadow-[0_10px_20px_-5px_rgba(14,165,233,0.15)] text-center font-bold text-sky-800 text-sm mx-auto max-w-xl">
              🌤️ <b>Previsión:</b> {climaPrevision} — Plan adaptado al tiempo
            </div>
          )}

          <div className="bg-white/70 backdrop-blur-md p-3 rounded-[3rem] border-4 border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
            <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} itinerario={itinerario} />
          </div>
          
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-4 border-white shadow-[0_15px_30px_-10px_rgba(59,130,246,0.15)] p-5 rounded-[2rem] flex flex-col md:flex-row items-center gap-4 max-w-3xl mx-auto my-2 transform hover:scale-[1.02] transition-transform">
            <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0 animate-pulse">💡</div>
            <p className="text-slate-700 text-sm md:text-base leading-snug">
              <b>¡Sácale todo el jugo al plan!</b> Toca cualquier tarjeta para consultar sus <b>horarios y precios</b>, asomarte a la puerta con la <b>cámara 360º</b>, o <b>pedirme que cambie el sitio</b> por otro diferente si no te convence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {itinerario.map((parada, index) => (
               <div key={index} onClick={() => { setParadaSeleccionada(parada); setIndiceSeleccionado(index); }} className="bg-white rounded-[2.5rem] overflow-hidden border-4 border-white shadow-[0_15px_35px_-10px_rgba(0,0,0,0.08)] flex flex-col transform transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_25px_50px_-12px_rgba(251,113,133,0.25)] cursor-pointer group">
                 <div className="h-52 w-full bg-slate-100 relative overflow-hidden">
                   <img src={parada.fotoOficial} alt={parada.titulo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                   <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-800 text-xs font-black px-4 py-2 rounded-full shadow-lg">
                     {parada.hora}
                   </div>
                 </div>
                 <div className="p-6 flex-1 flex flex-col">
                   <h3 className="text-xl font-black text-slate-800 leading-tight mb-2">{parada.titulo}</h3>
                   <p className="text-slate-500 font-medium text-sm mb-4 line-clamp-3 leading-relaxed">{parada.descripcion}</p>
                   <div className="flex justify-between items-center mt-auto pt-4 border-t-2 border-slate-50">
                      <span className="font-black text-amber-500 text-sm bg-amber-50 px-3 py-1 rounded-full">⭐ {parada.resenas}</span>
                      <span className="font-black text-rose-400 text-sm bg-rose-50 px-4 py-1 rounded-full group-hover:bg-rose-100 transition-colors">Abrir info</span>
                   </div>
                 </div>
               </div>
            ))}
          </div>

          {paradaSeleccionada && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => { setParadaSeleccionada(null); setIndiceSeleccionado(null); setInstruccionRetoque(""); }}>
              <div className="bg-white/95 backdrop-blur-xl p-6 sm:p-8 rounded-[3rem] border-4 border-white shadow-[0_30px_60px_rgba(0,0,0,0.2)] w-full max-w-lg max-h-[95vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-rose-100 text-rose-600 text-xs font-black px-3 py-1 rounded-full mb-3 inline-block shadow-sm">{paradaSeleccionada.hora}</span>
                    <h2 className="text-3xl font-black text-slate-800 leading-tight pr-2">{paradaSeleccionada.titulo}</h2>
                  </div>
                  <button onClick={() => { setParadaSeleccionada(null); setIndiceSeleccionado(null); setInstruccionRetoque(""); }} className="text-slate-500 font-black text-xl bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center hover:bg-slate-200 hover:text-slate-800 transition-colors shrink-0">✕</button>
                </div>
                
                {paradaSeleccionada.streetView && (
                  <div className="mb-6 relative group rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-600 z-10 pointer-events-none shadow-sm">
                      {paradaSeleccionada.streetView.includes("embed") ? "📍 Vista 360º (Arrastra)" : "📍 Vista exterior"}
                    </div>
                    {paradaSeleccionada.streetView.includes("embed") ? (
                      <iframe src={paradaSeleccionada.streetView} allowFullScreen loading="lazy" className="w-full h-48 sm:h-56"></iframe>
                    ) : (
                      <img src={paradaSeleccionada.streetView} alt="Street View" className="w-full h-48 sm:h-56 object-cover" />
                    )}
                  </div>
                )}
                
                <p className="text-slate-600 font-medium mb-6 text-base leading-relaxed bg-slate-50 p-4 rounded-[2rem]">{paradaSeleccionada.descripcion}</p>
                
                <div className="space-y-3 mb-6">
                  <p className="text-base text-slate-700 font-medium flex items-center bg-white border-2 border-slate-100 p-3 rounded-full shadow-sm"><span className="w-8 h-8 flex justify-center items-center font-black text-lg bg-green-100 text-green-600 rounded-full mr-3">💶</span> {paradaSeleccionada.precio}</p>
                  <p className="text-base text-slate-700 font-medium flex items-center bg-white border-2 border-slate-100 p-3 rounded-full shadow-sm"><span className="w-8 h-8 flex justify-center items-center font-black text-lg bg-blue-100 text-blue-600 rounded-full mr-3">🕒</span> {paradaSeleccionada.horario}</p>
                  <p className="text-base text-slate-700 font-medium flex items-center bg-white border-2 border-slate-100 p-3 rounded-full shadow-sm"><span className="w-8 h-8 flex justify-center items-center font-black text-lg bg-purple-100 text-purple-600 rounded-full mr-3">🚶</span> {paradaSeleccionada.transporte}</p>
                </div>

                <div className="flex items-center justify-between gap-2 mb-6">
                  {paradaSeleccionada.telefono !== "No disponible" ? (
                    <a href={`tel:${paradaSeleccionada.telefono}`} className="flex-1 bg-slate-800 text-white text-center font-bold py-3 rounded-full hover:bg-slate-700 transition-colors shadow-lg shadow-slate-300">📞 Llamar</a>
                  ) : (
                    <span className="flex-1 bg-slate-100 text-slate-400 text-center font-bold py-3 rounded-full cursor-not-allowed">📞 Sin teléfono</span>
                  )}
                  {paradaSeleccionada.web !== "No disponible" ? (
                    <a href={paradaSeleccionada.web} target="_blank" rel="noopener noreferrer" className="flex-1 bg-rose-50 text-rose-500 text-center font-bold py-3 rounded-full hover:bg-rose-100 transition-colors">🌐 Web</a>
                  ) : (
                    <span className="flex-1 bg-slate-100 text-slate-400 text-center font-bold py-3 rounded-full cursor-not-allowed">🌐 Sin web</span>
                  )}
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-[2rem] border-2 border-white shadow-sm">
                  <label className="block text-xs font-black text-indigo-400 mb-3 uppercase tracking-wide">🔄 ¿No te convence? Te lo cambio</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" value={instruccionRetoque} onChange={(e) => setInstruccionRetoque(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); retocarParada(); } }} placeholder="Ej: algo más barato, sitio vegetariano..." disabled={retocando} className="flex-1 bg-white border-0 text-slate-700 text-sm font-bold rounded-full px-5 py-3 outline-none shadow-inner disabled:opacity-50 focus:ring-2 focus:ring-indigo-200 transition-all" />
                    <button onClick={retocarParada} disabled={retocando || !instruccionRetoque.trim()} className="bg-indigo-500 text-white font-black px-6 py-3 rounded-full hover:bg-indigo-600 disabled:opacity-50 shadow-[0_5px_15px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_20px_rgba(99,102,241,0.6)] transition-all shrink-0">
                      {retocando ? "Pensando..." : "Cambiar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-md flex flex-col items-center mt-auto mb-auto">
          <form onSubmit={generarPlan} className="bg-white/70 backdrop-blur-xl p-8 rounded-[3rem] border-4 border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full transition-all duration-300">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-black bg-gradient-to-br from-rose-400 to-orange-400 bg-clip-text text-transparent mb-2 tracking-tighter">Cazurronics Planner</h1>
              <p className="text-slate-500 font-extrabold text-xs tracking-widest uppercase bg-white/80 inline-block px-4 py-2 rounded-full shadow-sm">El Plan Perfecto</p>
            </div>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 ml-2">¿Qué día es el plan? 📅</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-white/80 border-0 text-slate-700 text-sm font-bold rounded-full focus:ring-2 focus:ring-rose-200 block px-5 py-4 outline-none shadow-inner cursor-pointer transition-all" />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 ml-2">¿Qué te apetece? 🌮</label>
                <textarea rows="2" value={apetece} onChange={(e) => setApetece(e.target.value)} className="w-full bg-white/80 border-0 text-slate-700 text-sm font-bold rounded-[2rem] focus:ring-2 focus:ring-rose-200 block px-5 py-4 outline-none resize-none shadow-inner transition-all" placeholder="Ej: Cocido, ver monumentos..."></textarea>
              </div>
              
              <div className="bg-sky-50/50 p-5 rounded-[2.5rem] border-2 border-white shadow-sm">
                <label className="block text-sm font-black text-slate-700 mb-4 ml-1">Presupuesto (por persona)</label>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex items-center shrink-0 shadow-sm rounded-full overflow-hidden">
                    <span className="absolute left-3 text-xs font-black text-slate-400">Mín</span>
                    <input type="number" min="0" max="300" value={presupuestoMin} onChange={(e) => setPresupuestoMin(e.target.value === '' ? '' : Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} className="w-24 pl-10 pr-6 py-2 bg-white border-0 text-sm font-black text-slate-700 text-center outline-none focus:bg-sky-50 transition-colors" />
                    <span className="absolute right-3 text-xs font-black text-slate-400">€</span>
                  </div>
                  <input type="range" min="0" max="300" step="5" value={presupuestoMin === '' ? 0 : presupuestoMin} onChange={(e) => setPresupuestoMin(Math.min(Number(e.target.value), presupuestoMax === '' ? 300 : presupuestoMax))} className="w-full h-3 bg-white rounded-full appearance-none cursor-pointer roseton-slider shadow-inner" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center shrink-0 shadow-sm rounded-full overflow-hidden">
                    <span className="absolute left-3 text-xs font-black text-slate-400">Máx</span>
                    <input type="text" value={presupuestoMax === '' ? '' : (presupuestoMax >= 300 ? "+300" : presupuestoMax)} onChange={(e) => { let val = e.target.value.replace(/\D/g, ''); if (val === '') { setPresupuestoMax(''); return; } val = Number(val); if (val > 300) val = 300; setPresupuestoMax(Math.max(val, presupuestoMin === '' ? 0 : presupuestoMin)); }} className="w-24 pl-10 pr-6 py-2 bg-white border-0 text-sm font-black text-slate-700 text-center outline-none focus:bg-sky-50 transition-colors" />
                    <span className="absolute right-3 text-xs font-black text-slate-400">€</span>
                  </div>
                  <input type="range" min="0" max="300" step="5" value={presupuestoMax === '' ? 0 : presupuestoMax} onChange={(e) => setPresupuestoMax(Math.max(Number(e.target.value), presupuestoMin === '' ? 0 : presupuestoMin))} className="w-full h-3 bg-white rounded-full appearance-none cursor-pointer roseton-slider shadow-inner" />
                </div>
              </div>

              <div className="bg-indigo-50/50 p-3 rounded-[2.5rem] border-2 border-white shadow-sm">
                <label className="block text-sm font-black text-slate-700 mb-2 ml-3 mt-1">Zona de búsqueda 📍</label>
                <MapSelectorDynamic radiusKm={distancia} setRadiusKm={setDistancia} center={centroMapa} setCenter={setCentroMapa} />
              </div>
            </div>

            <button type="submit" className="bg-gradient-to-r from-rose-400 to-orange-400 text-white font-black text-xl py-4 px-6 rounded-full w-full shadow-[0_10px_30px_rgba(251,113,133,0.4)] hover:shadow-[0_15px_40px_rgba(251,113,133,0.6)] hover:-translate-y-1 active:translate-y-1 transition-all duration-300">
              ¡Descubrir el Plan!
            </button>
          </form>

          {/* El botón de negocios ahora vive aquí, feliz y sin errores de sintaxis */}
          <div className="w-full mt-4 flex justify-center">
            <BusinessModal />
          </div>
        </div>
      )}
    </main>
  );
}