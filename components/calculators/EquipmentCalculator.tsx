import React from 'react';
import { useBreweryStore } from '../../context/store';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Info, Flame, Settings, Save, Droplet, Thermometer, ShieldAlert, Check } from 'lucide-react';
import { useToast } from '../Toast';

export const EquipmentCalculator = () => {
  const settings = useBreweryStore(s => s.settings);
  const updateSettings = useBreweryStore(s => s.updateSettings);
  const { showToast } = useToast();

  // Get values from settings or use defaults
  const eqVol = settings.equipmentVolume || 300;
  const eqEff = settings.equipmentEfficiency || 72;
  const eqBoilOff = settings.equipmentBoilOff || 25;
  const eqLosses = settings.equipmentLosses || 15;
  
  // Custom equipment parameters with local states
  const [tempVol, setTempVol] = React.useState<number>(eqVol);
  const [tempEff, setTempEff] = React.useState<number>(eqEff);
  const [tempBoilOff, setTempBoilOff] = React.useState<number>(eqBoilOff);
  const [tempLosses, setTempLosses] = React.useState<number>(eqLosses);
  
  // Additional params
  const [mashRatio, setMashRatio] = React.useState<number>(3.0); // L/kg
  const [grainAbs, setGrainAbs] = React.useState<number>(0.9); // L/kg

  // Simulation inputs
  const [simBatchVol, setSimBatchVol] = React.useState<number>(100);
  const [simGrainKg, setSimGrainKg] = React.useState<number>(22);
  
  // Thermo inputs
  const [thermoCurrentTemp, setThermoCurrentTemp] = React.useState<number>(65);
  const [thermoTargetTemp, setThermoTargetTemp] = React.useState<number>(75);
  const [thermoTime, setThermoTime] = React.useState<number>(15);

  const handleSaveProfile = () => {
    updateSettings({
      equipmentVolume: tempVol,
      equipmentEfficiency: tempEff,
      equipmentBoilOff: tempBoilOff,
      equipmentLosses: tempLosses
    });
    showToast({
      message: 'Ficha de Equipo Global guardada y sincronizada',
      type: 'success'
    });
  };

  // Calculations
  const totalWater = simBatchVol + (grainAbs * simGrainKg) + tempBoilOff + tempLosses;
  const mashWater = simGrainKg * mashRatio;
  const spargeWater = Math.max(0, totalWater - mashWater);

  // Thermodynamics
  const deltaT = Math.max(0, thermoTargetTemp - thermoCurrentTemp);
  const kcalRequired = simBatchVol * deltaT; 
  const kwHeat = (kcalRequired * 4.184) / (thermoTime * 60);
  const decoctionFraction = deltaT / Math.max(1, (100 - thermoCurrentTemp));
  const decoctionVol = simBatchVol * decoctionFraction;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-copper/10 to-amber-500/10 border border-copper/20 dark:border-copper/30 p-4 rounded-2xl flex items-start gap-3">
        <Settings size={20} className="text-copper shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Ficha de Equipo Global</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configura y guarda el perfil técnico de tu fábrica. Estos parámetros se almacenan globalmente y sirven como base para los cálculos termodinámicos e hidrométricos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PARTE 1: FICHA DE CONFIGURACION */}
        <div className="space-y-4">
          <SectionCard title="Dimensiones y Rendimiento">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Volumen Olla Base" value={tempVol} onChange={setTempVol} unit="L" />
              <InputGroup label="Eficiencia Estimada" value={tempEff} onChange={setTempEff} unit="%" />
              <InputGroup label="Tasa Evaporación (Boil-off)" value={tempBoilOff} onChange={setTempBoilOff} unit="L/h" />
              <InputGroup label="Pérdidas (Espacio Muerto)" value={tempLosses} onChange={setTempLosses} unit="L" />
            </div>
          </SectionCard>

          <SectionCard title="Configuración de Empaste y Absorción">
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Relación de Empaste" value={mashRatio} onChange={setMashRatio} unit="L/kg" step="0.1" />
              <InputGroup label="Absorción del Grano" value={grainAbs} onChange={setGrainAbs} unit="L/kg" step="0.1" />
            </div>
          </SectionCard>

          <button
            onClick={handleSaveProfile}
            className="w-full bg-copper text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-copper-dark transition shadow-sm"
          >
            <Save size={16} /> Guardar Perfil en Configuración Global
          </button>
        </div>

        {/* PARTE 2: SIMULACION DE AGUA Y TERMODINAMICA */}
        <div className="space-y-4">
          <SectionCard title="Simulador de Lote y Aguas">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <InputGroup label="Vol. Lote Objetivo" value={simBatchVol} onChange={setSimBatchVol} unit="L" />
              <InputGroup label="Peso Granos Lote" value={simGrainKg} onChange={setSimGrainKg} unit="kg" />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 mt-4">
              <div className="flex justify-between text-xs border-b border-slate-200/50 dark:border-slate-800 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Total Agua Requerida:</span>
                <span className="font-mono font-bold text-copper">{totalWater.toFixed(1)} L</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Agua de Maceración (Mash):</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{mashWater.toFixed(1)} L</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Agua de Lavado (Sparge):</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{spargeWater.toFixed(1)} L</span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                * Calculado con boil-off de 1h ({tempBoilOff}L) + espacio muerto ({tempLosses}L) + absorción ({simGrainKg * grainAbs}L).
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Termodinámica: Escalón Térmico">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temp. Ini</label>
                <input
                  type="number"
                  value={thermoCurrentTemp}
                  onChange={e => setThermoCurrentTemp(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded p-1.5 text-center text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temp. Fin</label>
                <input
                  type="number"
                  value={thermoTargetTemp}
                  onChange={e => setThermoTargetTemp(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded p-1.5 text-center text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tiempo (min)</label>
                <input
                  type="number"
                  value={thermoTime}
                  onChange={e => setThermoTime(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded p-1.5 text-center text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <ResultCard 
                title="Potencia Requerida" 
                value={kwHeat.toFixed(1)} 
                unit="kW" 
                subtext={`Energía: ${Math.round(kcalRequired)} kcal`} 
                colorClass="text-orange-400" 
              />
              <ResultCard 
                title="Vol. Decocción" 
                value={decoctionVol.toFixed(1)} 
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
