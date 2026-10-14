import React, { useState } from 'react';
import { Trash2, Milk, History, DollarSign, Filter, Gift } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { BottleStockModal, BottleModalMode } from './packaging/BottleStockModal';

type ModalMode = 'SELL' | 'DELETE' | 'NONE';

export const BottleStockView: React.FC = React.memo(() => {
  const bottles = useBreweryStore(s => s.bottles);
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
  const groupedByFormat = bottles.reduce<Record<string, number>>((acc, item) => {
    acc[item.format] = (acc[item.format] || 0) + item.quantity;
    return acc;
  }, {});
  const visibleBottles = showLowOnly ? bottles.filter(b => b.quantity < 12) : bottles;

  return (
    <div className="space-y-6 pb-20">
      <BottleStockModal 
        mode={modalMode} 
        selectedId={selectedId} 
        onClose={closeModal} 
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white dark:bg-zinc-900/40 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Milk className="text-copper" size={24} />
            Stock de Botellas / Latas
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Inventario de producto terminado listo para la venta</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowLowOnly(v => !v)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${showLowOnly ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
            <Filter size={14} /> {showLowOnly ? 'Mostrando bajo stock' : 'Filtrar bajo stock'}
          </button>
          <div className="bg-copper/10 text-copper-dark dark:text-copper px-4 py-2 rounded-xl text-sm border border-copper/20 font-bold shadow-sm">
            Total: {totalBottles} u.
          </div>
        </div>
      </div>

      {Object.keys(groupedByFormat).length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {Object.entries(groupedByFormat).map(([format, qty]) => (
            <span key={format} className="text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 shadow-sm font-medium">
              {format}: <strong className="text-copper dark:text-copper-light ml-1">{qty}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
          {visibleBottles.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm"><Milk size={48} className="mx-auto mb-4 opacity-20 text-slate-400 dark:text-zinc-500" /><p className="text-slate-500 dark:text-zinc-400 font-medium">No hay botellas en stock</p></div>
          ) : (
              visibleBottles.map(item => (
                  <div key={item.id} className="bg-white dark:bg-zinc-900/60 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md dark:hover:border-zinc-700 group">
                      <div className="flex items-center gap-5 w-full md:w-auto">
                          <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl text-slate-400 dark:text-zinc-500 border border-slate-100 dark:border-zinc-700/50 group-hover:text-copper group-hover:bg-copper/5 dark:group-hover:bg-copper/10 transition-colors"><Milk size={28} /></div>
                          <div>
                              <h3 className="font-bold font-display text-slate-800 dark:text-zinc-100 text-lg sm:text-xl group-hover:text-copper dark:group-hover:text-copper-light transition-colors">{item.style}</h3>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                  <span className="bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md font-mono border border-slate-200 dark:border-zinc-700/80 font-medium text-slate-700 dark:text-zinc-300">{item.format}</span>
                                  {item.notes && <span className="italic truncate max-w-[150px] sm:max-w-xs">• {item.notes}</span>}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 mt-2 font-medium">
                                  <History size={12} /> {item.packagedDate}
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center justify-between w-full md:w-auto gap-6 md:gap-8 border-t border-slate-100 dark:border-zinc-800/80 md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
                          <div className="text-left md:text-right flex flex-col">
                              <span className={`block text-3xl font-bold font-mono tracking-tight leading-none ${item.quantity < 12 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-zinc-100'}`}>{item.quantity}</span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider mt-1">Stock</span>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => openSellModal(item.id)} className="w-11 h-11 md:w-auto md:px-5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 flex items-center justify-center font-bold text-sm transition-all shadow-sm" title="Registrar Venta"><DollarSign size={20} className="md:mr-1.5"/> <span className="hidden md:inline">Vender</span></button>
                              <button onClick={() => openGiftModal(item.id)} className="w-11 h-11 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center justify-center font-bold text-sm transition-all shadow-sm" title="Registrar Regalo"><Gift size={20} /></button>
                              <button onClick={() => openDeleteModal(item.id)} className="w-11 h-11 bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 rounded-xl border border-slate-200 dark:border-zinc-700/80 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/20 flex items-center justify-center transition-all shadow-sm" title="Eliminar Lote"><Trash2 size={18} /></button>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>
    </div>
  );
});