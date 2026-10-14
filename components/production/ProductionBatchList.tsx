import React from 'react';
import { Beer, Clock, ChevronRight, Archive, Beaker, Plus, Search } from 'lucide-react';
import { Batch, BatchStatus, MasterRecipe } from '../../types';
import { getDaysInStage, getStatusColor } from './utils';

interface ProductionBatchListProps {
    activeTab: 'ACTIVE' | 'HISTORY';
    filteredBatches: Batch[];
    searchQuery: string;
    masterRecipes: MasterRecipe[];
    selectedBatchId: string | null;
    setSelectedBatchId: (id: string | null) => void;
    openNewBatchModal: () => void;
}

export const ProductionBatchList: React.FC<ProductionBatchListProps> = ({
    activeTab,
    filteredBatches,
    searchQuery,
    masterRecipes,
    selectedBatchId,
    setSelectedBatchId,
    openNewBatchModal
}) => {
    return (
        <div className="lg:col-span-1 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 flex justify-between items-center">
                <h3 className="font-display font-semibold text-slate-700 dark:text-slate-200">
                    {activeTab === 'ACTIVE' ? 'Lotes en Proceso' : 'Archivo Histórico'}
                </h3>
                <span className="text-xs bg-copper/10 text-copper px-2.5 py-1 rounded-full font-bold">
                    {filteredBatches.length}
                </span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {filteredBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                        <div className="w-20 h-20 bg-copper/10 rounded-full flex items-center justify-center mb-4">
                            <Beer size={36} className="text-copper animate-pulse" />
                        </div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {searchQuery ? 'Sin resultados' : 'Tu próxima cocción te espera'}
                        </p>
                        <p className="text-xs text-slate-400 mb-4">
                            {searchQuery ? `No se encontró "${searchQuery}"` : 'Creá un lote nuevo para comenzar a trackear tu producción'}
                        </p>
                        {!searchQuery && masterRecipes.length === 0 && (
                            <p className="text-[10px] text-amber-600 mt-3 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/30">
                                ⚠ Primero creá una receta en la Biblioteca
                            </p>
                        )}
                    </div>
                ) : (
                    filteredBatches.map((batch) => {
                        const days = getDaysInStage(batch);
                        const stages = [BatchStatus.MASHING, BatchStatus.FERMENTING, BatchStatus.CONDITIONING, BatchStatus.PACKAGED];
                        const stageIdx = stages.indexOf(batch.status);
                        return (
                            <div key={batch.id} onClick={() => setSelectedBatchId(batch.id)} className={`p-3.5 rounded-xl border cursor-pointer transition-all relative group ${selectedBatchId === batch.id ? 'border-copper bg-copper/5 dark:bg-copper/10 ring-1 ring-copper/50 shadow-sm' : 'border-slate-200 dark:border-zinc-700 hover:border-copper/50 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{batch.recipeName}</span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap ${getStatusColor(batch.status)}`}>{batch.status}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono bg-white dark:bg-zinc-800 px-1.5 rounded border border-slate-200 dark:border-zinc-700 text-[10px]">{batch.lotCode}</span>
                                        {batch.fermenterName && (
                                            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 rounded border border-amber-200/50 dark:border-amber-800/40">
                                                {batch.fermenterName}
                                            </span>
                                        )}
                                    </div>
                                    {batch.status !== BatchStatus.COMPLETED && (
                                        <span className="flex items-center gap-1 text-[10px] text-copper font-medium">
                                            <Clock size={10} /> {days}d
                                        </span>
                                    )}
                                </div>
                                {/* Mini Stepper */}
                                {batch.status !== BatchStatus.COMPLETED && (
                                    <div className="flex items-center gap-1 mb-1">
                                        {stages.map((stage, i) => (
                                            <React.Fragment key={stage}>
                                                <div className={`w-2.5 h-2.5 rounded-full transition-all ${i <= stageIdx ? 'bg-copper scale-110' : 'bg-slate-200 dark:bg-zinc-600'}`} title={stage} />
                                                {i < stages.length - 1 && <div className={`flex-1 h-0.5 ${i < stageIdx ? 'bg-copper' : 'bg-slate-200 dark:bg-zinc-600'}`} />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                                {batch.status === BatchStatus.PACKAGED && (
                                    <div className="mt-1.5 bg-slate-200 dark:bg-zinc-700 h-1.5 w-full rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${((batch.volumeAvailable ?? batch.volumePackaged) / (batch.volumePackaged || 1)) < 0.2 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${((batch.volumeAvailable ?? batch.volumePackaged) / (batch.volumePackaged || 1)) * 100}%` }} />
                                    </div>
                                )}
                                <ChevronRight className={`absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-500 transition-opacity ${selectedBatchId === batch.id ? 'opacity-100 text-copper' : 'opacity-0 group-hover:opacity-100'}`} size={18} />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
