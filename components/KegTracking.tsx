import React, { useState, useEffect } from 'react';
import { MapPin, Clock, AlertTriangle, Truck, RotateCcw, Droplets, CheckCircle2, Plus, Beer, X, Pencil, Trash2, Save, Factory, Milk, DollarSign, Package, Calculator, Users, CreditCard } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Keg, BatchStatus } from '../types';
import { KegTrackingModal, KegModalMode } from './packaging/KegTrackingModal';
import { getKegDaysOut, getKegFillPercentage, isKegLate } from '../lib/packaging';

export const KegTracking: React.FC = React.memo(() => {
  const kegs = useBreweryStore(s => s.kegs);
  const updateKeg = useBreweryStore(s => s.updateKeg);
  
  const [modalMode, setModalMode] = useState<KegModalMode>('NONE');
  const [selectedKegId, setSelectedKegId] = useState<string | null>(null);
  const [showOnlyLate, setShowOnlyLate] = useState(false);

  const openCreateModal = () => { setModalMode('CREATE'); };
  const openEditModal = (keg: Keg) => { setSelectedKegId(keg.id); setModalMode('EDIT'); };
  const openFillModal = (keg: Keg) => { setSelectedKegId(keg.id); setModalMode('FILL'); };
  const openBottleModal = (keg: Keg) => { setSelectedKegId(keg.id); setModalMode('BOTTLE'); }
  const openDispatchModal = (keg: Keg) => { setSelectedKegId(keg.id); setModalMode('DISPATCH'); };
  const openReceiveModal = (keg: Keg) => { setSelectedKegId(keg.id); setModalMode('RECEIVE'); };
  const closeModal = () => { setModalMode('NONE'); setSelectedKegId(null); };
  
  const handleClean = (id: string) => { updateKeg(id, { status: 'IN_HOUSE', currentLocation: 'Cámara de Frío', currentVolume: undefined, dispatchedPrice: undefined }); };
  const inHouseKegs = kegs.filter(k => k.status === 'IN_HOUSE');
  const withClientKegs = kegs.filter(k => k.status === 'WITH_CLIENT');
  const dirtyKegs = kegs.filter(k => k.status === 'DIRTY');
  const lateKegs = withClientKegs.filter(k => isKegLate(k));
  const avgDaysOut = withClientKegs.length > 0
    ? Math.round(withClientKegs.reduce((sum, k) => sum + getKegDaysOut(k), 0) / withClientKegs.length)
    : 0;
  const displayWithClient = showOnlyLate ? lateKegs : withClientKegs;

  const renderKegCard = (keg: Keg) => {
    const isWithClient = keg.status === 'WITH_CLIENT';
    const isDirty = keg.status === 'DIRTY';
    const isInHouse = keg.status === 'IN_HOUSE';
    const currentVol = keg.currentVolume !== undefined ? keg.currentVolume : keg.size;
    const fillPercentage = getKegFillPercentage(keg);
    const daysOut = getKegDaysOut(keg);
    const isLate = isKegLate(keg);

    let borderColor = 'border-l-green-500';
    if (isDirty) borderColor = 'border-l-amber-500';
    if (isWithClient) borderColor = isLate ? 'border-l-red-500' : 'border-l-zinc-800 dark:border-l-slate-400';

    return (
      <div key={keg.id} className={`bg-white dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} border-y border-r border-slate-200 dark:border-y-zinc-800/80 dark:border-r-zinc-800/80 flex flex-col justify-between relative group transition-all hover:shadow-md`}>
        <button onClick={() => openEditModal(keg)} className="absolute top-3 right-3 p-2 text-slate-300 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"><Pencil size={16} /></button>
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2"><div className="font-mono font-bold text-lg text-slate-700 dark:text-slate-100">#{keg.id}</div>{isLate && isWithClient && <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={10} /> LENTO</span>}</div>
            <div className="text-xs bg-slate-100 dark:bg-zinc-800/80 px-2 py-1 rounded-lg font-medium text-slate-600 dark:text-slate-300 mr-8 border border-transparent dark:border-zinc-700/50">{keg.size} L</div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><MapPin size={16} className={`mt-0.5 shrink-0 ${isWithClient ? 'text-zinc-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} /><span className="font-medium">{keg.currentLocation}</span></div>
            {isInHouse && (
              <div className="ml-6">
                <div className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700/50 text-slate-500 dark:text-slate-400 text-xs w-full mb-2">Contenido: <span className={`font-bold ${keg.contents ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{keg.contents || 'Vacío'}</span></div>
                {keg.contents && (<><div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden mb-1"><div className={`h-full rounded-full transition-all duration-500 ${fillPercentage < 20 ? 'bg-red-500' : 'bg-copper'}`} style={{ width: `${fillPercentage}%` }}></div></div><div className="text-[10px] text-right text-slate-400 dark:text-slate-500 font-mono">{currentVol.toFixed(1)}L / {keg.size}L</div></>)}
              </div>
            )}
            {isDirty && <div className="text-sm text-amber-600 dark:text-amber-500 ml-6 flex items-center gap-2 font-medium"><Droplets size={14} /> Pendiente Lavado</div>}
            {isWithClient && (<div className="ml-6 space-y-1"><div className={`flex items-center gap-2 text-sm ${isLate ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}><Clock size={16} /><span>Hace {daysOut} días</span></div>{keg.dispatchedPrice && <div className="text-xs font-mono text-slate-500 dark:text-slate-400">Valor: ${keg.dispatchedPrice}</div>}</div>)}
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-1 gap-2">
          {isInHouse && !keg.contents && (
            <button onClick={() => openFillModal(keg)} className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><Beer size={16} /> Llenar</button>
          )}
          {isInHouse && keg.contents && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openFillModal(keg)} className="py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><Beer size={16} /> Editar</button>
              <button onClick={() => openBottleModal(keg)} className="py-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 border border-transparent dark:border-green-800/30 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><Milk size={16} /> Botellas</button>
            </div>
          )}
          {isInHouse && keg.contents && <button onClick={() => openDispatchModal(keg)} className="w-full py-2 bg-zinc-800 dark:bg-slate-900 hover:bg-zinc-700 dark:hover:bg-slate-800 text-white dark:text-slate-200 border border-transparent dark:border-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><Truck size={16} /> Despachar</button>}
          {isWithClient && <button onClick={() => openReceiveModal(keg)} className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white dark:text-slate-100 border border-transparent dark:border-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><RotateCcw size={16} /> Recibir</button>}
          {isDirty && <button onClick={() => handleClean(keg.id)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"><CheckCircle2 size={16} /> Marcar Limpio</button>}
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Gestión de Barriles</h2><p className="text-sm text-slate-500 dark:text-slate-400">Control de flota y rotación</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOnlyLate(v => !v)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${showOnlyLate ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40' : 'bg-white text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
            {showOnlyLate ? 'Mostrando atrasados' : 'Filtrar atrasados'}
          </button>
          <button onClick={openCreateModal} className="bg-slate-dark dark:bg-copper-dark hover:bg-slate-700 dark:hover:bg-copper text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"><Plus size={18} /> Nuevo Barril</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-500">En planta</p>
          <p className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">{inHouseKegs.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-500">Con cliente</p>
          <p className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">{withClientKegs.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-500">Atrasados</p>
          <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{lateKegs.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-500">Rotación prom.</p>
          <p className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">{avgDaysOut}d</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">En planta ({inHouseKegs.length})</h3>
          <div className="space-y-3">{inHouseKegs.map(renderKegCard)}</div>
        </div>
        <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Con cliente ({displayWithClient.length})</h3>
          <div className="space-y-3">{displayWithClient.map(renderKegCard)}</div>
        </div>
        <div className="bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Pendientes de lavado ({dirtyKegs.length})</h3>
          <div className="space-y-3">{dirtyKegs.map(renderKegCard)}</div>
        </div>
      </div>
    </div>
  );
});