import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Pencil, Save, TrendingUp } from 'lucide-react';
import { Sale } from '../types';
import { useBreweryStore } from '../context/store';
import { useToast } from './Toast';
import { DebouncedInput } from './ui/DebouncedInput';

interface SaleEditModalProps {
    detailGroup: { month: string, format: string, items: Sale[] };
    onClose: () => void;
    onUpdateItems: (items: Sale[]) => void;
}

export const SaleEditModal: React.FC<SaleEditModalProps> = ({ detailGroup, onClose, onUpdateItems }) => {
    const deleteSale = useBreweryStore(s => s.deleteSale);
    const updateSale = useBreweryStore(s => s.updateSale);
    const { showToast } = useToast();
    
    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Sale>>({});

    const handleDelete = (id: string) => {
        deleteSale(id);
        if (detailGroup.items.length <= 1) { 
            onClose(); 
        } else { 
            onUpdateItems(detailGroup.items.filter(i => i.id !== id)); 
        }
        showToast({ message: 'Venta eliminada', type: 'info' });
    };

    const startEdit = (sale: Sale) => { 
        setEditingSaleId(sale.id); 
        setEditForm({ ...sale }); 
    };

    const saveEdit = () => {
        if (editingSaleId && editForm) {
            updateSale(editingSaleId, editForm);
            setEditingSaleId(null);
            const updatedItems = detailGroup.items.map(i => i.id === editingSaleId ? { ...i, ...editForm } as Sale : i);
            onUpdateItems(updatedItems);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-zinc-800/50">
                <div className="p-5 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h3 className="text-xl font-bold font-display text-white">{detailGroup.format}</h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">{detailGroup.month}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
                        <X size={20} className="text-zinc-500 hover:text-white" />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar">
                    <div className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl text-xs text-zinc-400 mb-4 flex gap-3 shadow-sm">
                        <TrendingUp size={18} className="shrink-0 text-zinc-500" />
                        <p>Eliminar o editar ventas ajusta la caja (ingresos) pero <strong className="text-white">NO repone el stock físico</strong> automáticamente.</p>
                    </div>
                    {detailGroup.items.map((sale) => (
                        <div key={sale.id} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 shadow-sm transition-all hover:border-zinc-700">
                            {editingSaleId === sale.id ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Cantidad</label>
                                            <DebouncedInput 
                                                type="number" 
                                                value={editForm.quantity || 1} 
                                                onDebouncedChange={val => setEditForm({...editForm, quantity: parseFloat(val.toString())})} 
                                                className="w-full p-2.5 border border-zinc-800/50 rounded-lg bg-zinc-950/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Monto Total ($)</label>
                                            <DebouncedInput 
                                                type="number" 
                                                value={editForm.amount || 0} 
                                                onDebouncedChange={val => setEditForm({...editForm, amount: parseFloat(val.toString())})} 
                                                className="w-full p-2.5 border border-zinc-800/50 rounded-lg bg-zinc-950/50 text-white font-bold font-mono focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Descripción</label>
                                        <DebouncedInput 
                                            type="text" 
                                            value={editForm.description || ''} 
                                            onDebouncedChange={val => setEditForm({...editForm, description: val.toString()})} 
                                            className="w-full p-2.5 border border-zinc-800/50 rounded-lg bg-zinc-950/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" 
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setEditingSaleId(null)} className="px-4 py-2 text-xs font-bold text-zinc-400 border border-zinc-800/50 rounded-lg hover:bg-zinc-800/50 hover:text-white transition-colors">
                                            Cancelar
                                        </button>
                                        <button onClick={saveEdit} className="px-4 py-2 text-xs font-bold bg-copper/20 text-copper border border-copper/30 rounded-lg hover:bg-copper/30 transition-all shadow-sm active:scale-95 flex items-center gap-1.5">
                                            <Save size={14}/> Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-white text-sm">{sale.description}</p>
                                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 font-medium">
                                            <span className="bg-zinc-800/50 px-2 py-0.5 rounded-md border border-zinc-700/50 text-white">{sale.date}</span>
                                            <span className="font-mono bg-zinc-800/50 px-2 py-0.5 rounded-md border border-zinc-700/50 text-white">Cant: {sale.quantity || 1}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-white font-mono text-lg">${sale.amount}</span>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => startEdit(sale)} className="p-2 text-zinc-500 hover:text-copper hover:bg-copper/10 rounded-lg transition-colors" title="Editar">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(sale.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};
