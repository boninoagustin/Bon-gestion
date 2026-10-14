import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarCheck, PiggyBank, ShoppingBag, X } from 'lucide-react';

interface CloseMonthModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetMonthToClose: string;
    getTargetMonthLabel: () => string;
    targetStats: { net: number };
    targetIsProfitable: boolean;
    confirmCloseMonth: () => void;
}

export const CloseMonthModal: React.FC<CloseMonthModalProps> = ({
    isOpen,
    onClose,
    targetMonthToClose,
    getTargetMonthLabel,
    targetStats,
    targetIsProfitable,
    confirmCloseMonth
}) => {
    if (!isOpen || !targetMonthToClose) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800">
               <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/80">
                   <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                       <CalendarCheck size={18} className="text-copper" /> Cerrar Mes: {getTargetMonthLabel()}
                   </h3>
                   <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                       <X size={20} />
                   </button>
               </div>
               <div className="p-6 space-y-6">
                   <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700/50 text-center shadow-sm">
                       <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Resultado Neto del Periodo</p>
                       <h2 className={`text-5xl font-black font-display tracking-tight ${targetIsProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500'}`}>
                           {targetIsProfitable ? '+' : ''}${targetStats.net.toFixed(0)}
                       </h2>
                   </div>
                   <button onClick={confirmCloseMonth} className="w-full py-3.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-xl font-bold hover:bg-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-sm flex justify-center items-center gap-2">
                       <CalendarCheck size={18} /> Confirmar Cierre de Mes
                   </button>
                   <p className="text-center text-xs text-zinc-400 mt-2">Podrás reabrirlo más adelante si necesitas hacer correcciones.</p>
               </div>
           </div>
        </div>,
        document.body
    );
};
