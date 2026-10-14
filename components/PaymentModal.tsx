import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownLeft, DollarSign } from 'lucide-react';
import { DebouncedInput } from './ui/DebouncedInput';
import { useBreweryStore } from '../context/store';
import { Customer } from '../types';
import { useToast } from './Toast';

interface PaymentModalProps {
    customer: Customer;
    onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ customer, onClose }) => {
    const addPayment = useBreweryStore(s => s.addPayment);
    const { showToast } = useToast();

    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentNote, setPaymentNote] = useState('');

    const handlePaymentSubmit = () => {
        if (!customer || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return showToast({ message: 'Monto inválido', type: 'warning' });
        }
        if (paymentAmount > customer.debt) {
            return showToast({ message: 'El pago supera la deuda actual del cliente', type: 'warning' });
        }
        
        addPayment({ 
            id: crypto.randomUUID(), 
            customerId: customer.id, 
            amount: paymentAmount, 
            date: new Date().toISOString().split('T')[0], 
            notes: paymentNote 
        });
        
        onClose();
        showToast({ message: `Pago de $${paymentAmount} registrado`, type: 'success' });
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden border border-zinc-800/50">
                <div className="p-5 border-b border-zinc-800/50 flex justify-between items-center bg-emerald-600/10">
                    <h3 className="font-bold flex items-center gap-2 text-emerald-400 font-display text-lg"><DollarSign size={20} /> Registrar Cobro</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-emerald-500/20 transition-colors"><X size={20} className="text-emerald-500 hover:text-emerald-300" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="text-center mb-6">
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Cliente</p>
                        <h4 className="text-xl font-bold text-white">{customer.name}</h4>
                        <div className="mt-3 inline-block bg-zinc-900/50 px-4 py-2 rounded-xl border border-zinc-800/50">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Deuda Actual</p>
                            <p className="font-mono font-bold text-lg text-rose-500">${customer.debt}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 text-center">Monto Recibido</label>
                        <div className="relative max-w-[200px] mx-auto">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xl">$</span>
                            <DebouncedInput type="number" value={paymentAmount || ''} onDebouncedChange={val => setPaymentAmount(parseFloat(val.toString()) || 0)} className="w-full pl-8 pr-4 py-3 border border-emerald-500/30 rounded-2xl text-center text-3xl font-bold font-mono bg-zinc-900/60 text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] focus:border-emerald-500/60" autoFocus />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Nota (Opcional)</label>
                        <DebouncedInput type="text" value={paymentNote || ''} onDebouncedChange={val => setPaymentNote(val.toString())} className="w-full p-3 border border-zinc-800/50 rounded-xl bg-zinc-900/50 text-white focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all" placeholder="Ej: Transferencia, Efectivo..." />
                    </div>
                    <button onClick={handlePaymentSubmit} className="w-full py-3.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold hover:bg-emerald-600/30 hover:text-emerald-300 flex items-center justify-center gap-2 mt-4 transition-all shadow-lg active:scale-95">
                        <ArrowDownLeft size={18}/> Confirmar Pago
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
