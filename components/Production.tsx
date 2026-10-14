import React, { useState, useEffect, useMemo } from 'react';
import { Batch, BatchIngredient, BatchStatus, MasterRecipe, FermentationLog, SensoryProfile } from '../types';
import { Plus, Beaker, Archive, FlaskConical, Beer, Search, Star, Activity, Droplet, Percent, CheckCircle } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { useToast } from './Toast';
import { ProductionModalManager } from './production/modals/ProductionModalManager';
import { ProductionBatchList } from './production/ProductionBatchList';
import { ProductionBatchDetail } from './production/ProductionBatchDetail';
import { BrewAssistant } from './brew-assistant/BrewAssistant';
import { DebouncedInput } from './ui/DebouncedInput';
import { generateSmartLotCode, getOverheadRate, getEffectiveVolume, calculateProjectedOverhead, isValidBatchTransition, getTransitionChecklist } from './production/utils';
import { newBatchSchema } from '../lib/validations';
import { assignmentError, runFormAction } from './production/fermenterUi';
import { StarRating } from './ui/StarRating';

type ModalMode = 'NEW' | 'UPDATE_FERMENT' | 'UPDATE_CONDITION' | 'UPDATE_PACKAGE' | 'EDIT_COSTS' | 'DELETE' | 'EDIT_BATCH' | 'LOG_FERMENTATION' | 'SENSORY' | 'NONE';
type Tab = 'ACTIVE' | 'HISTORY';

export const Production: React.FC = React.memo(() => {
    const storedBatches = useBreweryStore(s => s.batches);
    const inventory = useBreweryStore(s => s.inventory);
    const settings = useBreweryStore(s => s.settings);
    const financialHistory = useBreweryStore(s => s.financialHistory);
    const masterRecipes = useBreweryStore(s => s.masterRecipes);
    const fermenters = useBreweryStore(s => s.fermenters);
    const batches = useMemo(() => storedBatches.map(b => ({ ...b, fermenterName: b.fermenterId ? fermenters.find(f => f.id === b.fermenterId)?.name ?? b.fermenterName : undefined })), [storedBatches, fermenters]);
    const addBatch = useBreweryStore(s => s.addBatch);
    const updateBatch = useBreweryStore(s => s.updateBatch);
    const deleteBatch = useBreweryStore(s => s.deleteBatch);
    const addMasterRecipe = useBreweryStore(s => s.addMasterRecipe);
    const addFermentationLog = useBreweryStore(s => s.addFermentationLog);
    const deleteFermentationLog = useBreweryStore(s => s.deleteFermentationLog);
    const addSensoryProfile = useBreweryStore(s => s.addSensoryProfile);
    const deleteSensoryProfile = useBreweryStore(s => s.deleteSensoryProfile);
    const addCalendarEvent = useBreweryStore(s => s.addCalendarEvent);
    const activeBrewBatchId = useBreweryStore(s => s.activeBrewBatchId);
    const { showToast } = useToast();
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const selectedBatch = useMemo(() => batches.find(b => b.id === selectedBatchId) || null, [batches, selectedBatchId]);

    const [activeTab, setActiveTab] = useState<Tab>('ACTIVE');

    const [modalMode, setModalMode] = useState<ModalMode>('NONE');
    const [tempData, setTempData] = useState<any>({});

    const [recipeIngredients, setRecipeIngredients] = useState<BatchIngredient[]>([]);
    const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
    const [amountToAdd, setAmountToAdd] = useState<number>(0);

    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const [logForm, setLogForm] = useState<Omit<FermentationLog, 'id'>>({ date: new Date().toISOString().split('T')[0], gravity: 1.050, temperature: 20, notes: '' });
    const [sensoryForm, setSensoryForm] = useState<Omit<SensoryProfile, 'id'>>({
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

    const filteredBatches = useMemo(() => {
        let list = batches.filter(b => {
            if (activeTab === 'ACTIVE') return b.status !== BatchStatus.COMPLETED;
            return b.status === BatchStatus.COMPLETED;
        });
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(b =>
                b.recipeName.toLowerCase().includes(q) ||
                b.lotCode.toLowerCase().includes(q) ||
                b.style.toLowerCase().includes(q)
            );
        }
        return list;
    }, [batches, activeTab, searchQuery]);

    // --- PRODUCTION STATS (Mini-Dashboard) ---
    const productionStats = useMemo(() => {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        // Active = all batches not completed/agotado (includes PACKAGED as "ready but in plant")
        const active = batches.filter(b => b.status !== BatchStatus.COMPLETED);
        // In-process = actively being brewed/fermented/conditioned (not yet packaged)
        const inProcess = batches.filter(b => b.status !== BatchStatus.COMPLETED && b.status !== BatchStatus.PACKAGED);
        
        // Litros: sum the best available volume for each active batch
        const litersInPlant = active.reduce((sum, b) => {
            if (b.volumePackaged > 0) return sum + b.volumePackaged;
            if (b.volumeFermenter > 0) return sum + b.volumeFermenter;
            return sum + b.volumeKettle;
        }, 0);
        
        // Active Trend (started this week)
        const activeStartedThisWeek = inProcess.filter(b => now - new Date(b.brewDate).getTime() <= oneWeek).length;
        const litersBrewedThisWeek = inProcess.filter(b => now - new Date(b.brewDate).getTime() <= oneWeek).reduce((sum, b) => sum + b.volumeKettle, 0);

        // Efficiency calculation helper
        const calcEfficiency = (batchList: typeof batches) => {
            let valid = 0;
            const total = batchList.reduce((sum, b) => {
                const grainKg = b.ingredientsUsed.filter(i => i.type === 'MALT').reduce((s, i) => s + i.amountUsed, 0);
                if (grainKg === 0 || !b.originalGravity || !b.volumeFermenter) return sum;
                const actual = b.volumeFermenter * (b.originalGravity - 1) * 1000;
                const potential = grainKg * 300;
                if (potential > 0) {
                    valid++;
                    return sum + (actual / potential) * 100;
                }
                return sum;
            }, 0);
            return valid > 0 ? total / valid : 0;
        };

        // Efficiency: calculate over all active batches that have enough data
        const activeBatchesWithData = active.filter(b => 
            b.originalGravity > 0 && 
            b.volumeFermenter > 0 && 
            b.ingredientsUsed.some(i => i.type === 'MALT' && i.amountUsed > 0)
        );
        
        let activeEfficiency = 0;
        if (activeBatchesWithData.length > 0) {
            activeEfficiency = calcEfficiency(activeBatchesWithData);
        }

        // Historical Efficiency (last 5 finished)
        const finished = batches.filter(b => b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED);
        const last5 = finished.slice(-5);
        const historicalEfficiency = calcEfficiency(last5);
        
        const readyLots = batches.filter(b => b.status === BatchStatus.PACKAGED).length;
        const readyThisWeek = batches.filter(b => b.status === BatchStatus.PACKAGED && b.packagedDate && (now - new Date(b.packagedDate).getTime() <= oneWeek)).length;

        return { 
            activeCount: inProcess.length, 
            litersInPlant, 
            activeEfficiency,
            historicalEfficiency, 
            readyLots,
            trends: {
                active: activeStartedThisWeek,
                liters: litersBrewedThisWeek,
                ready: readyThisWeek
            }
        };
    }, [batches]);

    const calculateCurrentRecipeCost = () => {
        return recipeIngredients.reduce((sum, item) => sum + (item.amountUsed * item.costAtTime), 0).toFixed(0);
    };

    const openNewBatchModal = () => {
        setTempData({
            recipeName: '',
            style: '',
            volumeKettle: 300,
            brewDate: new Date().toISOString().split('T')[0],
            lotCode: generateSmartLotCode('', batches),
            fermenterId: '',
            fermenterName: ''
        });
        setRecipeIngredients([]);
        setSelectedRecipeId('');
        setModalMode('NEW');
    };

    const scaleIngredients = (recipeId: string, targetVolume: number) => {
        if (!recipeId) {
            setRecipeIngredients([]);
            return;
        }
        const recipe = masterRecipes.find(r => r.id === recipeId);
        if (!recipe || !recipe.batchSize || recipe.batchSize <= 0) return;

        const scaleFactor = targetVolume / recipe.batchSize;

        const scaledIngredients = recipe.ingredients.map(ing => {
            const inventoryItem = inventory.find(i => i.id === ing.inventoryId);
            const currentCost = inventoryItem ? inventoryItem.costPerUnit : ing.costAtTime;

            return {
                ...ing,
                amountUsed: parseFloat((ing.amountUsed * scaleFactor).toFixed(2)),
                costAtTime: currentCost
            };
        });

        setRecipeIngredients(scaledIngredients);
    };

    const handleRecipeSelect = (recipeId: string) => {
        setSelectedRecipeId(recipeId);
        if (!recipeId) {
             setRecipeIngredients([]);
             return;
        }

        const recipe = masterRecipes.find(r => r.id === recipeId);
        if (!recipe) return;

        setTempData({
            ...tempData,
            recipeName: recipe.name,
            style: recipe.style,
            lotCode: generateSmartLotCode(recipe.name, batches)
        });

        scaleIngredients(recipeId, parseFloat(tempData.volumeKettle) || 0);
    };

    // Re-scale ingredients when Kettle Volume changes if a recipe is selected
    useEffect(() => {
        if (selectedRecipeId && tempData.volumeKettle) {
            const recipe = masterRecipes.find(r => r.id === selectedRecipeId);
            if (!recipe || !recipe.batchSize || recipe.batchSize <= 0) return;
            const scaleFactor = parseFloat(tempData.volumeKettle) / recipe.batchSize;
            setRecipeIngredients(prev => prev.map(ing => {
                const baseIng = recipe.ingredients.find(bi => bi.inventoryId === ing.inventoryId);
                if (!baseIng) return ing;
                return {
                    ...ing,
                    amountUsed: parseFloat((baseIng.amountUsed * scaleFactor).toFixed(2))
                };
            }));
        }
    }, [tempData.volumeKettle, selectedRecipeId, masterRecipes]);

    // Helper for Star Rating (Moved to StarRating component)

    // Auto-calculate overall score
    useEffect(() => {
        if (modalMode === 'SENSORY') {
            const scores = [sensoryForm.appearance.score, sensoryForm.aroma.score, sensoryForm.flavor.score, sensoryForm.mouthfeel.score];
            const avg = scores.reduce((a, b) => a + b, 0) / 4;
            setSensoryForm(prev => ({ ...prev, overallScore: parseFloat(avg.toFixed(1)) }));
        }
    }, [sensoryForm.appearance.score, sensoryForm.aroma.score, sensoryForm.flavor.score, sensoryForm.mouthfeel.score, modalMode]);

    const closeModal = () => {
        setModalMode('NONE');
        setTempData({});
    };

    const validateTank = (batch: Batch) => {
        if (!batch.fermenterId) return;
        const error = assignmentError(useBreweryStore.getState().fermenters.find(f => f.id === batch.fermenterId), batch);
        if (error) throw new Error(error);
    };
    const saveBatchUpdate = (id: string, updates: Partial<Batch>) => {
        const current = useBreweryStore.getState().batches.find(b => b.id === id);
        if (!current) throw new Error('El lote ya no existe.');
        const candidate = { ...current, ...updates };
        if (candidate.status !== BatchStatus.PACKAGED && candidate.status !== BatchStatus.COMPLETED) validateTank(candidate);
        else if (updates.fermenterId && updates.fermenterId !== current.fermenterId) validateTank(candidate);
        updateBatch(id, updates);
    };

    const handleSubmit = () => runFormAction(() => {
        if (modalMode === 'NEW') {
            const result = newBatchSchema.safeParse({
                recipeId: selectedRecipeId,
                recipeName: tempData.recipeName,
                volumeKettle: parseFloat(tempData.volumeKettle) || 0,
                brewDate: tempData.brewDate,
                lotCode: tempData.lotCode
            });

            if (!result.success) {
                const firstError = result.error.issues[0].message;
                return showToast({ message: firstError, type: 'warning' });
            }

            // Inventory validation
            if (tempData.discountIngredientsNow !== false) {
                for (const ing of recipeIngredients) {
                    const invItem = inventory.find(i => i.id === ing.inventoryId);
                    // Only block if the item is linked and has insufficient stock
                    if (invItem && invItem.stockAmount < ing.amountUsed) {
                        return showToast({ 
                            message: `Stock insuficiente de ${ing.name}. Requerido: ${ing.amountUsed.toFixed(2)}${ing.unit}, Disponible: ${invItem.stockAmount.toFixed(2)}${ing.unit}`, 
                            type: 'warning' 
                        });
                    }
                }
            }

            const kettleVol = result.data.volumeKettle;
            const calculatedIngCost = parseFloat(calculateCurrentRecipeCost());
            const overheadRate = getOverheadRate(settings, batches);
            const initialOverhead = overheadRate > 0 ? (overheadRate * (kettleVol * 0.85)) : 0;
            const newBatch: Batch = { 
                id: crypto.randomUUID(), 
                recipeName: result.data.recipeName, 
                style: tempData.style || 'Ale Genérica', 
                brewDate: result.data.brewDate, 
                status: BatchStatus.MASHING, 
                volumeKettle: kettleVol, 
                volumeFermenter: 0, 
                volumePackaged: 0, 
                ingredientsUsed: recipeIngredients, 
                totalIngredientsCost: calculatedIngCost, 
                overheadCost: parseFloat(initialOverhead.toFixed(0)), 
                originalGravity: 0, 
                finalGravity: 0, 
                lotCode: result.data.lotCode, 
                fermenterId: tempData.fermenterId || undefined,
                fermenterName: tempData.fermenterName || undefined,
                fermentationLogs: [], 
                ingredientsDiscounted: tempData.discountIngredientsNow !== false 
            };
            validateTank(newBatch);
            addBatch(newBatch);
            
            // Auto-generate events based on style
            import('../services/eventGenerator').then(({ generateBatchEvents }) => {
                const events = generateBatchEvents(newBatch.id, newBatch.recipeName, newBatch.style, newBatch.brewDate);
                events.forEach(ev => addCalendarEvent(ev));
            }).catch(() => showToast({ message: 'Lote guardado, pero no se pudieron generar sus eventos.', type: 'warning' }));

            setSelectedBatchId(newBatch.id);
        }
        else if (modalMode === 'UPDATE_FERMENT' && selectedBatch) {
            if (!isValidBatchTransition(selectedBatch.status, BatchStatus.FERMENTING)) {
                return showToast({ message: 'Transición inválida de estado', type: 'warning' });
            }
            const checklistIssues = getTransitionChecklist(selectedBatch);
            if (checklistIssues.length > 0) return showToast({ message: checklistIssues[0], type: 'warning' });
            saveBatchUpdate(selectedBatch.id, { 
                status: BatchStatus.FERMENTING, 
                volumeFermenter: parseFloat(tempData.volumeFermenter) || 0, 
                originalGravity: parseFloat(tempData.originalGravity) || 1.050,
                ...(tempData.fermenterId !== undefined ? { fermenterId: tempData.fermenterId, fermenterName: tempData.fermenterName } : {})
            });
        }
        else if (modalMode === 'UPDATE_CONDITION' && selectedBatch) {
            if (!isValidBatchTransition(selectedBatch.status, BatchStatus.CONDITIONING)) {
                return showToast({ message: 'Transición inválida de estado', type: 'warning' });
            }
            const checklistIssues = getTransitionChecklist(selectedBatch);
            if (checklistIssues.length > 0) return showToast({ message: checklistIssues[0], type: 'warning' });
            saveBatchUpdate(selectedBatch.id, { status: BatchStatus.CONDITIONING, volumeFermenter: parseFloat(tempData.volumeFermenter) || selectedBatch.volumeFermenter, finalGravity: parseFloat(tempData.finalGravity) || 0 });
        }
        else if (modalMode === 'UPDATE_PACKAGE' && selectedBatch) {
            if (!isValidBatchTransition(selectedBatch.status, BatchStatus.PACKAGED)) {
                return showToast({ message: 'Transición inválida de estado', type: 'warning' });
            }
            const checklistIssues = getTransitionChecklist(selectedBatch);
            if (checklistIssues.length > 0) return showToast({ message: checklistIssues[0], type: 'warning' });
            const packagedVol = parseFloat(tempData.volumePackaged) || 0;
            if (packagedVol <= 0) return showToast({ message: 'El volumen final debe ser mayor a 0', type: 'warning' });
            saveBatchUpdate(selectedBatch.id, {
                status: BatchStatus.PACKAGED,
                volumePackaged: packagedVol,
                finalGravity: parseFloat(tempData.finalGravity) || 1.010,
                volumeAvailable: packagedVol,
                packagedDate: new Date().toISOString().split('T')[0]
            });
        }
        else if (modalMode === 'EDIT_COSTS' && selectedBatch) {
            saveBatchUpdate(selectedBatch.id, { totalIngredientsCost: parseFloat(tempData.totalIngredientsCost), overheadCost: parseFloat(tempData.overheadCost) });
        }
        else if (modalMode === 'EDIT_BATCH' && selectedBatch) {
            const updates = { 
                recipeName: tempData.recipeName, 
                style: tempData.style, 
                lotCode: tempData.lotCode, 
                brewDate: tempData.brewDate, 
                volumeKettle: parseFloat(tempData.volumeKettle) || 0, 
                volumeFermenter: parseFloat(tempData.volumeFermenter) || 0, 
                volumePackaged: parseFloat(tempData.volumePackaged) || 0, 
                volumeAvailable: parseFloat(tempData.volumeAvailable) || 0, 
                originalGravity: parseFloat(tempData.originalGravity) || 0, 
                finalGravity: parseFloat(tempData.finalGravity) || 0,
                ...(tempData.fermenterId !== undefined ? { fermenterId: tempData.fermenterId, fermenterName: tempData.fermenterName } : {})
            };
            saveBatchUpdate(selectedBatch.id, updates);
        }
        else if (modalMode === 'LOG_FERMENTATION' && selectedBatch) {
            addFermentationLog(selectedBatch.id, logForm);
        }
        else if (modalMode === 'SENSORY' && selectedBatch) {
            addSensoryProfile(selectedBatch.id, sensoryForm);
        }
        else if (modalMode === 'DELETE' && selectedBatch) {
            deleteBatch(selectedBatch.id);
            setSelectedBatchId(null);
        }
        closeModal();
    }, message => showToast({ message, type: 'warning' }));

    return (
        <div className="space-y-6 h-full flex flex-col relative">

            {activeBrewBatchId && (
                <BrewAssistant batchId={activeBrewBatchId} />
            )}

            <ProductionModalManager
                modalMode={modalMode}
                selectedBatch={selectedBatch}
                closeModal={closeModal}
                handleSubmit={handleSubmit}
                tempData={tempData}
                setTempData={setTempData}
                logForm={logForm}
                setLogForm={setLogForm}
                sensoryForm={sensoryForm}
                setSensoryForm={setSensoryForm}
                masterRecipes={masterRecipes}
                selectedRecipeId={selectedRecipeId}
                handleRecipeSelect={handleRecipeSelect}
                recipeIngredients={recipeIngredients}
                calculateCurrentRecipeCost={calculateCurrentRecipeCost}
                getEffectiveVolume={() => getEffectiveVolume(settings, batches)}
                settings={settings}
                calculateProjectedOverhead={(vol) => calculateProjectedOverhead(vol, settings, batches)}
                stageChecklist={selectedBatch ? getTransitionChecklist(selectedBatch) : []}
                fermenters={fermenters}
            />

            {/* === HERO MINI-DASHBOARD === */}
            <div className="bg-slate-dark rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center">
                    <Beer size={200} className="opacity-50" />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <FlaskConical size={24} className="text-copper" />
                            Producción
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Costeo dinámico en tiempo real</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div 
                                className="bg-white/5 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-center min-w-[110px] group relative" 
                                title="Lotes activos actualmente en cocción, fermentación o maduración."
                            >
                                <p className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-center gap-1">🔥 En Proceso</p>
                                <p className="text-xl font-bold font-mono text-copper">{productionStats.activeCount}</p>
                                {productionStats.trends.active > 0 && (
                                    <p className="text-[9px] text-green-400 mt-1 flex items-center justify-center gap-0.5">
                                        ↑ {productionStats.trends.active} esta sem
                                    </p>
                                )}
                            </div>
                            
                            <div 
                                className="bg-white/5 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-center min-w-[110px] group relative"
                                title="Volumen total en litros actualmente dentro de la planta."
                            >
                                <p className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-center gap-1">💧 Litros</p>
                                <p className="text-xl font-bold font-mono text-white">{productionStats.litersInPlant}L</p>
                                {productionStats.trends.liters > 0 && (
                                    <p className="text-[9px] text-green-400 mt-1 flex items-center justify-center gap-0.5">
                                        ↑ {productionStats.trends.liters}L cocinados
                                    </p>
                                )}
                            </div>
                            
                            <div 
                                className="bg-white/5 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-center min-w-[110px] group relative" 
                                title="Eficiencia promedio histórica (últimos 5 terminados) y actual (en proceso)."
                            >
                                <p className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-center gap-1">📊 Eficiencia</p>
                                <p className="text-xl font-bold font-mono text-green-400">{productionStats.historicalEfficiency > 0 ? `${productionStats.historicalEfficiency.toFixed(0)}%` : <span className="text-sm opacity-50">S/D</span>}</p>
                                {productionStats.activeEfficiency > 0 && (
                                    <p className="text-[9px] text-blue-400 mt-1 flex items-center justify-center gap-0.5" title={`Eficiencia de los lotes en planta: ${productionStats.activeEfficiency.toFixed(1)}%`}>
                                        ⚡ {productionStats.activeEfficiency.toFixed(1)}% actual
                                    </p>
                                )}
                            </div>
                            
                            <div 
                                className="bg-white/5 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-center min-w-[110px] group relative"
                                title="Lotes envasados listos para la venta o distribución."
                            >
                                <p className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-center gap-1">✅ Listos</p>
                                <p className="text-xl font-bold font-mono text-amber-400">{productionStats.readyLots}</p>
                                {productionStats.trends.ready > 0 && (
                                    <p className="text-[9px] text-green-400 mt-1 flex items-center justify-center gap-0.5">
                                        ↑ {productionStats.trends.ready} esta sem
                                    </p>
                                )}
                            </div>
                        </div>
                        <button onClick={openNewBatchModal} className="bg-copper hover:bg-copper-dark text-white px-5 py-3 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-copper/30 whitespace-nowrap">
                            <Plus size={18} /> Nuevo Lote
                        </button>
                    </div>
                </div>
            </div>

            {/* === TABS + SEARCH === */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button onClick={() => { setActiveTab('ACTIVE'); setSelectedBatchId(null); setSearchQuery(''); }} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'ACTIVE' ? 'bg-white dark:bg-zinc-700 text-copper shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        <span className="flex items-center gap-2"><Beaker size={14} /> En Planta</span>
                    </button>
                    <button onClick={() => { setActiveTab('HISTORY'); setSelectedBatchId(null); setSearchQuery(''); }} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Archive size={14} /> Historial
                    </button>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <DebouncedInput
                        type="text"
                        placeholder="Buscar lote, receta, estilo..."
                        value={searchQuery}
                        onDebouncedChange={v => setSearchQuery(v)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition"
                    />
                </div>
            </div>

            {/* === MAIN GRID === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <ProductionBatchList
                    activeTab={activeTab}
                    filteredBatches={filteredBatches}
                    searchQuery={searchQuery}
                    masterRecipes={masterRecipes}
                    selectedBatchId={selectedBatchId}
                    setSelectedBatchId={setSelectedBatchId}
                    openNewBatchModal={openNewBatchModal}
                />
                
                <ProductionBatchDetail
                    selectedBatch={selectedBatch}
                    setSelectedBatchId={setSelectedBatchId}
                    setModalMode={setModalMode}
                    setTempData={setTempData}
                    setLogForm={setLogForm}
                    setSensoryForm={setSensoryForm}
                    openNewBatchModal={openNewBatchModal}
                />
            </div>
        </div>
    );
});