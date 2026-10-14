import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';

export const WaterChemCalculator: React.FC = () => {
  const [waterVol, setWaterVol] = useState<number>(300);
  const [baseProfile, setBaseProfile] = useState({ Ca: 10, Mg: 2, Na: 10, SO4: 10, Cl: 10, HCO3: 20 });
  const [targetProfile, setTargetProfile] = useState(WATER_PROFILES['IPA']);
  const [selectedProfileName, setSelectedProfileName] = useState<string>('IPA');
  const [additions, setAdditions] = useState({ gypsum: 0, cacl2: 0, epsom: 0, salt: 0, lactic: 0 });

  const calculateWaterChem = () => {
    const volFactor = 10 / (waterVol || 1); 
    
    const ca = baseProfile.Ca + (additions.gypsum * 23 * volFactor) + (additions.cacl2 * 27 * volFactor);
    const mg = baseProfile.Mg + (additions.epsom * 10 * volFactor);
    const na = baseProfile.Na + (additions.salt * 39 * volFactor);
    const so4 = baseProfile.SO4 + (additions.gypsum * 56 * volFactor) + (additions.epsom * 39 * volFactor);
    const cl = baseProfile.Cl + (additions.cacl2 * 48 * volFactor) + (additions.salt * 60 * volFactor);
    const hco3 = baseProfile.HCO3; 

    const ratioVal = cl > 0 ? so4 / cl : 0;
    let ratioDesc = "Equilibrado";
    if (ratioVal > 1.3) ratioDesc = "Amargo (Resalta Lúpulo)";
    else if (ratioVal < 0.75) ratioDesc = "Maltoso (Resalta Malta)";

    return { 
      ca: Math.round(ca), mg: Math.round(mg), na: Math.round(na), 
      so4: Math.round(so4), cl: Math.round(cl), hco3: Math.round(hco3),
      ratioVal: cl > 0 ? ratioVal.toFixed(2) : "N/A",
      ratioDesc
    };
  };

  const handleProfileChange = (profileName: string) => {
    setSelectedProfileName(profileName);
    setTargetProfile(WATER_PROFILES[profileName]);
  };

  const current = calculateWaterChem();

  return (
    <>
      <SectionCard title="Volumen a Tratar">
          <InputGroup label="Litros de Agua" value={waterVol} onChange={setWaterVol} unit="L" />
      </SectionCard>

      <SectionCard title="Perfil Base (Agua de Red)">
          <div className="grid grid-cols-3 gap-2">
              <InputGroup label="Ca+2" value={baseProfile.Ca} onChange={(v:any) => setBaseProfile({...baseProfile, Ca: v})} unit="ppm" />
              <InputGroup label="Mg+2" value={baseProfile.Mg} onChange={(v:any) => setBaseProfile({...baseProfile, Mg: v})} unit="ppm" />
              <InputGroup label="Na+" value={baseProfile.Na} onChange={(v:any) => setBaseProfile({...baseProfile, Na: v})} unit="ppm" />
              <InputGroup label="SO4-2" value={baseProfile.SO4} onChange={(v:any) => setBaseProfile({...baseProfile, SO4: v})} unit="ppm" />
              <InputGroup label="Cl-" value={baseProfile.Cl} onChange={(v:any) => setBaseProfile({...baseProfile, Cl: v})} unit="ppm" />
              <InputGroup label="HCO3-" value={baseProfile.HCO3} onChange={(v:any) => setBaseProfile({...baseProfile, HCO3: v})} unit="ppm" />
          </div>
      </SectionCard>

      <SectionCard title="Perfil Objetivo">
          <select 
              value={selectedProfileName}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="w-full mb-4 p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
          >
              {Object.keys(WATER_PROFILES).map(p => (
                  <option key={p} value={p}>{p}</option>
              ))}
          </select>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono font-bold bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 p-3 rounded-xl shadow-sm">
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">Ca</span>{targetProfile.Ca}</div>
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">Mg</span>{targetProfile.Mg}</div>
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">Na</span>{targetProfile.Na}</div>
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">SO4</span>{targetProfile.SO4}</div>
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">Cl</span>{targetProfile.Cl}</div>
              <div className="text-center"><span className="text-slate-400 dark:text-zinc-500 block text-[10px] tracking-wider uppercase mb-1">HCO3</span>{targetProfile.HCO3}</div>
          </div>
      </SectionCard>

      <SectionCard title="Adiciones (Gramos / 10L)">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Sulfato de Calcio (Gypsum)" value={additions.gypsum} onChange={(v:any) => setAdditions({...additions, gypsum: v})} unit="g" step="0.1" />
              <InputGroup label="Cloruro de Calcio" value={additions.cacl2} onChange={(v:any) => setAdditions({...additions, cacl2: v})} unit="g" step="0.1" />
              <InputGroup label="Sulfato de Magnesio (Epsom)" value={additions.epsom} onChange={(v:any) => setAdditions({...additions, epsom: v})} unit="g" step="0.1" />
              <InputGroup label="Sal de Mesa (NaCl)" value={additions.salt} onChange={(v:any) => setAdditions({...additions, salt: v})} unit="g" step="0.1" />
          </div>
      </SectionCard>

      <SectionCard title="Resultado Final">
          <div className="grid grid-cols-3 gap-2 mb-4">
              <ResultCard title="Ca" value={current.ca} colorClass={Math.abs(current.ca - targetProfile.Ca) <= 15 ? 'text-green-400' : 'text-amber-400'} />
              <ResultCard title="Mg" value={current.mg} colorClass={Math.abs(current.mg - targetProfile.Mg) <= 5 ? 'text-green-400' : 'text-amber-400'} />
              <ResultCard title="Na" value={current.na} colorClass={Math.abs(current.na - targetProfile.Na) <= 10 ? 'text-green-400' : 'text-amber-400'} />
              <ResultCard title="SO4" value={current.so4} colorClass={Math.abs(current.so4 - targetProfile.SO4) <= 20 ? 'text-green-400' : 'text-amber-400'} />
              <ResultCard title="Cl" value={current.cl} colorClass={Math.abs(current.cl - targetProfile.Cl) <= 15 ? 'text-green-400' : 'text-amber-400'} />
              <ResultCard title="HCO3" value={current.hco3} colorClass="text-slate-400" />
          </div>
          <div className="bg-slate-900 dark:bg-zinc-800 rounded-2xl p-5 border border-slate-800 dark:border-zinc-700 shadow-md">
              <p className="text-slate-400 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-2">Relación Sulfato/Cloruro</p>
              <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-display text-cyan-400 tracking-tight">{current.ratioVal}</span>
                  <span className="text-sm font-bold text-slate-300 dark:text-zinc-300">{current.ratioDesc}</span>
              </div>
          </div>
      </SectionCard>
    </>
  );
};
