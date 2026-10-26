import React, { useMemo, useState, useRef } from 'react';
import { useBreweryStore } from '../context/store';
import {
  Calendar,
  Beer,
  Milk,
  TrendingUp,
  Droplet,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Sale } from '../types';
import { useToast } from './Toast';
import { SaleEditModal } from './SaleEditModal';
import { parseVolumeFromFormat } from '../lib/volumeParser';
import { groupSalesHistory } from '../lib/selectors';
import { useVirtualizer } from '@tanstack/react-virtual';

export const SalesHistory: React.FC = React.memo(() => {
  const sales = useBreweryStore((s) => s.sales);
  const { showToast } = useToast();

  const [detailGroup, setDetailGroup] = useState<{
    month: string;
    format: string;
    items: Sale[];
  } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => {
    return groupSalesHistory(sales);
  }, [sales]);

  const months = Object.keys(history).sort().reverse();
  const grandTotalVolume = useMemo(
    () =>
      sales.reduce((acc, s: Sale) => {
        const vol = parseVolumeFromFormat(s.format || '') * (s.quantity || 1);
        return acc + (Number.isFinite(vol) ? vol : 0);
      }, 0),
    [sales]
  );

  const openDetails = (month: string, format: string, items: Sale[]) =>
    setDetailGroup({ month, format, items });
  const closeDetails = () => setDetailGroup(null);
  const handleUpdateItems = (items: Sale[]) =>
    setDetailGroup(detailGroup ? { ...detailGroup, items } : null);

  const exportCSV = () => {
    if (sales.length === 0) {
      showToast({ message: 'No hay ventas para exportar', type: 'warning' });
      return;
    }
    const headers = [
      'Fecha',
      'Descripción',
      'Tipo',
      'Formato',
      'Cantidad',
      'Monto',
      'Lote',
      'Pagado',
    ];
    const rows = [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((s) =>
        [
          s.date,
          `"${(s.description || '').replace(/"/g, '""')}"`,
          s.type || '',
          s.format || '',
          s.quantity || 1,
          s.amount.toFixed(2),
          s.lotCode || '',
          s.isPaid === false ? 'No' : 'Sí',
        ].join(',')
      );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
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
    estimateSize: () => 220,
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1a1d21] p-6 rounded-2xl border border-slate-200 dark:border-[#2c3138] shadow-sm">
        <div>
          <h3 className="text-2xl font-black font-display tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <TrendingUp className="text-[#f59e0b]" size={26} />
            Historial de Ventas y Despachos
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidado mensual de barriles, pintas en pizarra y botellas vendidas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 text-xs font-bold items-center">
          <div className="min-h-[44px] flex items-center bg-[#10b981]/15 text-[#10b981] px-4 py-2 rounded-xl border border-[#10b981]/30 font-mono">
            Total: $
            {sales
              .reduce((acc, s) => acc + s.amount, 0)
              .toLocaleString('es-AR', { maximumFractionDigits: 0 })}
          </div>
          <div className="min-h-[44px] flex items-center bg-slate-100 dark:bg-[#121417] text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#2c3138] font-mono">
            Vol: {grandTotalVolume.toFixed(1)} L
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="min-h-[44px] flex items-center gap-2 bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:from-[#b45309] hover:to-[#d97706] text-white px-4 py-2 rounded-xl uppercase tracking-wider shadow-copper-glow transition-all active:scale-95 cursor-pointer"
            title="Exportar a CSV"
          >
            <Download size={16} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {months.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-[#1a1d21] rounded-2xl border border-dashed border-slate-200 dark:border-[#2c3138]">
          <Calendar size={42} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold text-slate-700 dark:text-slate-200">
            No hay ventas registradas aún
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Las ventas de barriles, pizarra y botellas aparecerán agrupadas por mes aquí.
          </p>
        </div>
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
                  <div className="bg-white dark:bg-[#1a1d21] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2c3138] overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#121417] p-5 border-b border-slate-200 dark:border-[#2c3138] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h4 className="font-extrabold font-display text-slate-800 dark:text-white text-lg capitalize">
                          {data.monthLabel}
                        </h4>
                        <div className="flex gap-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                          <span className="bg-white dark:bg-[#1a1d21] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2c3138]">
                            {data.totalItems} operaciones
                          </span>
                          <span className="flex items-center gap-1.5 bg-white dark:bg-[#1a1d21] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2c3138]">
                            <Droplet size={12} className="text-[#38bdf8]" />
                            {parseFloat(data.totalVolume.toFixed(1))} L
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="block font-mono font-black text-2xl text-[#10b981] tracking-tight">
                          ${data.totalRevenue.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-100 dark:border-[#2c3138] tracking-wider">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold">
                              Formato
                            </th>
                            <th className="px-4 py-3 text-right font-bold">
                              Cant.
                            </th>
                            <th className="px-4 py-3 text-right font-bold">
                              Vol.
                            </th>
                            <th className="px-4 py-3 text-right font-bold">
                              Total
                            </th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2c3138]/60">
                          {Object.values(data.breakdown).map(
                            (
                              item: {
                                type: 'KEG' | 'BOTTLE' | 'TAPROOM';
                                quantity: number;
                                revenue: number;
                                volume: number;
                                format: string;
                                transactions: Sale[];
                              },
                              idx
                            ) => (
                              <tr
                                key={idx}
                                className="hover:bg-slate-50 dark:hover:bg-[#22262b] cursor-pointer group transition-colors"
                                onClick={() =>
                                  openDetails(
                                    data.monthLabel,
                                    item.format,
                                    item.transactions
                                  )
                                }
                              >
                                <td className="px-4 py-3.5 text-slate-700 dark:text-slate-200 flex items-center gap-3">
                                  <div className="p-2 bg-slate-100 dark:bg-[#121417] border border-slate-200 dark:border-[#2c3138] rounded-xl group-hover:border-[#d97706]/50 transition-colors">
                                    {item.type === 'KEG' ||
                                    item.type === 'TAPROOM' ? (
                                      <Beer
                                        size={17}
                                        className="text-[#f59e0b] shrink-0"
                                      />
                                    ) : (
                                      <Milk
                                        size={17}
                                        className="text-[#38bdf8] shrink-0"
                                      />
                                    )}
                                  </div>
                                  <span className="font-bold whitespace-nowrap">
                                    {item.format}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-300 font-mono font-semibold">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3.5 text-right text-slate-500 dark:text-slate-400 font-mono text-xs">
                                  {parseFloat(item.volume.toFixed(1))} L
                                </td>
                                <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-white font-mono text-base">
                                  ${item.revenue.toFixed(0)}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <ChevronRight
                                    size={18}
                                    className="text-slate-400 group-hover:text-[#f59e0b] transition-colors inline"
                                  />
                                </td>
                              </tr>
                            )
                          )}
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
