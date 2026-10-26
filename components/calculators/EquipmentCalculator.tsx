import React, { useState, useMemo } from 'react';
import { useBreweryStore } from '../../context/store';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Settings, Save } from 'lucide-react';
import { useToast } from '../Toast';
import {
  calculateEquipmentThermodynamics,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
} from '../../lib/brewmath';

export const EquipmentCalculator: React.FC = () => {
  const settings = useBreweryStore((s) => s.settings);
  const updateSettings = useBreweryStore((s) => s.updateSettings);
  const { showToast } = useToast();

  const eqVol = settings.equipmentVolume || 300;
  const eqEff = settings.equipmentEfficiency || 72;
  const eqBoilOff = settings.equipmentBoilOff || 25;
  const eqLosses = settings.equipmentLosses || 15;

  const [tempVol, setTempVol] = useState<number>(eqVol);
  const [tempEff, setTempEff] = useState<number>(eqEff);
  const [tempBoilOff, setTempBoilOff] = useState<number>(eqBoilOff);
  const [tempLosses, setTempLosses] = useState<number>(eqLosses);

  const [mashRatio, setMashRatio] = useState<number>(3.0);
  const [grainAbs, setGrainAbs] = useState<number>(0.9);

  const [simBatchVol, setSimBatchVol] = useState<number>(100);
  const [simGrainKg, setSimGrainKg] = useState<number>(22);

  const [thermoCurrentTemp, setThermoCurrentTemp] = useState<number>(65);
  const [thermoTargetTemp, setThermoTargetTemp] = useState<number>(75);
  const [thermoTime, setThermoTime] = useState<number>(15);

  const handleSaveProfile = () => {
    updateSettings({
      equipmentVolume: tempVol,
      equipmentEfficiency: tempEff,
      equipmentBoilOff: tempBoilOff,
      equipmentLosses: tempLosses,
    });
    showToast({
      message: 'Ficha de Equipo Global guardada y sincronizada',
      type: 'success',
    });
  };

  const thermo = useMemo(
    () =>
      calculateEquipmentThermodynamics({
        batchVolumeL: simBatchVol,
        grainKg: simGrainKg,
        mashRatioLPerKg: mashRatio,
        grainAbsorptionLPerKg: grainAbs,
        boilOffLPerHour: tempBoilOff,
        deadSpaceLossesL: tempLosses,
        currentTempC: thermoCurrentTemp,
        targetTempC: thermoTargetTemp,
        heatingTimeMinutes: thermoTime,
      }),
    [
      simBatchVol,
      simGrainKg,
      mashRatio,
      grainAbs,
      tempBoilOff,
      tempLosses,
      thermoCurrentTemp,
      thermoTargetTemp,
      thermoTime,
    ]
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-copper/10 to-amber-500/10 border border-copper/20 dark:border-copper/30 p-4 rounded-2xl flex items-start gap-3">
        <Settings size={20} className="text-copper shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            Ficha de Equipo Global
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configura y guarda el perfil técnico de tu fábrica. Estos parámetros se almacenan globalmente y sirven como base para los cálculos termodinámicos e hidrométricos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SectionCard title="Dimensiones y Rendimiento">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup
                label="Volumen Olla Base"
                value={tempVol}
                onChange={(v) => setTempVol(sanitizePositiveNumber(v, 300))}
                unit="L"
              />
              <InputGroup
                label="Eficiencia Estimada"
                value={tempEff}
                onChange={(v) => setTempEff(sanitizePositiveNumber(v, 72, 100))}
                unit="%"
              />
              <InputGroup
                label="Tasa Evaporación (Boil-off)"
                value={tempBoilOff}
                onChange={(v) => setTempBoilOff(sanitizePositiveNumber(v, 25))}
                unit="L/h"
              />
              <InputGroup
                label="Pérdidas (Espacio Muerto)"
                value={tempLosses}
                onChange={(v) => setTempLosses(sanitizePositiveNumber(v, 15))}
                unit="L"
              />
            </div>
          </SectionCard>

          <SectionCard title="Configuración de Empaste y Absorción">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup
                label="Relación de Empaste"
                value={mashRatio}
                onChange={(v) => setMashRatio(sanitizePositiveNumber(v, 3.0, 15))}
                unit="L/kg"
                step="0.1"
              />
              <InputGroup
                label="Absorción del Grano"
                value={grainAbs}
                onChange={(v) => setGrainAbs(sanitizePositiveNumber(v, 0.9, 5))}
                unit="L/kg"
                step="0.1"
              />
            </div>
          </SectionCard>

          <button
            onClick={handleSaveProfile}
            className="w-full bg-copper text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-copper-dark transition shadow-sm"
          >
            <Save size={16} /> Guardar Perfil en Configuración Global
          </button>
        </div>

        <div className="space-y-4">
          <SectionCard title="Simulador de Lote y Aguas">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <InputGroup
                label="Vol. Lote Objetivo"
                value={simBatchVol}
                onChange={(v) => setSimBatchVol(sanitizePositiveNumber(v, 100))}
                unit="L"
              />
              <InputGroup
                label="Peso Granos Lote"
                value={simGrainKg}
                onChange={(v) => setSimGrainKg(sanitizePositiveNumber(v, 22))}
                unit="kg"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 mt-4">
              <div className="flex justify-between text-xs border-b border-slate-200/50 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Total Agua Requerida:
                </span>
                <span className="font-mono font-bold text-copper">
                  {thermo.totalWaterL.toFixed(1)} L
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Agua de Maceración (Mash):
                </span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {thermo.mashWaterL.toFixed(1)} L
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Agua de Lavado (Sparge):
                </span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {thermo.spargeWaterL.toFixed(1)} L
                </span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                * Calculado con boil-off de 1h ({tempBoilOff}L) + espacio muerto ({tempLosses}L) + absorción ({thermo.grainAbsorptionL.toFixed(1)}L).
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Termodinámica: Escalón Térmico">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <InputGroup
                label="Temp. Ini"
                value={thermoCurrentTemp}
                onChange={(v) =>
                  setThermoCurrentTemp(sanitizeTemperatureC(v, 65, 0, 100))
                }
                unit="°C"
              />
              <InputGroup
                label="Temp. Fin"
                value={thermoTargetTemp}
                onChange={(v) =>
                  setThermoTargetTemp(sanitizeTemperatureC(v, 75, 0, 100))
                }
                unit="°C"
              />
              <InputGroup
                label="Tiempo"
                value={thermoTime}
                onChange={(v) => setThermoTime(sanitizePositiveNumber(v, 15, 240))}
                unit="min"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <ResultCard
                title="Potencia Requerida"
                value={thermo.kwRequired.toFixed(1)}
                unit="kW"
                subtext={`Energía: ${Math.round(thermo.kcalRequired)} kcal`}
                colorClass="text-orange-400"
              />
              <ResultCard
                title="Vol. Decocción"
                value={thermo.decoctionVolumeL.toFixed(1)}
                unit="L"
                subtext="Para lograr el salto térmico"
                colorClass="text-red-400"
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
