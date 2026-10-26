import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Pencil, Save, TrendingUp } from 'lucide-react';
import { Sale } from '../types';
import { useBreweryStore } from '../context/store';
import { useToast } from './Toast';
import { DebouncedInput } from './ui/DebouncedInput';

interface SaleEditModalProps {
  detailGroup: { month: string; format: string; items: Sale[] };
  onClose: () => void;
  onUpdateItems: (items: Sale[]) => void;
}

export const SaleEditModal: React.FC<SaleEditModalProps> = ({
  detailGroup,
  onClose,
  onUpdateItems,
}) => {
  const deleteSale = useBreweryStore((s) => s.deleteSale);
  const updateSale = useBreweryStore((s) => s.updateSale);
  const { showToast } = useToast();

  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Sale>>({});

  const handleDelete = (id: string) => {
    deleteSale(id);
    if (detailGroup.items.length <= 1) {
      onClose();
    } else {
      onUpdateItems(detailGroup.items.filter((i) => i.id !== id));
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
      const updatedItems = detailGroup.items.map((i) =>
        i.id === editingSaleId ? ({ ...i, ...editForm } as Sale) : i
      );
      onUpdateItems(updatedItems);
      showToast({ message: 'Venta actualizada', type: 'success' });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-lg w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-[#2c3138] shrink-0">
          <div>
            <h3 className="text-lg font-extrabold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-[#f59e0b]" size={20} />
              <span>{detailGroup.format}</span>
            </h3>
            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              {detailGroup.month}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#22262b] transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto space-y-3 pr-0.5 custom-scrollbar flex-1">
          <div className="bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] p-3.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex gap-2.5 items-center">
            <TrendingUp size={16} className="shrink-0 text-[#f59e0b]" />
            <p>
              Editar o eliminar ventas ajusta la caja financiera pero{' '}
              <strong className="text-slate-800 dark:text-white">
                no modifica el stock físico
              </strong>{' '}
              de barriles o botellas.
            </p>
          </div>

          {detailGroup.items.map((sale) => (
            <div
              key={sale.id}
              className="bg-slate-50 dark:bg-[#121417] p-4 rounded-xl border border-slate-200 dark:border-[#2c3138] transition-all"
            >
              {editingSaleId === sale.id ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                        Cantidad
                      </label>
                      <DebouncedInput
                        type="number"
                        value={editForm.quantity || 1}
                        onDebouncedChange={(val) =>
                          setEditForm({
                            ...editForm,
                            quantity: parseFloat(val.toString()),
                          })
                        }
                        className="w-full min-h-[44px] p-2.5 border border-slate-200 dark:border-[#2c3138] rounded-xl bg-white dark:bg-[#1a1d21] text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-[#d97706]/60 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                        Monto Total ($)
                      </label>
                      <DebouncedInput
                        type="number"
                        value={editForm.amount || 0}
                        onDebouncedChange={(val) =>
                          setEditForm({
                            ...editForm,
                            amount: parseFloat(val.toString()),
                          })
                        }
                        className="w-full min-h-[44px] p-2.5 border border-slate-200 dark:border-[#2c3138] rounded-xl bg-white dark:bg-[#1a1d21] text-slate-900 dark:text-white font-bold font-mono focus:ring-2 focus:ring-[#d97706]/60 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Descripción
                    </label>
                    <DebouncedInput
                      type="text"
                      value={editForm.description || ''}
                      onDebouncedChange={(val) =>
                        setEditForm({
                          ...editForm,
                          description: val.toString(),
                        })
                      }
                      className="w-full min-h-[44px] p-2.5 border border-slate-200 dark:border-[#2c3138] rounded-xl bg-white dark:bg-[#1a1d21] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#d97706]/60 outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSaleId(null)}
                      className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2c3138] rounded-xl hover:bg-slate-100 dark:hover:bg-[#22262b] transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="min-h-[44px] px-4 py-2 text-xs font-bold bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white rounded-xl shadow-copper-glow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={15} /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                      {sale.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                      <span className="bg-white dark:bg-[#1a1d21] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-[#2c3138]">
                        {sale.date}
                      </span>
                      <span className="bg-white dark:bg-[#1a1d21] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-[#2c3138]">
                        Cant: {sale.quantity || 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-[#10b981] font-mono text-base sm:text-lg">
                      ${sale.amount}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(sale)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-[#f59e0b] hover:bg-[#d97706]/15 rounded-xl transition-colors cursor-pointer"
                        title="Editar Venta"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sale.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-[#ef4444] hover:bg-[#ef4444]/15 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar Venta"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-[#2c3138] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
