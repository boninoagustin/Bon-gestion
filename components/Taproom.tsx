import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBreweryStore } from '../context/store';
import { Beer, Plus, X, Droplet, GlassWater, Maximize, Minimize, Gift } from 'lucide-react';

export const Taproom: React.FC = () => {
  const { kegs, batches, toggleKegTap, serveFromTap, giftFromTap } = useBreweryStore();
  
  // Local state for prices during the session
  const [prices, setPrices] = useState({
    media: 2000,
    pinta: 3000,
    litro: 5000,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const tappedKegs = kegs.filter(k => k.isTapped && k.status === 'IN_HOUSE' && k.currentVolume !== 0);
  const availableKegs = kegs.filter(k => !k.isTapped && k.status === 'IN_HOUSE' && (k.currentVolume === undefined || k.currentVolume > 0));

  const handleServe = (kegId: string, volume: number, format: string, price: number) => {
    serveFromTap(kegId, volume, format, price);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const renderKegCard = (keg: any, isPosMode: boolean = false) => {
    const batch = batches.find(b => b.id === keg.batchId);
    const currentVol = keg.currentVolume ?? keg.size;
    const percentage = (currentVol / keg.size) * 100;
    const pintasLeft = Math.floor(currentVol / 0.5);

    return (
      <div key={keg.id} className={`${isPosMode ? 'bg-zinc-900 border-zinc-800 shadow-xl' : 'bg-white dark:bg-zinc-900/60 backdrop-blur-md border-slate-200 dark:border-zinc-800/80'} border rounded-2xl p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all`}>
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-zinc-800">
          <div className={`h-full transition-all duration-500 ${percentage > 50 ? 'bg-emerald-500' : percentage > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }} />
        </div>
        
        <div className="flex justify-between items-start mb-4 mt-2">
          <div>
            <h3 className={`font-bold font-display ${isPosMode ? 'text-zinc-100 text-3xl mb-1' : 'text-slate-800 dark:text-zinc-100 text-lg sm:text-xl'}`}>{keg.contents || 'Cerveza'}</h3>
            <p className={`${isPosMode ? 'text-zinc-400 text-sm font-medium' : 'text-slate-500 dark:text-zinc-400 text-xs font-medium'}`}>Barril #{keg.id} {batch ? `• Lote ${batch.lotCode}` : ''}</p>
          </div>
          {!isPosMode && (
            <button 
              onClick={() => toggleKegTap(keg.id, false)}
              className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Despinchar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={`mb-6 flex items-center gap-4 ${isPosMode ? 'text-base' : 'text-sm'}`}>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Droplet size={isPosMode ? 20 : 16} className="text-blue-500" />
            <span className="font-medium">{currentVol.toFixed(1)}L <span className="text-slate-400 text-xs font-normal">/ {keg.size}L</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <GlassWater size={isPosMode ? 20 : 16} className="text-amber-500" />
            <span className="font-medium">~{pintasLeft} Pintas</span>
          </div>
        </div>

        {/* POS Buttons */}
        <div className={`grid grid-cols-4 gap-2 mt-auto ${isPosMode ? 'h-32' : ''}`}>
          <button
            onClick={() => handleServe(keg.id, 0.33, 'Media Pinta', prices.media)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${isPosMode ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-100 shadow-sm hover:shadow-md' : 'bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 hover:border-amber-500 hover:text-amber-600 dark:hover:border-amber-500/50'}`}
          >
            <span className={`${isPosMode ? 'text-lg' : 'text-[10px] uppercase tracking-wider'} font-bold mb-1`}>Media</span>
            <span className={`${isPosMode ? 'text-sm font-mono' : 'text-[10px] font-mono'} opacity-70`}>${prices.media}</span>
          </button>
          <button
            onClick={() => handleServe(keg.id, 0.5, 'Pinta', prices.pinta)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${isPosMode ? 'bg-copper hover:bg-copper-dark border border-transparent text-white shadow-lg shadow-copper/20' : 'bg-amber-50 dark:bg-copper/10 border border-amber-200 dark:border-copper/20 hover:bg-amber-100 dark:hover:bg-copper/20 text-amber-700 dark:text-copper-light'}`}
          >
            <span className={`${isPosMode ? 'text-xl' : 'text-[10px] uppercase tracking-wider'} font-bold mb-1`}>Pinta</span>
            <span className={`${isPosMode ? 'text-sm font-mono' : 'text-[10px] font-mono'} opacity-90`}>${prices.pinta}</span>
          </button>
          <button
            onClick={() => handleServe(keg.id, 1, 'Litro', prices.litro)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${isPosMode ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-100 shadow-sm hover:shadow-md' : 'bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 hover:border-amber-500 hover:text-amber-600 dark:hover:border-amber-500/50'}`}
          >
            <span className={`${isPosMode ? 'text-lg' : 'text-[10px] uppercase tracking-wider'} font-bold mb-1`}>Litro</span>
            <span className={`${isPosMode ? 'text-sm font-mono' : 'text-[10px] font-mono'} opacity-70`}>${prices.litro}</span>
          </button>
          <button
            onClick={() => giftFromTap(keg.id, 0.5, 'Pinta')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${isPosMode ? 'bg-indigo-600 hover:bg-indigo-500 border border-transparent text-white shadow-lg shadow-indigo-500/20' : 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'}`}
            title="Regalar Pinta"
          >
            <Gift size={isPosMode ? 24 : 16} className="mb-1" />
            <span className={`${isPosMode ? 'text-sm' : 'text-[10px] uppercase tracking-wider'} font-bold`}>Regalo</span>
          </button>
        </div>
      </div>
    );
  };

  // The POS Overlay when Fullscreen
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-zinc-950 overflow-y-auto p-8 animate-in fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
            <h1 className="text-4xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-copper to-orange-400 flex items-center gap-4">
              <Beer size={40} className="text-copper" />
              Pizarra BON
            </h1>
            <button 
              onClick={toggleFullscreen}
              className="bg-zinc-800 text-zinc-300 p-3.5 rounded-xl font-bold hover:bg-zinc-700 hover:text-white transition-all shadow-md flex items-center gap-2 active:scale-95"
            >
              <Minimize size={20} /> Salir de Pantalla Completa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tappedKegs.map(keg => renderKegCard(keg, true))}
            {tappedKegs.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500 text-xl border-2 border-dashed border-slate-700 rounded-3xl">
                No hay ningún barril pinchado. Salí de pantalla completa para configurar.
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Normal View
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900/40 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Beer className="text-copper" size={28} />
            Pizarra / Eventos
          </h2>
          <button 
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-copper-dark text-white text-sm font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-copper transition-all shadow-md active:scale-95 w-full sm:w-auto justify-center"
          >
            <Maximize size={18} /> Modo POS (Pantalla Completa)
          </button>
        </div>
        
        {/* Price Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-slate-100 dark:border-zinc-700/50">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Precio Media <span className="text-slate-400 dark:text-zinc-500 font-normal normal-case">(330ml)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 font-bold">$</span>
              <input 
                type="number" 
                value={prices.media}
                onChange={e => setPrices({...prices, media: Number(e.target.value)})}
                className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Precio Pinta <span className="text-slate-400 dark:text-zinc-500 font-normal normal-case">(500ml)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 font-bold">$</span>
              <input 
                type="number" 
                value={prices.pinta}
                onChange={e => setPrices({...prices, pinta: Number(e.target.value)})}
                className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Precio Litro <span className="text-slate-400 dark:text-zinc-500 font-normal normal-case">(1L)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 font-bold">$</span>
              <input 
                type="number" 
                value={prices.litro}
                onChange={e => setPrices({...prices, litro: Number(e.target.value)})}
                className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Tapped Kegs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tappedKegs.map(keg => renderKegCard(keg, false))}

          {/* Add Tap Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="border-2 border-dashed border-slate-200 dark:border-zinc-700/80 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-copper hover:border-copper/50 dark:hover:border-copper/50 transition-all min-h-[200px] hover:bg-slate-50 dark:hover:bg-zinc-800/30 group"
          >
            <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-copper/10 group-hover:text-copper transition-colors">
              <Plus size={28} />
            </div>
            <span className="font-medium">Pinchar Barril</span>
          </button>
        </div>
      </div>

      {/* Modal to Select Keg */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800/80">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800/80 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
              <h3 className="font-bold font-display text-lg text-slate-800 dark:text-zinc-100">Seleccionar Barril Lleno</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700/50 transition-colors">
                <X size={20} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
              {availableKegs.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-zinc-500 py-10 font-medium">No hay barriles llenos disponibles en fábrica.</p>
              ) : (
                availableKegs.map(keg => (
                  <button
                    key={keg.id}
                    onClick={() => {
                      toggleKegTap(keg.id, true);
                      setIsModalOpen(false);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-zinc-700/80 hover:border-copper hover:shadow-md dark:hover:border-copper/50 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">
                        Barril #{keg.id} {keg.contents ? `- ${keg.contents}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {keg.currentVolume ?? keg.size}L / {keg.size}L
                      </div>
                    </div>
                    <Plus size={18} className="text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
