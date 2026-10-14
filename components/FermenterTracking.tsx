import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Droplets, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, 
  Clock, Beer, X, Save, Sparkles, Filter, Search, RotateCcw,
  Cylinder, Flame, ThermometerSnowflake, Activity
} from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Fermenter, FermenterStatus, Batch, BatchStatus } from '../types';
import { assignmentError, runFormAction, tankEditError, tankFill } from './production/fermenterUi';
import { DebouncedInput } from './ui/DebouncedInput';

export const FermenterTracking: React.FC = React.memo(() => {
  const fermenters = useBreweryStore(s => s.fermenters);
  const batches = useBreweryStore(s => s.batches);
  const addFermenter = useBreweryStore(s => s.addFermenter);
  const updateFermenter = useBreweryStore(s => s.updateFermenter);
  const deleteFermenter = useBreweryStore(s => s.deleteFermenter);
  const cleanFermenter = useBreweryStore(s => s.cleanFermenter);
  const markFermenterDirty = useBreweryStore(s => s.markFermenterDirty);
  const releaseFermenter = useBreweryStore(s => s.releaseFermenter);
  const assignBatchToFermenter = useBreweryStore(s => s.assignBatchToFermenter);

  const [formError, setFormError] = useState('');
  const act = (action: () => void, success?: () => void) => runFormAction(action, setFormError, success);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'ALL' | FermenterStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [modalMode, setModalMode] = useState<'NONE' | 'CREATE' | 'EDIT' | 'DELETE' | 'ASSIGN'>('NONE');
  const [selectedFermenterSnapshot, setSelectedFermenter] = useState<Fermenter | null>(null);
  const selectedFermenter = fermenters.find(f => f.id === selectedFermenterSnapshot?.id) ?? null;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    capacity: 300,
    status: 'AVAILABLE' as FermenterStatus,
    notes: ''
  });
  const [selectedBatchToAssign, setSelectedBatchToAssign] = useState<string>('');

  // Estadísticas
  const totalTanks = fermenters.length;
  const totalCapacityLiters = fermenters.reduce((acc, f) => acc + (f.capacity || 0), 0);
  const availableTanks = fermenters.filter(f => f.status === 'AVAILABLE');
  const occupiedTanks = fermenters.filter(f => f.status === 'OCCUPIED');
  const dirtyTanks = fermenters.filter(f => f.status === 'DIRTY');

  // Lotes sin fermentador asignado o activos
  const activeUnassignedBatches = batches.filter(
    b => !assignmentError(fermenters.find(f => f.id === selectedFermenter?.id), b) && (!b.fermenterId || b.fermenterId === selectedFermenter?.id)
  );

  const openCreateModal = () => {
    setFormError('');
    const nextNum = fermenters.length + 1;
    setFormData({
      name: `Fermentador ${nextNum}`,
      capacity: 300,
      status: 'AVAILABLE',
      notes: ''
    });
    setSelectedFermenter(null);
    setModalMode('CREATE');
  };

  const openEditModal = (f: Fermenter) => {
    setFormError('');
    setSelectedFermenter(f);
    setFormData({
      name: f.name,
      capacity: f.capacity,
      status: f.status,
      notes: f.notes || ''
    });
    setModalMode('EDIT');
  };

  const openAssignModal = (f: Fermenter) => {
    setFormError('');
    setSelectedFermenter(f);
    setSelectedBatchToAssign(f.currentBatchId || '');
    setModalMode('ASSIGN');
  };

  const closeModal = () => {
    setFormError('');
    setModalMode('NONE');
    setSelectedFermenter(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim()) return setFormError('Ingresa un nombre.');
    const current = fermenters.find(f => f.id === selectedFermenter?.id);
    const error = tankEditError(current, formData.status, Number(formData.capacity), batches);
    if (error) return setFormError(error);
    act(() => {

    if (modalMode === 'CREATE') {
      addFermenter({
        name: formData.name.trim(),
        capacity: Number(formData.capacity),
        status: formData.status,
        notes: formData.notes.trim()
      });
    } else if (modalMode === 'EDIT' && selectedFermenter) {
      updateFermenter(selectedFermenter.id, {
        name: formData.name.trim(),
        capacity: Number(formData.capacity),
        status: formData.status,
        notes: formData.notes.trim()
      });
    }
    }, closeModal);
  };

  const handleConfirmAssign = () => {
    if (!selectedFermenter || !selectedBatchToAssign) return;
    const batch = batches.find(b => b.id === selectedBatchToAssign);
    const error = batch ? assignmentError(fermenters.find(f => f.id === selectedFermenter.id), batch) : 'El lote ya no existe.';
    if (error) return setFormError(error);
    act(() => assignBatchToFermenter(selectedFermenter.id, selectedBatchToAssign), closeModal);
  };

  const handleDelete = () => {
    if (!selectedFermenter) return;
    act(() => deleteFermenter(selectedFermenter.id), closeModal);
  };

  // Filtrado de lista
  const filteredFermenters = fermenters.filter(f => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const linkedBatch = batches.find(b => b.id === f.currentBatchId);
      const batchName = linkedBatch?.recipeName.toLowerCase() || '';
      const lotCode = linkedBatch?.lotCode.toLowerCase() || '';
      return f.name.toLowerCase().includes(term) || batchName.includes(term) || lotCode.includes(term);
    }
    return true;
  });

  const getDaysInFermenter = (batch?: Batch) => {
    if (!batch || !batch.brewDate) return null;
    const start = new Date(batch.brewDate).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="space-y-6 pb-20 relative">
      {formError && modalMode === 'NONE' && <p role="alert" className="text-red-600">{formError}</p>}
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Droplets className="text-copper" size={26} />
            Gestión de Fermentadores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control de flota de tanques, capacidad, ocupación y sanitización (CIP).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-copper hover:bg-copper/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-copper/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Fermentador</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Tanques */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Capacidad Instalada</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800 dark:text-white font-display">{totalTanks}</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">tanques</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono font-medium">{totalCapacityLiters.toLocaleString()} L totales</p>
        </div>

        {/* Disponibles / Limpios */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
          className={`bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'AVAILABLE' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-zinc-800/80 hover:border-emerald-500/50'
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Disponibles (Limpios)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">{availableTanks.length}</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">tanques</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono font-medium">
            {availableTanks.reduce((sum, f) => sum + (f.capacity || 0), 0).toLocaleString()} L listos para inocular
          </p>
        </div>

        {/* Ocupados / En Fermentación */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
          className={`bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'OCCUPIED' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-zinc-800/80 hover:border-blue-500/50'
          }`}
        >
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            En Fermentación
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-display">{occupiedTanks.length}</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">ocupados</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono font-medium">
            {occupiedTanks.reduce((sum, f) => sum + (f.capacity || 0), 0).toLocaleString()} L en proceso
          </p>
        </div>

        {/* Sucios / Pendiente CIP */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'DIRTY' ? 'ALL' : 'DIRTY')}
          className={`bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'DIRTY' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-zinc-800/80 hover:border-amber-500/50'
          }`}
        >
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Sucios (CIP Pendiente)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-display">{dirtyTanks.length}</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">requieren lavado</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono font-medium">
            {dirtyTanks.length === 0 ? 'Planta 100% higienizada' : 'Acción requerida'}
          </p>
        </div>
      </div>

      {/* FILTROS & BUSCADOR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-zinc-800 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
            }`}
          >
            Todos ({totalTanks})
          </button>
          <button
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'AVAILABLE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
            }`}
          >
            Disponibles ({availableTanks.length})
          </button>
          <button
            onClick={() => setStatusFilter('OCCUPIED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'OCCUPIED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600'
            }`}
          >
            Ocupados ({occupiedTanks.length})
          </button>
          <button
            onClick={() => setStatusFilter('DIRTY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'DIRTY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600'
            }`}
          >
            Sucios ({dirtyTanks.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <DebouncedInput
            type="text"
            value={searchTerm}
            onDebouncedChange={(val) => setSearchTerm(val.toString())}
            placeholder="Buscar fermentador o lote..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-copper"
          />
        </div>
      </div>

      {/* FERMENTERS GRID */}
      {fermenters.length === 0 ? (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-dashed border-slate-300 dark:border-zinc-800 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-copper/10 text-copper flex items-center justify-center mx-auto mb-4">
            <Droplets size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Aún no registraste fermentadores</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
            Configura los tanques de tu cervecería para asignarles lotes durante la cocción y rastrear su estado de limpieza (CIP).
          </p>
          <button
            onClick={openCreateModal}
            className="mt-6 px-5 py-3 bg-copper hover:bg-copper/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-copper/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Agregar Primer Fermentador</span>
          </button>
        </div>
      ) : filteredFermenters.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
          No hay fermentadores que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFermenters.map((f) => {
            const isAvailable = f.status === 'AVAILABLE';
            const isOccupied = f.status === 'OCCUPIED';
            const isDirty = f.status === 'DIRTY';
            const isMaintenance = f.status === 'MAINTENANCE';

            const activeBatch = batches.find(b => b.id === f.currentBatchId);
            const daysInTank = getDaysInFermenter(activeBatch);

            let borderColor = 'border-l-emerald-500';
            let badgeBg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40';
            let badgeLabel = 'Limpio / Disponible';

            if (isOccupied) {
              borderColor = 'border-l-blue-500';
              badgeBg = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/40';
              badgeLabel = 'En Fermentación';
            } else if (isDirty) {
              borderColor = 'border-l-amber-500';
              badgeBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40';
              badgeLabel = 'Sucio (CIP Pendiente)';
            } else if (isMaintenance) {
              borderColor = 'border-l-slate-400';
              badgeBg = 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-400 border-slate-300 dark:border-zinc-700';
              badgeLabel = 'En Mantenimiento';
            }

            return (
              <div
                key={f.id}
                className={`bg-white dark:bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} border-y border-r border-slate-200 dark:border-y-zinc-800/80 dark:border-r-zinc-800/80 flex flex-col justify-between relative group transition-all hover:shadow-md`}
              >
                {/* BOTÓN EDITAR */}
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(f)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                    title="Editar Fermentador"
                  >
                    <Pencil size={15} />
                  </button>
                </div>

                <div>
                  {/* CABECERA: NOMBRE & CAPACIDAD */}
                  <div className="flex items-start justify-between mb-3 pr-10">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 dark:text-white leading-tight flex items-center gap-2">
                        {f.name}
                      </h3>
                      <p className="text-[11px] font-mono font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                        Capacidad: <span className="text-slate-700 dark:text-slate-300 font-bold">{f.capacity} L</span>
                      </p>
                    </div>
                  </div>

                  {/* BADGE DE ESTADO */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                  </div>

                  {/* CUERPO SEGÚN ESTADO */}
                  {isOccupied && activeBatch && (
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                            {activeBatch.recipeName}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            {activeBatch.style} • Lote #{activeBatch.lotCode}
                          </p>
                        </div>
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {activeBatch.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                        <span className="text-slate-400 dark:text-zinc-500 flex items-center gap-1 text-[11px]">
                          <Clock size={13} />
                          {daysInTank !== null ? `${daysInTank} días en tanque` : 'Sin fecha'}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {tankFill(activeBatch, f).volume} L
                        </span>
                      </div>

                      <p className={tankFill(activeBatch, f).excess > 0 ? 'text-red-600 font-bold text-xs' : 'text-xs'}>
                        {tankFill(activeBatch, f).percent}% de capacidad
                        {tankFill(activeBatch, f).excess > 0 && ` — Exceso: ${tankFill(activeBatch, f).excess} L`}
                      </p>
                      {/* Barra de llenado estimado */}
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-copper rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, tankFill(activeBatch, f).percent)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isOccupied && !activeBatch && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl text-xs text-blue-700 dark:text-blue-400">
                      Ocupado por lote anterior.
                    </div>
                  )}

                  {isDirty && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/30 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-400">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Tanque sucio post-vaciado</p>
                          <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                            Requiere lavado alcalino/ácido y sanitización CIP antes de volver a inocular.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAvailable && (
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold">Sanitizado y listo</p>
                        {f.lastCleanedDate && (
                          <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                            Último CIP: {new Date(f.lastCleanedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {f.notes && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-3 italic line-clamp-2">
                      "{f.notes}"
                    </p>
                  )}
                </div>

                {/* BOTONES DE ACCIÓN INFERIORES */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex flex-col gap-2">
                  {isDirty && (
                    <button
                      onClick={() => act(() => cleanFermenter(f.id))}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 size={16} />
                      <span>Marcar Limpio (CIP Realizado)</span>
                    </button>
                  )}

                  {isOccupied && (
                    <button
                      onClick={() => act(() => releaseFermenter(f.id, true))}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Desocupar y Pasar a Sucio</span>
                    </button>
                  )}

                  {isAvailable && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAssignModal(f)}
                        className="flex-1 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <Beer size={14} />
                        <span>Asignar a Lote</span>
                      </button>
                      <button
                        onClick={() => act(() => markFermenterDirty(f.id))}
                        className="py-2 px-3 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-xl text-xs font-medium transition"
                        title="Marcar como Sucio"
                      >
                        Pasar a Sucio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Droplets className="text-copper" size={20} />
                {modalMode === 'CREATE' ? 'Nuevo Fermentador' : 'Editar Fermentador'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            {formError && <p role="alert" className="text-red-600 text-sm mb-3">{formError}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Nombre o Identificador
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ej. Fermentador 1, F-01, Tronco 300L"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-copper/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Capacidad Total (Litros)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  placeholder="300"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="w-full border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-copper/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Estado Inicial
                </label>
                <select
                  disabled={!!selectedFermenter && (selectedFermenter.status === 'OCCUPIED' || !!selectedFermenter.currentBatchId || batches.some(b => b.fermenterId === selectedFermenter.id))}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as FermenterStatus })}
                  className="w-full border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-copper/50 font-medium"
                >
                  <option value="AVAILABLE">🟢 Limpio / Disponible</option>
                  <option value="DIRTY">🟡 Sucio (CIP Pendiente)</option>
                  {formData.status === 'OCCUPIED' && <option value="OCCUPIED">🔵 En Fermentación (Ocupado)</option>}
                  <option value="MAINTENANCE">⚙️ En Mantenimiento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Chaqueta de glicol nueva, válvula de mariposa 1.5''..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-copper/50 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
                {modalMode === 'EDIT' && (
                  <button
                    type="button"
                    onClick={() => setModalMode('DELETE')}
                    className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
                    title="Eliminar Fermentador"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-copper hover:bg-copper/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-copper/20 transition active:scale-95"
                >
                  <Save size={16} />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL ASIGNAR A LOTE */}
      {modalMode === 'ASSIGN' && selectedFermenter && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Beer className="text-copper" size={20} />
                Asignar {selectedFermenter.name}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Selecciona el lote en cocción o fermentación que entrará en este tanque ({selectedFermenter.capacity} L):
            </p>

            {formError && <p role="alert" className="text-red-600 text-sm mb-3">{formError}</p>}
            {activeUnassignedBatches.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-center text-xs text-slate-400">
                No hay lotes activos disponibles para asignar. Crea o inicia un lote desde la pestaña de Producción.
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <select
                  value={selectedBatchToAssign}
                  onChange={(e) => setSelectedBatchToAssign(e.target.value)}
                  className="w-full border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-copper/50"
                >
                  <option value="">-- Seleccionar Lote --</option>
                  {activeUnassignedBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.recipeName} ({b.lotCode}) - {b.volumeFermenter || b.volumeKettle}L [{b.status}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedBatchToAssign}
                onClick={handleConfirmAssign}
                className="flex-1 py-2.5 bg-copper hover:bg-copper/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-copper/20 transition active:scale-95"
              >
                <CheckCircle2 size={16} />
                <span>Asignar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL ELIMINAR */}
      {modalMode === 'DELETE' && selectedFermenter && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            {formError && <p role="alert" className="text-red-600 text-sm mb-3">{formError}</p>}
            <h4 className="font-bold text-base text-slate-900 dark:text-white">¿Eliminar {selectedFermenter.name}?</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Esta acción quitará el tanque del inventario de fermentadores. Los lotes históricos no se perderán.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
