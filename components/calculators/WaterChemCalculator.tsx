import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import {
  calculateWaterChemistry,
  sanitizePositiveNumber,
  WaterIonProfile,
  WaterSaltAdditions,
} from '../../lib/brewmath';

export const WaterChemCalculator: React.FC = () => {
  const [waterVol, setWaterVol] = useState<number>(300);
  const [baseProfile, setBaseProfile] = useState<WaterIonProfile>({
    Ca: 10,
    Mg: 2,
    Na: 10,
    SO4: 10,
    Cl: 10,
    HCO3: 20,
  });
  const [targetProfile, setTargetProfile] = useState<WaterIonProfile>(
    WATER_PROFILES['IPA']
  );
  const [selectedProfileName, setSelectedProfileName] = useState<string>('IPA');
  const [additions, setAdditions] = useState<WaterSaltAdditions>({
    gypsum: 0,
    cacl2: 0,
    epsom: 0,
    salt: 0,
    lactic: 0,
  });

  const current = useMemo(
    () => calculateWaterChemistry(waterVol, baseProfile, additions),
    [waterVol, baseProfile, additions]
  );

  const handleProfileChange = (profileName: string) => {
    setSelectedProfileName(profileName);
    if (WATER_PROFILES[profileName]) {
      setTargetProfile(WATER_PROFILES[profileName]);
    }
  };

  return (
    <>
      <SectionCard title="Volumen a Tratar">
        <InputGroup
          label="Litros de Agua"
          value={waterVol}
          onChange={(v) => setWaterVol(sanitizePositiveNumber(v, 300))}
          unit="L"
        />
      </SectionCard>

      <SectionCard title="Perfil Base (Agua de Red)">
        <div className="grid grid-cols-3 gap-2">
          <InputGroup
            label="Ca+2"
            value={baseProfile.Ca}
            onChange={(v) => setBaseProfile({ ...baseProfile, Ca: v })}
            unit="ppm"
          />
          <InputGroup
            label="Mg+2"
            value={baseProfile.Mg}
            onChange={(v) => setBaseProfile({ ...baseProfile, Mg: v })}
            unit="ppm"
          />
          <InputGroup
            label="Na+"
            value={baseProfile.Na}
            onChange={(v) => setBaseProfile({ ...baseProfile, Na: v })}
            unit="ppm"
          />
          <InputGroup
            label="SO4-2"
            value={baseProfile.SO4}
            onChange={(v) => setBaseProfile({ ...baseProfile, SO4: v })}
            unit="ppm"
          />
          <InputGroup
            label="Cl-"
            value={baseProfile.Cl}
            onChange={(v) => setBaseProfile({ ...baseProfile, Cl: v })}
            unit="ppm"
          />
          <InputGroup
            label="HCO3-"
            value={baseProfile.HCO3}
            onChange={(v) => setBaseProfile({ ...baseProfile, HCO3: v })}
            unit="ppm"
          />
        </div>
      </SectionCard>

      <SectionCard title="Perfil Objetivo">
        <select
          value={selectedProfileName}
          onChange={(e) => handleProfileChange(e.target.value)}
          className="w-full mb-4 p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
        >
          {Object.keys(WATER_PROFILES).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono font-bold bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 p-3 rounded-xl shadow-sm">
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              Ca
            </span>
            {targetProfile.Ca}
          </div>
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              Mg
            </span>
            {targetProfile.Mg}
          </div>
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              Na
            </span>
            {targetProfile.Na}
          </div>
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              SO4
            </span>
            {targetProfile.SO4}
          </div>
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              Cl
            </span>
            {targetProfile.Cl}
          </div>
          <div className="text-center">
            <span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">
              HCO3
            </span>
            {targetProfile.HCO3}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Adiciones (Gramos / 10L)">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Sulfato de Calcio (Gypsum)"
            value={additions.gypsum}
            onChange={(v) => setAdditions({ ...additions, gypsum: v })}
            unit="g"
            step="0.1"
          />
          <InputGroup
            label="Cloruro de Calcio"
            value={additions.cacl2}
            onChange={(v) => setAdditions({ ...additions, cacl2: v })}
            unit="g"
            step="0.1"
          />
          <InputGroup
            label="Sulfato de Magnesio (Epsom)"
            value={additions.epsom}
            onChange={(v) => setAdditions({ ...additions, epsom: v })}
            unit="g"
            step="0.1"
          />
          <InputGroup
            label="Sal de Mesa (NaCl)"
            value={additions.salt}
            onChange={(v) => setAdditions({ ...additions, salt: v })}
            unit="g"
            step="0.1"
          />
        </div>
      </SectionCard>

      <SectionCard title="Resultado Final">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <ResultCard
            title="Ca"
            value={current.Ca}
            colorClass={
              Math.abs(current.Ca - targetProfile.Ca) <= 15
                ? 'text-green-400'
                : 'text-amber-400'
            }
          />
          <ResultCard
            title="Mg"
            value={current.Mg}
            colorClass={
              Math.abs(current.Mg - targetProfile.Mg) <= 5
                ? 'text-green-400'
                : 'text-amber-400'
            }
          />
          <ResultCard
            title="Na"
            value={current.Na}
            colorClass={
              Math.abs(current.Na - targetProfile.Na) <= 10
                ? 'text-green-400'
                : 'text-amber-400'
            }
          />
          <ResultCard
            title="SO4"
            value={current.SO4}
            colorClass={
              Math.abs(current.SO4 - targetProfile.SO4) <= 20
                ? 'text-green-400'
                : 'text-amber-400'
            }
          />
          <ResultCard
            title="Cl"
            value={current.Cl}
            colorClass={
              Math.abs(current.Cl - targetProfile.Cl) <= 15
                ? 'text-green-400'
                : 'text-amber-400'
            }
          />
          <ResultCard
            title="HCO3"
            value={current.HCO3}
            colorClass="text-slate-400"
          />
        </div>
        <div className="bg-slate-900 dark:bg-zinc-800 rounded-2xl p-5 border border-slate-800 dark:border-zinc-700 shadow-md">
          <p className="text-slate-400 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-2">
            Relación Sulfato/Cloruro
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-display text-cyan-400 tracking-tight">
              {current.ratioFormatted}
            </span>
            <span className="text-sm font-bold text-slate-300 dark:text-zinc-300">
              {current.ratioDescription}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Alcalinidad Residual (Kolbach): {current.residualAlkalinityPpm.toFixed(1)} ppm CaCO3
          </p>
        </div>
      </SectionCard>
    </>
  );
};
