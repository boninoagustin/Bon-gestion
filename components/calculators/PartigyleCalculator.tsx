import React, { useState } from 'react';
import { Beaker } from 'lucide-react';
import { SectionCard } from './Shared';

export const PartigyleCalculator: React.FC = () => {
  const [totalVolume, setTotalVolume] = useState<number>(50);
  const [totalOG, setTotalOG] = useState<number>(1.060);
  const [volume1, setVolume1] = useState<number>(25);

  const volume2 = Math.max(0, totalVolume - volume1);
  const totalPoints = (totalOG - 1) * 1000 * totalVolume;

  // Fraction of volume for batch 1
  const vFraction = totalVolume > 0 ? volume1 / totalVolume : 0;
  
  // Empirical curve for sugar extraction in fly sparging
  // Accumulated Sugar Fraction S = V + 0.32 * V * (1 - V)
  // This gives approx 58% of sugars in the first 50% of volume.
  const sugarFraction1 = vFraction + 0.32 * vFraction * (1 - vFraction);
  const sugarFraction2 = 1 - sugarFraction1;

  const points1 = totalPoints * sugarFraction1;
  const points2 = totalPoints * sugarFraction2;

  const og1 = volume1 > 0 ? 1 + (points1 / volume1) / 1000 : 1;
  const og2 = volume2 > 0 ? 1 + (points2 / volume2) / 1000 : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-copper/10 border border-copper/20 p-4 rounded-xl flex items-center gap-4">
        <div className="bg-white dark:bg-zinc-800 p-3 rounded-full shadow-sm">
          <Beaker className="text-copper-dark dark:text-copper" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Calculadora Parti-gyle</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Estima la Densidad Original (OG) de dos cervezas distintas obtenidas a partir de un mismo macerado, separando los primeros mostos (cerveza fuerte) de los lavados (cerveza suave).</p>
        </div>
      </div>

      <SectionCard title="Parámetros Totales del Macerado">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Volumen Total Esperado (L)</label>
            <input 
              type="number" 
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-zinc-900 dark:text-white"
              value={totalVolume || ''} 
              onChange={e => setTotalVolume(parseFloat(e.target.value))} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">OG Total Esperada</label>
            <input 
              type="number" 
              step="0.001"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-zinc-900 dark:text-white"
              value={totalOG || ''} 
              onChange={e => setTotalOG(parseFloat(e.target.value))} 
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Distribución de Lotes">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Volumen Lote 1 - Fuerte (L)</label>
          <input 
            type="number" 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-zinc-900 dark:text-white"
            value={volume1 || ''} 
            onChange={e => setVolume1(parseFloat(e.target.value))} 
          />
        </div>
      </SectionCard>

      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-xl mt-4">
        <h4 className="text-sm font-bold text-zinc-900/60 dark:text-zinc-300 mb-3">Estimación de los 2 Lotes</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl shadow-sm">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Lote 1 (Primeros Mostos)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-copper">{og1.toFixed(3)}</span>
              <span className="text-sm text-zinc-500">OG</span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">{volume1} Litros • {(sugarFraction1 * 100).toFixed(0)}% del extracto</span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl shadow-sm">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Lote 2 (Lavado)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-500">{og2.toFixed(3)}</span>
              <span className="text-sm text-zinc-500">OG</span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">{volume2} Litros • {(sugarFraction2 * 100).toFixed(0)}% del extracto</span>
          </div>
        </div>
      </div>
    </div>
  );
};
