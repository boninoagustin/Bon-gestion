import React, { useMemo, useState, useRef } from 'react';
import { useBreweryStore } from '../context/store';
import { Calendar, DollarSign, Package, Beer, Milk, TrendingUp, Droplet, ChevronRight, X, Trash2, Pencil, Save, Download } from 'lucide-react';
import { Sale } from '../types';
import { useToast } from './Toast';
import { SaleEditModal } from './SaleEditModal';
import { parseVolumeFromFormat } from '../lib/volumeParser';
import { groupSalesHistory } from '../lib/selectors';
import { useVirtualizer } from '@tanstack/react-virtual';

export const SalesHistory: React.FC = React.memo(() => {
  const sales = useBreweryStore(s => s.sales);
  const deleteSale = useBreweryStore(s => s.deleteSale);
  const updateSale = useBreweryStore(s => s.updateSale);
  const { showToast } = useToast();
  
  const [detailGroup, setDetailGroup] = useState<{month: string, format: string, items: Sale[]} | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => {
    return groupSalesHistory(sales);
  }, [sales]);

  const months = Object.keys(history).sort().reverse();
  const grandTotalVolume = useMemo(() => sales.reduce((acc, s: Sale) => {
    const vol = parseVolumeFromFormat(s.format || '') * (s.quantity || 1);
    return acc + (Number.isFinite(vol) ? vol : 0);
  }, 0), [sales]);

  const openDetails = (month: string, format: string, items: Sale[]) => setDetailGroup({ month, format, items });
  const closeDetails = () => setDetailGroup(null);
  const handleUpdateItems = (items: Sale[]) => setDetailGroup(detailGroup ? { ...detailGroup, items } : null);

  const exportCSV = () => {
    if (sales.length === 0) {
      showToast({ message: 'No hay ventas para exportar', type: 'warning' });
      return;
    }
    const headers = ['Fecha', 'Descripción', 'Tipo', 'Formato', 'Cantidad', 'Monto', 'Lote', 'Pagado'];
    const rows = [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => [
        s.date,
        `"${(s.description || '').replace(/"/g, '""')}"`,
        s.type || '',
        (s as any).format || '',
        s.quantity || 1,
        s.amount.toFixed(2),
        (s as any).lotCode || '',
        s.isPaid === false ? 'No' : 'Sí'
      ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_bon_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'CSV descargado correctamente', type: 'success' });
  };

  const rowVirtualizer = useVirtualizer({
    count: months.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  return (
    <div className="space-y-6 pb-20 relative">
        
        {detailGroup && (
            <SaleEditModal
                detailGroup={detailGroup}
                onClose={closeDetails}
                onUpdateItems={handleUpdateItems}
            />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white dark:bg-zinc-900/40 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-md">
            <h3 className="text-2xl font-bold font-display text-slate-800 dark:text-zinc-100 flex items-center gap-2"><TrendingUp className="text-copper" size={24} /> Historial de Ventas</h3>
            <div className="flex flex-wrap gap-3 text-sm font-bold items-center">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm">Total: ${sales.reduce((acc, s) => acc + s.amount, 0).toFixed(0)}</div>
                <div className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700/80 shadow-sm">Vol: {grandTotalVolume.toFixed(1)} Lts</div>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-copper-dark text-white px-4 py-2 rounded-xl hover:bg-slate-800 dark:hover:bg-copper transition-all shadow-md active:scale-95"
                  title="Exportar a CSV"
                >
                  <Download size={16} /> CSV
                </button>
            </div>
        </div>

        {months.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm"><Calendar size={48} className="mx-auto mb-4 opacity-20" /><p className="font-medium">No hay ventas registradas aún.</p></div>
        ) : (
            <div 
              ref={parentRef} 
              className="max-h-[calc(100vh-250px)] overflow-y-auto rounded-xl scrollbar-hide"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const monthKey = months[virtualRow.index];
                  const data = history[monthKey];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="pb-4"
                    >
                      <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 overflow-hidden hover:shadow-md transition-shadow">
                          <div className="bg-slate-50 dark:bg-zinc-800/80 p-5 border-b border-slate-200 dark:border-zinc-700/80 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                              <div><h4 className="font-bold font-display text-slate-800 dark:text-zinc-100 text-lg capitalize">{data.monthLabel}</h4><div className="flex gap-3 text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium"><span className="bg-slate-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700/80">{data.totalItems} transacciones</span><span className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700/80"><Droplet size={12} className="text-blue-500" /> {parseFloat(data.totalVolume.toFixed(1))} Lts</span></div></div>
                              <div className="text-left sm:text-right"><span className="block font-mono font-bold text-2xl text-emerald-600 dark:text-emerald-400 tracking-tight">${data.totalRevenue.toFixed(0)}</span></div>
                          </div>
                          <div className="p-2 overflow-x-auto">
                              <table className="w-full text-sm">
                                  <thead className="text-xs text-slate-400 dark:text-zinc-500 uppercase bg-white dark:bg-transparent border-b border-slate-100 dark:border-zinc-800/50 tracking-wider">
                                      <tr><th className="px-4 py-3 text-left font-bold">Formato</th><th className="px-4 py-3 text-right font-bold">Cant.</th><th className="px-4 py-3 text-right font-bold">Vol.</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-4 py-3"></th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                      {Object.values(data.breakdown).map((item: { type: 'KEG' | 'BOTTLE' | 'TAPROOM', quantity: number, revenue: number, volume: number, format: string, transactions: Sale[] }, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer group transition-colors" onClick={() => openDetails(data.monthLabel, item.format, item.transactions)}>
                                              <td className="px-4 py-4 text-slate-700 dark:text-zinc-300 flex items-center gap-3">
                                                  <div className="p-2 bg-slate-100 dark:bg-zinc-900 rounded-lg group-hover:bg-copper/10 transition-colors">
                                                      {item.type === 'KEG' || item.type === 'TAPROOM' ? (
                                                          <Beer size={18} className="text-copper shrink-0" />
                                                      ) : (
                                                          <Milk size={18} className="text-slate-500 dark:text-zinc-400 group-hover:text-copper transition-colors shrink-0" />
                                                      )}
                                                  </div>
                                                  <span className="font-bold whitespace-nowrap">{item.format}</span>
                                              </td>
                                              <td className="px-4 py-4 text-right text-slate-600 dark:text-zinc-400 font-mono font-medium">{item.quantity}</td>
                                              <td className="px-4 py-4 text-right text-slate-600 dark:text-zinc-400 font-mono text-xs font-medium">{parseFloat(item.volume.toFixed(1))} L</td>
                                              <td className="px-4 py-4 text-right font-bold text-slate-800 dark:text-zinc-200 font-mono text-base">${item.revenue.toFixed(0)}</td>
                                              <td className="px-4 py-4 text-right"><ChevronRight size={18} className="text-slate-300 dark:text-zinc-600 group-hover:text-copper dark:group-hover:text-copper-light transition-colors" /></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        )}
    </div>
  );
});
