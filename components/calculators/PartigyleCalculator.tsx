import React, { useState, useMemo } from 'react';
import { Beaker } from 'lucide-react';
import { SectionCard, InputGroup } from './Shared';
import {
  calculatePartigyle,
  sanitizeGravity,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

export const PartigyleCalculator: React.FC = () => {
  const [totalVolume, setTotalVolume] = useState<number>(50);
  const [totalOG, setTotalOG] = useState<number>(1.060);
  const [volume1, setVolume1] = useState<number>(25);

  const partigyle = useMemo(
    () => calculatePartigyle(totalVolume, totalOG, volume1),
    [totalVolume, totalOG, volume1]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-copper/10 border border-copper/20 p-4 rounded-xl flex items-center gap-4">
        <div className="bg-white dark:bg-zinc-800 p-3 rounded-full shadow-sm">
          <Beaker className="text-copper-dark dark:text-copper" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
            Calculadora Parti-gyle
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Estima la Densidad Original (OG) de dos cervezas distintas obtenidas a partir de un mismo macerado, separando los primeros mostos (cerveza fuerte) de los lavados (cerveza suave).
          </p>
        </div>
      </div>

      <SectionCard title="Parámetros Totales del Macerado">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Total Esperado"
            value={totalVolume}
            onChange={(v) => setTotalVolume(sanitizePositiveNumber(v, 50))}
            unit="L"
          />
          <InputGroup
            label="OG Total Esperada"
            value={totalOG}
            onChange={(v) => setTotalOG(sanitizeGravity(v, 1.06))}
            step="0.001"
          />
        </div>
      </SectionCard>

      <SectionCard title="Distribución de Lotes">
        <InputGroup
          label="Volumen Lote 1 - Fuerte"
          value={volume1}
          onChange={(v) =>
            setVolume1(sanitizePositiveNumber(v, 25, totalVolume))
          }
          unit="L"
        />
      </SectionCard>

      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-xl mt-4">
        <h4 className="text-sm font-bold text-zinc-900/60 dark:text-zinc-300 mb-3">
          Estimación de los 2 Lotes
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl shadow-sm">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">
              Lote 1 (Primeros Mostos)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-copper">
                {partigyle.og1.toFixed(3)}
              </span>
              <span className="text-sm text-zinc-500">OG</span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">
              {partigyle.volume1L.toFixed(1)} Litros • {(partigyle.sugarFraction1 * 100).toFixed(0)}% del extracto
            </span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-xl shadow-sm">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">
              Lote 2 (Lavado)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-500">
                {partigyle.og2.toFixed(3)}
              </span>
              <span className="text-sm text-zinc-500">OG</span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">
              {partigyle.volume2L.toFixed(1)} Litros • {(partigyle.sugarFraction2 * 100).toFixed(0)}% del extracto
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
