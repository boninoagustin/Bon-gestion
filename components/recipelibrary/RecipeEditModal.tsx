import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X, Wheat, Plus, Save, Trash2 } from 'lucide-react';
import { MasterRecipe, BatchIngredient } from '../../types';
import { useBreweryStore } from '../../context/store';
import { useToast } from '../Toast';
import { DebouncedInput } from '../ui/DebouncedInput';
import { BJCP_STYLES } from '../../lib/bjcp';

interface RecipeEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialRecipe: MasterRecipe | null;
}

export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({
    isOpen,
    onClose,
    initialRecipe
}) => {
    const masterRecipes = useBreweryStore(s => s.masterRecipes);
    const inventory = useBreweryStore(s => s.inventory);
    const updateMasterRecipe = useBreweryStore(s => s.updateMasterRecipe);
    const addMasterRecipe = useBreweryStore(s => s.addMasterRecipe);
    const { showToast } = useToast();
    const [editingRecipe, setEditingRecipe] = useState<MasterRecipe | null>(null);

    // Edit Ingredient States
    const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
    const [amountToAdd, setAmountToAdd] = useState<number>(0);
    const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && initialRecipe) {
            setEditingRecipe({ ...initialRecipe, ingredients: initialRecipe.ingredients || [] });
            setSelectedInventoryId('');
            setAmountToAdd(0);
            setEditingIngredientIndex(null);
        } else {
            setEditingRecipe(null);
        }
    }, [isOpen, initialRecipe]);

    const handleSaveModified = () => {
        if (!editingRecipe) return;
        if (!editingRecipe.name) return showToast({ message: 'El nombre es obligatorio', type: 'warning' });

        const exists = masterRecipes.find(r => r.id === editingRecipe.id);
        if (exists) {
            // Sobreescribir receta existente
            updateMasterRecipe(editingRecipe.id, editingRecipe);
            showToast({ message: 'Receta actualizada exitosamente', type: 'success' });
        } else {
            addMasterRecipe({ ...editingRecipe, version: 1 });
            showToast({ message: 'Receta guardada', type: 'success' });
        }
        onClose();
    };

    const handleAddIngredient = () => {
        if (!editingRecipe || !selectedInventoryId || amountToAdd <= 0) return;

        const invItem = inventory.find(i => i.id === selectedInventoryId);
        if (!invItem) return;

        const newIngredient: BatchIngredient = {
            inventoryId: invItem.id,
            name: invItem.name,
            amountUsed: amountToAdd,
            costAtTime: invItem.costPerUnit,
            unit: invItem.unit,
            type: invItem.type
        };

        if (editingIngredientIndex !== null) {
            const newIngredients = [...editingRecipe.ingredients];
            newIngredients[editingIngredientIndex] = newIngredient;
            setEditingRecipe({
                ...editingRecipe,
                ingredients: newIngredients
            });
            setEditingIngredientIndex(null);
        } else {
            setEditingRecipe({
                ...editingRecipe,
                ingredients: [...editingRecipe.ingredients, newIngredient]
            });
        }

        setSelectedInventoryId('');
        setAmountToAdd(0);
    };

    const handleEditIngredient = (index: number) => {
        if (!editingRecipe) return;
        const ingredient = (editingRecipe.ingredients || [])[index];
        if (!ingredient) return;
        setEditingIngredientIndex(index);
        setSelectedInventoryId(ingredient.inventoryId);
        setAmountToAdd(ingredient.amountUsed);
    };

    const handleCancelEditIngredient = () => {
        setEditingIngredientIndex(null);
        setSelectedInventoryId('');
        setAmountToAdd(0);
    };

    const handleRemoveIngredient = (index: number) => {
        if (!editingRecipe) return;
        const newIngredients = [...editingRecipe.ingredients];
        newIngredients.splice(index, 1);
        setEditingRecipe({ ...editingRecipe, ingredients: newIngredients });
        if (editingIngredientIndex === index) {
            handleCancelEditIngredient();
        }
    };

    if (!isOpen || !editingRecipe) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-zinc-800">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/80">
                    <h3 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Pencil size={18} className="text-copper" /> {masterRecipes.find(r => r.id === editingRecipe.id) ? 'Editar Receta' : 'Importar Receta'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nombre Receta</label>
                            <DebouncedInput type="text" value={editingRecipe.name} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, name: v })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-2 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Guía Estilo BJCP 2021</label>
                            <input 
                                list="bjcp-styles"
                                value={editingRecipe.style}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const matchedStyle = BJCP_STYLES[val];
                                    
                                    if (matchedStyle && editingRecipe.style !== val) {
                                        setEditingRecipe({
                                            ...editingRecipe,
                                            style: val,
                                            targetOG: matchedStyle.og.min,
                                            targetFG: matchedStyle.fg.min,
                                            targetIBU: matchedStyle.ibu.min,
                                            targetColor: matchedStyle.srm.min
                                        });
                                        showToast({ message: `Estilo "${val}" seleccionado. Autocompletado.`, type: 'info' });
                                    } else {
                                        setEditingRecipe({ ...editingRecipe, style: val });
                                    }
                                }}
                                placeholder="Buscar estilo o escribir..."
                                className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-2 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all"
                            />
                            <datalist id="bjcp-styles">
                                {Object.keys(BJCP_STYLES).map(k => (
                                    <option key={k} value={k}>{BJCP_STYLES[k].name}</option>
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Vol (L)</label>
                            <DebouncedInput type="text" inputMode="decimal" value={editingRecipe.batchSize} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, batchSize: parseFloat(v.replace(',', '.')) || 0 })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-center font-bold bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">OG (D.I.)</label>
                            <DebouncedInput type="text" inputMode="decimal" value={editingRecipe.targetOG} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, targetOG: parseFloat(v.replace(',', '.')) || 0 })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-center bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">FG (D.F.)</label>
                            <DebouncedInput type="text" inputMode="decimal" value={editingRecipe.targetFG} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, targetFG: parseFloat(v.replace(',', '.')) || 0 })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-center bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">IBU</label>
                            <DebouncedInput type="number" value={editingRecipe.targetIBU || 0} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, targetIBU: parseInt(v) || 0 })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-center bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Color SRM</label>
                            <DebouncedInput type="number" value={editingRecipe.targetColor || 0} onDebouncedChange={v => setEditingRecipe({ ...editingRecipe, targetColor: parseInt(v) || 0 })} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-center bg-white dark:bg-zinc-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                        </div>
                        <p className="col-span-5 text-[9px] text-slate-400 dark:text-slate-500 italic text-center font-medium">* Los límites ideales se validan dinámicamente contra la guía BJCP 2021.</p>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2 text-sm"><Wheat size={16} /> Insumos</h4>

                        {/* Add/Edit Ingredient Mini-Form */}
                        <div className="flex gap-2 mb-3 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Insumo</label>
                                <select value={selectedInventoryId} onChange={(e) => setSelectedInventoryId(e.target.value)} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all custom-scrollbar">
                                    <option value="">-- Seleccionar Insumo --</option>
                                    {inventory.map(item => (<option key={item.id} value={item.id}>{item.name} ({item.unit})</option>))}
                                </select>
                            </div>
                            <div className="w-20">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cant.</label>
                                <DebouncedInput type="number" placeholder="0" value={amountToAdd || ''} onDebouncedChange={(v) => setAmountToAdd(parseFloat(v) || 0)} className="w-full border border-slate-200 dark:border-zinc-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" />
                            </div>
                            <div className="flex gap-1">
                                <button onClick={handleAddIngredient} className="bg-copper text-white h-[34px] px-3 rounded hover:bg-copper-dark flex items-center justify-center transition shadow-sm" title={editingIngredientIndex !== null ? "Actualizar" : "Agregar"}>
                                    {editingIngredientIndex !== null ? <Save size={16} /> : <Plus size={16} />}
                                </button>
                                {editingIngredientIndex !== null && (
                                    <button onClick={handleCancelEditIngredient} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 h-[34px] px-2 rounded hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition" title="Cancelar Edición">
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                            {(editingRecipe.ingredients || []).length === 0 && <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-2">Sin insumos.</p>}
                            {(editingRecipe.ingredients || []).map((ing, idx) => {
                                if (!ing) return null;
                                const isLinked = inventory.some(i => i.id === ing.inventoryId);
                                const isEditing = editingIngredientIndex === idx;
                                return (
                                    <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border transition ${isEditing ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-copper/50 dark:hover:border-copper/50 shadow-sm'}`}>
                                        <div className="flex items-center gap-2">
                                            {isLinked ? (
                                                <div className="w-2 h-2 rounded-full bg-green-500" title="Vinculado a Inventario"></div>
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-yellow-400" title="No vinculado (Sin control de stock)"></div>
                                            )}
                                            <span className="text-slate-700 dark:text-slate-300 text-sm">{ing.name || 'Desconocido'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-slate-600 dark:text-slate-400 text-xs font-bold">{ing.amountUsed || 0} {ing.unit || ''}</span>
                                            <button onClick={() => handleEditIngredient(idx)} className="text-slate-300 dark:text-slate-500 hover:text-copper dark:hover:text-copper transition" title="Editar"><Pencil size={14} /></button>
                                            <button onClick={() => handleRemoveIngredient(idx)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <button onClick={handleSaveModified} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition flex items-center justify-center gap-2 mt-4 shadow-sm">
                        <Save size={18} /> Guardar Cambios
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
