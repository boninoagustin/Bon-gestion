import React, { useState, useEffect, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Info } from 'lucide-react';
import {
  BJCP_CARBONATION_STYLES,
  calculateCarbonationPressure,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const CarbCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('CARB');
  const [carbMode, setCarbMode] = useState<'QUICK' | 'EQUILIBRIUM'>('EQUILIBRIUM');
  const [carbTimeLeft, setCarbTimeLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  // La tool `calculate_carbonation` emite beerTempC / targetCO2Volumes; se aceptan también alias legacy.
  const [carbTemp, setCarbTemp] = useState<number>(() =>
    prefillNum(prefill, 'beerTempC', prefillNum(prefill, 'temperatureC', 4))
  );
  const [carbVol, setCarbVol] = useState<number>(() =>
    prefillNum(prefill, 'targetCO2Volumes', prefillNum(prefill, 'volumesCo2', 2.4))
  );
  const [selectedStyleId, setSelectedStyleId] = useState<string>(() =>
    typeof prefill.styleId === 'string' ? prefill.styleId : 'AMERICAN_IPA'
  );

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setCarbTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning]);

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
    const found = BJCP_CARBONATION_STYLES.find((s) => s.id === styleId);
    if (found) {
      setCarbVol(found.targetVols);
    }
  };

  const pressure = useMemo(
    () => calculateCarbonationPressure(carbTemp, carbVol, selectedStyleId),
    [carbTemp, carbVol, selectedStyleId]
  );

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-4">
        <button
          onClick={() => setCarbMode('EQUILIBRIUM')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
            carbMode === 'EQUILIBRIUM'
              ? 'bg-white dark:bg-zinc-900/60 text-amber-600 dark:text-amber-400 shadow'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          LENTO (Equilibrio BJCP)
        </button>
        <button
          onClick={() => setCarbMode('QUICK')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition ${
            carbMode === 'QUICK'
              ? 'bg-white dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 shadow'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          RÁPIDO (Agitado)
        </button>
      </div>

      {carbMode === 'QUICK' ? (
        <div className="text-center space-y-8 py-2">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-amber-900 dark:text-amber-200 text-sm text-left border border-amber-100 dark:border-amber-800 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <Info className="shrink-0 mt-1" size={16} />
              <h4 className="font-bold">Método Ross (Shake &amp; Bake)</h4>
            </div>
            <ol className="list-decimal ml-8 space-y-2 text-xs">
              <li>Enfría el barril a temperatura de servicio.</li>
              <li>
                Conecta CO2 a <strong>2.4 BAR (35 PSI)</strong>.
              </li>
              <li>
                Pon el barril de costado y <strong>agita vigorosamente</strong> mientras corre el tiempo.
              </li>
              <li>
                Al sonar la alarma: <strong>BAJA la presión</strong> o desconecta.
              </li>
              <li>Deja reposar 24hs para estabilizar la espuma.</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-300">
              ⚠️ Advertencia: Si dejas 2.4 Bar conectados por 24hs sin bajar, tendrás una cerveza sobrecarbonatada.
            </div>
          </div>

          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full border-4 ${
                isTimerRunning
                  ? 'border-amber-500 animate-pulse'
                  : 'border-zinc-200 dark:border-zinc-900/60'
              }`}
            />
            <div className="text-5xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              {formatTime(carbTimeLeft)}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            {!isTimerRunning ? (
              <button
                onClick={() => setIsTimerRunning(true)}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg transition transform active:scale-95"
              >
                {carbTimeLeft < 300 && carbTimeLeft > 0 ? 'Reanudar' : 'Iniciar 5 Min'}
              </button>
            ) : (
              <button
                onClick={() => setIsTimerRunning(false)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold shadow-lg"
              >
                Pausar
              </button>
            )}
            <button
              onClick={() => {
                setIsTimerRunning(false);
                setCarbTimeLeft(300);
              }}
              className="bg-zinc-200 hover:bg-zinc-300 text-zinc-900/60 px-4 py-3 rounded-full font-bold"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/80">
            Cálculo de presión de equilibrio según <strong>Ley de Henry / ASBC</strong> y volúmenes de CO2 por estilo <strong>BJCP 2021</strong>.
          </div>

          <SectionCard title="Estilo BJCP y Variables de Equilibrio">
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                Estilo BJCP de Referencia
              </label>
              <select
                value={selectedStyleId}
                onChange={(e) => handleStyleSelect(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 font-bold text-sm focus:ring-2 focus:ring-copper/50 outline-none"
              >
                {BJCP_CARBONATION_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.minVols.toFixed(1)} a {s.maxVols.toFixed(1)} Vol (Obj: {s.targetVols.toFixed(1)})
                  </option>
                ))}
              </select>
              {pressure.style && (
                <p
                  className={`text-[11px] mt-1.5 font-medium ${
                    pressure.inStyleRange
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Rango BJCP ({pressure.style.category}): {pressure.style.minVols} – {pressure.style.maxVols} Vol CO2{' '}
                  {pressure.inStyleRange ? '✓ En rango' : '⚠️ Fuera de rango del estilo'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup
                label="Temperatura Cerveza"
                value={carbTemp}
                onChange={(v) => setCarbTemp(sanitizeTemperatureC(v, 4, -2, 35))}
                unit="°C"
                step="0.5"
                allowNegative={true}
                min={-2}
                max={35}
              />
              <InputGroup
                label="Volúmenes CO2 Deseados"
                value={carbVol}
                onChange={(v) => setCarbVol(sanitizePositiveNumber(v, 2.5, 5.0))}
                step="0.1"
              />
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {[1.9, 2.2, 2.4, 2.6, 3.0, 3.6].map((v) => (
                <button
                  key={v}
                  onClick={() => setCarbVol(v)}
                  className={`px-3 py-1 text-xs rounded-xl whitespace-nowrap transition ${
                    carbVol === v
                      ? 'bg-copper text-white font-bold'
                      : 'bg-zinc-100 dark:bg-zinc-900/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'
                  }`}
                >
                  {v.toFixed(1)} Vol
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              title="Presión PSI"
              value={pressure.psi.toFixed(1)}
              unit="PSI"
              subtext={`${pressure.temperatureF.toFixed(1)} °F • ${pressure.kpa.toFixed(0)} kPa`}
              colorClass="text-amber-400"
            />
            <ResultCard
              title="Presión BARES"
              value={pressure.bar.toFixed(2)}
              unit="Bar"
              subtext={`Objetivo: ${pressure.targetVolumes.toFixed(2)} Vol CO2`}
              colorClass="text-sky-400"
            />
          </div>
        </>
      )}
    </div>
  );
};
