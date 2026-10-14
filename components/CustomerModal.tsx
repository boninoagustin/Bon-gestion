import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import { DebouncedInput } from './ui/DebouncedInput';
import { useBreweryStore } from '../context/store';
import { Customer } from '../types';
import { useToast } from './Toast';

interface CustomerModalProps {
    customerToEdit: Customer | null;
    onClose: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ customerToEdit, onClose }) => {
    const addCustomer = useBreweryStore(s => s.addCustomer);
    const updateCustomer = useBreweryStore(s => s.updateCustomer);
    const { showToast } = useToast();

    const [customerForm, setCustomerForm] = useState<Partial<Customer>>({ name: '', contact: '', address: '', debt: 0 });

    useEffect(() => {
        if (customerToEdit) {
            setCustomerForm({ ...customerToEdit });
        } else {
            setCustomerForm({ name: '', contact: '', address: '', debt: 0 });
        }
    }, [customerToEdit]);

    const handleCustomerSubmit = () => {
        if (!customerForm.name) return showToast({ message: 'Nombre requerido', type: 'warning' });
        
        if (customerToEdit) { 
            updateCustomer(customerToEdit.id, customerForm); 
        } else { 
            addCustomer({ 
                id: crypto.randomUUID(), 
                name: customerForm.name!, 
                contact: customerForm.contact || '', 
                address: customerForm.address || '', 
                debt: customerForm.debt || 0, 
                totalSales: 0 
            }); 
        }
        
        onClose();
        showToast({ message: customerToEdit ? 'Cliente actualizado' : 'Cliente creado', type: 'success' });
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden border border-zinc-800/50">
                <div className="p-5 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/50">
                    <h3 className="font-bold text-white font-display text-lg">{customerToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800/50 transition-colors"><X size={20} className="text-zinc-500 hover:text-white" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Nombre Negocio / Persona</label>
                        <DebouncedInput type="text" value={customerForm.name || ''} onDebouncedChange={val => setCustomerForm({...customerForm, name: val.toString()})} className="w-full p-3 border border-zinc-800/50 rounded-xl bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all shadow-sm" autoFocus />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Contacto (Tel / Email)</label>
                        <DebouncedInput type="text" value={customerForm.contact || ''} onDebouncedChange={val => setCustomerForm({...customerForm, contact: val.toString()})} className="w-full p-3 border border-zinc-800/50 rounded-xl bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Dirección / Zona</label>
                        <DebouncedInput type="text" value={customerForm.address || ''} onDebouncedChange={val => setCustomerForm({...customerForm, address: val.toString()})} className="w-full p-3 border border-zinc-800/50 rounded-xl bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all shadow-sm" />
                    </div>
                    {!customerToEdit && (
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Saldo Inicial (Deuda)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                                <DebouncedInput type="number" value={customerForm.debt || 0} onDebouncedChange={val => setCustomerForm({...customerForm, debt: parseFloat(val.toString()) || 0})} className="w-full pl-8 pr-3 py-3 border border-zinc-800/50 rounded-xl bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all shadow-sm font-mono font-medium" />
                            </div>
                        </div>
                    )}
                    <button onClick={handleCustomerSubmit} className="w-full py-3.5 bg-copper/20 text-copper border border-copper/30 hover:bg-copper/30 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition-all shadow-lg active:scale-95">
                        <Save size={18}/> Guardar Cliente
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
