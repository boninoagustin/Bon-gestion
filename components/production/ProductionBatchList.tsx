import React from 'react';
import {
  Beer,
  Clock,
  ChevronRight,
  Plus,
  Thermometer,
  Droplets,
} from 'lucide-react';
import { Batch, BatchStatus, MasterRecipe } from '../../types';
import { getDaysInStage, getStatusColor } from './utils';
import { EmptyState } from '../EmptyState';
import { calculateAttenuation } from '../../lib/brewmath';

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
  openNewBatchModal,
}) => {
  return (
    <div className="lg:col-span-1 bg-white dark:bg-[#1a1d21] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2c3138] overflow-hidden flex flex-col max-h-[560px] lg:max-h-none">
      <div className="p-4 border-b border-slate-200 dark:border-[#2c3138] bg-slate-50 dark:bg-[#121417]/70 flex justify-between items-center">
        <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          {activeTab === 'ACTIVE' ? 'Lotes en Proceso' : 'Archivo Histórico'}
        </h3>
        <span className="text-xs font-mono bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30 px-2.5 py-1 rounded-full font-bold">
          {filteredBatches.length}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 p-2.5 space-y-2.5">
        {filteredBatches.length === 0 ? (
          <div className="py-4">
            <EmptyState
              type="batches"
              message={
                searchQuery
                  ? `No se encontraron lotes para "${searchQuery}".`
                  : 'Creá un lote nuevo para registrar densidades, temperaturas y progreso de fermentación.'
              }
              actionLabel={!searchQuery ? 'Nuevo Lote' : undefined}
              onAction={!searchQuery ? openNewBatchModal : undefined}
            />
            {!searchQuery && masterRecipes.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-[#f59e0b] text-center mx-4 mb-3 bg-amber-50 dark:bg-[#d97706]/10 px-3 py-2 rounded-xl border border-amber-200 dark:border-[#d97706]/30">
                ⚠️ Tip: creá primero una receta maestra en la Biblioteca para precargar maltas y lúpulos.
              </p>
            )}
          </div>
        ) : (
          filteredBatches.map((batch) => {
            const days = getDaysInStage(batch);
            const stages = [
              BatchStatus.MASHING,
              BatchStatus.FERMENTING,
              BatchStatus.CONDITIONING,
              BatchStatus.PACKAGED,
            ];
            const stageIdx = stages.indexOf(batch.status);
            const logs = batch.fermentationLogs || [];
            const lastGrav = [...logs]
              .reverse()
              .find((l) => typeof l.gravity === 'number')?.gravity;
            const lastTemp = [...logs]
              .reverse()
              .find((l) => typeof l.temperature === 'number')?.temperature;

            const attenuationPct =
              lastGrav !== undefined && batch.originalGravity > 1
                ? Math.min(
                    100,
                    Math.max(
                      8,
                      Math.round(
                        calculateAttenuation(batch.originalGravity, lastGrav)
                      )
                    )
                  )
                : batch.status === BatchStatus.CONDITIONING
                ? 85
                : batch.status === BatchStatus.FERMENTING
                ? 45
                : 15;

            const isSelected = selectedBatchId === batch.id;

            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => setSelectedBatchId(batch.id)}
                className={`w-full text-left min-h-[76px] p-4 rounded-xl border transition-all relative group select-none ${
                  isSelected
                    ? 'border-[#d97706] bg-[#d97706]/10 dark:bg-[#d97706]/15 ring-1 ring-[#f59e0b]/50 shadow-sm'
                    : 'border-slate-200 dark:border-[#2c3138] bg-white dark:bg-[#121417]/50 hover:border-[#d97706]/50 hover:bg-slate-50 dark:hover:bg-[#22262b]/70'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2 pr-5">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">
                    {batch.recipeName}
                  </span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ${getStatusColor(
                      batch.status
                    )}`}
                  >
                    {batch.status}
                  </span>
                </div>

                {/* Telemetría en fuente Monoespaciada (Código, Tanque, SG, Temp, Días) */}
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-2.5 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap font-mono">
                    <span className="bg-slate-100 dark:bg-[#1a1d21] text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#2c3138] text-[11px] font-semibold">
                      {batch.lotCode}
                    </span>
                    {batch.fermenterName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#f59e0b] bg-[#d97706]/15 px-2 py-0.5 rounded-md border border-[#d97706]/30">
                        <Droplets size={10} />
                        {batch.fermenterName}
                      </span>
                    )}
                    {lastGrav !== undefined && (
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                        SG {lastGrav.toFixed(3)}
                      </span>
                    )}
                    {lastTemp !== undefined && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-[#38bdf8] font-semibold">
                        <Thermometer size={11} />
                        {lastTemp}°C
                      </span>
                    )}
                  </div>

                  {batch.status !== BatchStatus.COMPLETED && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-[#f59e0b] font-bold">
                      <Clock size={11} /> {days}d
                    </span>
                  )}
                </div>

                {/* Barra de Progreso de Fermentación / Maduración con Gradiente Sutil */}
                {(batch.status === BatchStatus.FERMENTING ||
                  batch.status === BatchStatus.CONDITIONING ||
                  batch.status === BatchStatus.MASHING) && (
                  <div className="space-y-1 mt-1">
                    <div className="fermentation-progress-track h-2">
                      <div
                        className={
                          batch.status === BatchStatus.CONDITIONING
                            ? 'fermentation-progress-bar fermentation-progress-bar--chill'
                            : 'fermentation-progress-bar'
                        }
                        style={{ width: `${attenuationPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {batch.status === BatchStatus.PACKAGED && (
                  <div className="mt-2 fermentation-progress-track h-2">
                    <div
                      className={
                        (batch.volumeAvailable ?? batch.volumePackaged) /
                          (batch.volumePackaged || 1) <
                        0.2
                          ? 'fermentation-progress-bar fermentation-progress-bar--alert'
                          : 'fermentation-progress-bar'
                      }
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((batch.volumeAvailable ?? batch.volumePackaged) /
                              (batch.volumePackaged || 1)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                )}

                <ChevronRight
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity ${
                    isSelected
                      ? 'opacity-100 text-[#f59e0b]'
                      : 'opacity-0 group-hover:opacity-100 text-slate-400'
                  }`}
                  size={18}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
