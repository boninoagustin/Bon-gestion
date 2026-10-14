import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

interface ExpensesModalProps {
    isOpen: boolean;
    onClose: () => void;
    expenseForm: { description: string; amount: number; category: string };
    setExpenseForm: React.Dispatch<React.SetStateAction<{ description: string; amount: number; category: string }>>;
    handleAddExpense: () => void;
}

export const ExpensesModal: React.FC<ExpensesModalProps> = ({
    isOpen,
    onClose,
    expenseForm,
    setExpenseForm,
    handleAddExpense
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
             <div className="bg-zinc-950/90 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden border border-zinc-800/50">
                 <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/50">
                     <h3 className="text-lg font-bold font-display text-white">Registrar Gasto Vario</h3>
                     <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                         <X size={20} />
                     </button>
                 </div>
                 <div className="p-6 space-y-5">
                     <div>
                         <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Descripción</label>
                         <DebouncedInput 
                             type="text" 
                             value={expenseForm.description || ''} 
                             onDebouncedChange={val => setExpenseForm(prev => ({...prev, description: val}))} 
                             className="w-full p-2.5 rounded-xl border border-zinc-800/50 bg-zinc-900/50 text-white outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" 
                             placeholder="Ej: Reparación Bomba" 
                             autoFocus
                         />
                     </div>
                     <div>
                         <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Monto ($)</label>
                         <DebouncedInput 
                             type="number" 
                             value={expenseForm.amount || ''} 
                             onDebouncedChange={val => setExpenseForm(prev => ({...prev, amount: parseFloat(val) || 0}))} 
                             className="w-full p-2.5 rounded-xl border border-zinc-800/50 bg-zinc-900/50 text-white font-mono outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all" 
                             placeholder="0"
                         />
                     </div>
                     <div>
                         <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Categoría</label>
                         <select 
                             value={expenseForm.category} 
                             onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} 
                             className="w-full p-2.5 rounded-xl border border-zinc-800/50 bg-zinc-900/50 text-white outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all appearance-none cursor-pointer" 
                         >
                             <option value="MAINTENANCE">Mantenimiento / Reparación</option>
                             <option value="MARKETING">Marketing / Publicidad</option>
                             <option value="LOGISTICS">Logística / Flete</option>
                             <option value="ADMIN">Administrativo / Impuestos</option>
                             <option value="OTHER">Otros</option>
                         </select>
                     </div>
                     <button onClick={handleAddExpense} className="w-full py-3 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl font-bold hover:bg-rose-600/30 hover:text-rose-300 transition-all mt-4 flex items-center justify-center gap-2">
                         Registrar Gasto
                     </button>
                 </div>
             </div>
        </div>,
        document.body
    );
};
