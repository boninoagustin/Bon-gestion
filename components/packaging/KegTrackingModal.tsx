import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Clock, AlertTriangle, Truck, RotateCcw, Droplets, CheckCircle2, Plus, Beer, X, Pencil, Trash2, Save, Factory, Milk, DollarSign, Package, Calculator, Users, CreditCard } from 'lucide-react';
import { useBreweryStore } from '../../context/store';
import { Keg, BatchStatus } from '../../types';
import { useToast } from '../Toast';
import { DebouncedInput } from '../ui/DebouncedInput';
import { CustomSelect } from '../ui/CustomSelect';

export type KegModalMode = 'CREATE' | 'EDIT' | 'FILL' | 'BOTTLE' | 'DISPATCH' | 'RECEIVE' | 'DELETE' | 'NONE';

interface KegTrackingModalProps {
  mode: KegModalMode;
  selectedKegId: string | null;
  onClose: () => void;
  onDeleteClick?: () => void; // Used when clicking delete from edit mode
}

export const KegTrackingModal: React.FC<KegTrackingModalProps> = ({ mode, selectedKegId, onClose, onDeleteClick }) => {
  const kegs = useBreweryStore(s => s.kegs);
  const batches = useBreweryStore(s => s.batches);
  const inventory = useBreweryStore(s => s.inventory);
  const customers = useBreweryStore(s => s.customers);
  const addKeg = useBreweryStore(s => s.addKeg);
  const updateKeg = useBreweryStore(s => s.updateKeg);
  const fillKegFromBatch = useBreweryStore(s => s.fillKegFromBatch);
  const bottleFromKeg = useBreweryStore(s => s.bottleFromKeg);
  const deleteKeg = useBreweryStore(s => s.deleteKeg);
  const addSale = useBreweryStore(s => s.addSale);
  const addPayment = useBreweryStore(s => s.addPayment);
  const { showToast } = useToast();
  
  const [selectedBatchIdForFill, setSelectedBatchIdForFill] = useState<string>('');
  const [fillAmount, setFillAmount] = useState<number>(0);
  const [bottleQuantity, setBottleQuantity] = useState<number>(1);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [customFormatName, setCustomFormatName] = useState<string>('Vaso Pinta');
  const [detectedVolume, setDetectedVolume] = useState<number>(0.5);
  const [dispatchTotal, setDispatchTotal] = useState<number>(0);
  const [isPaidNow, setIsPaidNow] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<Keg>>({
      id: '', size: 50, status: 'IN_HOUSE', currentLocation: 'Fábrica', contents: ''
  });

  const availableBatches = batches.filter(b => b.status === BatchStatus.PACKAGED && (b.volumeAvailable === undefined || b.volumeAvailable > 0));
  const packagingInventory = inventory.filter(i => i.type === 'PACKAGING');

  const detectVolumeFromName = (name: string): number => {
      const n = name.toLowerCase().trim();
      if (n.includes('1lt') || n.includes('1 lt') || n.includes('1000ml')) return 1.0;
      if (n.includes('pinta')) return 0.5;
      if (n.includes('500') || n.includes('0.5')) return 0.5;
      if (n.includes('330')) return 0.33;
      if (n.includes('growler')) return 1.9;
      return 0.5; 
  };

  useEffect(() => {
      if (selectedInventoryId) {
          const item = inventory.find(i => i.id === selectedInventoryId);
          if (item) { setCustomFormatName(item.name); setDetectedVolume(detectVolumeFromName(item.name)); }
      } else if (mode === 'BOTTLE') {
          setCustomFormatName('Envase Cliente'); setDetectedVolume(0.5);
      }
  }, [selectedInventoryId, inventory, mode]);

  useEffect(() => {
    if (mode === 'CREATE') {
        setFormData({ id: '', size: 50, status: 'IN_HOUSE', currentLocation: 'Fábrica', contents: '' });
    } else if (selectedKegId) {
        const keg = kegs.find(k => k.id === selectedKegId);
        if (keg) {
            if (mode === 'EDIT') setFormData({ ...keg });
            if (mode === 'FILL') { setFormData({ contents: keg.contents || '' }); setSelectedBatchIdForFill(''); setFillAmount(keg.size > 50 ? 50 : keg.size); }
            if (mode === 'BOTTLE') { setBottleQuantity(1); setSelectedInventoryId(''); }
            if (mode === 'DISPATCH') { setSelectedCustomerId(''); setDispatchTotal(0); setFormData({ currentLocation: '' }); }
            if (mode === 'RECEIVE') { setIsPaidNow(false); }
        }
    }
  }, [mode, selectedKegId, kegs]);

  if (mode === 'NONE') return null;

  const handleSubmit = () => {
      if (mode === 'CREATE') { if (!formData.id || kegs.find(k => k.id === formData.id)) return showToast({ message: 'ID inválido o ya existe', type: 'warning' }); addKeg(formData as Keg); showToast({ message: `Barril #${formData.id} creado`, type: 'success' }); }
      else if (mode === 'EDIT' && selectedKegId) { updateKeg(selectedKegId, formData); }
      else if (mode === 'FILL' && selectedKegId) { 
          if (!selectedBatchIdForFill) return showToast({ message: 'Seleccioná un lote', type: 'warning' }); 
          if (fillAmount <= 0) return showToast({ message: 'Cantidad inválida', type: 'warning' });
          fillKegFromBatch(selectedKegId, selectedBatchIdForFill, fillAmount); 
          showToast({ message: 'Barril llenado correctamente', type: 'success' }); 
      }
      else if (mode === 'BOTTLE' && selectedKegId) {
          if (bottleQuantity <= 0) return showToast({ message: 'Cantidad inválida', type: 'warning' });
          if (selectedInventoryId) { const container = inventory.find(i => i.id === selectedInventoryId); if (container && container.stockAmount < bottleQuantity) { showToast({ message: `Stock insuficiente de ${container.name}`, type: 'warning' }); } }
          bottleFromKeg(selectedKegId, customFormatName, bottleQuantity, selectedInventoryId || null, detectedVolume);
      }
      else if (mode === 'DISPATCH' && selectedKegId) {
          let clientName = formData.currentLocation;
          const keg = kegs.find(k => k.id === selectedKegId);
          const batch = batches.find(b => b.id === keg?.batchId);
          if (selectedCustomerId) { const cust = customers.find(c => c.id === selectedCustomerId); if (cust) clientName = cust.name; }
          if (!clientName) return showToast({ message: 'Ingresá el cliente', type: 'warning' });
          if (dispatchTotal > 0) {
              const isCreditSale = !!selectedCustomerId;
              addSale({ id: crypto.randomUUID(), amount: dispatchTotal, date: new Date().toISOString().split('T')[0], description: `Venta Barril #${selectedKegId} - ${clientName}`, type: 'KEG', quantity: 1, format: `Barril ${keg?.currentVolume ?? keg?.size}L`, lotCode: batch?.lotCode, customerId: selectedCustomerId || undefined, isPaid: !isCreditSale });
          }
          updateKeg(selectedKegId, { status: 'WITH_CLIENT', currentLocation: clientName, customerId: selectedCustomerId || undefined, dateDispatched: new Date().toISOString().split('T')[0], dispatchedPrice: dispatchTotal });
      }
      else if (mode === 'RECEIVE' && selectedKegId) {
          const keg = kegs.find(k => k.id === selectedKegId);
          if (!keg) return;
          if (keg.customerId && isPaidNow && keg.dispatchedPrice && keg.dispatchedPrice > 0) {
             addPayment({ id: crypto.randomUUID(), customerId: keg.customerId, amount: keg.dispatchedPrice, date: new Date().toISOString().split('T')[0], notes: `Pago Barril #${keg.id} al recibir` });
          }
          updateKeg(selectedKegId, { status: 'DIRTY', currentLocation: 'Lavadero (Fábrica)', contents: '', dateDispatched: undefined, currentVolume: 0, batchId: undefined, customerId: undefined, dispatchedPrice: undefined });
      }
      onClose();
  };

  const confirmDelete = () => { if (selectedKegId) { deleteKeg(selectedKegId); onClose(); } };
  const getDispensingVolume = () => (detectedVolume * bottleQuantity).toFixed(2);
  const getRemainingVolume = () => { const keg = kegs.find(k => k.id === selectedKegId); return keg?.currentVolume !== undefined ? keg.currentVolume : (keg?.size || 0); };
  const getSelectedKeg = () => kegs.find(k => k.id === selectedKegId);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-zinc-800/80">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800/80 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                <h3 className="text-lg font-bold font-display text-slate-800 dark:text-zinc-100">
                    {mode === 'CREATE' && 'Nuevo Barril'}{mode === 'EDIT' && 'Editar Barril'}{mode === 'FILL' && 'Llenar Barril'}{mode === 'BOTTLE' && 'Tirar / Trasvasar'}{mode === 'DISPATCH' && 'Despachar & Vender'}{mode === 'RECEIVE' && 'Recibir Barril'}{mode === 'DELETE' && 'Eliminar Barril'}
                </h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700/50 transition-colors"><X size={20} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300" /></button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {(mode === 'CREATE' || mode === 'EDIT') && (
                    <div className="space-y-4">
                        <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">ID / Número</label><DebouncedInput type="text" disabled={mode === 'EDIT'} value={formData.id || ''} onDebouncedChange={(val) => setFormData({...formData, id: val.toString()})} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 font-mono disabled:bg-slate-100 disabled:dark:bg-zinc-800/50 bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" placeholder="Ej: K-105" /></div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Capacidad</label>
                            <div className="flex gap-2">
                                {[20, 30, 50].map(size => (<button key={size} onClick={() => setFormData({...formData, size})} className={`flex-1 py-3 border rounded-xl text-sm font-bold transition-all shadow-sm ${formData.size === size ? 'bg-copper text-white border-copper shadow-md' : 'bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/80 hover:bg-white dark:hover:bg-zinc-800/80'}`}>{size}L</button>))}
                            </div>
                        </div>
                        {mode === 'EDIT' && (
                            <>
                                <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Ubicación</label><DebouncedInput type="text" value={formData.currentLocation || ''} onDebouncedChange={(val) => setFormData({...formData, currentLocation: val.toString()})} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Contenido</label><DebouncedInput type="text" value={formData.contents || ''} onDebouncedChange={(val) => setFormData({...formData, contents: val.toString()})} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" /></div>
                            </>
                        )}
                    </div>
                )}

                {mode === 'FILL' && (
                    <div className="space-y-4">
                         <div>
                             <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Lote a Embarrilar</label>
                             {availableBatches.length > 0 ? (
                                <CustomSelect 
                                    value={selectedBatchIdForFill} 
                                    onChange={setSelectedBatchIdForFill}
                                    options={availableBatches.map(batch => ({
                                        value: batch.id,
                                        label: `${batch.recipeName} (${batch.lotCode}) - ${batch.volumeAvailable ?? batch.volumePackaged}L Disp.`
                                    }))}
                                    placeholder="-- Seleccionar Lote --"
                                    className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
                                />
                             ) : (<div className="text-center p-4 border-2 border-dashed border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-400 dark:text-zinc-500 text-sm">No hay lotes FINALIZADOS con stock disponible.</div>)}
                         </div>
                         <div>
                             <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Litros a llenar (Máx 50L)</label>
                             <input type="number" min="1" max="50" step="0.5" value={fillAmount} onChange={(e) => setFillAmount(Number(e.target.value))} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" />
                         </div>
                    </div>
                )}

                {mode === 'BOTTLE' && (
                    <div className="space-y-4">
                         <div className="bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 p-4 rounded-xl flex items-start gap-3"><Milk className="text-green-600 dark:text-emerald-500 shrink-0 mt-0.5" size={18} /><div className="text-sm text-green-800 dark:text-emerald-400"><p>Líquido Restante en Barril: <strong>{getRemainingVolume()} Litros</strong></p></div></div>
                         <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Seleccionar Envase (Inventario)</label><CustomSelect value={selectedInventoryId} onChange={setSelectedInventoryId} options={packagingInventory.map(item => ({ value: item.id, label: `${item.name} (Stock: ${item.stockAmount})` }))} placeholder="-- Envase Cliente / Growler --" className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" /></div>
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Formato</label><DebouncedInput type="text" value={customFormatName || ''} onDebouncedChange={(val) => setCustomFormatName(val.toString())} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-slate-100 dark:bg-zinc-800/50 text-slate-600 dark:text-zinc-400 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" readOnly={!!selectedInventoryId} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Capacidad (L)</label><DebouncedInput type="number" step="0.01" value={detectedVolume || 0} onDebouncedChange={(val) => setDetectedVolume(parseFloat(val.toString()) || 0)} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 font-bold text-center focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" /></div>
                         </div>
                         <div><label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Cantidad Unidades</label><DebouncedInput type="number" value={bottleQuantity || 0} onDebouncedChange={(val) => setBottleQuantity(parseInt(val.toString()) || 0)} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-lg font-mono bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" min="1" /></div>
                         <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-700/80 shadow-inner"><div className="text-sm font-medium text-slate-600 dark:text-zinc-400">{bottleQuantity} u. x {detectedVolume} L</div><div className="text-2xl font-black font-display text-slate-800 dark:text-zinc-100">= {getDispensingVolume()} L</div></div>
                    </div>
                )}

                {mode === 'DISPATCH' && (
                    <div className="space-y-4">
                         <div>
                             <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Cliente (CRM)</label>
                             {customers.length > 0 ? (
                                <CustomSelect 
                                    value={selectedCustomerId} 
                                    onChange={(val) => { 
                                        setSelectedCustomerId(val); 
                                        const cust = customers.find(c => c.id === val); 
                                        if(cust) setFormData({...formData, currentLocation: cust.name}); 
                                    }} 
                                    options={customers.map(c => ({ value: c.id, label: c.name }))}
                                    placeholder="-- Cliente Ocasional --"
                                    icon={<Users size={16} />}
                                    className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
                                />
                             ) : (<div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700/80">Crea clientes en la sección CRM para seleccionarlos aquí.</div>)}
                         </div>
                         <div>
                             <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Monto de Venta ($)</label>
                             <div className="relative"><DollarSign className="absolute left-3 top-3 text-slate-400 dark:text-zinc-500" size={18} /><DebouncedInput type="number" value={dispatchTotal || ''} onDebouncedChange={(val) => setDispatchTotal(parseFloat(val.toString()) || 0)} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 pl-10 text-lg bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 font-bold font-mono focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" placeholder="0" /></div>
                             {selectedCustomerId && dispatchTotal > 0 && (<div className="text-xs text-amber-600 dark:text-amber-500 mt-2 flex items-center gap-1"><AlertTriangle size={12}/> Se generará una deuda de ${dispatchTotal} al cliente.</div>)}
                         </div>
                         <div>
                             <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Destino / Ubicación</label>
                             <DebouncedInput type="text" value={formData.currentLocation || ''} onDebouncedChange={(val) => setFormData({...formData, currentLocation: val.toString()})} className="w-full border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3 bg-slate-50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm" placeholder="Ej: Bar La Esquina" />
                         </div>
                    </div>
                )}

                {mode === 'RECEIVE' && getSelectedKeg() && (
                    <div className="text-center space-y-4">
                        {getSelectedKeg()?.customerId ? (
                            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 p-4 rounded-xl text-slate-900 dark:text-zinc-100 text-left text-sm shadow-sm">
                                <p className="font-bold flex items-center gap-2"><Users size={16} className="text-copper"/> {getSelectedKeg()?.currentLocation}</p>
                                <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">Precio Pactado: <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">${getSelectedKeg()?.dispatchedPrice || 0}</span></p>
                                <div className="mt-5 p-4 bg-white dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 text-center">¿El cliente pagó el barril?</p>
                                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                                        <button onClick={() => setIsPaidNow(true)} className={`w-full sm:flex-1 py-3 text-xs font-bold rounded-xl transition-all shadow-sm border ${isPaidNow ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-700'}`}>SÍ, PAGÓ AHORA</button>
                                        <button onClick={() => setIsPaidNow(false)} className={`w-full sm:flex-1 py-3 text-xs font-bold rounded-xl transition-all shadow-sm border ${!isPaidNow ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-700'}`}>NO, SIGUE DEBIENDO</button>
                                    </div>
                                    {isPaidNow && <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1 justify-center"><CreditCard size={14}/> Se registrará un pago de ${getSelectedKeg()?.dispatchedPrice || 0}.</div>}
                                    {!isPaidNow && <div className="mt-4 text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1 justify-center"><AlertTriangle size={14}/> La deuda se mantendrá en el CRM.</div>}
                                </div>
                            </div>
                        ) : (<div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl text-sm text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/80 shadow-sm"><p className="font-medium text-slate-800 dark:text-zinc-200">Barril de cliente ocasional (Contado).</p><p className="text-xs mt-1">Solo se marcará como sucio para lavado.</p></div>)}
                    </div>
                )}

                {mode === 'DELETE' && (<div className="text-center space-y-4"><div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-5 rounded-2xl text-rose-900 dark:text-rose-400"><AlertTriangle className="mx-auto mb-3 text-rose-600 dark:text-rose-500" size={40} /><h4 className="font-display font-bold text-lg">¿Estás seguro?</h4><p className="text-sm mt-2">Vas a eliminar el barril permanentemente.</p></div></div>)}
                <button onClick={mode === 'DELETE' ? confirmDelete : handleSubmit} className={`w-full py-3.5 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-6 ${mode === 'RECEIVE' || mode === 'BOTTLE' ? 'bg-emerald-600 dark:bg-emerald-600/90 hover:bg-emerald-700 dark:hover:bg-emerald-600' : mode === 'DELETE' ? 'bg-rose-600 dark:bg-rose-600/90 hover:bg-rose-700 dark:hover:bg-rose-600' : 'bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 border border-transparent'}`}>
                    {mode === 'CREATE' ? <><Plus size={18} /> Crear Barril</> : mode === 'RECEIVE' ? 'Confirmar Recepción' : mode === 'DISPATCH' ? 'Confirmar Despacho' : mode === 'DELETE' ? 'Eliminar Definitivamente' : <><Save size={18} /> Guardar</>}
                </button>
                {mode === 'EDIT' && <button onClick={onDeleteClick} className="w-full py-3 bg-white dark:bg-zinc-900/60 flex justify-center items-center gap-2 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all shadow-sm mt-3"><Trash2 size={18} /> Eliminar Barril</button>}
            </div>
        </div>
    </div>,
    document.body
  );
};
