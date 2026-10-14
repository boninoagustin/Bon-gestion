import React from 'react';
import { assignmentError } from '../fermenterUi';
import { createPortal } from 'react-dom';
import { X, BookOpen, Coins, AlertCircle, Eye, Wind, Utensils, Activity, Save, Droplets } from 'lucide-react';
import { DebouncedInput, DebouncedTextarea } from '../../ui/DebouncedInput';
import { StarRating } from '../../ui/StarRating';
import { Batch, BatchStatus, MasterRecipe, Fermenter } from '../../../types';

interface ProductionModalManagerProps {
    modalMode: 'NEW' | 'UPDATE_FERMENT' | 'UPDATE_CONDITION' | 'UPDATE_PACKAGE' | 'EDIT_COSTS' | 'DELETE' | 'EDIT_BATCH' | 'LOG_FERMENTATION' | 'SENSORY' | 'NONE';
    selectedBatch: Batch | null;
    closeModal: () => void;
    handleSubmit: () => void;
    tempData: any;
    setTempData: React.Dispatch<React.SetStateAction<any>>;
    logForm: any;
    setLogForm: React.Dispatch<React.SetStateAction<any>>;
    sensoryForm: any;
    setSensoryForm: React.Dispatch<React.SetStateAction<any>>;
    masterRecipes: MasterRecipe[];
    selectedRecipeId: string;
    handleRecipeSelect: (id: string) => void;
    recipeIngredients: any[];
    calculateCurrentRecipeCost: () => string;
    getEffectiveVolume: () => number;
    settings: any;
    calculateProjectedOverhead: (kettleVol: number) => string;
    stageChecklist: string[];
    fermenters?: Fermenter[];
}

export const ProductionModalManager: React.FC<ProductionModalManagerProps> = ({
    modalMode,
    selectedBatch,
    closeModal,
    handleSubmit,
    tempData,
    setTempData,
    logForm,
    setLogForm,
    sensoryForm,
    setSensoryForm,
    masterRecipes,
    selectedRecipeId,
    handleRecipeSelect,
    recipeIngredients,
    calculateCurrentRecipeCost,
    getEffectiveVolume,
    settings,
    calculateProjectedOverhead,
    stageChecklist,
    fermenters = []
}) => {
    if (modalMode === 'NONE') return null;
    const draft = {
        ...(modalMode === 'NEW' ? {} : selectedBatch),
        status: modalMode === 'NEW' ? BatchStatus.MASHING : selectedBatch?.status ?? BatchStatus.MASHING,
        volumeKettle: Number(tempData.volumeKettle ?? selectedBatch?.volumeKettle ?? 0),
        volumeFermenter: Number(tempData.volumeFermenter ?? (modalMode === 'NEW' ? 0 : selectedBatch?.volumeFermenter) ?? 0)
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-zinc-800">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-800 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                        {modalMode === 'NEW' && 'Nueva Cocción'}
                        {modalMode === 'UPDATE_FERMENT' && 'Fin de Cocción -> Fermentador'}
                        {modalMode === 'UPDATE_CONDITION' && 'Fin Fermentación -> Maduración'}
                        {modalMode === 'UPDATE_PACKAGE' && 'Fin Maduración -> Finalizado'}
                        {modalMode === 'EDIT_COSTS' && 'Ajustar Costos Manualmente'}
                        {modalMode === 'EDIT_BATCH' && 'Editar Datos del Lote'}
                        {modalMode === 'DELETE' && 'Eliminar Lote'}
                        {modalMode === 'LOG_FERMENTATION' && 'Registrar Medición'}
                        {modalMode === 'SENSORY' && 'Registrar Cata / Calidad'}
                    </h3>
                    <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">

                    {modalMode === 'NEW' && (
                        <>
                            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30">
                                <label className="block text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1 flex items-center gap-2"><BookOpen size={12} /> Receta Maestra</label>
                                <select value={selectedRecipeId} onChange={(e) => handleRecipeSelect(e.target.value)} className="w-full border border-amber-300 dark:border-amber-700 rounded p-2 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium">
                                    <option value="">-- Seleccionar Receta --</option>
                                    {masterRecipes.map(r => (<option key={r.id} value={r.id}>{r.name} (Base {r.batchSize}L)</option>))}
                                </select>
                                {selectedRecipeId && <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">Los insumos se han escalado automáticamente a tu volumen de olla actual.</p>}
                                {masterRecipes.length === 0 && <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">Debes crear recetas en la Biblioteca primero.</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Volumen Olla (L)</label><DebouncedInput type="number" value={tempData.volumeKettle} onDebouncedChange={v => setTempData({ ...tempData, volumeKettle: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-copper" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha Cocción</label><DebouncedInput type="date" value={tempData.brewDate || new Date().toISOString().split('T')[0]} onDebouncedChange={v => setTempData({ ...tempData, brewDate: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" /></div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Código Lote</label><DebouncedInput type="text" value={tempData.lotCode} onDebouncedChange={v => setTempData({ ...tempData, lotCode: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono" /></div>
                            </div>

                            <div className="mt-4 bg-slate-50 dark:bg-zinc-800/80 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                                    <Droplets size={14} className="text-copper" /> Fermentador Destino
                                </label>
                                <select
                                    value={tempData.fermenterId || ''}
                                    onChange={(e) => {
                                        const fId = e.target.value;
                                        const foundF = fermenters.find(f => f.id === fId);
                                        setTempData({ ...tempData, fermenterId: fId, fermenterName: foundF ? foundF.name : '' });
                                    }}
                                    className="w-full border border-slate-300 dark:border-zinc-700 rounded p-2 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                                >
                                    <option value="">-- Sin asignar (En olla / A definir) --</option>
                                    {fermenters.map(f => {
                                        const isAvail = !assignmentError(f, draft);
                                        const statusLabel = f.status === 'AVAILABLE' ? 'Limpio / Disponible' : f.status === 'DIRTY' ? 'SUCIO (CIP Pendiente)' : f.status === 'OCCUPIED' ? 'Ocupado' : 'Mantenimiento';
                                        return (
                                            <option key={f.id} value={f.id} disabled={!isAvail}>
                                                {f.name} ({f.capacity}L) — {assignmentError(f, draft) || statusLabel}
                                            </option>
                                        );
                                    })}
                                </select>
                                {fermenters.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        💡 Puedes agregar y gestionar tus fermentadores en <strong>Envasado &gt; Fermentadores</strong>.
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Solo tanques limpios (disponibles) pueden recibir un nuevo lote.
                                    </p>
                                )}
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 mt-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 text-sm"><Coins size={16} /> Costos Insumos (Escalados)</h4>

                                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                                    {recipeIngredients.length === 0 && <p className="text-xs text-slate-400 text-center italic">Selecciona una receta y volumen.</p>}
                                    {recipeIngredients.map((ing, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-700 p-2 rounded border border-slate-200 dark:border-zinc-600 text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">{ing.name}</span>
                                            <div className="flex items-center gap-3"><span className="font-mono text-xs text-slate-500 dark:text-slate-400">{ing.amountUsed} {ing.unit}</span><span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-200">${(ing.amountUsed * ing.costAtTime).toFixed(0)}</span></div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-zinc-700 font-bold text-slate-800 dark:text-white text-sm"><span>Total Insumos:</span><span>${calculateCurrentRecipeCost()}</span></div>
                                <p className="text-[10px] text-slate-400 mt-1">* Al guardar, se descontará del inventario según tu preferencia:</p>
                                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-zinc-700 flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="discountIngredientsNow"
                                        checked={tempData.discountIngredientsNow !== false} 
                                        onChange={(e) => setTempData({ ...tempData, discountIngredientsNow: e.target.checked })}
                                        className="rounded border-slate-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 bg-white dark:bg-zinc-800"
                                    />
                                    <label htmlFor="discountIngredientsNow" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        Descontar stock AHORA (al iniciar la cocción)
                                    </label>
                                </div>
                            </div>

                            <div className={`p-3 rounded border flex justify-between items-center text-sm mt-4 ${getEffectiveVolume() === 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-400' : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200'}`}>
                                <span>Overhead ({settings.targetMonthlyVolume ? 'Objetivo' : 'Real'}):</span>
                                {getEffectiveVolume() === 0 ? (<span className="font-bold text-xs">¡Sin Producción!</span>) : (<span className="font-bold font-mono">${calculateProjectedOverhead(parseFloat(tempData.volumeKettle) || 0)}</span>)}
                            </div>
                            {getEffectiveVolume() === 0 && (<p className="text-[10px] text-red-500 dark:text-red-400 mt-0">* Configura un Volumen Objetivo en Inventario &gt; Costos Fijos para tener cálculos estables.</p>)}
                        </>
                    )}

                    {modalMode === 'UPDATE_FERMENT' && (
                        <>
                            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 p-3 rounded-lg text-sm mb-4">
                                El mosto se enfrió y pasó al fermentador. ¿Cuánto recuperaste realmente y a qué tanque va?
                            </div>
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Volumen en Fermentador (Litros)</label>
                                <DebouncedInput type="number" autoFocus value={tempData.volumeFermenter} onDebouncedChange={v => setTempData({ ...tempData, volumeFermenter: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 text-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" />
                            </div>
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Densidad Inicial (OG)</label>
                                <DebouncedInput type="number" step="0.001" value={tempData.originalGravity} onDebouncedChange={v => setTempData({ ...tempData, originalGravity: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                                    <Droplets size={14} className="text-copper" /> Fermentador Asignado
                                </label>
                                <select
                                    value={tempData.fermenterId || ''}
                                    onChange={(e) => {
                                        const fId = e.target.value;
                                        const foundF = fermenters.find(f => f.id === fId);
                                        setTempData({ ...tempData, fermenterId: fId, fermenterName: foundF ? foundF.name : '' });
                                    }}
                                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
                                >
                                    <option value="">-- Sin asignar --</option>
                                    {fermenters.map(f => {
                                        const isCurrent = f.id === selectedBatch?.fermenterId;
                                        const isAvail = !assignmentError(f, draft);
                                        const statusLabel = isCurrent ? 'Asignado actualmente' : f.status === 'AVAILABLE' ? 'Limpio / Disponible' : f.status === 'DIRTY' ? 'SUCIO (CIP Pendiente)' : f.status === 'OCCUPIED' ? 'Ocupado' : 'Mantenimiento';
                                        return (
                                            <option key={f.id} value={f.id} disabled={!isAvail}>
                                                {f.name} ({f.capacity}L) — {assignmentError(f, draft) || statusLabel}
                                            </option>
                                        );
                                    })}
                                </select>
                                {fermenters.length === 0 && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        💡 Puedes agregar y gestionar tus tanques en <strong>Envasado &gt; Fermentadores</strong>.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                    {modalMode === 'UPDATE_CONDITION' && (
                        <><div className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 p-3 rounded-lg text-sm mb-4">La fermentación terminó. ¿Pasamos a Maduración/Frío?</div><div className="mb-3"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Volumen Actual (Post-Purga)</label><DebouncedInput type="number" autoFocus value={tempData.volumeFermenter} onDebouncedChange={v => setTempData({ ...tempData, volumeFermenter: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 text-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" /><p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Si hubo trasvase y pérdida de levadura/barro, ajusta el volumen.</p></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Densidad Actual (SG)</label><DebouncedInput type="number" step="0.001" value={tempData.finalGravity} onDebouncedChange={v => setTempData({ ...tempData, finalGravity: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" /></div></>
                    )}
                    {modalMode === 'UPDATE_PACKAGE' && (
                        <><div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 p-3 rounded-lg text-sm mb-4">Terminó la maduración. ¿Cuánto producto final quedó para la venta?</div><div className="mb-3"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Volumen Final (Litros)</label><DebouncedInput type="number" autoFocus value={tempData.volumePackaged} onDebouncedChange={v => setTempData({ ...tempData, volumePackaged: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 text-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" /></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Densidad Final (FG)</label><DebouncedInput type="number" step="0.001" value={tempData.finalGravity} onDebouncedChange={v => setTempData({ ...tempData, finalGravity: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-3 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" /></div></>
                    )}
                    {stageChecklist.length > 0 && (modalMode === 'UPDATE_FERMENT' || modalMode === 'UPDATE_CONDITION' || modalMode === 'UPDATE_PACKAGE') && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3 mt-4">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase mb-1">Checklist pendiente</p>
                            <ul className="text-xs text-amber-700 dark:text-amber-400/80 space-y-1">
                                {stageChecklist.map((item, idx) => <li key={idx}>- {item}</li>)}
                            </ul>
                        </div>
                    )}
                    {modalMode === 'EDIT_COSTS' && (<div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Total Insumos ($)</label><DebouncedInput type="number" value={tempData.totalIngredientsCost} onDebouncedChange={v => setTempData({ ...tempData, totalIngredientsCost: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Overhead ($)</label><DebouncedInput type="number" value={tempData.overheadCost} onDebouncedChange={v => setTempData({ ...tempData, overheadCost: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div></div>)}
                    {modalMode === 'EDIT_BATCH' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Código Lote</label><DebouncedInput type="text" value={tempData.lotCode} onDebouncedChange={v => setTempData({ ...tempData, lotCode: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-copper transition-all" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha Cocción</label><DebouncedInput type="date" value={tempData.brewDate} onDebouncedChange={v => setTempData({ ...tempData, brewDate: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre Receta</label><DebouncedInput type="text" value={tempData.recipeName} onDebouncedChange={v => setTempData({ ...tempData, recipeName: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Estilo</label><DebouncedInput type="text" value={tempData.style} onDebouncedChange={v => setTempData({ ...tempData, style: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                                    <Droplets size={14} className="text-copper" /> Fermentador Asignado
                                </label>
                                <select
                                    value={tempData.fermenterId || ''}
                                    onChange={(e) => {
                                        const fId = e.target.value;
                                        const foundF = fermenters.find(f => f.id === fId);
                                        setTempData({ ...tempData, fermenterId: fId, fermenterName: foundF ? foundF.name : '' });
                                    }}
                                    className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
                                >
                                    <option value="">-- Sin fermentador --</option>
                                    {fermenters.map(f => {
                                        const isCurrent = f.id === selectedBatch?.fermenterId;
                                        const isAvail = !assignmentError(f, draft);
                                        const statusLabel = isCurrent ? 'Asignado' : f.status === 'AVAILABLE' ? 'Limpio / Disponible' : f.status === 'DIRTY' ? 'SUCIO' : 'Ocupado';
                                        return (
                                            <option key={f.id} value={f.id} disabled={!isAvail}>
                                                {f.name} ({f.capacity}L) — {assignmentError(f, draft) || statusLabel}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-zinc-700 pb-1 mt-2">Volúmenes & Densidades</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vol. Olla (L)</label><DebouncedInput type="number" value={tempData.volumeKettle} onDebouncedChange={v => setTempData({ ...tempData, volumeKettle: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vol. Fermentador (L)</label><DebouncedInput type="number" value={tempData.volumeFermenter} onDebouncedChange={v => setTempData({ ...tempData, volumeFermenter: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-copper/5 dark:bg-copper/10 p-3 rounded-lg border border-copper/20">
                                <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Vol. Final (L)</label><DebouncedInput type="number" value={tempData.volumePackaged} onDebouncedChange={v => setTempData({ ...tempData, volumePackaged: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-copper transition-all" /></div>
                                <div><label className="block text-[10px] font-bold text-copper uppercase mb-1">Saldo Disponible (L)</label><DebouncedInput type="number" value={tempData.volumeAvailable} onDebouncedChange={v => setTempData({ ...tempData, volumeAvailable: v })} className="w-full border border-copper/30 dark:border-copper/50 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/50 transition-all" /><p className="text-[9px] text-copper/80 mt-1">Ajustar si hubo error de stock.</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">OG</label><DebouncedInput type="number" step="0.001" value={tempData.originalGravity} onDebouncedChange={v => setTempData({ ...tempData, originalGravity: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">FG</label><DebouncedInput type="number" step="0.001" value={tempData.finalGravity} onDebouncedChange={v => setTempData({ ...tempData, finalGravity: v })} className="w-full border border-slate-300 dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-copper transition-all" /></div>
                            </div>
                        </div>
                    )}
                    {modalMode === 'DELETE' && (<div className="text-center py-4"><p className="text-slate-600">¿Estás seguro de eliminar el lote <strong>{selectedBatch?.lotCode}</strong>?</p><p className="text-xs text-red-500 mt-2">Esta acción no repondrá los insumos al inventario.</p></div>)}
                    {modalMode === 'LOG_FERMENTATION' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tipo de Registro</label>
                                <div className="flex flex-wrap gap-2">
                                    {['MEDICION', 'DRY_HOP', 'CLARIFICANTE', 'PURGA', 'TRASIEGO', 'OTRO'].map(act => (
                                        <button
                                            key={act}
                                            onClick={() => setLogForm({ ...logForm, action: act as any })}
                                            className={`px-3 py-1.5 rounded text-xs font-bold transition ${logForm.action === act ? 'bg-copper text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                        >
                                            {act.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fecha</label>
                                    <DebouncedInput type="date" value={logForm.date} onDebouncedChange={(v) => setLogForm({ ...logForm, date: v })} className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" />
                                </div>
                                {logForm.action === 'MEDICION' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Temperatura (°C)</label>
                                        <DebouncedInput type="number" step="0.1" value={logForm.temperature || ''} onDebouncedChange={(v) => setLogForm({ ...logForm, temperature: parseFloat(v) || undefined })} className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-slate-900 dark:text-white" placeholder="Temp °C" />
                                    </div>
                                )}
                            </div>
                            
                            {logForm.action === 'MEDICION' && (
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Densidad (SG)</label>
                                    <DebouncedInput type="number" step="0.001" value={logForm.gravity || ''} onDebouncedChange={(v) => setLogForm({ ...logForm, gravity: parseFloat(v) || undefined })} className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold" autoFocus />
                                </div>
                            )}
                            
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Notas / Detalles</label>
                                <DebouncedTextarea value={logForm.notes} onDebouncedChange={(v) => setLogForm({ ...logForm, notes: v })} className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-sm" rows={2} placeholder={logForm.action === 'DRY_HOP' ? "Ej: 50g Citra, 30g Mosaic..." : "Ej: Actividad vigorosa..."}></DebouncedTextarea>
                            </div>
                        </>
                    )}
                    {modalMode === 'SENSORY' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label><DebouncedInput type="date" value={sensoryForm.date} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, date: v })} className="w-full p-2 border rounded bg-white text-slate-900" /></div>
                                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Evaluador</label><DebouncedInput type="text" value={sensoryForm.evaluator} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, evaluator: v })} className="w-full p-2 border rounded bg-white text-slate-900" placeholder="Nombre" /></div>
                            </div>

                            {/* Appearance */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Eye size={16} /> 1. Apariencia (Visual)</h4>
                                    <StarRating score={sensoryForm.appearance.score} setScore={(n: number) => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, score: n } })} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Color</label>
                                        <select value={sensoryForm.appearance.color} onChange={e => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, color: e.target.value as any } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900">
                                            {['Pálido', 'Ámbar', 'Cobrizo', 'Marrón', 'Negro'].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Claridad</label>
                                        <select value={sensoryForm.appearance.clarity} onChange={e => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, clarity: e.target.value as any } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900">
                                            {['Brillante', 'Nebulosa', 'Turbia', 'Opaca'].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Espuma: Formación</label><DebouncedInput type="text" value={sensoryForm.appearance.foam.formation} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, foam: { ...sensoryForm.appearance.foam, formation: v } } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Ej: Rápida, Lenta" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Espuma: Retención</label><DebouncedInput type="text" value={sensoryForm.appearance.foam.retention} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, foam: { ...sensoryForm.appearance.foam, retention: v } } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Ej: Baja, Media, Alta" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Espuma: Textura</label><DebouncedInput type="text" value={sensoryForm.appearance.foam.texture} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, foam: { ...sensoryForm.appearance.foam, texture: v } } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Ej: Cremosa, Jabonosa" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Espuma: Adherencia</label><DebouncedInput type="text" value={sensoryForm.appearance.foam.adherence} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, appearance: { ...sensoryForm.appearance, foam: { ...sensoryForm.appearance.foam, adherence: v } } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Ej: Belgian Lace" /></div>
                                </div>
                            </div>

                            {/* Aroma */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Wind size={16} /> 2. Aroma (Olfato)</h4>
                                    <StarRating score={sensoryForm.aroma.score} setScore={(n: number) => setSensoryForm({ ...sensoryForm, aroma: { ...sensoryForm.aroma, score: n } })} />
                                </div>
                                <div className="space-y-2">
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Malta</label><DebouncedInput type="text" value={sensoryForm.aroma.malt} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, aroma: { ...sensoryForm.aroma, malt: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Grano, pan, caramelo, tostado..." /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lúpulo</label><DebouncedInput type="text" value={sensoryForm.aroma.hops} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, aroma: { ...sensoryForm.aroma, hops: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Cítrico, floral, herbal, resinoso..." /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Levadura</label><DebouncedInput type="text" value={sensoryForm.aroma.yeast} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, aroma: { ...sensoryForm.aroma, yeast: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Ésteres frutales, fenoles especiados..." /></div>
                                </div>
                            </div>

                            {/* Flavor */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Utensils size={16} /> 3. Sabor (Gusto)</h4>
                                    <StarRating score={sensoryForm.flavor.score} setScore={(n: number) => setSensoryForm({ ...sensoryForm, flavor: { ...sensoryForm.flavor, score: n } })} />
                                </div>
                                <div className="space-y-2">
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Malta</label><DebouncedInput type="text" value={sensoryForm.flavor.malt} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, flavor: { ...sensoryForm.flavor, malt: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Dulzura, tostado..." /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lúpulo</label><DebouncedInput type="text" value={sensoryForm.flavor.hops} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, flavor: { ...sensoryForm.flavor, hops: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Amargor, sabor..." /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Balance</label><DebouncedInput type="text" value={sensoryForm.flavor.balance} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, flavor: { ...sensoryForm.flavor, balance: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="¿Equilibrado? ¿Hacia la malta?" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Retrogusto</label><DebouncedInput type="text" value={sensoryForm.flavor.aftertaste} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, flavor: { ...sensoryForm.flavor, aftertaste: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Persistencia, final seco/dulce..." /></div>
                                </div>
                            </div>

                            {/* Mouthfeel */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Activity size={16} /> 4. Sensación en Boca</h4>
                                    <StarRating score={sensoryForm.mouthfeel.score} setScore={(n: number) => setSensoryForm({ ...sensoryForm, mouthfeel: { ...sensoryForm.mouthfeel, score: n } })} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cuerpo</label>
                                        <select value={sensoryForm.mouthfeel.body} onChange={e => setSensoryForm({ ...sensoryForm, mouthfeel: { ...sensoryForm.mouthfeel, body: e.target.value as any } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900">
                                            {['Ligero/Aguado', 'Medio', 'Pleno/Denso'].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Carbonatación</label>
                                        <select value={sensoryForm.mouthfeel.carbonation} onChange={e => setSensoryForm({ ...sensoryForm, mouthfeel: { ...sensoryForm.mouthfeel, carbonation: e.target.value as any } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900">
                                            {['Baja/Plana', 'Media', 'Alta/Punzante'].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Textura</label><DebouncedInput type="text" value={sensoryForm.mouthfeel.texture} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, mouthfeel: { ...sensoryForm.mouthfeel, texture: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Cremosa, sedosa, astringente..." /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calentamiento</label><DebouncedInput type="text" value={sensoryForm.mouthfeel.warming} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, mouthfeel: { ...sensoryForm.mouthfeel, warming: v } })} className="w-full p-1.5 border rounded text-xs bg-white text-slate-900" placeholder="Alcohol agradable vs ardor..." /></div>
                                </div>
                            </div>

                            {/* Defects */}
                            <div className="bg-red-50 p-4 rounded border border-red-200">
                                <h4 className="font-bold text-red-800 text-sm mb-3 flex items-center gap-2"><AlertCircle size={16} /> Defectos (Off-Flavors)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        'Acetaldehído', 'Ácido Acético', 'Ácido Butírico', 'Ácido Láctico',
                                        'Astringencia', 'Diacetilo', 'DMS', 'Fenólico',
                                        'Indol', 'Luz (Lightstruck)', 'Metálico', 'Oxidación',
                                        'Solvente / Fusel', 'Sulfuroso (H2S)'
                                    ].map(defect => (
                                        <label key={defect} className="flex items-center gap-2 text-xs text-red-900 cursor-pointer hover:bg-red-100 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={sensoryForm.defects.includes(defect)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSensoryForm({ ...sensoryForm, defects: [...sensoryForm.defects, defect] });
                                                    } else {
                                                        setSensoryForm({ ...sensoryForm, defects: sensoryForm.defects.filter((d: string) => d !== defect) });
                                                    }
                                                }}
                                                className="rounded border-red-300 text-red-600 focus:ring-red-500"
                                            />
                                            {defect}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas Generales / Impresión</label>
                                <DebouncedTextarea value={sensoryForm.notes} onDebouncedChange={v => setSensoryForm({ ...sensoryForm, notes: v })} className="w-full p-2 border rounded bg-white text-slate-900 text-sm" rows={3} placeholder="¿Volverías a cocinarla? ¿Qué cambiarías?"></DebouncedTextarea>
                            </div>

                            <div className="flex justify-between items-center bg-slate-100 p-3 rounded border border-slate-200">
                                <span className="font-bold text-slate-700">Puntaje Total (Promedio)</span>
                                <div className="flex items-center gap-2">
                                    <StarRating score={Math.round(sensoryForm.overallScore)} size={24} />
                                    <span className="font-mono font-bold text-xl text-slate-800">{sensoryForm.overallScore.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <button onClick={handleSubmit} className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition ${modalMode === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-dark hover:bg-zinc-800'}`}>
                        {modalMode === 'DELETE' ? 'Eliminar Definitivamente' : <><Save size={18} /> Guardar Datos</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
