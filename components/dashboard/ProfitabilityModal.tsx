import React from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

interface ProfitabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    profitabilitySummary: { totalRevenue: number; totalProfit: number; weightedAvgMargin: number; };
    profitabilityData: any[];
    targetMargins: Record<string, number>;
    updateBatchTargetMargin: (lotCode: string, val: number) => void;
}

export const ProfitabilityModal: React.FC<ProfitabilityModalProps> = ({
    isOpen,
    onClose,
    profitabilitySummary,
    profitabilityData,
    targetMargins,
    updateBatchTargetMargin
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white/95 dark:bg-zinc-900/95 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-zinc-700/50">
                <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
                    <div>
                        <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Calculator size={20} className="text-copper"/> Simulador de Rentabilidad & Precios</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Analiza tu ganancia real y ajusta objetivos por lote</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200/50 dark:border-zinc-800/50 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-widest mb-1">Ventas Totales</span>
                        <span className="text-2xl font-mono font-black text-zinc-900 dark:text-zinc-100">${profitabilitySummary.totalRevenue.toFixed(0)}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-widest mb-1">Ganancia Neta</span>
                        <span className={`text-2xl font-mono font-black ${profitabilitySummary.totalProfit > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>${profitabilitySummary.totalProfit.toFixed(0)}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-widest mb-1">Margen Promedio Ponderado</span>
                        <span className="text-3xl font-mono font-black text-copper">{profitabilitySummary.weightedAvgMargin.toFixed(1)}%</span>
                    </div>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] sticky top-0 z-10 shadow-sm border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="p-4 tracking-wider">Lote / Cerveza</th>
                                <th className="p-4 text-right tracking-wider">Costo Total / Lt<br/><span className="text-[9px] font-normal normal-case text-zinc-400 dark:text-zinc-500">(Insumos + Fijos Reales)</span></th>
                                <th className="p-4 text-center w-32 bg-amber-50/50 dark:bg-amber-900/10 border-l border-amber-100 dark:border-amber-900/30 tracking-wider">Margen Obj. (%)</th>
                                <th className="p-4 text-center bg-amber-50/50 dark:bg-amber-900/10 border-r border-amber-100 dark:border-amber-900/30 tracking-wider">Precio Sugerido / Lt<br/><span className="text-[9px] font-normal normal-case dark:text-amber-600/50">(Mínimo)</span></th>
                                <th className="p-4 text-center tracking-wider">Rentabilidad Real</th>
                                <th className="p-4 text-right tracking-wider">Ganancia (Total)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {profitabilityData.map((item) => {
                                const target = Math.min(95, Math.max(0, targetMargins[item.lotCode] ?? 30)); // Default 30%
                                // Formula for Markup Pricing: Cost / (1 - Margin%)
                                const divisor = 1 - (target / 100);
                                const suggestedPrice = divisor > 0 ? item.totalCostPerLiter / divisor : 0;
                                
                                return (
                                    <tr key={item.lotCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-zinc-900 dark:text-zinc-200">{item.name}</div>
                                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{item.lotCode}</div>
                                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">{item.litersSold.toFixed(1)} Lts vendidos</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                            ${item.totalCostPerLiter.toFixed(0)}
                                        </td>
                                        <td className="p-4 text-center bg-amber-50/30 dark:bg-amber-900/10 border-l border-amber-100 dark:border-amber-900/20">
                                             <div className="flex items-center justify-center gap-1">
                                                 <DebouncedInput 
                                                      type="number" 
                                                      value={target || ''} 
                                                      onDebouncedChange={(val) => updateBatchTargetMargin(item.lotCode, parseFloat(val) || 0)}
                                                      className="w-14 p-1.5 text-center border border-amber-300 dark:border-amber-700/50 rounded-md font-mono font-bold text-amber-800 dark:text-amber-400 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-copper/50 focus:border-copper outline-none transition-all"
                                                 />
                                                 <span className="text-amber-700 dark:text-amber-500 font-bold text-xs">%</span>
                                             </div>
                                        </td>
                                        <td className="p-4 text-center bg-amber-50/30 dark:bg-amber-900/10 border-r border-amber-100 dark:border-amber-900/20 font-mono font-bold text-amber-700 dark:text-amber-500">
                                            ${suggestedPrice.toFixed(0)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm ${item.marginPercent >= target ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
                                                {item.marginPercent.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-lg text-zinc-900 dark:text-zinc-100">
                                            ${item.profit.toFixed(0)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-200/50 dark:border-zinc-800/50 text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-col md:flex-row justify-between gap-2">
                    <p><strong>*</strong> El Costo Total por litro incluye Insumos + Overhead ajustado al volumen real de ese mes.</p>
                    <p><strong>Precio Sugerido</strong> = Costo / (1 - Margen%). Ajusta el Margen Objetivo por lote para ver el precio ideal.</p>
                </div>
            </div>
        </div>,
        document.body
    );
};
