import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Save, AlertCircle, Check, Target, Pencil } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { CostItem, BatchStatus } from '../types';
import { DebouncedInput } from './ui/DebouncedInput';

interface FinancialSettingsModalProps {
    onClose: () => void;
}

export const FinancialSettingsModal: React.FC<FinancialSettingsModalProps> = React.memo(({ onClose }) => {
    const settings = useBreweryStore(s => s.settings);
    const updateSettings = useBreweryStore(s => s.updateSettings);
    const batches = useBreweryStore(s => s.batches);

    // Inicialización lazy — se ejecuta UNA vez al montar, sin useEffect
    const [tempFixedCosts, setTempFixedCosts] = useState<CostItem[]>(
        () => [...(settings.fixedCosts || [])]
    );
    const [targetVolume, setTargetVolume] = useState<number>(
        () => settings.targetMonthlyVolume || 0
    );
    const [newCostName, setNewCostName] = useState('');
    const [newCostAmount, setNewCostAmount] = useState(0);
    const [editingCostId, setEditingCostId] = useState<string | null>(null);
    const [editingCostAmount, setEditingCostAmount] = useState<number>(0);

    const handleAddCostItem = useCallback(() => {
        if (!newCostName || newCostAmount <= 0) return;
        setTempFixedCosts(prev => [...prev, { id: crypto.randomUUID(), name: newCostName, amount: newCostAmount }]);
        setNewCostName(''); setNewCostAmount(0);
    }, [newCostName, newCostAmount]);

    const handleRemoveCostItem = useCallback((id: string) => {
        setTempFixedCosts(prev => prev.filter(c => c.id !== id));
    }, []);

    const startEditingCost = useCallback((item: CostItem) => {
        setEditingCostId(item.id);
        setEditingCostAmount(item.amount);
    }, []);

    const saveEditedCost = useCallback(() => {
        if (editingCostId) {
            setTempFixedCosts(prev => prev.map(c =>
                c.id === editingCostId ? { ...c, amount: editingCostAmount } : c
            ));
            setEditingCostId(null);
        }
    }, [editingCostId, editingCostAmount]);
    
    const handleSaveSettings = useCallback(() => { 
        updateSettings({ fixedCosts: tempFixedCosts, targetMonthlyVolume: targetVolume }); 
        onClose(); 
    }, [updateSettings, tempFixedCosts, targetVolume, onClose]);

    const realMonthlyVolume = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return batches
            .filter(b =>
                (b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED) &&
                new Date(b.packagedDate || b.brewDate) >= thirtyDaysAgo
            )
            .reduce((sum, b) => sum + b.volumePackaged, 0);
    }, [batches]);

    const totalFixed = useMemo(
        () => tempFixedCosts.reduce((sum, item) => sum + item.amount, 0),
        [tempFixedCosts]
    );
    const effectiveVolume = targetVolume > 0 ? targetVolume : realMonthlyVolume;
    const estimatedOverhead = effectiveVolume > 0 ? (totalFixed / effectiveVolume).toFixed(0) : '---';

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white/95 dark:bg-zinc-900/95 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-zinc-700/50">
                <div className="p-5 border-b border-zinc-200/50 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Configuración Costos Fijos</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"><X size={18} className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200" /></button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                     <div className="space-y-5">
                         
                         <div className="bg-copper/5 dark:bg-copper/10 border border-copper/20 dark:border-copper/20 p-4 rounded-xl text-xs text-copper-dark dark:text-copper flex flex-col gap-2 shadow-sm">
                             <div className="flex gap-2"><AlertCircle size={16} className="shrink-0" /><strong>Costos Fijos Reales:</strong></div>
                             <p className="opacity-90">El sistema suma tus gastos y los divide por tu producción para calcular el costo de overhead.</p>
                         </div>

                         {/* TARGET VOLUME INPUT */}
                         <div className="bg-zinc-50 dark:bg-zinc-900/60 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
                             <div className="flex items-center gap-2 mb-4">
                                 <Target size={18} className="text-copper" />
                                 <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Capacidad Objetivo (Litros/Mes)</label>
                             </div>
                             <DebouncedInput 
                                type="number" 
                                value={targetVolume || ''} 
                                onDebouncedChange={val => setTargetVolume(parseFloat(val.toString()) || 0)} 
                                placeholder="Ej: 1000" 
                                className="w-full p-3 border border-zinc-200 dark:border-zinc-700/80 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 font-mono outline-none focus:ring-2 focus:ring-copper/50 transition-all shadow-sm"
                             />
                             <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-3 leading-relaxed">
                                 {targetVolume > 0 
                                    ? `✅ Costos Fijos Estables: Se dividirán siempre por ${targetVolume} L, sin importar cuánto cocines este mes.` 
                                    : `⚠️ Costos Dinámicos: Se dividirán por tu producción real de los últimos 30 días (${realMonthlyVolume} L). Si produces poco, tu costo subirá.`}
                             </p>
                         </div>

                         <div className="flex gap-3 items-end pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
                             <div className="flex-1"><label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Nuevo Gasto</label><DebouncedInput type="text" value={newCostName} onDebouncedChange={val => setNewCostName(val.toString())} placeholder="Ej: Internet" className="w-full p-3 border border-zinc-200 dark:border-zinc-700/80 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-copper/50 transition-all shadow-sm" /></div>
                             <div className="w-32"><label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Monto ($)</label><DebouncedInput type="number" value={newCostAmount || ''} onDebouncedChange={val => setNewCostAmount(parseFloat(val.toString()) || 0)} placeholder="0" className="w-full p-3 border border-zinc-200 dark:border-zinc-700/80 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-copper/50 transition-all font-mono shadow-sm" /></div>
                             <button onClick={handleAddCostItem} className="bg-emerald-600 dark:bg-emerald-600/90 text-white p-3 rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all shadow-sm active:scale-95 flex items-center justify-center"><Plus size={20}/></button>
                         </div>
                         <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700/80 rounded-xl bg-white dark:bg-zinc-900 shadow-sm custom-scrollbar">
                             {tempFixedCosts.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">Sin gastos registrados</div>}
                             {tempFixedCosts.map(item => (
                                 <div key={item.id} className="flex justify-between items-center p-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                     <span className="text-zinc-700 dark:text-zinc-300 font-medium">{item.name}</span>
                                     <div className="flex items-center gap-2">
                                         {editingCostId === item.id ? (
                                            <div className="flex items-center gap-2">
                                                 <DebouncedInput type="number" value={editingCostAmount} onDebouncedChange={(val) => setEditingCostAmount(parseFloat(val.toString()) || 0)} className="w-24 p-2 border border-zinc-200 dark:border-zinc-700/80 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 font-mono text-right outline-none focus:ring-2 focus:ring-copper/50" autoFocus />
                                                 <button onClick={saveEditedCost} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><Check size={16}/></button>
                                            </div>
                                         ) : (
                                            <>
                                                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200 mr-2">${item.amount}</span>
                                                <button onClick={() => startEditingCost(item)} className="text-zinc-400 hover:text-copper dark:text-zinc-500 dark:hover:text-copper p-2 rounded-xl hover:bg-copper/10 transition-colors"><Pencil size={14}/></button>
                                                <button onClick={() => handleRemoveCostItem(item.id)} className="text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"><Trash2 size={14}/></button>
                                            </>
                                         )}
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <div className="bg-zinc-50 dark:bg-zinc-900/60 p-5 rounded-xl space-y-4 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
                             <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-200"><span>Total Gastos Fijos:</span><span className="font-mono text-emerald-600 dark:text-emerald-500">${totalFixed}</span></div>
                             <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                 <span>Volumen Cálculo:</span>
                                 <span className="font-mono">{effectiveVolume} L {targetVolume > 0 ? '(Objetivo)' : '(Real)'}</span>
                             </div>
                             <div className="border-t border-zinc-200 dark:border-zinc-700/80 pt-4 flex justify-between items-center">
                                 <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Costo Overhead</span>
                                 <span className="text-2xl font-black font-display text-copper">{effectiveVolume > 0 ? `$${estimatedOverhead}` : '---'}<span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1 font-sans font-bold uppercase tracking-widest">/ Litro</span></span>
                             </div>
                         </div>
                         <button onClick={handleSaveSettings} className="w-full py-3.5 bg-zinc-950 dark:bg-zinc-800 text-white dark:text-zinc-100 rounded-xl font-bold hover:bg-zinc-900 dark:hover:bg-zinc-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-6"><Save size={18} /> Guardar Configuración</button>
                     </div>
                </div>
            </div>
        </div>,
        document.body
    );
});
