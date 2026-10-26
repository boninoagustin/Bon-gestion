import React, { useState } from 'react';
import {
  Trash2,
  Milk,
  History,
  DollarSign,
  Filter,
  Gift,
  AlertTriangle,
} from 'lucide-react';
import { useBreweryStore } from '../context/store';
import {
  BottleStockModal,
  BottleModalMode,
} from './packaging/BottleStockModal';

export const BottleStockView: React.FC = React.memo(() => {
  const bottles = useBreweryStore((s) => s.bottles);
  const [modalMode, setModalMode] = useState<BottleModalMode>('NONE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  const openSellModal = (id: string) => {
    setSelectedId(id);
    setModalMode('SELL');
  };

  const openGiftModal = (id: string) => {
    setSelectedId(id);
    setModalMode('GIFT');
  };

  const openDeleteModal = (id: string) => {
    setSelectedId(id);
    setModalMode('DELETE');
  };

  const closeModal = () => {
    setModalMode('NONE');
    setSelectedId(null);
  };

  const totalBottles = bottles.reduce((acc, curr) => acc + curr.quantity, 0);
  const groupedByFormat = bottles.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.format] = (acc[item.format] || 0) + item.quantity;
      return acc;
    },
    {}
  );
  const visibleBottles = showLowOnly
    ? bottles.filter((b) => b.quantity < 12)
    : bottles;

  return (
    <div className="space-y-6 pb-20">
      <BottleStockModal
        mode={modalMode}
        selectedId={selectedId}
        onClose={closeModal}
      />

      {/* HEADER & FILTROS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#1a1d21] p-6 rounded-2xl border border-slate-200 dark:border-[#2c3138] shadow-sm">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <Milk className="text-[#f59e0b]" size={26} />
            Stock de Botellas y Latas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Inventario fraccionado listo para venta directa, entregas y cortesías.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowLowOnly((v) => !v)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
              showLowOnly
                ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40 shadow-sm'
                : 'bg-slate-50 dark:bg-[#121417] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c3138] hover:border-[#f59e0b]/50'
            }`}
          >
            <Filter size={15} />
            <span>
              {showLowOnly ? 'Mostrando bajo stock (<12)' : 'Filtrar bajo stock'}
            </span>
          </button>
          <div className="min-h-[44px] flex items-center bg-[#d97706]/15 text-[#f59e0b] px-4 py-2 rounded-xl text-xs font-mono font-extrabold border border-[#d97706]/30">
            Total: {totalBottles} u.
          </div>
        </div>
      </div>

      {/* RESUMEN POR FORMATO */}
      {Object.keys(groupedByFormat).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(groupedByFormat).map(([format, qty]) => (
            <span
              key={format}
              className="text-xs px-3.5 py-2 rounded-xl bg-white dark:bg-[#1a1d21] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2c3138] shadow-sm font-medium flex items-center gap-2"
            >
              <span>{format}:</span>
              <strong className="font-mono font-bold text-[#f59e0b]">
                {qty} u.
              </strong>
            </span>
          ))}
        </div>
      )}

      {/* LISTADO DE LOTES EMBOTELLADOS */}
      <div className="grid grid-cols-1 gap-3.5">
        {visibleBottles.length === 0 ? (
          <div className="text-center py-14 bg-white dark:bg-[#1a1d21] rounded-2xl border border-dashed border-slate-200 dark:border-[#2c3138]">
            <div className="w-14 h-14 rounded-2xl bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30 flex items-center justify-center mx-auto mb-3">
              <Milk size={28} />
            </div>
            <p className="text-slate-800 dark:text-white font-extrabold text-base">
              No hay botellas ni latas en stock
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Podés fraccionar botellas o latas directamente desde un barril lleno en la pestaña Barriles.
            </p>
          </div>
        ) : (
          visibleBottles.map((item) => {
            const isLowStock = item.quantity < 12;
            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-[#1a1d21] p-5 rounded-2xl shadow-sm border-l-4 ${
                  isLowStock ? 'border-l-[#ef4444]' : 'border-l-[#10b981]'
                } border-y border-r border-slate-200 dark:border-y-[#2c3138] dark:border-r-[#2c3138] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md group`}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-13 h-13 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#121417] text-[#f59e0b] border border-slate-200 dark:border-[#2c3138] flex items-center justify-center shrink-0">
                    <Milk size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold font-display text-slate-800 dark:text-white text-base sm:text-lg">
                        {item.style}
                      </h3>
                      {isLowStock && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
                          <AlertTriangle size={11} /> Bajo Stock
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="bg-slate-100 dark:bg-[#121417] px-2.5 py-0.5 rounded-lg font-mono font-bold border border-slate-200 dark:border-[#2c3138] text-slate-700 dark:text-slate-200">
                        {item.format}
                      </span>
                      {item.lotCode && (
                        <span className="font-mono text-[11px] text-[#f59e0b]">
                          Lote #{item.lotCode}
                        </span>
                      )}
                      {item.notes && (
                        <span className="italic truncate max-w-[180px] sm:max-w-xs">
                          • {item.notes}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-1.5">
                      <History size={12} /> Envasado: {item.packagedDate}
                    </div>
                  </div>
                </div>

                {/* CONTADOR MONOSPACE + BOTONES TÁCTILES (>= 44x44px) */}
                <div className="flex items-center justify-between w-full md:w-auto gap-5 border-t border-slate-100 dark:border-[#2c3138] md:border-t-0 pt-3.5 md:pt-0">
                  <div className="text-left md:text-right flex flex-col">
                    <span
                      className={`block text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none ${
                        isLowStock
                          ? 'text-[#ef4444]'
                          : 'text-slate-800 dark:text-white'
                      }`}
                    >
                      {item.quantity}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">
                      Unidades
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSellModal(item.id)}
                      className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
                      title="Registrar Venta de Botellas"
                    >
                      <DollarSign size={16} />
                      <span>Vender</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openGiftModal(item.id)}
                      className="min-h-[44px] min-w-[44px] px-3 bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 text-[#38bdf8] border border-[#0ea5e9]/35 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      title="Registrar Regalo / Cortesía"
                    >
                      <Gift size={17} />
                      <span className="hidden sm:inline">Cortesía</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(item.id)}
                      className="min-h-[44px] min-w-[44px] bg-slate-100 dark:bg-[#22262b] text-slate-400 hover:bg-[#ef4444]/15 hover:text-[#ef4444] border border-slate-200 dark:border-[#2c3138] hover:border-[#ef4444]/30 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                      title="Eliminar Registro de Stock"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});