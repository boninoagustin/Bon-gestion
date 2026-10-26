import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Minus,
  Trash2,
  X,
  Save,
  AlertTriangle,
  DollarSign,
  Calculator,
  Users,
  Gift,
  Milk,
} from 'lucide-react';
import { useBreweryStore } from '../../context/store';
import { useToast } from '../Toast';
import { DebouncedInput } from '../ui/DebouncedInput';

export type BottleModalMode = 'SELL' | 'DELETE' | 'NONE' | 'GIFT';

interface BottleStockModalProps {
  mode: BottleModalMode;
  selectedId: string | null;
  onClose: () => void;
}

export const BottleStockModal: React.FC<BottleStockModalProps> = ({
  mode,
  selectedId,
  onClose,
}) => {
  const bottles = useBreweryStore((s) => s.bottles);
  const customers = useBreweryStore((s) => s.customers);
  const updateBottleStock = useBreweryStore((s) => s.updateBottleStock);
  const deleteBottleStock = useBreweryStore((s) => s.deleteBottleStock);
  const addSale = useBreweryStore((s) => s.addSale);
  const giftBottle = useBreweryStore((s) => s.giftBottle);
  const { showToast } = useToast();

  const [actionAmount, setActionAmount] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [chargeToAccount, setChargeToAccount] = useState(true);

  useEffect(() => {
    if (mode === 'SELL' || mode === 'GIFT') {
      setActionAmount(1);
      setUnitPrice(0);
      setSelectedCustomerId('');
      setChargeToAccount(true);
    }
  }, [mode, selectedId]);

  if (mode === 'NONE' || !selectedId) return null;

  const selectedItemForSale = bottles.find((b) => b.id === selectedId);

  const handleSubmit = () => {
    if (
      (mode === 'SELL' || mode === 'GIFT') &&
      selectedId &&
      selectedItemForSale
    ) {
      if (actionAmount <= 0)
        return showToast({ message: 'Cantidad inválida', type: 'warning' });
      if (actionAmount > selectedItemForSale.quantity)
        return showToast({
          message: `Solo tenés ${selectedItemForSale.quantity} unidades en stock`,
          type: 'warning',
        });

      if (mode === 'GIFT') {
        giftBottle(selectedId, actionAmount);
        showToast({
          message: `Registradas ${actionAmount} u. de cortesía`,
          type: 'info',
        });
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
          description: `Venta ${actionAmount}x ${
            selectedItemForSale.style || 'Botellas'
          } (${selectedItemForSale.format})`,
          type: 'BOTTLE',
          quantity: actionAmount,
          format: selectedItemForSale.format,
          lotCode: selectedItemForSale.lotCode,
          customerId: selectedCustomerId || undefined,
          isPaid: !chargeToAccount,
        });
      }
      showToast({
        message: `Venta registrada (${actionAmount} u.)`,
        type: 'success',
      });
      onClose();
    }
  };

  const confirmDelete = () => {
    if (selectedId) {
      deleteBottleStock(selectedId);
      showToast({ message: 'Stock de botellas eliminado', type: 'info' });
      onClose();
    }
  };

  // Modal de confirmación de eliminación (una sola mano)
  if (mode === 'DELETE') {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-sm w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={28} />
          </div>
          <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
            ¿Eliminar lote de {selectedItemForSale?.style || 'Botellas'}?
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Esta acción quitará permanentemente las{' '}
            <strong className="font-mono text-slate-700 dark:text-slate-200">
              {selectedItemForSale?.quantity ?? 0} unidades
            </strong>{' '}
            del inventario de producto terminado.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] bg-slate-100 dark:bg-[#22262b] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="flex-1 min-h-[48px] bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-[#2c3138]">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            {mode === 'GIFT' ? (
              <Gift className="text-[#38bdf8]" size={20} />
            ) : (
              <Milk className="text-[#f59e0b]" size={20} />
            )}
            <span>
              {mode === 'SELL'
                ? 'Registrar Venta de Botellas'
                : 'Registrar Cortesía / Regalo'}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#22262b] transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {selectedItemForSale && (
          <div className="space-y-4">
            {/* INFO LOTE */}
            <div className="flex justify-between items-center text-xs bg-slate-50 dark:bg-[#121417] p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138]">
              <div>
                <span className="font-extrabold text-slate-800 dark:text-white block text-sm">
                  {selectedItemForSale.style}
                </span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {selectedItemForSale.format}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Disponible
                </span>
                <span className="font-mono font-black text-base text-[#10b981]">
                  {selectedItemForSale.quantity} u.
                </span>
              </div>
            </div>

            {/* SELECTOR TÁCTIL DE CANTIDAD (+/- >= 48px) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 text-center">
                Cantidad de Unidades a Descontar
              </label>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActionAmount(Math.max(1, actionAmount - 1))}
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center bg-slate-100 dark:bg-[#22262b] hover:bg-slate-200 dark:hover:bg-[#2c3138] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#2c3138] rounded-xl transition active:scale-95 cursor-pointer"
                >
                  <Minus size={20} />
                </button>
                <DebouncedInput
                  type="number"
                  value={actionAmount}
                  max={selectedItemForSale.quantity}
                  onDebouncedChange={(v) =>
                    setActionAmount(
                      Math.min(
                        Math.max(1, parseInt(v.toString()) || 0),
                        selectedItemForSale.quantity
                      )
                    )
                  }
                  className="w-28 min-h-[48px] text-center p-2.5 text-2xl font-black font-mono border border-slate-200 dark:border-[#2c3138] rounded-xl bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:ring-2 focus:ring-[#d97706]/60 outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setActionAmount(
                      Math.min(selectedItemForSale.quantity, actionAmount + 1)
                    )
                  }
                  disabled={actionAmount >= selectedItemForSale.quantity}
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center bg-slate-100 dark:bg-[#22262b] hover:bg-slate-200 dark:hover:bg-[#2c3138] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#2c3138] rounded-xl transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {mode === 'SELL' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Cliente (Opcional)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 pl-10 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:ring-2 focus:ring-[#d97706]/60 outline-none cursor-pointer"
                    >
                      <option value="">-- Venta Mostrador / Contado --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Users
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      size={16}
                    />
                  </div>

                  {selectedCustomerId && (
                    <label
                      htmlFor="chargeAccount"
                      className="mt-2.5 min-h-[44px] flex items-center gap-2.5 px-3 py-2 bg-slate-50 dark:bg-[#121417] rounded-xl border border-slate-200 dark:border-[#2c3138] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        id="chargeAccount"
                        checked={chargeToAccount}
                        onChange={(e) => setChargeToAccount(e.target.checked)}
                        className="w-4 h-4 accent-[#d97706] rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Cargar a cuenta corriente (Fiado)
                      </span>
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Precio Unitario ($)
                  </label>
                  <div className="relative">
                    <DollarSign
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      size={17}
                    />
                    <DebouncedInput
                      type="number"
                      value={unitPrice || ''}
                      onDebouncedChange={(v) =>
                        setUnitPrice(parseFloat(v.toString()) || 0)
                      }
                      className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 pl-10 text-base bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-[#d97706]/60 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 dark:bg-[#121417] p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138]">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <Calculator size={16} className="text-[#f59e0b]" />
                    <span>Total Venta:</span>
                  </div>
                  <div className="text-xl font-mono font-black text-[#f59e0b]">
                    ${(unitPrice * actionAmount).toLocaleString()}
                  </div>
                </div>

                {selectedCustomerId &&
                  chargeToAccount &&
                  unitPrice * actionAmount > 0 && (
                    <div className="bg-[#d97706]/10 border border-[#d97706]/30 p-3 rounded-xl flex items-center gap-2 text-xs text-[#f59e0b] font-bold">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>
                        Se sumará a la deuda del cliente: $
                        {(unitPrice * actionAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
              </>
            )}

            {/* FOOTER BUTTONS (UNA SOLA MANO >= 48px) */}
            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-[#2c3138]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className={`flex-1 min-h-[48px] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                  mode === 'GIFT'
                    ? 'bg-[#0ea5e9] hover:bg-[#0284c7] shadow-md'
                    : 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] shadow-copper-glow'
                }`}
              >
                <Save size={17} />
                <span>
                  {mode === 'GIFT' ? 'Confirmar Cortesía' : 'Confirmar Venta'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
