import React, { useState } from 'react';
import { ABVCalculator } from './calculators/ABVCalculator';
import { AcidCalculator } from './calculators/AcidCalculator';
import { CaloriesCalculator } from './calculators/CaloriesCalculator';
import { CarbCalculator } from './calculators/CarbCalculator';
import { ColdCrashCalculator } from './calculators/ColdCrashCalculator';
import { ColorCalculator } from './calculators/ColorCalculator';
import { DensityCalculator } from './calculators/DensityCalculator';
import { DilutionCalculator } from './calculators/DilutionCalculator';
import { DryHopCalculator } from './calculators/DryHopCalculator';
import { EfficiencyCalculator } from './calculators/EfficiencyCalculator';
import { EquipmentCalculator } from './calculators/EquipmentCalculator';
import { IBUCalculator } from './calculators/IBUCalculator';
import { KettleCalculator } from './calculators/KettleCalculator';
import { PartigyleCalculator } from './calculators/PartigyleCalculator';
import { PitchCalculator } from './calculators/PitchCalculator';
import { PrimingCalculator } from './calculators/PrimingCalculator';
import { RecipeCalculator } from './calculators/RecipeCalculator';
import { RefractometerCalculator } from './calculators/RefractometerCalculator';
import { SpargeCalculator } from './calculators/SpargeCalculator';
import { StarterCalculator } from './calculators/StarterCalculator';
import { StrikeCalculator } from './calculators/StrikeCalculator';
import { WaterChemCalculator } from './calculators/WaterChemCalculator';

import { 
  Thermometer, 
  Droplet, 
  Scale, 
  Timer, 
  FlaskConical, 
  Calculator, 
  Waves,
  Percent,
  Wheat,
  Flame,
  Pipette,
  Eye,
  Palette,
  Cookie,
  TestTube2,
  Leaf,
  Snowflake,
  ArrowLeft,
  Beaker
} from 'lucide-react';

type CalculatorType = 'MENU' | 'IBU' | 'ABV' | 'PITCH' | 'DENSITY' | 'STRIKE' | 'WATER_CHEM' | 'DILUTION' | 'CARB' | 'KETTLE' | 'SPARGE' | 'EFFICIENCY' | 'RECIPE' | 'ACID' | 'REFRACTOMETER' | 'COLOR' | 'PRIMING' | 'STARTER' | 'DRY_HOP' | 'COLD_CRASH' | 'CALORIES' | 'EQUIPMENT' | 'PARTIGYLE';



export const Calculators: React.FC = React.memo(() => {
  const [activeView, setActiveView] = useState<CalculatorType>('MENU');

  // --- MAIN MENU RENDER ---
  
  if (activeView === 'MENU') {
    const menuGroups = [
      {
        title: "Diseño y Preparación",
        items: [
          { id: 'RECIPE', label: 'Diseño Receta', tooltip: 'Balance cruzado de masa y densidad para conocer malta a usar o densidad a lograr.', icon: Wheat, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
          { id: 'WATER_CHEM', label: 'Química Agua', tooltip: 'Corrige niveles minerales y ajusta relación Sulfato/Cloruro para el perfil de sabor.', icon: Waves, color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' },
          { id: 'EQUIPMENT', label: 'Termodinámica', tooltip: 'Cálculos de saltos de temperatura (kW), y volúmenes requeridos para Macerado por Decocción.', icon: Flame, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
          { id: 'COLOR', label: 'Color (SRM)', tooltip: 'Estima el color resultante de la cerveza con base en las maltas seleccionadas (Método Morey).', icon: Palette, color: 'bg-amber-200 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500' },
        ]
      },
      {
        title: "Maceración y Hervor",
        items: [
          { id: 'STRIKE', label: 'Temp. Macerado', tooltip: 'Calcula la temperatura inicial del agua para lograr la temperatura de macerado deseada (Strike Temp).', icon: Thermometer, color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
          { id: 'SPARGE', label: 'Agua Lavado', tooltip: 'Determina cuánta agua necesitas para lavar el grano e ingresar al hervor con el volumen preciso.', icon: Waves, color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' },
          { id: 'IBU', label: 'Amargor (IBU)', tooltip: 'Calcula los IBUs de tu lúpulo usando fórmulas Tinseth, incluyendo correcciones por mostos densos.', icon: FlaskConical, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
          { id: 'KETTLE', label: 'Volumen Olla', tooltip: 'Estima cuánto mosto debes recolectar antes de hervir, estimando evaporación y mermas por turbio.', icon: Beaker, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
          { id: 'EFFICIENCY', label: 'Eficiencia Equipo', tooltip: 'Mide qué porcentaje de los azúcares de la malta pudiste llevar a la olla realmente.', icon: Percent, color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' },
          { id: 'PARTIGYLE', label: 'Parti-gyle', tooltip: 'Calcula densidades estimadas separando un mismo macerado en dos lotes de distintos volúmenes.', icon: Beaker, color: 'bg-copper/20 dark:bg-copper/30 text-copper-dark dark:text-copper' },
        ]
      },
      {
        title: "Fermentación y Levadura",
        items: [
          { id: 'PITCH', label: 'Pitching Rate', tooltip: 'Conoce cuánta levadura en gramos debes inocular, con alertas extra si el mosto es de alta densidad.', icon: Droplet, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' },
          { id: 'STARTER', label: 'Starter', tooltip: 'Formula los litros y el caldo inicial para propagar levadura líquida (Braukaiser).', icon: TestTube2, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
          { id: 'ACID', label: 'Acidificación (pH)', tooltip: 'Ayuda técnica sobre la adición de ácidos orientada a la reducción inicial del pH.', icon: Pipette, color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
          { id: 'DENSITY', label: 'Corrección Dens.', tooltip: 'Ajusta una lectura de densímetro si el mosto estaba más caliente o frío que la calibración original del equipo.', icon: Scale, color: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' },
          { id: 'REFRACTOMETER', label: 'Refractómetro', tooltip: 'Convierte Brix a Gravedad Específica limitando el error del alcohol durante la fermentación final (Terrill).', icon: Eye, color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
          { id: 'ABV', label: 'Alcohol (ABV)', tooltip: 'Conoce el grado alcohólico y atenuación aparente de tu cerveza por ecuaciones no lineales (High-Gravity Support).', icon: Calculator, color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' },
        ]
      },
      {
        title: "Acondicionamiento y Empaque",
        items: [
          { id: 'DRY_HOP', label: 'Tasa Dry Hop', tooltip: 'Averigua cuántos gramos de lúpulo agregar en fermentador para alcanzar tasas medias o agresivas (g/L).', icon: Leaf, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
          { id: 'COLD_CRASH', label: 'Rampa de Frío', tooltip: 'Calcula los días orientativos para realizar un descenso seguro escalonado de temperatura en cerveza verde.', icon: Snowflake, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
          { id: 'CARB', label: 'Carbonatación', tooltip: 'Guía simple sobre presiones (PSI) de CO2 con base a la temperatura de la cerveza (Barriles).', icon: Timer, color: 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' },
          { id: 'PRIMING', label: 'Priming', tooltip: 'Calcula cuántos gramos de tu azúcar preferida mezclar para carbonatar lotes embotellados naturalmente.', icon: Cookie, color: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400' },
          { id: 'DILUTION', label: 'Dilución', tooltip: 'Hiciste mosto de sobra y está denso? Averigua cuántos litros de agua destilada añadir para bajar a la densidad correcta.', icon: Droplet, color: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
          { id: 'CALORIES', label: 'Calorías Cerveza', tooltip: 'Calcula un aproximado calórico en kJ y kcal debido a los hidratos de carbono restantes y el ABV de tu cerveza.', icon: Flame, color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
        ]
      }
    ];

    return (
      <div className="space-y-8 pb-12">
        {menuGroups.map((group, gi) => (
          <div key={gi}>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-wider">{group.title}</h3>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  title={'tooltip' in item ? item.tooltip : ''}
                  onClick={() => setActiveView(item.id as CalculatorType)}
                  className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition flex flex-col items-center gap-2 md:gap-3 h-28 md:h-32"
                >
                  <div className={`p-2 md:p-3 rounded-full ${item.color}`}>
                    <item.icon size={20} className="md:w-6 md:h-6" />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs md:text-sm text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- INDIVIDUAL TOOL RENDERER ---

  const renderToolContent = () => {
    switch (activeView) {
      case 'STARTER': return <StarterCalculator />;
      case 'DRY_HOP': return <DryHopCalculator />;
      case 'COLD_CRASH': return <ColdCrashCalculator />;
      case 'ABV': return <ABVCalculator />;
      case 'IBU': return <IBUCalculator />;
      case 'PITCH': return <PitchCalculator />;
      case 'DENSITY': return <DensityCalculator />;
      case 'STRIKE': return <StrikeCalculator />;
      case 'WATER_CHEM': return <WaterChemCalculator />;
      case 'DILUTION': return <DilutionCalculator />;
      case 'CARB': return <CarbCalculator />;
      case 'KETTLE': return <KettleCalculator />;
      case 'SPARGE': return <SpargeCalculator />;
      case 'EFFICIENCY': return <EfficiencyCalculator />;
      case 'RECIPE': return <RecipeCalculator />;
      case 'ACID': return <AcidCalculator />;
      case 'REFRACTOMETER': return <RefractometerCalculator />;
      case 'COLOR': return <ColorCalculator />;
      case 'PRIMING': return <PrimingCalculator />;
      case 'CALORIES': return <CaloriesCalculator />;
      case 'EQUIPMENT': return <EquipmentCalculator />;
      case 'PARTIGYLE': return <PartigyleCalculator />;
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <button 
          onClick={() => setActiveView('MENU')}
          className="mb-4 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-500 transition"
      >
          <ArrowLeft size={20} /> Volver al menú
      </button>
      
       <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
           {activeView === 'RECIPE' && 'Diseño de Receta (Granos)'}
           {activeView === 'ABV' && 'Calculadora de Alcohol'}
           {activeView === 'IBU' && 'Calculadora de Amargor'}
           {activeView === 'PITCH' && 'Tasa de Inoculación'}
           {activeView === 'EFFICIENCY' && 'Eficiencia de Equipo'}
           {activeView === 'DENSITY' && 'Corrección de Densidad'}
           {activeView === 'ACID' && 'Acidificación (pH)'}
           {activeView === 'STRIKE' && 'Temp. Agua Macerado'}
           {activeView === 'WATER_CHEM' && 'Ajuste Perfil Agua'}
           {activeView === 'DILUTION' && 'Corrección por Dilución'}
           {activeView === 'KETTLE' && 'Volumen Geométrico Olla'}
           {activeView === 'SPARGE' && 'Cálculo Agua de Lavado'}
           {activeView === 'CARB' && 'Carbonatación Forzada'}
           {activeView === 'REFRACTOMETER' && 'Corrección Refractómetro'}
           {activeView === 'COLOR' && 'Estimación de Color'}
           {activeView === 'PRIMING' && 'Carbonatación Natural (Priming)'}
           {activeView === 'STARTER' && 'Calculadora de Starter'}
           {activeView === 'DRY_HOP' && 'Tasa de Dry Hop'}
           {activeView === 'COLD_CRASH' && 'Rampa de Frío'}
           {activeView === 'CALORIES' && 'Calorías y Nutrición'}
           {activeView === 'EQUIPMENT' && 'Termodinámica de Equipos'}
           {activeView === 'PARTIGYLE' && 'Calculadora Parti-gyle'}
       </h2>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="p-1">
               {renderToolContent()}
           </div>
      </div>
    </div>
  );
});
