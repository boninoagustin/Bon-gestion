import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Truck,
  RotateCcw,
  Plus,
  Beer,
  X,
  Trash2,
  Save,
  Milk,
  DollarSign,
  Users,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { useBreweryStore } from '../../context/store';
import { Keg, BatchStatus } from '../../types';
import { useToast } from '../Toast';
import { DebouncedInput } from '../ui/DebouncedInput';
import { CustomSelect } from '../ui/CustomSelect';

export type KegModalMode =
  | 'CREATE'
  | 'EDIT'
  | 'FILL'
  | 'BOTTLE'
  | 'DISPATCH'
  | 'RECEIVE'
  | 'DELETE'
  | 'NONE';

interface KegTrackingModalProps {
  mode: KegModalMode;
  selectedKegId: string | null;
  onClose: () => void;
  onDeleteClick?: () => void;
}

export const KegTrackingModal: React.FC<KegTrackingModalProps> = ({
  mode,
  selectedKegId,
  onClose,
  onDeleteClick,
}) => {
  const kegs = useBreweryStore((s) => s.kegs);
  const batches = useBreweryStore((s) => s.batches);
  const inventory = useBreweryStore((s) => s.inventory);
  const customers = useBreweryStore((s) => s.customers);
  const addKeg = useBreweryStore((s) => s.addKeg);
  const updateKeg = useBreweryStore((s) => s.updateKeg);
  const fillKegFromBatch = useBreweryStore((s) => s.fillKegFromBatch);
  const bottleFromKeg = useBreweryStore((s) => s.bottleFromKeg);
  const deleteKeg = useBreweryStore((s) => s.deleteKeg);
  const addSale = useBreweryStore((s) => s.addSale);
  const addPayment = useBreweryStore((s) => s.addPayment);
  const { showToast } = useToast();

  const [selectedBatchIdForFill, setSelectedBatchIdForFill] =
    useState<string>('');
  const [fillAmount, setFillAmount] = useState<number>(0);
  const [bottleQuantity, setBottleQuantity] = useState<number>(1);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [customFormatName, setCustomFormatName] =
    useState<string>('Vaso Pinta');
  const [detectedVolume, setDetectedVolume] = useState<number>(0.5);
  const [dispatchTotal, setDispatchTotal] = useState<number>(0);
  const [isPaidNow, setIsPaidNow] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<Keg>>({
    id: '',
    size: 50,
    status: 'IN_HOUSE',
    currentLocation: 'Fábrica',
    contents: '',
  });

  const availableBatches = batches.filter(
    (b) =>
      b.status === BatchStatus.PACKAGED &&
      (b.volumeAvailable === undefined || b.volumeAvailable > 0)
  );
  const packagingInventory = inventory.filter((i) => i.type === 'PACKAGING');

  const detectVolumeFromName = (name: string): number => {
    const n = name.toLowerCase().trim();
    if (n.includes('1lt') || n.includes('1 lt') || n.includes('1000ml'))
      return 1.0;
    if (n.includes('pinta')) return 0.5;
    if (n.includes('500') || n.includes('0.5')) return 0.5;
    if (n.includes('330')) return 0.33;
    if (n.includes('growler')) return 1.9;
    return 0.5;
  };

  useEffect(() => {
    if (selectedInventoryId) {
      const item = inventory.find((i) => i.id === selectedInventoryId);
      if (item) {
        setCustomFormatName(item.name);
        setDetectedVolume(detectVolumeFromName(item.name));
      }
    } else if (mode === 'BOTTLE') {
      setCustomFormatName('Envase Cliente');
      setDetectedVolume(0.5);
    }
  }, [selectedInventoryId, inventory, mode]);

  useEffect(() => {
    if (mode === 'CREATE') {
      setFormData({
        id: '',
        size: 50,
        status: 'IN_HOUSE',
        currentLocation: 'Fábrica',
        contents: '',
      });
    } else if (selectedKegId) {
      const keg = kegs.find((k) => k.id === selectedKegId);
      if (keg) {
        if (mode === 'EDIT') setFormData({ ...keg });
        if (mode === 'FILL') {
          setFormData({ contents: keg.contents || '' });
          setSelectedBatchIdForFill('');
          setFillAmount(keg.size > 50 ? 50 : keg.size);
        }
        if (mode === 'BOTTLE') {
          setBottleQuantity(1);
          setSelectedInventoryId('');
        }
        if (mode === 'DISPATCH') {
          setSelectedCustomerId('');
          setDispatchTotal(0);
          setFormData({ currentLocation: '' });
        }
        if (mode === 'RECEIVE') {
          setIsPaidNow(false);
        }
      }
    }
  }, [mode, selectedKegId, kegs]);

  if (mode === 'NONE') return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === 'CREATE') {
      const cleanId = (formData.id || '').trim();
      if (!cleanId || kegs.find((k) => k.id === cleanId)) {
        return showToast({
          message: 'ID inválido o ya existe',
          type: 'warning',
        });
      }
      addKeg({ ...formData, id: cleanId } as Keg);
      showToast({ message: `Barril #${cleanId} creado`, type: 'success' });
    } else if (mode === 'EDIT' && selectedKegId) {
      updateKeg(selectedKegId, formData);
      showToast({
        message: `Barril #${selectedKegId} actualizado`,
        type: 'success',
      });
    } else if (mode === 'FILL' && selectedKegId) {
      if (!selectedBatchIdForFill)
        return showToast({ message: 'Seleccioná un lote', type: 'warning' });
      if (fillAmount <= 0)
        return showToast({ message: 'Cantidad inválida', type: 'warning' });
      fillKegFromBatch(selectedKegId, selectedBatchIdForFill, fillAmount);
      showToast({ message: 'Barril llenado correctamente', type: 'success' });
    } else if (mode === 'BOTTLE' && selectedKegId) {
      if (bottleQuantity <= 0)
        return showToast({ message: 'Cantidad inválida', type: 'warning' });
      if (selectedInventoryId) {
        const container = inventory.find((i) => i.id === selectedInventoryId);
        if (container && container.stockAmount < bottleQuantity) {
          showToast({
            message: `Stock insuficiente de ${container.name}`,
            type: 'warning',
          });
        }
      }
      bottleFromKeg(
        selectedKegId,
        customFormatName,
        bottleQuantity,
        selectedInventoryId || null,
        detectedVolume
      );
      showToast({
        message: `Trasvasadas ${bottleQuantity} u. desde Barril #${selectedKegId}`,
        type: 'success',
      });
    } else if (mode === 'DISPATCH' && selectedKegId) {
      let clientName = formData.currentLocation;
      const keg = kegs.find((k) => k.id === selectedKegId);
      const batch = batches.find((b) => b.id === keg?.batchId);
      if (selectedCustomerId) {
        const cust = customers.find((c) => c.id === selectedCustomerId);
        if (cust) clientName = cust.name;
      }
      if (!clientName)
        return showToast({ message: 'Ingresá el cliente', type: 'warning' });
      if (dispatchTotal > 0) {
        const isCreditSale = !!selectedCustomerId;
        addSale({
          id: crypto.randomUUID(),
          amount: dispatchTotal,
          date: new Date().toISOString().split('T')[0],
          description: `Venta Barril #${selectedKegId} - ${clientName}`,
          type: 'KEG',
          quantity: 1,
          format: `Barril ${keg?.currentVolume ?? keg?.size}L`,
          lotCode: batch?.lotCode,
          customerId: selectedCustomerId || undefined,
          isPaid: !isCreditSale,
        });
      }
      updateKeg(selectedKegId, {
        status: 'WITH_CLIENT',
        currentLocation: clientName,
        customerId: selectedCustomerId || undefined,
        dateDispatched: new Date().toISOString().split('T')[0],
        dispatchedPrice: dispatchTotal,
      });
      showToast({
        message: `Barril #${selectedKegId} despachado a ${clientName}`,
        type: 'success',
      });
    } else if (mode === 'RECEIVE' && selectedKegId) {
      const keg = kegs.find((k) => k.id === selectedKegId);
      if (!keg) return;
      if (
        keg.customerId &&
        isPaidNow &&
        keg.dispatchedPrice &&
        keg.dispatchedPrice > 0
      ) {
        addPayment({
          id: crypto.randomUUID(),
          customerId: keg.customerId,
          amount: keg.dispatchedPrice,
          date: new Date().toISOString().split('T')[0],
          notes: `Pago Barril #${keg.id} al recibir`,
        });
      }
      updateKeg(selectedKegId, {
        status: 'DIRTY',
        currentLocation: 'Lavadero (Fábrica)',
        contents: '',
        dateDispatched: undefined,
        currentVolume: 0,
        batchId: undefined,
        customerId: undefined,
        dispatchedPrice: undefined,
      });
      showToast({
        message: `Barril #${selectedKegId} recibido en Lavadero`,
        type: 'info',
      });
    }
    onClose();
  };

  const confirmDelete = () => {
    if (selectedKegId) {
      deleteKeg(selectedKegId);
      showToast({
        message: `Barril #${selectedKegId} eliminado`,
        type: 'info',
      });
      onClose();
    }
  };

  const getDispensingVolume = () =>
    (detectedVolume * bottleQuantity).toFixed(2);
  const getRemainingVolume = () => {
    const keg = kegs.find((k) => k.id === selectedKegId);
    return keg?.currentVolume !== undefined
      ? keg.currentVolume
      : keg?.size || 0;
  };
  const selectedKeg = kegs.find((k) => k.id === selectedKegId);

  // Modal de confirmación de eliminación (una sola mano)
  if (mode === 'DELETE') {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-sm w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={28} />
          </div>
          <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
            ¿Eliminar Barril #{selectedKegId}?
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Esta acción quitará el barril de forma permanente de la flota de envasado.
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

  const getHeaderIcon = () => {
    switch (mode) {
      case 'BOTTLE':
        return <Milk className="text-[#10b981]" size={20} />;
      case 'DISPATCH':
        return <Truck className="text-[#f59e0b]" size={20} />;
      case 'RECEIVE':
        return <RotateCcw className="text-[#38bdf8]" size={20} />;
      default:
        return <Beer className="text-[#f59e0b]" size={20} />;
    }
  };

  const getHeaderTitle = () => {
    switch (mode) {
      case 'CREATE':
        return 'Nuevo Barril';
      case 'EDIT':
        return `Editar Barril #${selectedKegId}`;
      case 'FILL':
        return `Llenar Barril #${selectedKegId}`;
      case 'BOTTLE':
        return `Embotellar desde #${selectedKegId}`;
      case 'DISPATCH':
        return `Despachar Barril #${selectedKegId}`;
      case 'RECEIVE':
        return `Recibir Barril #${selectedKegId}`;
      default:
        return 'Barril';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#1a1d21] rounded-t-3xl sm:rounded-2xl max-w-md w-full border-t sm:border border-slate-200 dark:border-[#2c3138] p-6 pb-8 sm:pb-6 shadow-2xl animate-scale-in max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200 dark:border-[#2c3138] shrink-0">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            {getHeaderIcon()}
            <span>{getHeaderTitle()}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#22262b] transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="space-y-4 overflow-y-auto pr-0.5 custom-scrollbar flex-1">
          {(mode === 'CREATE' || mode === 'EDIT') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  ID / Código de Barril
                </label>
                <DebouncedInput
                  type="text"
                  disabled={mode === 'EDIT'}
                  value={formData.id || ''}
                  onDebouncedChange={(val) =>
                    setFormData({ ...formData, id: val.toString() })
                  }
                  className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm font-mono font-bold disabled:opacity-60 bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  placeholder="ej. K-105, B-01"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Capacidad Nominal (Litros)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[20, 30, 50].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormData({ ...formData, size })}
                      className={`min-h-[48px] py-2.5 border rounded-xl text-sm font-mono font-extrabold transition-all cursor-pointer ${
                        formData.size === size
                          ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white border-[#f59e0b] shadow-copper-glow'
                          : 'bg-slate-50 dark:bg-[#121417] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2c3138] hover:border-[#d97706]/50'
                      }`}
                    >
                      {size} L
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'EDIT' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                      Ubicación Actual
                    </label>
                    <DebouncedInput
                      type="text"
                      value={formData.currentLocation || ''}
                      onDebouncedChange={(val) =>
                        setFormData({
                          ...formData,
                          currentLocation: val.toString(),
                        })
                      }
                      className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                      placeholder="ej. Cámara de Frío, Fábrica"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                      Contenido / Estilo
                    </label>
                    <DebouncedInput
                      type="text"
                      value={formData.contents || ''}
                      onDebouncedChange={(val) =>
                        setFormData({ ...formData, contents: val.toString() })
                      }
                      className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                      placeholder="Dejar en blanco si está vacío"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'FILL' && (
            <div className="space-y-4">
              {selectedKeg && (
                <div className="bg-slate-50 dark:bg-[#121417] p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138] flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase">
                    Capacidad del Barril
                  </span>
                  <span className="font-mono font-bold text-sm text-[#f59e0b]">
                    {selectedKeg.size} L
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Lote Terminado a Embarrilar
                </label>
                {availableBatches.length > 0 ? (
                  <CustomSelect
                    value={selectedBatchIdForFill}
                    onChange={setSelectedBatchIdForFill}
                    options={availableBatches.map((batch) => ({
                      value: batch.id,
                      label: `${batch.recipeName} (${batch.lotCode}) — ${
                        batch.volumeAvailable ?? batch.volumePackaged
                      } L disp.`,
                    }))}
                    placeholder="-- Seleccionar Lote --"
                  />
                ) : (
                  <div className="text-center p-4 border border-dashed border-slate-200 dark:border-[#2c3138] bg-slate-50 dark:bg-[#121417] rounded-xl text-slate-400 text-xs">
                    No hay lotes en estado Envasado/Finalizado con volumen disponible.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Litros a Llenar (Máx {selectedKeg?.size ?? 50} L)
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedKeg?.size ?? 50}
                  step="0.5"
                  value={fillAmount}
                  onChange={(e) => setFillAmount(Number(e.target.value))}
                  className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-base font-mono font-bold bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                />
              </div>
            </div>
          )}

          {mode === 'BOTTLE' && (
            <div className="space-y-4">
              <div className="bg-[#10b981]/10 border border-[#10b981]/30 p-3.5 rounded-xl flex items-center justify-between text-xs text-[#10b981]">
                <div className="flex items-center gap-2 font-bold">
                  <Milk size={17} className="shrink-0" />
                  <span>Disponible en Barril:</span>
                </div>
                <span className="font-mono font-black text-sm">
                  {getRemainingVolume()} L
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Seleccionar Envase de Inventario
                </label>
                <CustomSelect
                  value={selectedInventoryId}
                  onChange={setSelectedInventoryId}
                  options={packagingInventory.map((item) => ({
                    value: item.id,
                    label: `${item.name} (Stock: ${item.stockAmount})`,
                  }))}
                  placeholder="-- Envase Cliente / Growler --"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Formato
                  </label>
                  <DebouncedInput
                    type="text"
                    value={customFormatName || ''}
                    onDebouncedChange={(val) =>
                      setCustomFormatName(val.toString())
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-xs font-bold bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60 read-only:opacity-70"
                    readOnly={!!selectedInventoryId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Vol. Unidad (L)
                  </label>
                  <DebouncedInput
                    type="number"
                    step="0.01"
                    value={detectedVolume || 0}
                    onDebouncedChange={(val) =>
                      setDetectedVolume(parseFloat(val.toString()) || 0)
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm font-mono font-bold text-center bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Cantidad de Unidades
                </label>
                <DebouncedInput
                  type="number"
                  value={bottleQuantity || 0}
                  onDebouncedChange={(val) =>
                    setBottleQuantity(parseInt(val.toString()) || 0)
                  }
                  className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-base font-mono font-bold bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  min="1"
                />
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-[#121417] p-3.5 rounded-xl border border-slate-200 dark:border-[#2c3138]">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {bottleQuantity} u. × {detectedVolume} L
                </span>
                <span className="text-lg font-black font-mono text-[#f59e0b]">
                  = {getDispensingVolume()} L
                </span>
              </div>
            </div>
          )}

          {mode === 'DISPATCH' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Cliente (CRM)
                </label>
                {customers.length > 0 ? (
                  <CustomSelect
                    value={selectedCustomerId}
                    onChange={(val) => {
                      setSelectedCustomerId(val);
                      const cust = customers.find((c) => c.id === val);
                      if (cust)
                        setFormData({
                          ...formData,
                          currentLocation: cust.name,
                        });
                    }}
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    placeholder="-- Cliente Ocasional --"
                    icon={<Users size={16} />}
                  />
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-[#121417] text-slate-500 dark:text-slate-400 text-xs rounded-xl border border-slate-200 dark:border-[#2c3138]">
                    Creá clientes en la sección CRM para vincular cuenta corriente.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Monto de Venta ($)
                </label>
                <div className="relative">
                  <DollarSign
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <DebouncedInput
                    type="number"
                    value={dispatchTotal || ''}
                    onDebouncedChange={(val) =>
                      setDispatchTotal(parseFloat(val.toString()) || 0)
                    }
                    className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 pl-10 text-base bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                    placeholder="0"
                  />
                </div>
                {selectedCustomerId && dispatchTotal > 0 && (
                  <div className="text-xs text-[#f59e0b] mt-2 flex items-center gap-1.5 font-medium">
                    <AlertTriangle size={13} />
                    <span>
                      Se registrará cargo en cuenta corriente por $
                      {dispatchTotal.toLocaleString()}.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Destino / Bar / Ubicación
                </label>
                <DebouncedInput
                  type="text"
                  value={formData.currentLocation || ''}
                  onDebouncedChange={(val) =>
                    setFormData({
                      ...formData,
                      currentLocation: val.toString(),
                    })
                  }
                  className="w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60"
                  placeholder="ej. Bar La Esquina"
                />
              </div>
            </div>
          )}

          {mode === 'RECEIVE' && selectedKeg && (
            <div className="space-y-4">
              {selectedKeg.customerId ? (
                <div className="bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                      <Users size={16} className="text-[#f59e0b]" />
                      {selectedKeg.currentLocation}
                    </span>
                    <span className="font-mono font-bold text-base text-[#f59e0b]">
                      ${(selectedKeg.dispatchedPrice || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-[#2c3138]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                      ¿El cliente abonó el barril al devolverlo?
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsPaidNow(true)}
                        className={`min-h-[48px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                          isPaidNow
                            ? 'bg-[#10b981] text-white border-[#10b981] shadow-hop-glow'
                            : 'bg-white dark:bg-[#1a1d21] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c3138]'
                        }`}
                      >
                        SÍ, PAGÓ AHORA
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPaidNow(false)}
                        className={`min-h-[48px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                          !isPaidNow
                            ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40'
                            : 'bg-white dark:bg-[#1a1d21] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c3138]'
                        }`}
                      >
                        NO, QUEDA EN CTA.
                      </button>
                    </div>
                    {isPaidNow ? (
                      <div className="mt-3 text-xs text-[#10b981] flex items-center gap-1.5 justify-center font-medium">
                        <CreditCard size={14} />
                        <span>
                          Se acreditará el pago de $
                          {(selectedKeg.dispatchedPrice || 0).toLocaleString()}.
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-[#f59e0b] flex items-center gap-1.5 justify-center font-medium">
                        <AlertTriangle size={14} />
                        <span>El saldo quedará pendiente en CRM.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-[#121417] p-4 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2c3138]">
                  <p className="font-bold text-slate-800 dark:text-white text-sm">
                    Recepción de barril en planta
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    El barril ingresará al sector de lavado como{' '}
                    <strong className="text-[#f59e0b]">Sucio (CIP Pendiente)</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS (ERGONOMÍA DE UNA SOLA MANO >= 48px) */}
        <div className="flex gap-3 pt-4 mt-5 border-t border-slate-200 dark:border-[#2c3138] shrink-0">
          {mode === 'EDIT' && onDeleteClick && (
            <button
              type="button"
              onClick={onDeleteClick}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[#ef4444] hover:bg-[#ef4444]/15 border border-transparent hover:border-[#ef4444]/30 rounded-xl transition cursor-pointer"
              title="Eliminar Barril"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] border border-slate-200 dark:border-[#2c3138] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-[#22262b] transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            className={`flex-1 min-h-[48px] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
              mode === 'BOTTLE' || mode === 'RECEIVE'
                ? 'bg-[#10b981] hover:bg-[#059669] shadow-hop-glow'
                : 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] shadow-copper-glow'
            }`}
          >
            {mode === 'CREATE' && (
              <>
                <Plus size={17} />
                <span>Crear Barril</span>
              </>
            )}
            {mode === 'EDIT' && (
              <>
                <Save size={17} />
                <span>Guardar</span>
              </>
            )}
            {mode === 'FILL' && (
              <>
                <CheckCircle2 size={17} />
                <span>Llenar</span>
              </>
            )}
            {mode === 'BOTTLE' && (
              <>
                <Milk size={17} />
                <span>Embotellar</span>
              </>
            )}
            {mode === 'DISPATCH' && (
              <>
                <Truck size={17} />
                <span>Despachar</span>
              </>
            )}
            {mode === 'RECEIVE' && (
              <>
                <RotateCcw size={17} />
                <span>Recibir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
