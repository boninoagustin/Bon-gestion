import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  AlertTriangle,
  Truck,
  RotateCcw,
  Droplets,
  CheckCircle2,
  Plus,
  Beer,
  Pencil,
  Milk,
  Sparkles,
  Filter,
} from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Keg } from '../types';
import { KegTrackingModal, KegModalMode } from './packaging/KegTrackingModal';
import {
  getKegDaysOut,
  getKegFillPercentage,
  isKegLate,
} from '../lib/packaging';

export const KegTracking: React.FC = React.memo(() => {
  const kegs = useBreweryStore((s) => s.kegs);
  const updateKeg = useBreweryStore((s) => s.updateKeg);

  const [modalMode, setModalMode] = useState<KegModalMode>('NONE');
  const [selectedKegId, setSelectedKegId] = useState<string | null>(null);
  const [showOnlyLate, setShowOnlyLate] = useState(false);

  const openCreateModal = () => {
    setSelectedKegId(null);
    setModalMode('CREATE');
  };
  const openEditModal = (keg: Keg) => {
    setSelectedKegId(keg.id);
    setModalMode('EDIT');
  };
  const openFillModal = (keg: Keg) => {
    setSelectedKegId(keg.id);
    setModalMode('FILL');
  };
  const openBottleModal = (keg: Keg) => {
    setSelectedKegId(keg.id);
    setModalMode('BOTTLE');
  };
  const openDispatchModal = (keg: Keg) => {
    setSelectedKegId(keg.id);
    setModalMode('DISPATCH');
  };
  const openReceiveModal = (keg: Keg) => {
    setSelectedKegId(keg.id);
    setModalMode('RECEIVE');
  };
  const closeModal = () => {
    setModalMode('NONE');
    setSelectedKegId(null);
  };

  const handleClean = (id: string) => {
    updateKeg(id, {
      status: 'IN_HOUSE',
      currentLocation: 'Cámara de Frío',
      currentVolume: undefined,
      dispatchedPrice: undefined,
    });
  };

  const inHouseKegs = kegs.filter((k) => k.status === 'IN_HOUSE');
  const withClientKegs = kegs.filter((k) => k.status === 'WITH_CLIENT');
  const dirtyKegs = kegs.filter((k) => k.status === 'DIRTY');
  const lateKegs = withClientKegs.filter((k) => isKegLate(k));
  const avgDaysOut =
    withClientKegs.length > 0
      ? Math.round(
          withClientKegs.reduce((sum, k) => sum + getKegDaysOut(k), 0) /
            withClientKegs.length
        )
      : 0;
  const displayWithClient = showOnlyLate ? lateKegs : withClientKegs;

  const renderKegCard = (keg: Keg) => {
    const isWithClient = keg.status === 'WITH_CLIENT';
    const isDirty = keg.status === 'DIRTY';
    const isInHouse = keg.status === 'IN_HOUSE';
    const currentVol =
      keg.currentVolume !== undefined ? keg.currentVolume : keg.size;
    const fillPercentage = getKegFillPercentage(keg);
    const daysOut = getKegDaysOut(keg);
    const isLate = isKegLate(keg);

    let borderColor = 'border-l-[#10b981]';
    let badgeBg = 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30';
    let badgeText = keg.contents ? 'Lleno en Cámara' : 'Limpio / Vacío';

    if (isDirty) {
      borderColor = 'border-l-[#f59e0b]';
      badgeBg = 'bg-[#d97706]/15 text-[#f59e0b] border-[#d97706]/30';
      badgeText = 'Sucio (CIP Pendiente)';
    } else if (isWithClient) {
      if (isLate) {
        borderColor = 'border-l-[#ef4444]';
        badgeBg = 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30';
        badgeText = 'Demorado en Cliente';
      } else {
        borderColor = 'border-l-[#0ea5e9]';
        badgeBg = 'bg-[#0ea5e9]/15 text-[#38bdf8] border-[#0ea5e9]/30';
        badgeText = 'Entregado a Cliente';
      }
    }

    return (
      <div
        key={keg.id}
        className={`bg-white dark:bg-[#1a1d21] p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} border-y border-r border-slate-200 dark:border-y-[#2c3138] dark:border-r-[#2c3138] flex flex-col justify-between relative group transition-all hover:shadow-md`}
      >
        {/* Botón Editar Barril (Ergonomía táctil >= 44x44px, estética Industrial Craft) */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => openEditModal(keg)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-[#f59e0b] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#22262b] rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-[#2c3138] transition cursor-pointer"
            title="Editar Barril"
          >
            <Pencil size={17} />
          </button>
        </div>

        <div>
          <div className="flex items-start justify-between mb-2.5 pr-12">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg text-slate-800 dark:text-white tracking-tight">
                  #{keg.id}
                </span>
                <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-[#121417] px-2.5 py-0.5 rounded-lg text-[#f59e0b] border border-slate-200 dark:border-[#2c3138]">
                  {keg.size} L
                </span>
                {isLate && isWithClient && (
                  <span className="bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={11} /> Atrasado
                  </span>
                )}
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeBg}`}
                >
                  {badgeText}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#121417]/80 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-[#2c3138]">
              <MapPin
                size={15}
                className={`shrink-0 ${
                  isWithClient ? 'text-[#38bdf8]' : 'text-[#f59e0b]'
                }`}
              />
              <span className="font-bold truncate">{keg.currentLocation}</span>
            </div>

            {isInHouse && (
              <div className="bg-slate-50 dark:bg-[#121417] p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138] space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Contenido
                  </span>
                  <span
                    className={`font-extrabold ${
                      keg.contents
                        ? 'text-slate-800 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500 italic'
                    }`}
                  >
                    {keg.contents || 'Vacío (Sanitizado)'}
                  </span>
                </div>

                {keg.contents && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-[#2c3138]">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-slate-400">Volumen actual</span>
                      <span
                        className={`font-bold ${
                          fillPercentage < 20
                            ? 'text-[#ef4444]'
                            : 'text-[#f59e0b]'
                        }`}
                      >
                        {currentVol.toFixed(1)} L / {keg.size} L (
                        {Math.round(fillPercentage)}%)
                      </span>
                    </div>
                    <div className="fermentation-progress-track h-2">
                      <div
                        className={
                          fillPercentage < 20
                            ? 'fermentation-progress-bar fermentation-progress-bar--alert'
                            : 'fermentation-progress-bar'
                        }
                        style={{
                          width: `${Math.min(100, Math.max(0, fillPercentage))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {isDirty && (
              <div className="bg-[#d97706]/10 p-3 rounded-xl border border-[#d97706]/30 flex items-center gap-2.5 text-xs text-[#f59e0b] font-bold">
                <Droplets size={16} className="shrink-0" />
                <span>Pendiente de lavado y sanitización CIP</span>
              </div>
            )}

            {isWithClient && (
              <div className="bg-slate-50 dark:bg-[#121417] p-3 rounded-xl border border-slate-200 dark:border-[#2c3138] flex items-center justify-between text-xs font-mono">
                <div
                  className={`flex items-center gap-1.5 ${
                    isLate
                      ? 'text-[#ef4444] font-bold'
                      : 'text-slate-600 dark:text-slate-300 font-semibold'
                  }`}
                >
                  <Clock size={14} />
                  <span>Hace {daysOut} días</span>
                </div>
                {keg.dispatchedPrice !== undefined && keg.dispatchedPrice > 0 && (
                  <span className="text-[#10b981] font-bold">
                    ${keg.dispatchedPrice.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTONES DE ACCIÓN TÁCTIL (>= 44x44px) CON ESTÉTICA INDUSTRIAL CRAFT */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-[#2c3138] flex flex-col gap-2">
          {isInHouse && !keg.contents && (
            <button
              type="button"
              onClick={() => openFillModal(keg)}
              className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
            >
              <Beer size={16} />
              <span>Llenar Barril</span>
            </button>
          )}

          {isInHouse && keg.contents && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openFillModal(keg)}
                  className="min-h-[44px] py-2 px-3 bg-slate-100 dark:bg-[#22262b] hover:bg-slate-200 dark:hover:bg-[#2c3138] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#2c3138] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Beer size={15} className="text-[#f59e0b]" />
                  <span>Recargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => openBottleModal(keg)}
                  className="min-h-[44px] py-2 px-3 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Milk size={15} />
                  <span>Embotellar</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => openDispatchModal(keg)}
                className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
              >
                <Truck size={16} />
                <span>Despachar a Cliente</span>
              </button>
            </>
          )}

          {isWithClient && (
            <button
              type="button"
              onClick={() => openReceiveModal(keg)}
              className="w-full min-h-[44px] py-2.5 bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 text-[#38bdf8] border border-[#0ea5e9]/35 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Recibir en Planta</span>
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={() => handleClean(keg.id)}
              className="w-full min-h-[44px] py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-hop-glow transition-all active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>Marcar Limpio (CIP)</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 relative">
      <KegTrackingModal
        mode={modalMode}
        selectedKegId={selectedKegId}
        onClose={closeModal}
        onDeleteClick={() => setModalMode('DELETE')}
      />

      {/* HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <Beer className="text-[#f59e0b]" size={26} />
            Gestión de Barriles
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control de flota, llenado desde tanque, despacho comercial y trazabilidad de retorno.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowOnlyLate((v) => !v)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
              showOnlyLate
                ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40 shadow-sm'
                : 'bg-white dark:bg-[#1a1d21] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c3138] hover:border-[#f59e0b]/50'
            }`}
          >
            <Filter size={15} />
            <span>
              {showOnlyLate ? 'Mostrando atrasados' : 'Filtrar atrasados'}
            </span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>Nuevo Barril</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1a1d21] rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#10b981] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            En Planta
          </p>
          <p className="text-2xl font-black font-mono text-slate-800 dark:text-white mt-1">
            {inHouseKegs.length}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            {inHouseKegs.filter((k) => !!k.contents).length} llenos •{' '}
            {inHouseKegs.filter((k) => !k.contents).length} vacíos
          </p>
        </div>

        <div className="bg-white dark:bg-[#1a1d21] rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#38bdf8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
            Con Cliente
          </p>
          <p className="text-2xl font-black font-mono text-slate-800 dark:text-white mt-1">
            {withClientKegs.length}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            En bares y puntos de venta
          </p>
        </div>

        <div className="bg-white dark:bg-[#1a1d21] rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#ef4444] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            Atrasados (&gt;14d)
          </p>
          <p className="text-2xl font-black font-mono text-[#ef4444] mt-1">
            {lateKegs.length}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            {lateKegs.length === 0 ? 'Retornos al día' : 'Reclamar devolución'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1a1d21] rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#f59e0b]">
            Rotación Promedio
          </p>
          <p className="text-2xl font-black font-mono text-slate-800 dark:text-white mt-1">
            {avgDaysOut}d
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            {dirtyKegs.length} pendientes de CIP
          </p>
        </div>
      </div>

      {/* KANBAN 3 COLUMNAS DE BARRILES */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-slate-50/70 dark:bg-[#1a1d21]/60 rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2c3138]">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              En Planta ({inHouseKegs.length})
            </h3>
          </div>
          {inHouseKegs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-[#2c3138] rounded-xl">
              <Sparkles size={22} className="mx-auto mb-2 opacity-40" />
              No hay barriles disponibles en planta.
            </div>
          ) : (
            <div className="space-y-3">{inHouseKegs.map(renderKegCard)}</div>
          )}
        </div>

        <div className="bg-slate-50/70 dark:bg-[#1a1d21]/60 rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2c3138]">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
              Con Cliente ({displayWithClient.length})
            </h3>
          </div>
          {displayWithClient.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-[#2c3138] rounded-xl">
              <Truck size={22} className="mx-auto mb-2 opacity-40" />
              No hay barriles entregados a clientes.
            </div>
          ) : (
            <div className="space-y-3">
              {displayWithClient.map(renderKegCard)}
            </div>
          )}
        </div>

        <div className="bg-slate-50/70 dark:bg-[#1a1d21]/60 rounded-2xl border border-slate-200 dark:border-[#2c3138] p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2c3138]">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              Pendientes de Lavado ({dirtyKegs.length})
            </h3>
          </div>
          {dirtyKegs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-[#2c3138] rounded-xl">
              <CheckCircle2 size={22} className="mx-auto mb-2 opacity-40" />
              Todos los barriles están limpios.
            </div>
          ) : (
            <div className="space-y-3">{dirtyKegs.map(renderKegCard)}</div>
          )}
        </div>
      </div>
    </div>
  );
});