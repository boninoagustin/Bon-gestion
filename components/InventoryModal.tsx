import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertTriangle } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Ingredient } from '../types';
import { DebouncedInput } from './ui/DebouncedInput';
import { useToast } from './Toast';

export interface InventoryModalProps {
    ingredientToEdit?: Ingredient | null;
    initialData?: Partial<Ingredient> | null;
    onClose: () => void;
    onSuccess?: (ingredient: Ingredient) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ ingredientToEdit, initialData, onClose, onSuccess }) => {
    const addIngredient = useBreweryStore(s => s.addIngredient);
    const editIngredient = useBreweryStore(s => s.editIngredient);
    const { showToast } = useToast();

    const [costInputMode, setCostInputMode] = useState<'UNIT' | 'TOTAL'>('TOTAL');
    const [totalCost, setTotalCost] = useState<number | ''>('');
    const [formData, setFormData] = useState<Partial<Ingredient>>({
        name: '', type: 'MALT', stockAmount: 0, unit: 'kg', costPerUnit: 0, purchaseDate: new Date().toISOString().split('T')[0], lotNumber: ''
    });

    useEffect(() => {
        if (ingredientToEdit) {
            setFormData({ ...ingredientToEdit });
            const stock = Number(ingredientToEdit.stockAmount) || 0;
            const unitCost = Number(ingredientToEdit.costPerUnit) || 0;
            setTotalCost((stock > 0 && unitCost > 0) ? Math.round(stock * unitCost) : '');
        } else if (initialData) {
            const merged: Partial<Ingredient> = {
                name: '',
                type: 'MALT',
                stockAmount: 0,
                unit: 'kg',
                costPerUnit: 0,
                purchaseDate: new Date().toISOString().split('T')[0],
                lotNumber: '',
                ...initialData
            };
            setFormData(merged);
            const stock = Number(merged.stockAmount) || 0;
            const unitCost = Number(merged.costPerUnit) || 0;
            setTotalCost((stock > 0 && unitCost > 0) ? Math.round(stock * unitCost) : '');
        } else {
            setFormData({ name: '', type: 'MALT', stockAmount: 0, unit: 'kg', costPerUnit: 0, purchaseDate: new Date().toISOString().split('T')[0], lotNumber: '' });
            setTotalCost('');
        }
    }, [ingredientToEdit, initialData]);

    const getUnitOptions = (type: string) => {
        switch(type) {
            case 'YEAST': return ['paq', 'g', 'ml'];
            case 'CHEMICAL': return ['L', 'ml', 'kg', 'g', 'gal'];
            case 'PACKAGING': return ['u', 'cajas', 'pack'];
            default: return ['kg', 'g', 'lb'];
        }
    };

    const handleTypeChange = (type: string) => {
        let defaultUnit = 'kg';
        if (type === 'YEAST') defaultUnit = 'paq';
        if (type === 'CHEMICAL') defaultUnit = 'L';
        if (type === 'PACKAGING') defaultUnit = 'u';
        setFormData(prev => ({ ...prev, type: type as any, unit: defaultUnit }));
    };

    const toggleCostMode = () => {
        if (costInputMode === 'TOTAL') {
            setCostInputMode('UNIT');
        } else {
            setCostInputMode('TOTAL');
            const stock = Number(formData.stockAmount) || 0;
            const unitCost = Number(formData.costPerUnit) || 0;
            setTotalCost((stock > 0 && unitCost > 0) ? Math.round(stock * unitCost) : '');
        }
    };

    const handleSubmit = () => {
        const name = (formData.name || '').trim();
        const stockAmount = Number(formData.stockAmount);
        
        let costPerUnit = Number(formData.costPerUnit);
        if (costInputMode === 'TOTAL' && typeof totalCost === 'number' && stockAmount > 0) {
            costPerUnit = totalCost / stockAmount;
        }

        if (!name) {
            return showToast({ message: 'Ingresa el nombre del insumo', type: 'warning' });
        }
        if (!Number.isFinite(stockAmount) || stockAmount < 0) {
            return showToast({ message: 'La cantidad ingresada es inválida', type: 'warning' });
        }
        if (!ingredientToEdit && stockAmount <= 0) {
            return showToast({ message: 'La cantidad ingresada debe ser mayor a 0', type: 'warning' });
        }
        if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
            return showToast({ message: 'El costo no puede ser negativo o inválido', type: 'warning' });
        }

        const cleanCostPerUnit = Math.round(costPerUnit * 100) / 100;
        const purchaseDate = formData.purchaseDate || new Date().toISOString().split('T')[0];
        const lotNumber = (formData.lotNumber || '').trim() || 'S/N';

        if (ingredientToEdit) {
            const updated = { 
                ...ingredientToEdit, 
                ...formData, 
                name, 
                stockAmount, 
                costPerUnit: cleanCostPerUnit,
                purchaseDate,
                lotNumber
            };
            editIngredient(ingredientToEdit.id, updated);
            onSuccess?.(updated as Ingredient);
        } else {
            const newIngredient: Ingredient = { 
                id: crypto.randomUUID(), 
                name, 
                type: (formData.type || 'MALT') as any, 
                stockAmount, 
                unit: formData.unit || 'kg', 
                costPerUnit: cleanCostPerUnit, 
                purchaseDate, 
                lotNumber
            };
            addIngredient(newIngredient);
            onSuccess?.(newIngredient);
        }
        showToast({ message: ingredientToEdit ? 'Insumo actualizado' : 'Insumo agregado al inventario', type: 'success' });
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-zinc-800/50">
                <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h3 className="text-lg font-bold font-display text-white">
                            {ingredientToEdit ? 'Editar Insumo' : (initialData ? 'Ingresar Factura de Compra' : 'Ingresar Compra / Factura')}
                        </h3>
                        {initialData && (
                            <p className="text-[10px] text-emerald-400 font-medium">Vinculado desde Lista de Compras (se removerá al guardar)</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Tipo Insumo</label>
                            <select value={formData.type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full border border-zinc-800/50 rounded-lg p-2 bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all">
                                <option value="MALT">Malta / Grano</option><option value="HOP">Lúpulo</option><option value="YEAST">Levadura</option><option value="ADJUNCT">Adjunto (Especias/Fruta)</option><option value="PACKAGING">Envases (Botellas/Vasos)</option><option value="CHEMICAL">Químico / Limpieza</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Lote Proveedor</label>
                             <DebouncedInput type="text" value={formData.lotNumber || ''} onDebouncedChange={(val) => setFormData(prev => ({...prev, lotNumber: val.toString()}))} className="w-full border border-zinc-800/50 rounded-lg p-2 font-mono bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" placeholder="Ej: L-2023-X" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre Insumo</label>
                        <DebouncedInput type="text" value={formData.name || ''} onDebouncedChange={(val) => setFormData(prev => ({...prev, name: val.toString()}))} className="w-full border border-zinc-800/50 rounded-lg p-2 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" placeholder="Ej: Botella Ambar 500ml" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/50 shadow-sm">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Cantidad</label>
                            <div className="flex">
                                <DebouncedInput 
                                    type="number" 
                                    step="any" 
                                    value={formData.stockAmount || ''} 
                                    onDebouncedChange={(val) => {
                                        const raw = val.toString().trim();
                                        const parsed = raw === '' ? 0 : parseFloat(raw.replace(',', '.'));
                                        const newStock = Number.isFinite(parsed) ? parsed : 0;
                                        
                                        if (costInputMode === 'TOTAL') {
                                            const currentTotal = typeof totalCost === 'number' ? totalCost : (parseFloat(totalCost.toString()) || 0);
                                            const computedPerUnit = (newStock > 0 && currentTotal > 0) ? (currentTotal / newStock) : 0;
                                            setFormData(prev => ({ ...prev, stockAmount: newStock, costPerUnit: computedPerUnit }));
                                        } else {
                                            const perUnit = Number(formData.costPerUnit) || 0;
                                            const newTotal = (newStock > 0 && perUnit > 0) ? Math.round(newStock * perUnit) : '';
                                            setTotalCost(newTotal);
                                            setFormData(prev => ({ ...prev, stockAmount: newStock }));
                                        }
                                    }} 
                                    className="w-full border border-zinc-800/50 rounded-l-lg p-2 font-mono bg-zinc-950/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" 
                                    placeholder="0" 
                                />
                                <select value={formData.unit} onChange={(e) => { const unit = e.target.value; setFormData(prev => ({...prev, unit})); }} className="border-y border-r border-zinc-800/50 rounded-r-lg px-2 bg-zinc-900 text-zinc-300 text-xs outline-none focus:ring-2 focus:ring-copper/50 transition-all">
                                    {getUnitOptions(formData.type || 'MALT').map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <label className="block text-xs font-bold text-zinc-500 uppercase">
                                    {costInputMode === 'TOTAL' ? 'Costo Total' : 'Costo Unitario'}
                                </label>
                                <button 
                                    type="button"
                                    onClick={toggleCostMode}
                                    className="text-[10px] text-copper hover:text-copper/80 transition-colors font-bold bg-transparent border-none p-0 cursor-pointer"
                                >
                                    Cambiar a {costInputMode === 'TOTAL' ? 'Unitario' : 'Total'}
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-2 top-2 text-zinc-500">$</span>
                                <DebouncedInput 
                                    type="number" 
                                    step="any" 
                                    value={costInputMode === 'TOTAL' 
                                        ? (totalCost === '' ? '' : totalCost) 
                                        : (formData.costPerUnit ? formData.costPerUnit : '')} 
                                    onDebouncedChange={(val) => {
                                        const raw = val.toString().trim();
                                        const parsed = raw === '' ? 0 : parseFloat(raw.replace(',', '.'));
                                        const safeValue = Number.isFinite(parsed) ? parsed : 0;
                                        
                                        if (costInputMode === 'TOTAL') {
                                            setTotalCost(raw === '' ? '' : safeValue);
                                            const qty = Number(formData.stockAmount) || 0;
                                            const computed = (qty > 0 && safeValue > 0) ? (safeValue / qty) : 0;
                                            setFormData(prev => ({ ...prev, costPerUnit: computed }));
                                        } else {
                                            setFormData(prev => ({ ...prev, costPerUnit: safeValue }));
                                            const qty = Number(formData.stockAmount) || 0;
                                            const newTotal = (qty > 0 && safeValue > 0) ? Math.round(qty * safeValue) : '';
                                            setTotalCost(newTotal);
                                        }
                                    }} 
                                    className="w-full border border-zinc-800/50 rounded-lg p-2 pl-6 font-mono bg-zinc-950/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" 
                                    placeholder="0" 
                                />
                            </div>
                            {costInputMode === 'TOTAL' && (formData.stockAmount || 0) > 0 ? (
                                <p className="text-[10px] text-zinc-500 mt-1 text-right font-mono">
                                    Unitario: ${(formData.costPerUnit || 0).toFixed(2)} / {formData.unit}
                                </p>
                            ) : null}
                            {costInputMode === 'UNIT' && (formData.stockAmount || 0) > 0 ? (
                                <p className="text-[10px] text-zinc-500 mt-1 text-right font-mono">
                                    Total: ${((formData.costPerUnit || 0) * (formData.stockAmount || 0)).toFixed(2)}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Fecha de Compra</label>
                         <DebouncedInput type="date" value={formData.purchaseDate || ''} onDebouncedChange={(val) => setFormData(prev => ({...prev, purchaseDate: val.toString()}))} className="w-full border border-zinc-800/50 rounded-lg p-2 bg-zinc-950/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" />
                        <p className="text-[10px] text-zinc-500 mt-1">Esta fecha se usará para calcular la frescura (FIFO).</p>
                    </div>
                    
                    {/* WARNING FOR STOCK EDITING */}
                    {ingredientToEdit && formData.stockAmount !== undefined && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-xs text-amber-400 flex items-start gap-2">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <p>⚠️ Si estás reponiendo stock nuevo, te sugerimos usar el botón <strong>'+ Ingresar Factura'</strong> en la pantalla principal. Editar aquí NO generará un registro de gasto en tu historial financiero.</p>
                        </div>
                    )}

                    <button onClick={handleSubmit} className="w-full py-3 bg-copper/20 text-copper border border-copper/30 hover:bg-copper/30 rounded-lg font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-2">
                        <Save size={18} /> {ingredientToEdit ? 'Guardar Cambios' : 'Guardar en Inventario'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
