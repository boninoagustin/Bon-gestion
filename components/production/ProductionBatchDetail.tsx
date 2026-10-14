import React, { useState } from 'react';
import { Batch, BatchStatus, MasterRecipe } from '../../types';
import { Pencil, Trash2, Clock, BookOpen, StickyNote, Save, Wheat, Building2, DollarSign, BarChart3, CalendarRange, TrendingDown, ArrowRight, ArrowDown, LineChart, Plus, Thermometer, Star, Eye, Wind, Utensils, Activity, FileText, AlertCircle, FlaskConical, Archive, Flame, Droplets } from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useBreweryStore } from '../../context/store';
import { useToast } from '../Toast';
import { getDaysInStage, getRealMonthAnalysis, calculatePerLiterBreakdown, calculateDynamicCost, getTransitionActionLabel, getTransitionChecklist, getNextBatchStatus } from './utils';
import { DebouncedTextarea } from '../ui/DebouncedInput';
import { StarRating } from '../ui/StarRating';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const dateStr = typeof label === 'string' || typeof label === 'number' 
            ? new Date(label).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) 
            : label;
            
        return (
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-slate-200 dark:border-zinc-800 p-3 rounded-lg shadow-xl z-50">
                <p className="font-bold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-zinc-800 pb-1">{dateStr}</p>
                {payload.map((entry: any, index: number) => {
                    const isAtt = entry.name?.includes('Atenuación');
                    const isTemp = entry.name?.includes('Temp');
                    const suffix = isAtt ? '%' : isTemp ? '°C' : '';
                    return (
                        <div key={index} className="flex justify-between items-center gap-4 mb-1">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                <span className="text-sm text-slate-600 dark:text-slate-400">{entry.name}</span>
                            </div>
                            <span className="text-sm font-bold font-mono text-slate-800 dark:text-white">
                                {entry.value !== undefined ? entry.value : ''}{suffix}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

interface ProductionBatchDetailProps {
    selectedBatch: Batch | null;
    setSelectedBatchId: (id: string | null) => void;
    setModalMode: (mode: any) => void;
    setTempData: (data: any) => void;
    setLogForm: (data: any) => void;
    setSensoryForm: (data: any) => void;
    openNewBatchModal: () => void;
}

export const ProductionBatchDetail: React.FC<ProductionBatchDetailProps> = ({
    selectedBatch,
    setSelectedBatchId,
    setModalMode,
    setTempData,
    setLogForm,
    setSensoryForm,
    openNewBatchModal
}) => {
    const batches = useBreweryStore(s => s.batches);
    const settings = useBreweryStore(s => s.settings);
    const financialHistory = useBreweryStore(s => s.financialHistory);
    const updateBatch = useBreweryStore(s => s.updateBatch);
    const deleteBatch = useBreweryStore(s => s.deleteBatch);
    const addMasterRecipe = useBreweryStore(s => s.addMasterRecipe);
    const deleteFermentationLog = useBreweryStore(s => s.deleteFermentationLog);
    const deleteSensoryProfile = useBreweryStore(s => s.deleteSensoryProfile);
    const setActiveBrewBatchId = useBreweryStore(s => s.setActiveBrewBatchId);
    const { showToast } = useToast();

    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [tempNotes, setTempNotes] = useState('');
    const [chartMode, setChartMode] = useState<'gravity' | 'attenuation'>('gravity');

    if (!selectedBatch) {
        return (
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6 overflow-y-auto">
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12">
                    <div className="w-24 h-24 bg-copper/10 rounded-full flex items-center justify-center mb-6">
                        <FlaskConical size={48} className="text-copper opacity-70" />
                    </div>
                    <p className="font-bold text-lg text-slate-600 dark:text-slate-300">Seleccioná un lote para ver detalles</p>
                    <p className="text-sm mt-2 text-slate-400 max-w-xs text-center">Elegí un lote de la lista para gestionar su progreso y ver sus métricas.</p>
                </div>
            </div>
        );
    }

    const openEditBatchModal = (batch: Batch) => {
        setTempData({ 
            recipeName: batch.recipeName, 
            style: batch.style, 
            lotCode: batch.lotCode, 
            brewDate: batch.brewDate, 
            volumeKettle: batch.volumeKettle, 
            volumeFermenter: batch.volumeFermenter, 
            volumePackaged: batch.volumePackaged, 
            volumeAvailable: batch.volumeAvailable !== undefined ? batch.volumeAvailable : batch.volumePackaged, 
            originalGravity: batch.originalGravity, 
            finalGravity: batch.finalGravity,
            fermenterId: batch.fermenterId || '',
            fermenterName: batch.fermenterName || ''
        });
        setModalMode('EDIT_BATCH');
    };

    const saveAsRecipe = (batch: Batch) => {
        const newRecipe: MasterRecipe = {
            id: crypto.randomUUID(),
            name: batch.recipeName,
            style: batch.style,
            batchSize: batch.volumeKettle,
            ingredients: batch.ingredientsUsed,
            targetOG: batch.originalGravity,
            targetFG: batch.finalGravity,
            notes: `Creada desde Lote ${batch.lotCode}`
        };
        addMasterRecipe(newRecipe);
        showToast({ message: '¡Receta guardada en la biblioteca!', type: 'success' });
    };

    const openStageModal = (batch: Batch) => {
        const checklistIssues = getTransitionChecklist(batch);
        if (checklistIssues.length > 0) {
            showToast({ message: `Checklist incompleto: ${checklistIssues[0]}`, type: 'warning' });
            return;
        }
        if (batch.status === BatchStatus.PLANNED || batch.status === BatchStatus.MASHING) {
            setTempData({ 
                volumeFermenter: batch.volumeKettle, 
                originalGravity: 1.050,
                fermenterId: batch.fermenterId || '',
                fermenterName: batch.fermenterName || ''
            });
            setModalMode('UPDATE_FERMENT');
        } else if (batch.status === BatchStatus.FERMENTING) {
            setTempData({ volumeFermenter: batch.volumeFermenter, finalGravity: batch.originalGravity });
            setModalMode('UPDATE_CONDITION');
        } else if (batch.status === BatchStatus.CONDITIONING) {
            setTempData({ volumePackaged: batch.volumeFermenter, finalGravity: batch.finalGravity || 1.010 });
            setModalMode('UPDATE_PACKAGE');
        }
    };

    const openLogFermentationModal = (batch: Batch) => {
        const lastLog = batch.fermentationLogs[batch.fermentationLogs.length - 1];
        setLogForm({
            date: new Date().toISOString().split('T')[0],
            action: 'MEDICION',
            gravity: lastLog ? lastLog.gravity : batch.originalGravity,
            temperature: lastLog ? lastLog.temperature : 20,
            notes: ''
        });
        setModalMode('LOG_FERMENTATION');
    };

    const openEditCostsModal = (batch: Batch) => {
        setTempData({ totalIngredientsCost: batch.totalIngredientsCost, overheadCost: batch.overheadCost });
        setModalMode('EDIT_COSTS');
    };

    const openSensoryModal = (batch: Batch) => {
        setSensoryForm({
            date: new Date().toISOString().split('T')[0],
            evaluator: '',
            appearance: { color: 'Ámbar', clarity: 'Brillante', foam: { formation: 'Media', retention: 'Media', texture: 'Cremosa', adherence: 'Media' }, score: 0 },
            aroma: { malt: '', hops: '', yeast: '', score: 0 },
            flavor: { malt: '', hops: '', balance: '', aftertaste: '', score: 0 },
            mouthfeel: { body: 'Medio', carbonation: 'Media', texture: '', warming: '', score: 0 },
            overallScore: 0,
            defects: [],
            notes: ''
        });
        setModalMode('SENSORY');
    };

    const handleLogDelete = (logId: string) => {
        deleteFermentationLog(selectedBatch.id, logId);
        showToast({ message: 'Registro eliminado', type: 'info' });
    };

    const handleSensoryDelete = (profileId: string) => {
        deleteSensoryProfile(selectedBatch.id, profileId);
        showToast({ message: 'Perfil sensorial eliminado', type: 'info' });
    };

    const handleDeleteBatch = () => {
        setModalMode('DELETE');
    };

    return (
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6 overflow-y-auto">
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedBatch.recipeName}</h3>
                            <button onClick={() => openEditBatchModal(selectedBatch)} className="text-slate-400 hover:text-copper p-1 rounded hover:bg-copper/10 transition" title="Editar Lote"><Pencil size={18} /></button>
                            <button onClick={handleDeleteBatch} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"><Trash2 size={16} /></button>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center flex-wrap gap-2">
                            <span>{selectedBatch.style} &bull; Lote: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedBatch.lotCode}</span></span>
                            {selectedBatch.fermenterName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    <Droplets size={12} /> {selectedBatch.fermenterName}
                                </span>
                            )}
                        </p>
                        {selectedBatch.status !== BatchStatus.COMPLETED && (
                            <p className="text-xs text-copper mt-1 flex items-center gap-1.5 font-medium"><Clock size={12} /> {getDaysInStage(selectedBatch)} días desde cocción</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => saveAsRecipe(selectedBatch)} className="bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-200 dark:border-zinc-700 transition" title="Guardar como Receta Maestra"><BookOpen size={16} /> Receta</button>
                    </div>
                </div>

                {/* Notes Section */}
                <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1.5">
                        <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase flex items-center gap-1.5"><StickyNote size={12} /> Notas del Lote</h4>
                        {!isEditingNotes && (
                            <button onClick={() => { setIsEditingNotes(true); setTempNotes(selectedBatch.notes || ''); }} className="text-amber-600 dark:text-amber-400 hover:text-amber-800 text-[10px] font-bold uppercase flex items-center gap-1"><Pencil size={10} /> Editar</button>
                        )}
                    </div>
                    {isEditingNotes ? (
                        <div className="space-y-2">
                            <DebouncedTextarea
                                value={tempNotes}
                                onDebouncedChange={setTempNotes}
                                className="w-full p-2 text-sm border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-zinc-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-400 outline-none"
                                rows={3}
                                placeholder="Decisiones, incidentes, recordatorios..."
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsEditingNotes(false)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1 rounded">Cancelar</button>
                                <button onClick={() => { updateBatch(selectedBatch.id, { notes: tempNotes }); setIsEditingNotes(false); showToast({ message: 'Notas guardadas', type: 'success' }); }} className="text-xs bg-amber-600 text-white px-3 py-1 rounded font-bold hover:bg-amber-700 flex items-center gap-1"><Save size={12} /> Guardar</button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-amber-900/70 dark:text-amber-300/70 italic">{selectedBatch.notes || 'Sin notas — click en Editar para agregar observaciones'}</p>
                    )}
                </div>

                {selectedBatch.status === BatchStatus.PACKAGED && (
                    <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-4">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Saldo Disponible en Lote</p>
                                <p className="text-2xl font-mono font-bold text-slate-800 dark:text-white">{selectedBatch.volumeAvailable ?? selectedBatch.volumePackaged} L <span className="text-sm text-slate-400 font-normal ml-1">/ {selectedBatch.volumePackaged} L</span></p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="text-right text-xs text-slate-400">{Math.round(((selectedBatch.volumeAvailable ?? selectedBatch.volumePackaged) / (selectedBatch.volumePackaged || 1)) * 100)}% Restante</div>
                                <button 
                                    onClick={() => {
                                        updateBatch(selectedBatch.id, { status: BatchStatus.COMPLETED });
                                        showToast({ message: 'Lote movido al historial', type: 'success' });
                                    }} 
                                    className="text-[11px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md font-bold transition shadow-sm flex items-center gap-1.5"
                                >
                                    <Archive size={12}/> Agotar y Archivar
                                </button>
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-zinc-700 h-3 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ${((selectedBatch.volumeAvailable ?? selectedBatch.volumePackaged) / (selectedBatch.volumePackaged || 1)) < 0.2 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${((selectedBatch.volumeAvailable ?? selectedBatch.volumePackaged) / (selectedBatch.volumePackaged || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-copper/10 dark:bg-copper/20 p-3 rounded-lg border border-copper/20 dark:border-copper/30 text-center">
                        <div className="text-[10px] uppercase text-copper font-bold mb-1 flex items-center justify-center gap-1"><Wheat size={12} /> Insumos / Lt</div>
                        <div className="font-mono font-bold text-xl text-copper-dark dark:text-copper">{calculatePerLiterBreakdown(selectedBatch).ingredients === '---' ? '---' : `$${calculatePerLiterBreakdown(selectedBatch).ingredients}`}</div>
                    </div>
                    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 text-center">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1 flex items-center justify-center gap-1"><Building2 size={12} /> {(selectedBatch.status === BatchStatus.PACKAGED || selectedBatch.status === BatchStatus.COMPLETED) ? 'Fijos (Real) / Lt' : 'Fijos (Est) / Lt'}</div>
                        <div className="font-mono font-bold text-xl text-slate-800 dark:text-white">
                            {(() => {
                                if (selectedBatch.status === BatchStatus.PACKAGED || selectedBatch.status === BatchStatus.COMPLETED) {
                                    const stats = getRealMonthAnalysis(selectedBatch, batches, financialHistory, settings);
                                    return `$${stats.realOverheadRate.toFixed(0)}`;
                                } else {
                                    return calculatePerLiterBreakdown(selectedBatch).fixed === '---' ? '---' : `$${calculatePerLiterBreakdown(selectedBatch).fixed}`;
                                }
                            })()}
                        </div>
                    </div>
                    <div className="bg-slate-dark p-3 rounded-lg text-center shadow">
                        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center justify-center gap-1"><DollarSign size={12} /> TOTAL / LT</div>
                        <div className="font-mono font-bold text-xl text-copper">
                            {(() => {
                                if (selectedBatch.status === BatchStatus.PACKAGED || selectedBatch.status === BatchStatus.COMPLETED) {
                                    const stats = getRealMonthAnalysis(selectedBatch, batches, financialHistory, settings);
                                    const ingCost = parseFloat(calculatePerLiterBreakdown(selectedBatch).ingredients) || 0;
                                    const realTotal = ingCost + stats.realOverheadRate;
                                    return `$${realTotal.toFixed(0)}`;
                                } else {
                                    return calculateDynamicCost(selectedBatch) === '---' ? '---' : `$${calculateDynamicCost(selectedBatch)}`;
                                }
                            })()}
                        </div>
                    </div>
                </div>

                {(() => {
                    const stats = getRealMonthAnalysis(selectedBatch, batches, financialHistory, settings);
                    if (selectedBatch.status !== BatchStatus.PACKAGED && selectedBatch.status !== BatchStatus.COMPLETED) return null;
                    return (
                        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mt-4">
                            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase flex items-center gap-2 mb-3"><BarChart3 size={14} /> Análisis Costo Real (Ajustado Mensual)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Mes Prod.</p>
                                    <p className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1"><CalendarRange size={12} className="text-slate-400" /> {stats.monthLabel}</p>
                                    {stats.isClosedMonth && <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800/30">Mes Cerrado</span>}
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Volumen Total Mes</p>
                                    <p className="text-slate-800 dark:text-slate-200 font-mono">{stats.totalMonthlyVolume} Litros</p>
                                    <p className="text-[10px] text-slate-400">en {stats.batchCount} lotes</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Costo Fijo Real / Lt</p>
                                    <p className="text-zinc-700 dark:text-zinc-300 font-bold font-mono text-lg">${stats.realOverheadRate.toFixed(0)}</p>
                                    {stats.costDiff > 0 ? (
                                        <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1"><TrendingDown size={10} /> ${stats.costDiff.toFixed(0)} menos que estimado</p>
                                    ) : stats.costDiff < 0 ? (
                                        <p className="text-[10px] text-red-500">Has pagado más de lo estimado</p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {selectedBatch.status !== BatchStatus.PACKAGED && selectedBatch.status !== BatchStatus.COMPLETED && (
                    <div className="bg-copper/10 dark:bg-copper/20 border border-copper/20 dark:border-copper/30 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-copper/20 p-2 rounded-full text-copper"><ArrowRight size={20} /></div>
                            <div>
                                <p className="text-sm font-bold text-copper-dark dark:text-copper">Siguiente Etapa</p>
                                <p className="text-xs text-copper dark:text-copper/70">
                                    {selectedBatch.status === BatchStatus.MASHING && 'Terminar Cocción y Enfriar'}
                                    {selectedBatch.status === BatchStatus.FERMENTING && 'Terminar Fermentación y Purgar'}
                                    {selectedBatch.status === BatchStatus.CONDITIONING && 'Terminar Maduración y Finalizar'}
                                </p>
                                {getTransitionChecklist(selectedBatch).length > 0 && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                        Falta completar checklist de proceso.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                            {selectedBatch.status === BatchStatus.MASHING && (
                                <button 
                                    onClick={() => setActiveBrewBatchId(selectedBatch.id)} 
                                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition shadow flex items-center justify-center gap-2"
                                >
                                    <Flame size={16} /> Asistente de Cocción
                                </button>
                            )}
                            <button onClick={() => openStageModal(selectedBatch)} className="w-full sm:w-auto bg-copper hover:bg-copper-dark text-white px-6 py-2 rounded-lg text-sm font-bold transition shadow">
                                {getTransitionActionLabel(selectedBatch.status)}
                            </button>
                        </div>
                    </div>
                )}

                {getTransitionChecklist(selectedBatch).length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase mb-2">
                            Checklist previo a {getNextBatchStatus(selectedBatch.status) || 'siguiente etapa'}
                        </p>
                        <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                            {getTransitionChecklist(selectedBatch).map((issue, idx) => (
                                <li key={idx}>- {issue}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-6">Trazabilidad de Volúmenes & Mermas</h4>
                    <div className="relative pt-2 pb-6">
                        <div className="absolute top-8 left-[5%] right-[5%] h-1 bg-slate-200 dark:bg-zinc-700 -z-10"></div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="flex flex-col items-center group">
                                <div className="w-14 h-14 bg-orange-400 rounded-2xl flex items-center justify-center text-white shadow-md mb-3 rotate-3 group-hover:rotate-0 transition border-4 border-white dark:border-zinc-900"><span className="font-bold text-md">{selectedBatch.volumeKettle}</span></div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Olla</p>
                                <span className="text-[9px] text-slate-400 uppercase">Inicial</span>
                            </div>
                            <div className={`flex flex-col items-center transition-opacity ${selectedBatch.volumeFermenter > 0 ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-md mb-3 border-4 border-white dark:border-zinc-900"><span className="font-bold text-md">{selectedBatch.volumeFermenter > 0 ? selectedBatch.volumeFermenter : '?'}</span></div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Ferment.</p>
                                {selectedBatch.volumeFermenter > 0 && selectedBatch.volumeKettle > selectedBatch.volumeFermenter && (
                                    <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full mt-1 font-medium whitespace-nowrap"><ArrowDown size={8} />{selectedBatch.volumeKettle - selectedBatch.volumeFermenter}L</div>
                                )}
                            </div>
                            <div className={`flex flex-col items-center transition-opacity ${(selectedBatch.status === BatchStatus.CONDITIONING || selectedBatch.status === BatchStatus.PACKAGED || selectedBatch.status === BatchStatus.COMPLETED) ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="w-14 h-14 bg-zinc-400 rounded-2xl flex items-center justify-center text-white shadow-md mb-3 border-4 border-white dark:border-zinc-900"><span className="font-bold text-md">{selectedBatch.status === BatchStatus.CONDITIONING ? selectedBatch.volumeFermenter : (selectedBatch.status === BatchStatus.PACKAGED || selectedBatch.status === BatchStatus.COMPLETED ? '~' : '?')}</span></div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Maduración</p>
                                <span className="text-[9px] text-slate-400 uppercase">Frío</span>
                            </div>
                            <div className={`flex flex-col items-center transition-opacity ${selectedBatch.volumePackaged > 0 ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-md mb-3 -rotate-3 group-hover:rotate-0 transition border-4 border-white dark:border-zinc-900"><span className="font-bold text-md">{selectedBatch.volumePackaged > 0 ? selectedBatch.volumePackaged : '?'}</span></div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Final</p>
                                {selectedBatch.volumePackaged > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full mt-1 font-medium whitespace-nowrap"><ArrowDown size={8} />{selectedBatch.volumeFermenter - selectedBatch.volumePackaged}L</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* FERMENTATION LOG SECTION */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 flex justify-between items-center flex-wrap gap-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><LineChart size={16} /> Bitácora de Fermentación</h4>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-200 dark:bg-zinc-700 p-0.5 rounded-lg text-xs mr-2">
                                <button 
                                    onClick={() => setChartMode('gravity')} 
                                    className={`px-2.5 py-1 rounded-md font-medium transition ${chartMode === 'gravity' ? 'bg-white dark:bg-zinc-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                >
                                    Densidad & Temp
                                </button>
                                <button 
                                    onClick={() => setChartMode('attenuation')} 
                                    className={`px-2.5 py-1 rounded-md font-medium transition ${chartMode === 'attenuation' ? 'bg-white dark:bg-zinc-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                >
                                    Atenuación (%)
                                </button>
                            </div>
                            {selectedBatch.status !== BatchStatus.PACKAGED && selectedBatch.status !== BatchStatus.COMPLETED && (
                                <button onClick={() => openLogFermentationModal(selectedBatch)} className="bg-zinc-50 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-zinc-200 dark:border-zinc-600"><Plus size={14} /> Registrar</button>
                            )}
                        </div>
                    </div>
                    {(selectedBatch.fermentationLogs && selectedBatch.fermentationLogs.length > 0) ? (
                        <div className="p-4">
                            <div className="h-64 w-full mb-4">
                                <ResponsiveContainer>
                                    <RechartsLineChart 
                                        data={selectedBatch.fermentationLogs.map(log => {
                                            const ogVal = selectedBatch.originalGravity || 1.050;
                                            const attVal = ogVal > 1 ? Math.max(0, Math.min(100, ((ogVal - log.gravity) / (ogVal - 1)) * 100)) : 0;
                                            return {
                                                ...log,
                                                attenuation: parseFloat(attVal.toFixed(1))
                                            };
                                        })} 
                                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} />
                                        
                                        {chartMode === 'gravity' ? (
                                            <YAxis yAxisId="left" domain={['dataMin - 0.002', 'dataMax + 0.002']} tick={{ fontSize: 10 }} allowDecimals={false} tickFormatter={(g) => g.toFixed(3)} />
                                        ) : (
                                            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10 }} allowDecimals={false} tickFormatter={(a) => `${a}%`} />
                                        )}
                                        
                                        <YAxis yAxisId="right" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10 }} tickFormatter={(t) => `${t}°C`} />
                                        
                                        <YAxis yAxisId="right" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10 }} tickFormatter={(t) => `${t}°C`} />
                                        
                                        <Tooltip 
                                            content={<CustomTooltip />}
                                            cursor={{ stroke: 'rgba(161, 161, 170, 0.2)' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                        
                                        {chartMode === 'gravity' ? (
                                            <Line yAxisId="left" type="monotone" dataKey="gravity" name="Densidad (SG)" stroke="#b87333" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        ) : (
                                            <Line yAxisId="left" type="monotone" dataKey="attenuation" name="Atenuación (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        )}
                                        
                                        <Line yAxisId="right" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    </RechartsLineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="max-h-40 overflow-y-auto border-t border-slate-200 dark:border-zinc-700">
                                <table className="w-full text-xs">
                                    <thead className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800"><tr className="text-left"><th className="p-2">Fecha</th><th className="p-2">Densidad</th><th className="p-2">Atenuación Calc.</th><th className="p-2">Temp</th><th className="p-2">Notas</th><th></th></tr></thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                        {selectedBatch.fermentationLogs.map((log, index, arr) => {
                                            const ogVal = selectedBatch.originalGravity || 1.050;
                                            
                                            // Fallback for UI if gravity is missing
                                            let currentGravity = log.gravity;
                                            if (currentGravity === undefined) {
                                                for (let i = index - 1; i >= 0; i--) {
                                                    if (arr[i].gravity !== undefined) { currentGravity = arr[i].gravity; break; }
                                                }
                                            }
                                            
                                            const attVal = ogVal > 1 && currentGravity !== undefined ? Math.max(0, Math.min(100, ((ogVal - currentGravity) / (ogVal - 1)) * 100)) : 0;
                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                                                    <td className="p-2">
                                                        {log.date}
                                                        {log.action && log.action !== 'MEDICION' && (
                                                            <span className="block text-[10px] font-bold text-copper mt-0.5">{log.action.replace('_', ' ')}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 font-mono font-bold text-copper">{log.gravity ? log.gravity.toFixed(3) : '-'}</td>
                                                    <td className="p-2 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{log.gravity ? `${attVal.toFixed(1)}%` : '-'}</td>
                                                    <td className="p-2 font-mono text-red-500">{log.temperature ? `${log.temperature}°C` : '-'}</td>
                                                    <td className="p-2 text-slate-500 dark:text-slate-400 italic">{log.notes}</td>
                                                    <td className="p-2 text-right">
                                                        {selectedBatch.status !== BatchStatus.PACKAGED && selectedBatch.status !== BatchStatus.COMPLETED && (
                                                            <button onClick={() => handleLogDelete(log.id)}><Trash2 size={12} className="text-slate-300 hover:text-red-500" /></button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-8 text-slate-400 dark:text-slate-500 text-sm">No hay mediciones registradas.</div>
                    )}
                </div>

                {/* SENSORY PROFILES SECTION */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden mt-6">
                    <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Thermometer size={16} /> Control de Calidad & Cata</h4>
                        <button onClick={() => openSensoryModal(selectedBatch)} className="bg-zinc-50 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-zinc-200 dark:border-zinc-600"><Plus size={14} /> Nueva Cata</button>
                    </div>
                    {(selectedBatch.sensoryProfiles && selectedBatch.sensoryProfiles.length > 0) ? (
                        <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                            {selectedBatch.sensoryProfiles.map(profile => (
                                <div key={profile.id} className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.date} <span className="text-slate-400 dark:text-slate-500 font-normal">por {profile.evaluator || 'Anónimo'}</span></p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded border border-slate-200 dark:border-zinc-700">
                                                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                                <span className="text-xs font-bold">{profile.overallScore}</span>
                                            </div>
                                            <button onClick={() => handleSensoryDelete(profile.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs mb-3">
                                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-2 rounded border border-slate-100 dark:border-zinc-700">
                                            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Eye size={10} /> Apariencia <span className="ml-auto text-slate-800 dark:text-slate-200 font-mono">{profile.appearance.score}/5</span></p>
                                            <div className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                                <p>Color: {profile.appearance.color}</p>
                                                <p>Claridad: {profile.appearance.clarity}</p>
                                                <p>Espuma: {profile.appearance.foam.formation}, {profile.appearance.foam.retention}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-2 rounded border border-slate-100 dark:border-zinc-700">
                                            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Wind size={10} /> Aroma <span className="ml-auto text-slate-800 dark:text-slate-200 font-mono">{profile.aroma.score}/5</span></p>
                                            <div className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                                <p>Malta: {profile.aroma.malt || '-'}</p>
                                                <p>Lúpulo: {profile.aroma.hops || '-'}</p>
                                                <p>Levadura: {profile.aroma.yeast || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-2 rounded border border-slate-100 dark:border-zinc-700">
                                            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Utensils size={10} /> Sabor <span className="ml-auto text-slate-800 dark:text-slate-200 font-mono">{profile.flavor.score}/5</span></p>
                                            <div className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                                <p>Balance: {profile.flavor.balance || '-'}</p>
                                                <p>Retrogusto: {profile.flavor.aftertaste || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-zinc-800/50 p-2 rounded border border-slate-100 dark:border-zinc-700">
                                            <p className="font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Activity size={10} /> Boca <span className="ml-auto text-slate-800 dark:text-slate-200 font-mono">{profile.mouthfeel.score}/5</span></p>
                                            <div className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                                <p>Cuerpo: {profile.mouthfeel.body}</p>
                                                <p>Carbonatación: {profile.mouthfeel.carbonation}</p>
                                                <p>Textura: {profile.mouthfeel.texture || '-'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {profile.defects.length > 0 && (
                                        <div className="mb-2">
                                            <span className="text-[10px] font-bold text-red-500 uppercase mr-2">Defectos:</span>
                                            {profile.defects.map((d, i) => <span key={i} className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded border border-red-100 dark:border-red-800/50 mr-1">{d}</span>)}
                                        </div>
                                    )}

                                    {profile.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-yellow-50/50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-100 dark:border-yellow-900/30">"{profile.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-slate-400 dark:text-slate-500 text-sm">No hay perfiles sensoriales registrados.</div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-slate-200 dark:border-zinc-700 relative group transition-colors">
                        <button onClick={() => openEditCostsModal(selectedBatch)} className="absolute top-3 right-3 text-slate-400 hover:text-copper p-1"><Pencil size={14} /></button>
                        <h5 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><FileText size={16} /> Estructura de Costos Global</h5>
                        <ul className="space-y-3 text-sm">
                            <li className="flex justify-between items-center"><span className="text-slate-500 dark:text-slate-400">Insumos (Materia Prima)</span><span className="font-mono font-medium bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200">${selectedBatch.totalIngredientsCost.toFixed(0)}</span></li>
                            <li className="flex justify-between items-center"><span className="text-slate-500 dark:text-slate-400">Overhead (Fijos/Var)</span><span className="font-mono font-medium bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200">${selectedBatch.overheadCost.toFixed(0)}</span></li>
                            <li className="flex justify-between items-center border-t border-slate-200 dark:border-zinc-700 pt-3 font-bold text-slate-800 dark:text-slate-200"><span>Inversión Total</span><span>${(selectedBatch.totalIngredientsCost + selectedBatch.overheadCost).toFixed(0)}</span></li>
                        </ul>
                        {selectedBatch.ingredientsUsed && selectedBatch.ingredientsUsed.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-zinc-700/50">
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase">Detalle Insumos:</p>
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                    {selectedBatch.ingredientsUsed.map((ing, i) => (
                                        <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                                            <span>{ing.name} <span className="opacity-50">({ing.amountUsed}{ing.unit})</span></span>
                                            <span>${(ing.amountUsed * ing.costAtTime).toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-slate-200 dark:border-zinc-700 transition-colors">
                        <h5 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><FileText size={16} /> Datos Técnicos</h5>
                        <ul className="space-y-3 text-sm">
                            <li className="flex justify-between items-center"><span className="text-slate-500 dark:text-slate-400">Densidad Inicial (OG)</span><span className="font-mono font-bold bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-copper">{selectedBatch.originalGravity || '-'}</span></li>
                            <li className="flex justify-between items-center"><span className="text-slate-500 dark:text-slate-400">Densidad Final (FG)</span><span className="font-mono font-bold bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400">{selectedBatch.finalGravity || '-'}</span></li>
                            <li className="flex justify-between items-center"><span className="text-slate-500 dark:text-slate-400">Alcohol Estimado (ABV)</span><span className="font-mono font-bold bg-copper/10 dark:bg-copper/20 px-2 py-0.5 rounded text-copper border border-copper/30">{selectedBatch.finalGravity > 0 ? ((selectedBatch.originalGravity - selectedBatch.finalGravity) * 131.25).toFixed(1) + '%' : 'Pendiente'}</span></li>
                            {(() => {
                                let eff = 0;
                                if (selectedBatch.originalGravity && selectedBatch.volumeFermenter) {
                                    const totalGrain = selectedBatch.ingredientsUsed
                                        ?.filter(i => i.type === 'MALT' || i.type === 'ADJUNCT')
                                        .reduce((sum, i) => {
                                            let qty = i.amountUsed;
                                            if (i.unit === 'g' || i.unit === 'gr' || i.unit === 'ml') {
                                                qty = qty / 1000;
                                            }
                                            return sum + qty;
                                        }, 0) || 0;
                                    let og = selectedBatch.originalGravity;
                                    if (og >= 1000) og = og / 1000;
                                    
                                    if (totalGrain > 0) {
                                        const actual = selectedBatch.volumeFermenter * (og - 1) * 1000;
                                        const potential = totalGrain * 300;
                                        eff = (actual / potential) * 100;
                                    }
                                }
                                return eff > 0 ? (
                                    <li className="flex justify-between items-center border-t border-slate-200 dark:border-zinc-700 pt-3"><span className="text-slate-500 dark:text-slate-400 font-bold">Eficiencia (Brewhouse)</span><span className="font-mono font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">{eff.toFixed(1)}%</span></li>
                                ) : null;
                            })()}
                        </ul>
                    </div>
                </div>

                {selectedBatch.volumePackaged < selectedBatch.volumeFermenter && selectedBatch.volumePackaged > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-500 dark:text-red-400 shrink-0 mt-1" size={18} />
                        <div>
                            <h5 className="text-red-800 dark:text-red-300 font-bold text-sm">Alerta de Rentabilidad</h5>
                            <p className="text-red-700 dark:text-red-400 text-xs mt-1 leading-relaxed">
                                Las mermas finales ({selectedBatch.volumeFermenter - selectedBatch.volumePackaged}L) aumentaron tu costo en <strong className="mx-1 bg-red-100 dark:bg-red-900/40 px-1 rounded">${(parseFloat(calculateDynamicCost(selectedBatch)) - ((selectedBatch.totalIngredientsCost + selectedBatch.overheadCost) / (selectedBatch.volumeFermenter || 1))).toFixed(0)}/Litro</strong>. Revisa tus procesos de purga y dry-hopping.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
