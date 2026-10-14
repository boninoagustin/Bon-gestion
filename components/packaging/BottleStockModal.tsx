import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Trash2, X, Save, AlertTriangle, DollarSign, Calculator, Users } from 'lucide-react';
import { useBreweryStore } from '../../context/store';
import { useToast } from '../Toast';
import { DebouncedInput } from '../ui/DebouncedInput';
import { BottleStock } from '../../types';

export type BottleModalMode = 'SELL' | 'DELETE' | 'NONE' | 'GIFT';

interface BottleStockModalProps {
  mode: BottleModalMode;
  selectedId: string | null;
  onClose: () => void;
}

export const BottleStockModal: React.FC<BottleStockModalProps> = ({ mode, selectedId, onClose }) => {
  const bottles = useBreweryStore(s => s.bottles);
  const customers = useBreweryStore(s => s.customers);
  const updateBottleStock = useBreweryStore(s => s.updateBottleStock);
  const deleteBottleStock = useBreweryStore(s => s.deleteBottleStock);
  const addSale = useBreweryStore(s => s.addSale);
  const giftBottle = useBreweryStore(s => s.giftBottle);
  const { showToast } = useToast();

  const [actionAmount, setActionAmount] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [chargeToAccount, setChargeToAccount] = useState(true);

  // Reset state when modal opens with a new item
  useEffect(() => {
    if (mode === 'SELL' || mode === 'GIFT') {
      setActionAmount(1);
      setUnitPrice(0);
      setSelectedCustomerId('');
      setChargeToAccount(true);
    }
  }, [mode, selectedId]);

  if (mode === 'NONE' || !selectedId) return null;

  const selectedItemForSale = bottles.find(b => b.id === selectedId);

  const handleSubmit = () => {
    if ((mode === 'SELL' || mode === 'GIFT') && selectedId && selectedItemForSale) {
      if (actionAmount <= 0) return showToast({ message: 'Cantidad inválida', type: 'warning' });
      if (actionAmount > selectedItemForSale.quantity) return showToast({ message: `Solo tenés ${selectedItemForSale.quantity} botellas`, type: 'warning' });
      
      if (mode === 'GIFT') {
        giftBottle(selectedId, actionAmount);
        onClose();
        return;
      }

      if (selectedItemForSale.quantity - actionAmount <= 0) {
        deleteBottleStock(selectedId);
      } else {
        updateBottleStock(selectedId, -actionAmount);
      }

      const totalRevenue = unitPrice * actionAmount;
      if (totalRevenue > 0) {
          addSale({
              id: crypto.randomUUID(),
              amount: totalRevenue,
              date: new Date().toISOString().split('T')[0],
              description: `Venta ${actionAmount}x ${selectedItemForSale.style || 'Botellas'} (${selectedItemForSale.format})`,
              type: 'BOTTLE',
              quantity: actionAmount,
              format: selectedItemForSale.format,
              lotCode: selectedItemForSale.lotCode,
              customerId: selectedCustomerId || undefined,
              isPaid: !chargeToAccount
          });
      }
      onClose();
    }
  };

  const confirmDelete = () => {
    if (selectedId) {
      deleteBottleStock(selectedId);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-700/80">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-700/80 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{mode === 'SELL' ? 'Registrar Venta' : mode === 'GIFT' ? 'Registrar Regalo' : 'Eliminar Stock'}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6 space-y-4">
                {(mode === 'SELL' || mode === 'GIFT') && selectedItemForSale && (
                   <div className="text-center">
                      <div className="flex justify-between items-center text-sm text-slate-600 dark:text-zinc-400 mb-4 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 shadow-inner"><span>Disponible:</span><span className="font-bold text-slate-900 dark:text-zinc-100">{selectedItemForSale.quantity} unidades</span></div>
                      
                      <div className="flex items-center justify-center gap-3 mb-6">
                          <button onClick={()=>setActionAmount(Math.max(1, actionAmount-1))} className="p-3 bg-white dark:bg-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/80 transition-all shadow-sm active:scale-95"><Minus size={20}/></button>
                          <DebouncedInput type="number" value={actionAmount} max={selectedItemForSale.quantity} onDebouncedChange={(v) => setActionAmount(Math.min(Math.max(1, parseInt(v)||0), selectedItemForSale.quantity))} className="w-24 text-center p-3 text-2xl font-bold font-mono border border-slate-200 dark:border-zinc-700/80 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all" />
                          <button onClick={()=>setActionAmount(Math.min(selectedItemForSale.quantity, actionAmount+1))} className="p-3 bg-white dark:bg-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/80 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none" disabled={actionAmount >= selectedItemForSale.quantity}><Plus size={20}/></button>
                      </div>
                      
                      {mode === 'SELL' && (
                        <>
                          <div className="text-left mb-4">
                                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Cliente (Opcional)</label>
                                <div className="relative">
                                    <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 pl-10 text-sm bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all appearance-none cursor-pointer">
                                        <option value="">-- Venta Mostrador / Contado --</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <Users className="absolute left-3 top-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" size={16}/>
                                </div>
                                {selectedCustomerId && (
                                    <div className="mt-3 flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700/80">
                                        <input type="checkbox" id="chargeAccount" checked={chargeToAccount} onChange={(e) => setChargeToAccount(e.target.checked)} className="w-4 h-4 accent-copper bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 rounded cursor-pointer"/>
                                        <label htmlFor="chargeAccount" className="text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer select-none">Cargar a cuenta corriente (Fiado)</label>
                                    </div>
                                )}
                          </div>

                          <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-700/80 text-left mb-4 shadow-inner">
                                <div className="flex justify-between items-end mb-2"><label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">Precio Unitario ($)</label></div>
                                <div className="relative"><DollarSign className="absolute left-3 top-3.5 text-slate-400 dark:text-zinc-500" size={18} /><DebouncedInput type="number" value={unitPrice || ''} onDebouncedChange={(v) => setUnitPrice(parseFloat(v) || 0)} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 pl-10 text-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-mono font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all" placeholder="0"/></div>
                          </div>

                          <div className="flex justify-between items-center bg-slate-100 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700/80 mb-4 shadow-sm">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-sm font-bold"><Calculator size={18} /> Total Venta:</div>
                                <div className="text-2xl font-mono font-bold text-copper dark:text-copper-light">${(unitPrice * actionAmount).toFixed(0)}</div>
                          </div>

                          {selectedCustomerId && chargeToAccount && (unitPrice * actionAmount) > 0 && (
                            <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 p-3 rounded-xl flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 font-bold animate-in fade-in slide-in-from-bottom-1 shadow-sm">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>⚠️ Se sumará a la deuda del cliente: ${(unitPrice * actionAmount).toFixed(0)}</span>
                            </div>
                          )}
                        </>
                      )}

                      <button onClick={handleSubmit} className={`w-full py-3 ${mode === 'GIFT' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-dark dark:bg-copper-dark hover:bg-slate-800 dark:hover:bg-copper'} text-white rounded-xl font-bold border border-transparent shadow-md transition-all active:scale-95 flex items-center justify-center gap-2`}><Save size={18} /> {mode === 'GIFT' ? 'Confirmar Regalo' : 'Confirmar Venta'}</button>
                   </div>
                )}

                {mode === 'DELETE' && (
                    <div className="text-center space-y-4">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-5 rounded-xl text-red-900 dark:text-red-400"><AlertTriangle className="mx-auto mb-3 text-red-600 dark:text-red-500" size={36} /><h4 className="font-bold text-lg">¿Eliminar Lote?</h4><p className="text-sm mt-2 opacity-90">Esta acción borrará permanentemente este registro de stock.</p></div>
                        <button onClick={confirmDelete} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"><Trash2 size={18} /> Sí, Eliminar</button>
                    </div>
                )}
            </div>
        </div>
    </div>,
    document.body
  );
};
