import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Droplets,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Beer,
  X,
  Save,
  Sparkles,
  Search,
  RotateCcw,
  Thermometer,
} from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Fermenter, FermenterStatus, Batch, BatchStatus } from '../types';
import {
  assignmentError,
  runFormAction,
  tankEditError,
  tankFill,
} from './production/fermenterUi';
import { DebouncedInput } from './ui/DebouncedInput';
import { calculateAttenuation } from '../lib/brewmath';

export const FermenterTracking: React.FC = React.memo(() => {
  const fermenters = useBreweryStore((s) => s.fermenters);
  const batches = useBreweryStore((s) => s.batches);
  const addFermenter = useBreweryStore((s) => s.addFermenter);
  const updateFermenter = useBreweryStore((s) => s.updateFermenter);
  const deleteFermenter = useBreweryStore((s) => s.deleteFermenter);
  const cleanFermenter = useBreweryStore((s) => s.cleanFermenter);
  const markFermenterDirty = useBreweryStore((s) => s.markFermenterDirty);
  const releaseFermenter = useBreweryStore((s) => s.releaseFermenter);
  const assignBatchToFermenter = useBreweryStore(
    (s) => s.assignBatchToFermenter
  );

  const [formError, setFormError] = useState('');
  const act = (action: () => void, success?: () => void) =>
    runFormAction(action, setFormError, success);

  const [statusFilter, setStatusFilter] = useState<'ALL' | FermenterStatus>(
    'ALL'
  );
  const [searchTerm, setSearchTerm] = useState('');

  const [modalMode, setModalMode] = useState<
    'NONE' | 'CREATE' | 'EDIT' | 'DELETE' | 'ASSIGN'
  >('NONE');
  const [selectedFermenterSnapshot, setSelectedFermenter] =
    useState<Fermenter | null>(null);
  const selectedFermenter =
    fermenters.find((f) => f.id === selectedFermenterSnapshot?.id) ?? null;

  const [formData, setFormData] = useState({
    name: '',
    capacity: 300,
    status: 'AVAILABLE' as FermenterStatus,
    notes: '',
  });
  const [selectedBatchToAssign, setSelectedBatchToAssign] =
    useState<string>('');

  const totalTanks = fermenters.length;
  const totalCapacityLiters = fermenters.reduce(
    (acc, f) => acc + (f.capacity || 0),
    0
  );
  const availableTanks = fermenters.filter((f) => f.status === 'AVAILABLE');
  const occupiedTanks = fermenters.filter((f) => f.status === 'OCCUPIED');
  const dirtyTanks = fermenters.filter((f) => f.status === 'DIRTY');

  const activeUnassignedBatches = batches.filter(
    (b) =>
      !assignmentError(
        fermenters.find((f) => f.id === selectedFermenter?.id),
        b
      ) &&
      (!b.fermenterId || b.fermenterId === selectedFermenter?.id)
  );

  const openCreateModal = () => {
    setFormError('');
    const nextNum = fermenters.length + 1;
    setFormData({
      name: `Fermentador ${nextNum}`,
      capacity: 300,
      status: 'AVAILABLE',
      notes: '',
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
      notes: f.notes || '',
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
    const current = fermenters.find((f) => f.id === selectedFermenter?.id);
    const error = tankEditError(
      current,
      formData.status,
      Number(formData.capacity),
      batches
    );
    if (error) return setFormError(error);
    act(() => {
      if (modalMode === 'CREATE') {
        addFermenter({
          name: formData.name.trim(),
          capacity: Number(formData.capacity),
          status: formData.status,
          notes: formData.notes.trim(),
        });
      } else if (modalMode === 'EDIT' && selectedFermenter) {
        updateFermenter(selectedFermenter.id, {
          name: formData.name.trim(),
          capacity: Number(formData.capacity),
          status: formData.status,
          notes: formData.notes.trim(),
        });
      }
    }, closeModal);
  };

  const handleConfirmAssign = () => {
    if (!selectedFermenter || !selectedBatchToAssign) return;
    const batch = batches.find((b) => b.id === selectedBatchToAssign);
    const error = batch
      ? assignmentError(
          fermenters.find((f) => f.id === selectedFermenter.id),
          batch
        )
      : 'El lote ya no existe.';
    if (error) return setFormError(error);
    act(
      () => assignBatchToFermenter(selectedFermenter.id, selectedBatchToAssign),
      closeModal
    );
  };

  const handleDelete = () => {
    if (!selectedFermenter) return;
    act(() => deleteFermenter(selectedFermenter.id), closeModal);
  };

  const filteredFermenters = fermenters.filter((f) => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const linkedBatch = batches.find((b) => b.id === f.currentBatchId);
      const batchName = linkedBatch?.recipeName.toLowerCase() || '';
      const lotCode = linkedBatch?.lotCode.toLowerCase() || '';
      return (
        f.name.toLowerCase().includes(term) ||
        batchName.includes(term) ||
        lotCode.includes(term)
      );
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
      {formError && modalMode === 'NONE' && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/40 text-[#ef4444] text-xs font-bold"
        >
          {formError}
        </p>
      )}

      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <Droplets className="text-[#f59e0b]" size={26} />
            Sala de Fermentadores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitoreo industrial de tanques cilindro-cónicos, telemetría térmica y estado CIP.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>Nuevo Fermentador</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS (SEMÁFOROS INDUSTRIALES) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1a1d21] p-4 rounded-2xl border border-slate-200 dark:border-[#2c3138] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Capacidad Instalada
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">
              {totalTanks}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              tanques
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-semibold">
            {totalCapacityLiters.toLocaleString()} L totales
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')
          }
          className={`text-left min-h-[88px] bg-white dark:bg-[#1a1d21] p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'AVAILABLE'
              ? 'border-[#10b981] ring-2 ring-[#10b981]/25'
              : 'border-slate-200 dark:border-[#2c3138] hover:border-[#10b981]/60'
          }`}
        >
          <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            Disponibles (Limpios)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#10b981] font-mono">
              {availableTanks.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              tanques
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-semibold">
            {availableTanks
              .reduce((sum, f) => sum + (f.capacity || 0), 0)
              .toLocaleString()}{' '}
            L listos
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')
          }
          className={`text-left min-h-[88px] bg-white dark:bg-[#1a1d21] p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'OCCUPIED'
              ? 'border-[#0ea5e9] ring-2 ring-[#0ea5e9]/25'
              : 'border-slate-200 dark:border-[#2c3138] hover:border-[#0ea5e9]/60'
          }`}
        >
          <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
            En Fermentación
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#38bdf8] font-mono">
              {occupiedTanks.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ocupados
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-semibold">
            {occupiedTanks
              .reduce((sum, f) => sum + (f.capacity || 0), 0)
              .toLocaleString()}{' '}
            L en proceso
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'DIRTY' ? 'ALL' : 'DIRTY')
          }
          className={`text-left min-h-[88px] bg-white dark:bg-[#1a1d21] p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'DIRTY'
              ? 'border-[#f59e0b] ring-2 ring-[#f59e0b]/25'
              : 'border-slate-200 dark:border-[#2c3138] hover:border-[#f59e0b]/60'
          }`}
        >
          <span className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            Sucios (CIP Pendiente)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#f59e0b] font-mono">
              {dirtyTanks.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              requieren CIP
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-semibold">
            {dirtyTanks.length === 0
              ? 'Planta 100% higienizada'
              : 'Lavado requerido'}
          </p>
        </button>
      </div>

      {/* FILTROS TÁCTILES (>= 44px) & BUSCADOR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#1a1d21] p-3 rounded-2xl border border-slate-200 dark:border-[#2c3138]">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-[#121417] text-white border border-[#2c3138] shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#22262b]'
            }`}
          >
            Todos ({totalTanks})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'AVAILABLE'
                ? 'bg-[#10b981] text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-[#10b981]/15 hover:text-[#10b981]'
            }`}
          >
            Disponibles ({availableTanks.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OCCUPIED')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'OCCUPIED'
                ? 'bg-[#0ea5e9] text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-[#0ea5e9]/15 hover:text-[#38bdf8]'
            }`}
          >
            Ocupados ({occupiedTanks.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DIRTY')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'DIRTY'
                ? 'bg-[#d97706] text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-[#d97706]/15 hover:text-[#f59e0b]'
            }`}
          >
            Sucios ({dirtyTanks.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <DebouncedInput
            type="text"
            value={searchTerm}
            onDebouncedChange={(val) => setSearchTerm(val.toString())}
            placeholder="Buscar fermentador o lote..."
            className="w-full min-h-[44px] pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#2c3138] bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
          />
        </div>
      </div>

      {/* FERMENTERS GRID */}
      {fermenters.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1d21] border border-dashed border-slate-300 dark:border-[#2c3138] rounded-3xl p-10 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30 flex items-center justify-center mx-auto mb-4">
            <Droplets size={32} />
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">
            Aún no registraste fermentadores
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
            Configurá los tanques cilindro-cónicos de tu cervecería para asignarles lotes, controlar temperaturas y auditar limpiezas CIP.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 min-h-[48px] px-6 py-3 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-copper-glow transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>Agregar Primer Fermentador</span>
          </button>
        </div>
      ) : filteredFermenters.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-[#1a1d21] rounded-2xl border border-slate-200 dark:border-[#2c3138]">
          No hay fermentadores que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFermenters.map((f) => {
            const isAvailable = f.status === 'AVAILABLE';
            const isOccupied = f.status === 'OCCUPIED';
            const isDirty = f.status === 'DIRTY';
            const isMaintenance = f.status === 'MAINTENANCE';

            const activeBatch = batches.find((b) => b.id === f.currentBatchId);
            const daysInTank = getDaysInFermenter(activeBatch);
            const logs = activeBatch?.fermentationLogs || [];
            const lastGrav = [...logs]
              .reverse()
              .find((l) => typeof l.gravity === 'number')?.gravity;
            const lastTemp = [...logs]
              .reverse()
              .find((l) => typeof l.temperature === 'number')?.temperature;
            const attPercent =
              activeBatch && lastGrav !== undefined
                ? calculateAttenuation(activeBatch.originalGravity, lastGrav)
                : null;

            let borderColor = 'border-l-[#10b981]';
            let badgeBg =
              'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30';
            let badgeLabel = 'Limpio / Disponible';

            if (isOccupied) {
              borderColor = 'border-l-[#0ea5e9]';
              badgeBg = 'bg-[#0ea5e9]/15 text-[#38bdf8] border-[#0ea5e9]/30';
              badgeLabel = 'En Fermentación';
            } else if (isDirty) {
              borderColor = 'border-l-[#f59e0b]';
              badgeBg = 'bg-[#d97706]/15 text-[#f59e0b] border-[#d97706]/30';
              badgeLabel = 'Sucio (CIP Pendiente)';
            } else if (isMaintenance) {
              borderColor = 'border-l-[#ef4444]';
              badgeBg = 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30';
              badgeLabel = 'En Mantenimiento';
            }

            return (
              <div
                key={f.id}
                className={`bg-white dark:bg-[#1a1d21] p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} border-y border-r border-slate-200 dark:border-y-[#2c3138] dark:border-r-[#2c3138] flex flex-col justify-between relative group transition-all hover:shadow-md`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(f)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#22262b] rounded-xl transition"
                    title="Editar Fermentador"
                  >
                    <Pencil size={17} />
                  </button>
                </div>

                <div>
                  <div className="flex items-start justify-between mb-3 pr-12">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-800 dark:text-white leading-tight">
                        {f.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-400 mt-0.5">
                        Capacidad:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-bold">
                          {f.capacity} L
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeBg}`}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  {isOccupied && activeBatch && (
                    <div className="bg-slate-50 dark:bg-[#121417]/80 p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138] space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                            {activeBatch.recipeName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {activeBatch.style} • #{activeBatch.lotCode}
                          </p>
                        </div>
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#0ea5e9]/15 text-[#38bdf8] border border-[#0ea5e9]/30">
                          {activeBatch.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-[#2c3138] font-mono text-[11px]">
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-bold">
                            Densidad
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {(lastGrav ?? activeBatch.originalGravity ?? 1.05).toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-bold">
                            Temp.
                          </span>
                          <span className="font-bold text-[#38bdf8] inline-flex items-center gap-0.5">
                            <Thermometer size={11} />
                            {lastTemp !== undefined ? `${lastTemp}°C` : '--'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] uppercase text-slate-400 font-sans font-bold">
                            Volumen
                          </span>
                          <span className="font-bold text-[#f59e0b]">
                            {tankFill(activeBatch, f).volume} L
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock size={12} />
                            {daysInTank !== null ? `${daysInTank}d en tanque` : 'Sin fecha'}
                            {attPercent !== null
                              ? ` • ${attPercent.toFixed(0)}% AA`
                              : ''}
                          </span>
                          <span
                            className={
                              tankFill(activeBatch, f).excess > 0
                                ? 'text-[#ef4444] font-bold'
                                : 'text-slate-600 dark:text-slate-300 font-bold'
                            }
                          >
                            {tankFill(activeBatch, f).percent}% de capacidad
                            {tankFill(activeBatch, f).excess > 0 &&
                              ` — Exceso: ${tankFill(activeBatch, f).excess} L`}
                          </span>
                        </div>
                        <div className="fermentation-progress-track h-2">
                          <div
                            className={
                              tankFill(activeBatch, f).excess > 0
                                ? 'fermentation-progress-bar fermentation-progress-bar--alert'
                                : activeBatch.status === BatchStatus.CONDITIONING
                                ? 'fermentation-progress-bar fermentation-progress-bar--chill'
                                : 'fermentation-progress-bar'
                            }
                            style={{
                              width: `${Math.min(
                                100,
                                tankFill(activeBatch, f).percent
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isOccupied && !activeBatch && (
                    <div className="p-3 bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded-xl text-xs text-[#38bdf8]">
                      Ocupado por lote anterior.
                    </div>
                  )}

                  {isDirty && (
                    <div className="bg-[#d97706]/10 p-3.5 rounded-xl border border-[#d97706]/30 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-[#f59e0b]">
                        <AlertTriangle
                          size={16}
                          className="text-[#f59e0b] shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="font-bold">Tanque sucio post-vaciado</p>
                          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            Requiere lavado alcalino/ácido y sanitización CIP antes de volver a inocular.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAvailable && (
                    <div className="bg-[#10b981]/10 p-3.5 rounded-xl border border-[#10b981]/30 text-xs text-[#10b981] flex items-center gap-2.5">
                      <Sparkles size={17} className="shrink-0" />
                      <div>
                        <p className="font-bold">Sanitizado y listo</p>
                        {f.lastCleanedDate && (
                          <p className="text-[11px] font-mono opacity-80 mt-0.5">
                            Último CIP:{' '}
                            {new Date(f.lastCleanedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {f.notes && (
                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-400 mt-3 italic line-clamp-2">
                      &ldquo;{f.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* BOTONES DE ACCIÓN TÁCTIL EN PLANTA (>= 44x44px) */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-[#2c3138] flex flex-col gap-2">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => act(() => cleanFermenter(f.id))}
                      className="w-full min-h-[44px] py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-hop-glow transition-all active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 size={17} />
                      <span>Marcar Limpio (CIP Realizado)</span>
                    </button>
                  )}

                  {isOccupied && (
                    <button
                      type="button"
                      onClick={() => act(() => releaseFermenter(f.id, true))}
                      className="w-full min-h-[44px] py-2.5 bg-[#d97706]/15 hover:bg-[#d97706]/25 text-[#f59e0b] border border-[#d97706]/35 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>Desocupar y Pasar a Sucio</span>
                    </button>
                  )}

                  {isAvailable && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openAssignModal(f)}
                        className="flex-1 min-h-[44px] py-2.5 bg-slate-100 dark:bg-[#22262b] hover:bg-slate-200 dark:hover:bg-[#2c3138] text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <Beer size={15} className="text-[#f59e0b]" />
                        <span>Asignar a Lote</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => act(() => markFermenterDirty(f.id))}
                        className="min-h-[44px] px-3.5 text-slate-400 hover:text-[#f59e0b] hover:bg-[#d97706]/15 rounded-xl text-xs font-bold transition"
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

      {/* MODAL CREAR / EDITAR (ERGONOMÍA DE UNA SOLA MANO) */}
      {(modalMode === 'CREATE' || modalMode === 'EDIT') &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-[#2c3138]">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Droplets className="text-[#f59e0b]" size={20} />
                  {modalMode === 'CREATE'
                    ? 'Nuevo Fermentador'
                    : 'Editar Fermentador'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-[#22262b]"
                >
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="text-[#ef4444] text-xs font-bold mb-3 p-2.5 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30"
                >
                  {formError}
                </p>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Nombre o Identificador
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ej. Fermentador 1, F-01"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Capacidad Total (Litros)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    step={1}
                    placeholder="300"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        capacity: Number(e.target.value),
                      })
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Estado Inicial
                  </label>
                  <select
                    disabled={
                      !!selectedFermenter &&
                      (selectedFermenter.status === 'OCCUPIED' ||
                        !!selectedFermenter.currentBatchId ||
                        batches.some(
                          (b) => b.fermenterId === selectedFermenter.id
                        ))
                    }
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as FermenterStatus,
                      })
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60 font-medium"
                  >
                    <option value="AVAILABLE">🟢 Limpio / Disponible</option>
                    <option value="DIRTY">🟡 Sucio (CIP Pendiente)</option>
                    {formData.status === 'OCCUPIED' && (
                      <option value="OCCUPIED">
                        🔵 En Fermentación (Ocupado)
                      </option>
                    )}
                    <option value="MAINTENANCE">⚙️ En Mantenimiento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Notas u Observaciones (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ej. Setpoint 19°C, chaqueta glicol activa..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-xs font-mono bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-[#2c3138]">
                  {modalMode === 'EDIT' && (
                    <button
                      type="button"
                      onClick={() => setModalMode('DELETE')}
                      className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[#ef4444] hover:bg-[#ef4444]/15 rounded-xl transition"
                      title="Eliminar Fermentador"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[48px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-copper-glow transition active:scale-95"
                  >
                    <Save size={17} />
                    <span>Guardar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ASIGNAR A LOTE (UNA MANO) */}
      {modalMode === 'ASSIGN' &&
        selectedFermenter &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-[#2c3138]">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Beer className="text-[#f59e0b]" size={20} />
                  Asignar {selectedFermenter.name}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Selecciona el lote en cocción o fermentación que entrará en este tanque ({selectedFermenter.capacity} L):
              </p>

              {formError && (
                <p role="alert" className="text-[#ef4444] text-xs font-bold mb-3">
                  {formError}
                </p>
              )}

              {activeUnassignedBatches.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-[#121417] rounded-xl text-center text-xs text-slate-400 mb-4">
                  No hay lotes activos disponibles para asignar. Crea o inicia un lote desde la pestaña de Producción.
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  <select
                    value={selectedBatchToAssign}
                    onChange={(e) => setSelectedBatchToAssign(e.target.value)}
                    className="w-full min-h-[48px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm font-mono bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  >
                    <option value="">-- Seleccionar Lote --</option>
                    {activeUnassignedBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.recipeName} ({b.lotCode}) -{' '}
                        {b.volumeFermenter || b.volumeKettle}L [{b.status}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedBatchToAssign}
                  onClick={handleConfirmAssign}
                  className="flex-1 min-h-[48px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-copper-glow transition active:scale-95"
                >
                  <CheckCircle2 size={17} />
                  <span>Asignar</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL ELIMINAR (CONFIRMACIÓN CON UNA SOLA MANO) */}
      {modalMode === 'DELETE' &&
        selectedFermenter &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-sm w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={28} />
              </div>
              {formError && (
                <p role="alert" className="text-[#ef4444] text-xs font-bold mb-3">
                  {formError}
                </p>
              )}
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                ¿Eliminar {selectedFermenter.name}?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Esta acción quitará el tanque del inventario de fermentadores. Los lotes históricos no se perderán.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 min-h-[48px] bg-slate-100 dark:bg-[#22262b] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 min-h-[48px] bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md active:scale-95"
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
