import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBreweryStore } from '../context/store';
import {
  Beer,
  Plus,
  X,
  Droplet,
  GlassWater,
  Maximize,
  Minimize,
  Gift,
  CheckCircle2,
} from 'lucide-react';
import { Keg } from '../types';

export const Taproom: React.FC = () => {
  const { kegs, batches, toggleKegTap, serveFromTap, giftFromTap } =
    useBreweryStore();

  const [prices, setPrices] = useState({
    media: 2000,
    pinta: 3000,
    litro: 5000,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const tappedKegs = kegs.filter(
    (k) => k.isTapped && k.status === 'IN_HOUSE' && k.currentVolume !== 0
  );
  const availableKegs = kegs.filter(
    (k) =>
      !k.isTapped &&
      k.status === 'IN_HOUSE' &&
      (k.currentVolume === undefined || k.currentVolume > 0) &&
      !!k.contents
  );

  const handleServe = (
    kegId: string,
    volume: number,
    format: string,
    price: number
  ) => {
    serveFromTap(kegId, volume, format, price);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const renderKegCard = (keg: Keg, isPosMode: boolean = false) => {
    const batch = batches.find((b) => b.id === keg.batchId);
    const currentVol = keg.currentVolume ?? keg.size;
    const percentage = Math.min(
      100,
      Math.max(0, (currentVol / keg.size) * 100)
    );
    const pintasLeft = Math.floor(currentVol / 0.5);

    return (
      <div
        key={keg.id}
        className={`${
          isPosMode
            ? 'bg-[#1a1d21] border-[#2c3138] shadow-2xl'
            : 'bg-white dark:bg-[#1a1d21] border-slate-200 dark:border-[#2c3138]'
        } border rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all`}
      >
        {/* Barra superior de progreso con gradiente Industrial Craft */}
        <div className="fermentation-progress-track h-2 mb-4">
          <div
            className={
              percentage <= 20
                ? 'fermentation-progress-bar fermentation-progress-bar--alert'
                : 'fermentation-progress-bar'
            }
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Canilla Activa
              </span>
              <span className="font-mono text-xs font-bold text-[#f59e0b]">
                #{keg.id}
              </span>
            </div>
            <h3
              className={`font-black font-display tracking-tight ${
                isPosMode
                  ? 'text-white text-2xl sm:text-3xl'
                  : 'text-slate-800 dark:text-white text-lg sm:text-xl'
              }`}
            >
              {keg.contents || 'Cerveza Artesanal'}
            </h3>
            {batch && (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Lote #{batch.lotCode} • {batch.style}
              </p>
            )}
          </div>
          {!isPosMode && (
            <button
              type="button"
              onClick={() => toggleKegTap(keg.id, false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:bg-[#ef4444]/15 hover:text-[#ef4444] rounded-xl border border-transparent hover:border-[#ef4444]/30 transition-colors cursor-pointer"
              title="Despinchar barril de la pizarra"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-5 p-3 rounded-xl bg-slate-50 dark:bg-[#121417] border border-slate-200/80 dark:border-[#2c3138] font-mono">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Droplet size={16} className="text-[#38bdf8] shrink-0" />
            <div>
              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400">
                Restante
              </span>
              <span className="text-xs sm:text-sm font-bold">
                {currentVol.toFixed(1)} L{' '}
                <span className="text-slate-400 text-[11px] font-normal">
                  / {keg.size}L
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <GlassWater size={16} className="text-[#f59e0b] shrink-0" />
            <div>
              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400">
                Rendimiento
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#f59e0b]">
                ~{pintasLeft} pintas
              </span>
            </div>
          </div>
        </div>

        {/* Botonera Táctil POS (>= 48px) */}
        <div
          className={`grid grid-cols-4 gap-2 mt-auto ${
            isPosMode ? 'h-28' : ''
          }`}
        >
          <button
            type="button"
            onClick={() =>
              handleServe(keg.id, 0.33, 'Media Pinta', prices.media)
            }
            className={`min-h-[54px] flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
              isPosMode
                ? 'bg-[#121417] hover:bg-[#22262b] border border-[#2c3138] text-white'
                : 'bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] hover:border-[#d97706] text-slate-800 dark:text-slate-100'
            }`}
          >
            <span
              className={`${
                isPosMode ? 'text-base' : 'text-[10px] uppercase tracking-wider'
              } font-extrabold mb-0.5`}
            >
              Media
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
              ${prices.media}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleServe(keg.id, 0.5, 'Pinta', prices.pinta)}
            className="min-h-[54px] flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white shadow-copper-glow transition-all active:scale-95 cursor-pointer"
          >
            <span
              className={`${
                isPosMode ? 'text-lg' : 'text-[10px] uppercase tracking-wider'
              } font-black mb-0.5`}
            >
              Pinta
            </span>
            <span className="text-[11px] font-mono font-bold text-white/95">
              ${prices.pinta}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleServe(keg.id, 1, 'Litro', prices.litro)}
            className={`min-h-[54px] flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
              isPosMode
                ? 'bg-[#121417] hover:bg-[#22262b] border border-[#2c3138] text-white'
                : 'bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] hover:border-[#d97706] text-slate-800 dark:text-slate-100'
            }`}
          >
            <span
              className={`${
                isPosMode ? 'text-base' : 'text-[10px] uppercase tracking-wider'
              } font-extrabold mb-0.5`}
            >
              Litro
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
              ${prices.litro}
            </span>
          </button>

          <button
            type="button"
            onClick={() => giftFromTap(keg.id, 0.5, 'Pinta')}
            className="min-h-[54px] flex flex-col items-center justify-center p-2 rounded-xl bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 border border-[#0ea5e9]/35 text-[#38bdf8] transition-all active:scale-95 cursor-pointer"
            title="Regalar Pinta (Cortesía)"
          >
            <Gift size={isPosMode ? 22 : 15} className="mb-0.5" />
            <span className="text-[10px] uppercase tracking-wider font-extrabold">
              Cortesía
            </span>
          </button>
        </div>
      </div>
    );
  };

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-[#121417] overflow-y-auto p-6 sm:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-[#1a1d21] p-6 rounded-2xl border border-[#2c3138] shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#f59e0b] flex items-center justify-center">
                <Beer size={28} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
                  Pizarra Taproom BON
                </h1>
                <p className="text-xs font-mono text-slate-400">
                  Modo Punto de Venta (POS Táctil) • {tappedKegs.length}{' '}
                  canilla(s) activa(s)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[48px] px-5 py-2.5 bg-[#22262b] hover:bg-[#2c3138] text-slate-200 hover:text-white border border-[#2c3138] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Minimize size={18} />
              <span>Salir de Pantalla Completa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {tappedKegs.map((keg) => renderKegCard(keg, true))}
            {tappedKegs.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 text-base border border-dashed border-[#2c3138] bg-[#1a1d21]/60 rounded-3xl">
                No hay ningún barril pinchado en canilla. Salí de pantalla completa para pinchar un barril.
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER & CONFIGURACIÓN DE PRECIOS */}
      <div className="bg-white dark:bg-[#1a1d21] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#2c3138]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
              <GlassWater className="text-[#f59e0b]" size={26} />
              Pizarra / Taproom & Eventos
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Despacho rápido de pintas en barra con descuento automático de litros en barril.
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 bg-slate-100 dark:bg-[#22262b] hover:bg-slate-200 dark:hover:bg-[#2c3138] text-slate-800 dark:text-white border border-slate-200 dark:border-[#2c3138] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Plus size={17} className="text-[#f59e0b]" />
              <span>Pinchar Barril</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-copper-glow transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize size={17} />
              <span>Modo POS</span>
            </button>
          </div>
        </div>

        {/* Tarifario de Barra (Monospace Inputs >= 44px) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 dark:bg-[#121417] p-4 rounded-2xl border border-slate-200 dark:border-[#2c3138]">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Precio Media Pinta{' '}
              <span className="font-mono text-slate-400">(330 mL)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f59e0b] font-mono font-bold">
                $
              </span>
              <input
                type="number"
                value={prices.media}
                onChange={(e) =>
                  setPrices({ ...prices, media: Number(e.target.value) })
                }
                className="w-full min-h-[44px] pl-8 pr-3 py-2 bg-white dark:bg-[#1a1d21] border border-slate-200 dark:border-[#2c3138] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#d97706]/60 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Precio Pinta{' '}
              <span className="font-mono text-slate-400">(500 mL)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f59e0b] font-mono font-bold">
                $
              </span>
              <input
                type="number"
                value={prices.pinta}
                onChange={(e) =>
                  setPrices({ ...prices, pinta: Number(e.target.value) })
                }
                className="w-full min-h-[44px] pl-8 pr-3 py-2 bg-white dark:bg-[#1a1d21] border border-slate-200 dark:border-[#2c3138] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#d97706]/60 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Precio Litro / Recarga{' '}
              <span className="font-mono text-slate-400">(1000 mL)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f59e0b] font-mono font-bold">
                $
              </span>
              <input
                type="number"
                value={prices.litro}
                onChange={(e) =>
                  setPrices({ ...prices, litro: Number(e.target.value) })
                }
                className="w-full min-h-[44px] pl-8 pr-3 py-2 bg-white dark:bg-[#1a1d21] border border-slate-200 dark:border-[#2c3138] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#d97706]/60 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Grilla de Canillas Activas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tappedKegs.map((keg) => renderKegCard(keg, false))}

          {/* Tarjeta para Pinchar Nuevo Barril */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="border-2 border-dashed border-slate-200 dark:border-[#2c3138] rounded-2xl p-6 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#f59e0b] hover:border-[#d97706]/60 transition-all min-h-[220px] hover:bg-slate-50 dark:hover:bg-[#121417]/60 group cursor-pointer"
          >
            <div className="w-14 h-14 bg-slate-100 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] rounded-2xl flex items-center justify-center mb-3 group-hover:bg-[#d97706]/15 group-hover:border-[#d97706]/40 group-hover:text-[#f59e0b] transition-colors">
              <Plus size={26} />
            </div>
            <span className="font-extrabold text-sm text-slate-700 dark:text-slate-200 group-hover:text-[#f59e0b]">
              Pinchar Barril en Canilla
            </span>
            <span className="text-xs text-slate-400 mt-1">
              {availableKegs.length} barril(es) lleno(s) en cámara
            </span>
          </button>
        </div>
      </div>

      {/* MODAL PINCHAR BARRIL (ESTÉTICA INDUSTRIAL CRAFT + UNA SOLA MANO) */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-[#2c3138] shrink-0">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Beer className="text-[#f59e0b]" size={20} />
                  <span>Pinchar Barril en Pizarra</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#22262b] transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 shrink-0">
                Seleccioná uno de los barriles llenos en cámara de frío para conectarlo a una canilla activa:
              </p>

              <div className="space-y-2.5 overflow-y-auto pr-0.5 custom-scrollbar flex-1">
                {availableKegs.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-[#121417] border border-dashed border-slate-200 dark:border-[#2c3138] rounded-2xl text-center">
                    <Beer
                      size={28}
                      className="mx-auto mb-2 text-slate-400 opacity-50"
                    />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      No hay barriles llenos disponibles en planta
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Primero llená un barril desde un lote terminado en la pestaña Barriles.
                    </p>
                  </div>
                ) : (
                  availableKegs.map((keg) => {
                    const currentVol = keg.currentVolume ?? keg.size;
                    return (
                      <button
                        key={keg.id}
                        type="button"
                        onClick={() => {
                          toggleKegTap(keg.id, true);
                          setIsModalOpen(false);
                        }}
                        className="w-full min-h-[60px] text-left p-3.5 rounded-xl bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] hover:border-[#d97706] dark:hover:border-[#f59e0b] hover:bg-amber-50/30 dark:hover:bg-[#22262b] transition-all flex justify-between items-center gap-3 group cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#f59e0b]">
                              #{keg.id}
                            </span>
                            <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                              {keg.contents || 'Cerveza'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            Ubicación: {keg.currentLocation} • Disponible:{' '}
                            <strong className="text-[#10b981]">
                              {currentVol} L / {keg.size} L
                            </strong>
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30 flex items-center justify-center group-hover:bg-[#d97706] group-hover:text-white transition-colors shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex gap-3 pt-4 mt-5 border-t border-slate-200 dark:border-[#2c3138] shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
