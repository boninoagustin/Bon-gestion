import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const DensityCalculator = () => {
  const [measuredGravity, setMeasuredGravity] = useState<number>(1.050);
const [measuredTemp, setMeasuredTemp] = useState<number>(60);
const [calibrationTemp, setCalibrationTemp] = useState<number>(15);

  const calculateCorrectedGravity = () => {
    // Thiesen Equation for density of water
    const getWaterDensity = (t: number) => {
        return 1 - ((t + 288.9414) / (508929.2 * (t + 68.12963))) * Math.pow(t - 3.9863, 2);
    };
    const densityMeas = getWaterDensity(measuredTemp);
    const densityCal = getWaterDensity(calibrationTemp);
    
    // El densímetro mide la relación de densidades a la temperatura de calibración. Correct Formula: SG_corrected = SG_measured * (Density_Water_CalTemp / Density_Water_SampleTemp)
    const cg = measuredGravity * (densityCal / densityMeas);
    return cg.toFixed(3);
  };

  
  return (
          <>
             <SectionCard title="Lectura Densímetro">
                 <InputGroup label="Densidad Leída" value={measuredGravity} onChange={setMeasuredGravity} step="0.001" />
             </SectionCard>

             <SectionCard title="Temperaturas">
                 <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp. Muestra" value={measuredTemp} onChange={setMeasuredTemp} unit="°C" />
                    <InputGroup label="Calibración" value={calibrationTemp} onChange={setCalibrationTemp} unit="°C" />
                 </div>
             </SectionCard>
             
            <ResultCard title="Densidad Corregida" value={calculateCorrectedGravity()} colorClass="text-purple-400" />
          </>
        );
};
