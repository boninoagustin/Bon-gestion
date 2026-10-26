import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { PlusCircle, Trash2 } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';
import {
  calculateTinsethIBUBreakdown,
  HopAdditionInput,
  HopAdditionStage,
  HopFormType,
  sanitizeGravity,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

interface HopRowState extends HopAdditionInput {
  id: string;
}

export const IBUCalculator: React.FC = () => {
  const [ibuBoilVol, setIbuBoilVol] = useState<number>(300);
  const [ibuGravity, setIbuGravity] = useState<number>(1.050);
  const [evapRateLPerHour, setEvapRateLPerHour] = useState<number>(25);
  const [totalBoilMinutes, setTotalBoilMinutes] = useState<number>(60);
  const [kettleDiameterCm, setKettleDiameterCm] = useState<number>(70);
  const [hopAdditions, setHopAdditions] = useState<HopRowState[]>([
    {
      id: '1',
      amount: 50,
      alpha: 12.5,
      time: 60,
      type: 'BOIL',
      form: 'PELLET',
      whirlpoolTempC: 85,
    },
  ]);

  const breakdown = useMemo(
    () =>
      calculateTinsethIBUBreakdown(hopAdditions, ibuBoilVol, ibuGravity, {
        evaporationRateLPerHour: evapRateLPerHour,
        totalBoilTimeMinutes: totalBoilMinutes,
        kettleDiameterCm,
        gravityReferenceStage: 'POST_BOIL',
      }),
    [hopAdditions, ibuBoilVol, ibuGravity, evapRateLPerHour, totalBoilMinutes, kettleDiameterCm]
  );

  const addHopRow = () => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());
    setHopAdditions((prev) => [
      ...prev,
      {
        id: newId,
        amount: 25,
        alpha: 8.0,
        time: 15,
        type: 'BOIL',
        form: 'PELLET',
        whirlpoolTempC: 85,
      },
    ]);
  };

  const removeHopRow = (id: string) => {
    setHopAdditions((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHopRow = <K extends keyof HopRowState>(
    id: string,
    field: K,
    value: HopRowState[K]
  ) => {
    setHopAdditions((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  return (
    <>
      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-400 p-4 rounded-xl text-xs border border-amber-100 dark:border-amber-800/50 shadow-sm">
        <strong>Tinseth Exacto (Paso a Paso + Geometría):</strong>
        <ul className="mt-2 ml-4 list-disc space-y-1 font-medium">
          <li>
            <strong>Gravedad Paso a Paso:</strong> Integra minuto a minuto la concentración del mosto según la evaporación ({evapRateLPerHour} L/h).
          </li>
          <li>
            <strong>Geometría de Olla:</strong> Relación D/H = {breakdown.geometry.aspectRatio.toFixed(2)} (Factor utilización: ×{breakdown.geometry.geometryFactor.toFixed(3)}).
          </li>
          <li>
            <strong>Hopstand / Whirlpool:</strong> Cinética de isomerización sub-hervor de Malowicki según temperatura.
          </li>
        </ul>
      </div>

      <SectionCard title="Configuración de Olla y Hervor">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InputGroup
            label="Volumen Post-Hervor"
            value={ibuBoilVol}
            onChange={(v) => setIbuBoilVol(sanitizePositiveNumber(v, 300))}
            unit="L"
          />
          <InputGroup
            label="Densidad Post-Hervor"
            value={ibuGravity}
            onChange={(v) => setIbuGravity(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
          <InputGroup
            label="Evaporación"
            value={evapRateLPerHour}
            onChange={(v) => setEvapRateLPerHour(sanitizePositiveNumber(v, 0, 500))}
            unit="L/h"
          />
          <InputGroup
            label="Tiempo Total Hervor"
            value={totalBoilMinutes}
            onChange={(v) => setTotalBoilMinutes(sanitizePositiveNumber(v, 60, 240))}
            unit="min"
          />
          <InputGroup
            label="Diámetro Olla"
            value={kettleDiameterCm}
            onChange={(v) => setKettleDiameterCm(sanitizePositiveNumber(v, 0, 500))}
            unit="cm"
          />
          <div className="flex flex-col justify-center bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Evolución SG Hervor</span>
            <span className="font-mono font-bold text-slate-700 dark:text-zinc-200 mt-1">
              {breakdown.initialBoilGravity.toFixed(3)} → {breakdown.finalBoilGravity.toFixed(3)}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Adiciones de Lúpulo">
        <div className="space-y-3">
          {hopAdditions.map((hop, idx) => {
            const addResult = breakdown.additions[idx];
            return (
              <div
                key={hop.id}
                className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-xl relative shadow-sm transition-all"
              >
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">
                      Gramos
                    </label>
                    <DebouncedInput
                      type="text"
                      inputMode="decimal"
                      value={hop.amount}
                      onDebouncedChange={(val) =>
                        updateHopRow(hop.id, 'amount', sanitizePositiveNumber(val, 0))
                      }
                      className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">
                      % AA
                    </label>
                    <DebouncedInput
                      type="text"
                      inputMode="decimal"
                      value={hop.alpha}
                      onDebouncedChange={(val) =>
                        updateHopRow(hop.id, 'alpha', sanitizePositiveNumber(val, 0, 100))
                      }
                      className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">
                      Minutos
                    </label>
                    <DebouncedInput
                      type="text"
                      inputMode="decimal"
                      value={hop.time}
                      onDebouncedChange={(val) =>
                        updateHopRow(hop.id, 'time', sanitizePositiveNumber(val, 0, 240))
                      }
                      className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center mt-1">
                  <div className="flex-1 min-w-[140px]">
                    <select
                      value={hop.type}
                      onChange={(e) =>
                        updateHopRow(hop.id, 'type', e.target.value as HopAdditionStage)
                      }
                      className="w-full p-2.5 text-sm font-medium bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                    >
                      <option value="BOIL">Hervor (Boil)</option>
                      <option value="FIRST_WORT">First Wort Hop (FWH)</option>
                      <option value="HOPSTAND">Hopstand / Whirlpool</option>
                      <option value="DRY_HOP">Dry Hop (0 IBU)</option>
                    </select>
                  </div>

                  <div className="w-32">
                    <select
                      value={hop.form ?? 'PELLET'}
                      onChange={(e) =>
                        updateHopRow(hop.id, 'form', e.target.value as HopFormType)
                      }
                      className="w-full p-2.5 text-sm font-medium bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                    >
                      <option value="PELLET">Pellet (+10%)</option>
                      <option value="WHOLE">Flor Entera</option>
                      <option value="PLUG">Plug (+2%)</option>
                    </select>
                  </div>

                  {hop.type === 'HOPSTAND' && (
                    <div className="w-24">
                      <DebouncedInput
                        type="text"
                        inputMode="decimal"
                        value={hop.whirlpoolTempC ?? 85}
                        onDebouncedChange={(val) =>
                          updateHopRow(
                            hop.id,
                            'whirlpoolTempC',
                            sanitizePositiveNumber(val, 85, 100)
                          )
                        }
                        title="Temperatura Whirlpool (°C)"
                        className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                  )}

                  <div className="text-right min-w-[90px]">
                    <span className="block text-xs font-mono font-bold text-green-600 dark:text-green-400">
                      {addResult ? addResult.ibu.toFixed(1) : '0.0'} IBU
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      Util: {addResult ? (addResult.utilization * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>

                  <button
                    onClick={() => removeHopRow(hop.id)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1"
                    title="Eliminar adición"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={addHopRow}
            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-zinc-700/80 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2 text-sm font-bold transition-all"
          >
            <PlusCircle size={18} /> Agregar Lúpulo
          </button>
        </div>
      </SectionCard>

      <ResultCard
        title="Amargor Total"
        value={breakdown.totalIBU.toFixed(1)}
        unit="IBUs"
        subtext={`SG Media Hervor: ${breakdown.averageBoilGravity.toFixed(3)} • Factor Geometría: ×${breakdown.geometry.geometryFactor.toFixed(2)}`}
        colorClass="text-green-400"
      />
    </>
  );
};
