
import React, { useState, useRef } from 'react';
import { useBreweryStore } from '../context/store';
import { BookOpen, Trash2, ChevronDown, ChevronUp, Beaker, Wheat, Pencil, X, Plus, Save, Upload, AlertCircle, Clock } from 'lucide-react';
import { MasterRecipe, BatchIngredient } from '../types';
import { useToast } from './Toast';
import { EmptyState } from './EmptyState';
import { DebouncedInput } from './ui/DebouncedInput';
import { RecipeEditModal } from './recipelibrary/RecipeEditModal';
import { BJCP_STYLES, validateParameter, calculateABV } from '../lib/bjcp';

export const RecipeLibrary: React.FC = React.memo(() => {
  const masterRecipes = useBreweryStore(s => s.masterRecipes);
  const inventory = useBreweryStore(s => s.inventory);
  const batches = useBreweryStore(s => s.batches);
  const brewSessions = useBreweryStore(s => s.brewSessions);
  const updateMasterRecipe = useBreweryStore(s => s.updateMasterRecipe);
  const deleteMasterRecipe = useBreweryStore(s => s.deleteMasterRecipe);
  const addMasterRecipe = useBreweryStore(s => s.addMasterRecipe);
  const { showToast } = useToast();
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<MasterRecipe | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEditModal = (recipe: MasterRecipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRecipe({ ...recipe, ingredients: recipe.ingredients || [] }); // Create copy to edit
  };

  const closeEditModal = () => {
    setEditingRecipe(null);
  };

  // --- BeerSmith Import Logic ---

  const parseBeerSmithRecipe = (text: string, currentInventory: typeof inventory): MasterRecipe | null => {
    try {
      const lines = text.split('\n');
      let name = "Receta Importada";
      let style = "Desconocido";
      let baseVolume = 20;
      let targetOG = 1.050;
      let targetFG = 1.010; // Default as it's not always in the summary
      const ingredients: BatchIngredient[] = [];

      let readingIngredients = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("Recipe:")) {
          name = trimmed.replace("Recipe:", "").trim();
        } else if (trimmed.startsWith("Style:")) {
          style = trimmed.replace("Style:", "").trim();
        } else if (trimmed.startsWith("Batch Size (fermenter):")) {
          // "Batch Size (fermenter): 180,00 L"
          const valStr = trimmed.replace("Batch Size (fermenter):", "").replace("L", "").trim().replace(',', '.');
          baseVolume = parseFloat(valStr) || 0;
        } else if (trimmed.startsWith("Estimated OG:")) {
          // "Estimated OG: 1,067 SG"
          const valStr = trimmed.replace("Estimated OG:", "").replace("SG", "").trim().replace(',', '.');
          targetOG = parseFloat(valStr) || 1.000;
        }

        // Ingredients Section
        if (trimmed.startsWith("Ingredients:")) {
          readingIngredients = true;
          continue;
        }
        if (readingIngredients && trimmed.startsWith("-----")) continue; // Skip separator
        if (readingIngredients && trimmed === "") {
          // Empty line usually ends the block, but let's be careful. 
          // If we hit another section header (e.g. "Mash Schedule"), stop.
          continue;
        }
        if (readingIngredients && (trimmed.startsWith("Mash Schedule") || trimmed.startsWith("Total Grain Weight"))) {
          readingIngredients = false;
        }

        if (readingIngredients) {
          // Parse Ingredient Line
          // Example: "45,00 kg         Pilsner (2 Row) UK (2,0 EBC)                     Grano         1          83,3 %        29,34 L"
          // This is fixed width or tab separated usually, but splitting by multiple spaces is a good heuristic.

          // Regex to capture: Amount, Unit, Name, Type
          // Strategy: Split by 2 or more spaces to separate columns
          const parts = trimmed.split(/\s{2,}/);

          if (parts.length >= 3) {
            // parts[0] = "45,00 kg"
            // parts[1] = "Pilsner..."
            // parts[2] = "Grano"

            const amountPart = parts[0].trim(); // "45,00 kg"
            const namePart = parts[1].trim();
            const typePart = parts[2].trim();

            // Parse Amount and Unit
            const amountMatch = amountPart.match(/^([\d,]+)\s+(.+)$/);
            let amount = 0;
            let unit = "kg";

            if (amountMatch) {
              amount = parseFloat(amountMatch[1].replace(',', '.'));
              unit = amountMatch[2];
            }

            // Map Type
            let type: BatchIngredient['type'] = 'ADJUNCT';
            if (typePart.toLowerCase().includes('grano')) type = 'MALT';
            else if (typePart.toLowerCase().includes('lúpulo') || typePart.toLowerCase().includes('lupulo')) type = 'HOP';
            else if (typePart.toLowerCase().includes('levadura')) type = 'YEAST';

            // Map Unit (BeerSmith might use 'g', 'kg', 'pkg', etc. - keep as is or normalize?)
            // App uses 'kg' for malt usually, 'g' for hops.
            // If unit is 'pkg', maybe change to 'unit'?

            // LINKING LOGIC
            // Try to find a match in inventory
            // Simple strategy: Check if inventory name contains the imported name OR imported name contains inventory name
            // Case insensitive.

            let matchedItem = currentInventory.find(i => i.name.toLowerCase() === namePart.toLowerCase());

            if (!matchedItem) {
              // Try partial match
              matchedItem = currentInventory.find(i =>
                (i.name.toLowerCase().includes(namePart.toLowerCase()) || namePart.toLowerCase().includes(i.name.toLowerCase()))
                && i.type === type // Ensure type matches to avoid weird links
              );
            }

            if (matchedItem) {
              ingredients.push({
                inventoryId: matchedItem.id,
                name: matchedItem.name, // Use our internal name to be consistent
                amountUsed: amount,
                costAtTime: matchedItem.costPerUnit,
                unit: matchedItem.unit, // Use our unit
                type: matchedItem.type
              });
            } else {
              ingredients.push({
                inventoryId: `imported-${Date.now()}-${crypto.randomUUID().slice(0,8)}`, // Temporary ID
                name: namePart,
                amountUsed: amount,
                costAtTime: 0,
                unit: unit,
                type: type
              });
            }
          }
        }
      }

      return {
        id: `recipe-${Date.now()}`,
        name,
        style,
        batchSize: baseVolume,
        ingredients,
        targetOG,
        targetFG,
        notes: "Importada de BeerSmith"
      };

    } catch (e) {
      console.error("Error parsing recipe", e);
      return null;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        const recipe = parseBeerSmithRecipe(text, inventory);
        if (recipe) {
          setEditingRecipe(recipe);
        } else {
          showToast({ message: 'No se pudo leer la receta. Verificá el formato.', type: 'warning' });
        }
      }
    };
    reader.readAsText(file);
  };

  const openNewRecipeModal = () => {
    setEditingRecipe({
      id: crypto.randomUUID(),
      name: '',
      style: '',
      batchSize: 20,
      ingredients: [],
      targetOG: 1.050,
      targetFG: 1.010,
      notes: ''
    });
  };

  const calculateMissingIngredients = (recipe: MasterRecipe) => {
    const missing: { name: string, amountMissing: number, unit: string, cost: number }[] = [];
    let totalCost = 0;

    (recipe.ingredients || []).forEach(ing => {
      if (!ing) return;
      const invItem = inventory.find(i => i.id === ing.inventoryId);
      if (invItem) {
        if (invItem.stockAmount < (ing.amountUsed || 0)) {
          const diff = (ing.amountUsed || 0) - (invItem.stockAmount || 0);
          const cost = diff * (invItem.costPerUnit || 0);
          missing.push({ name: ing.name || 'Desconocido', amountMissing: diff, unit: ing.unit || '', cost });
          totalCost += cost;
        }
      } else {
        missing.push({ name: ing.name || 'Desconocido', amountMissing: ing.amountUsed || 0, unit: ing.unit || '', cost: 0 });
      }
    });

    return { missing, totalCost };
  };



  return (
    <div className="space-y-6 pb-20 relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt"
        className="hidden"
      />

      {/* EDIT MODAL */}
      <RecipeEditModal
        isOpen={!!editingRecipe}
        onClose={closeEditModal}
        initialRecipe={editingRecipe}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="text-copper" /> Biblioteca de Recetas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Estandariza tus mejores cocciones.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNewRecipeModal}
            className="bg-copper text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-copper-dark transition shadow-sm"
          >
            <Plus size={16} /> Nueva Receta
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Upload size={16} /> Importar (BeerSmith)
          </button>
        </div>
      </div>

      {masterRecipes.length === 0 ? (
        <EmptyState type="recipes" actionLabel="Importar BeerSmith" onAction={() => fileInputRef.current?.click()} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {masterRecipes.map((recipe) => (
            <div key={recipe.id} className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800/80 overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition"
                onClick={() => setExpandedRecipeId(expandedRecipeId === recipe.id ? null : recipe.id)}
              >
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{recipe.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{recipe.style}</span>
                    <span className="flex items-center gap-1"><Beaker size={12} /> Base: {recipe.batchSize}L</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="block font-mono font-bold text-slate-700 dark:text-slate-300">OG {recipe.targetOG.toFixed(3)}</span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">FG {recipe.targetFG.toFixed(3)}</span>
                  </div>
                  {expandedRecipeId === recipe.id ? <ChevronUp className="text-slate-400 dark:text-slate-500" /> : <ChevronDown className="text-slate-400 dark:text-slate-500" />}
                </div>
              </div>

              {expandedRecipeId === recipe.id && (
                <div className="bg-slate-50 dark:bg-zinc-900 p-4 border-t border-slate-200 dark:border-zinc-800/80">
                  
                  {/* Validador BJCP 2021 */}
                  {(() => {
                    const bjcpStyle = BJCP_STYLES[recipe.style];
                    if (!bjcpStyle) return null;

                    const abv = calculateABV(recipe.targetOG, recipe.targetFG);

                    const ogVal = validateParameter(recipe.targetOG, bjcpStyle.og, 'D.I.', (v) => v.toFixed(3));
                    const fgVal = validateParameter(recipe.targetFG, bjcpStyle.fg, 'D.F.', (v) => v.toFixed(3));
                    const abvVal = validateParameter(abv, bjcpStyle.abv, 'ABV', (v) => `${v.toFixed(1)}%`);
                    const ibuVal = validateParameter(recipe.targetIBU, bjcpStyle.ibu, 'IBU', (v) => `${v} IBU`);
                    const srmVal = validateParameter(recipe.targetColor, bjcpStyle.srm, 'Color', (v) => `${v} SRM`);

                    const metrics = [
                      { label: 'Densidad Inicial (OG)', value: recipe.targetOG.toFixed(3), range: `${bjcpStyle.og.min.toFixed(3)} - ${bjcpStyle.og.max.toFixed(3)}`, status: ogVal },
                      { label: 'Densidad Final (FG)', value: recipe.targetFG.toFixed(3), range: `${bjcpStyle.fg.min.toFixed(3)} - ${bjcpStyle.fg.max.toFixed(3)}`, status: fgVal },
                      { label: 'Graduación (ABV)', value: `${abv.toFixed(1)}%`, range: `${bjcpStyle.abv.min.toFixed(1)}% - ${bjcpStyle.abv.max.toFixed(1)}%`, status: abvVal },
                      { label: 'Amargor (IBU)', value: recipe.targetIBU ? `${recipe.targetIBU} IBU` : 'N/A', range: `${bjcpStyle.ibu.min} - ${bjcpStyle.ibu.max} IBU`, status: recipe.targetIBU ? ibuVal : null },
                      { label: 'Color (SRM)', value: recipe.targetColor ? `${recipe.targetColor} SRM` : 'N/A', range: `${bjcpStyle.srm.min} - ${bjcpStyle.srm.max} SRM`, status: recipe.targetColor ? srmVal : null }
                    ];

                    const allInRange = ogVal.inRange && fgVal.inRange && abvVal.inRange && (!recipe.targetIBU || ibuVal.inRange) && (!recipe.targetColor || srmVal.inRange);

                    return (
                      <div className="mb-4 bg-white dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-700/80 flex flex-col shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
                            <Beaker size={14} className="text-copper" /> Validador BJCP 2021: {bjcpStyle.name}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${allInRange ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {allInRange ? '✓ Conforme al Estilo' : '⚠ Fuera de Rango'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {metrics.map((m, idx) => {
                            let badgeColor = 'bg-slate-100 text-slate-500';
                            let borderStyle = 'border-slate-100 dark:border-zinc-800';
                            if (m.status) {
                              if (m.status.status === 'ideal') {
                                badgeColor = 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400 border border-green-200/50 dark:border-green-900/20';
                                borderStyle = 'border-slate-200 dark:border-slate-700';
                              } else if (m.status.status.startsWith('warn')) {
                                badgeColor = 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/20';
                                borderStyle = 'border-rose-200/30 dark:border-rose-900/20';
                              }
                            }
                            return (
                              <div key={idx} className={`bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border ${borderStyle} flex flex-col justify-between`}>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase font-semibold block leading-tight mb-1">{m.label}</span>
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono leading-tight">{m.value}</p>
                                </div>
                                <div className="mt-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                                  <span className="text-[8px] text-slate-400 block font-mono">Límites: {m.range}</span>
                                  {m.status && m.status.status !== 'none' && (
                                    <span className={`inline-block mt-1 text-[8px] font-black rounded-md px-1.5 py-0.5 leading-none ${badgeColor}`}>
                                      {m.status.status === 'ideal' ? 'OK' : m.status.status === 'warn-low' ? 'BAJO' : 'ALTO'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Historical Performance & Cost */}
                  {(() => {
                    const baseCost = (recipe.ingredients || []).reduce((acc, ing) => {
                        const invItem = inventory.find(i => i.id === ing.inventoryId);
                        return acc + (ing.amountUsed * (invItem?.costPerUnit || 0));
                    }, 0);

                    const recipeBatches = batches.filter(b => b.recipeId === recipe.id || b.recipeName === recipe.name);
                    const completedBatches = recipeBatches.filter(b => b.status === 'Finalizado' || b.status === 'Agotado/Historial');
                    const ogBatches = completedBatches.filter(b => b.originalGravity && b.originalGravity > 0);
                    const avgRealOG = ogBatches.length ? ogBatches.reduce((sum, b) => sum + b.originalGravity!, 0) / ogBatches.length : null;
                    const fgBatches = completedBatches.filter(b => b.finalGravity && b.finalGravity > 0);
                    const avgRealFG = fgBatches.length ? fgBatches.reduce((sum, b) => sum + b.finalGravity!, 0) / fgBatches.length : null;

                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Costo Base Est.</span>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">${baseCost.toFixed(2)}</p>
                            </div>
                            <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Lotes Cocinados</span>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{completedBatches.length}</p>
                            </div>
                            <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">OG Promedio (Desvío)</span>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {avgRealOG ? avgRealOG.toFixed(3) : '-'} 
                                    {avgRealOG && <span className={`text-xs ml-1 ${Math.abs(avgRealOG - recipe.targetOG) > 0.005 ? 'text-orange-500' : 'text-green-500'}`}>({((avgRealOG - recipe.targetOG)*1000).toFixed(0)} pts)</span>}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700/80">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">FG Promedio (Desvío)</span>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {avgRealFG ? avgRealFG.toFixed(3) : '-'}
                                    {avgRealFG && <span className={`text-xs ml-1 ${Math.abs(avgRealFG - recipe.targetFG) > 0.002 ? 'text-orange-500' : 'text-green-500'}`}>({((avgRealFG - recipe.targetFG)*1000).toFixed(0)} pts)</span>}
                                </p>
                            </div>
                        </div>
                    );
                  })()}

                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2"><Wheat size={14} /> Insumos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {['MALT', 'HOP', 'YEAST', 'ADJUNCT'].map(type => {
                        const items = (recipe.ingredients || []).filter(i => i.type === type || (type === 'ADJUNCT' && !['MALT', 'HOP', 'YEAST'].includes(i.type)));
                        if (items.length === 0) return null;
                        
                        let typeName = 'Otros Adjuntos';
                        if (type === 'MALT') typeName = 'Granos / Fermentables';
                        if (type === 'HOP') typeName = 'Lúpulos';
                        if (type === 'YEAST') typeName = 'Levadura';

                        return (
                            <div key={type} className="bg-white dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/80 p-3 shadow-sm">
                                <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-100 dark:border-zinc-700/80 pb-1.5">{typeName}</h5>
                                <div className="space-y-1">
                                    {items.map((ing, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{ing.name || 'Desconocido'}</span>
                                            <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{ing.amountUsed || 0} {ing.unit || ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const { missing, totalCost } = calculateMissingIngredients(recipe);
                    if (missing.length === 0) {
                      return (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400 rounded text-sm flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          Tienes stock suficiente para producir este lote base.
                        </div>
                      );
                    }
                    return (
                      <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded">
                        <h4 className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase mb-2 flex items-center gap-2">
                          <AlertCircle size={14} /> Insumos Faltantes
                        </h4>
                        <div className="bg-white dark:bg-slate-800 rounded border border-orange-200 dark:border-orange-800/30 p-2 space-y-1 mb-2">
                          {missing.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300">{m.name}</span>
                              <div className="text-right">
                                <span className="font-mono text-red-600 dark:text-red-400 block">{m.amountMissing.toFixed(2)} {m.unit}</span>
                                {m.cost > 0 && <span className="text-[10px] text-slate-500 dark:text-slate-400">~${m.cost.toFixed(0)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {totalCost > 0 && (
                          <div className="text-right text-xs font-bold text-slate-700 dark:text-slate-300">
                            Costo estimado faltantes: <span className="text-orange-700 dark:text-orange-400">${totalCost.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* HISTORIAL DE COCCIONES (ASISTENTE) */}
                  {(() => {
                    const recipeBatches = batches.filter(b => b.recipeId === recipe.id || b.recipeName === recipe.name);
                    const batchIds = recipeBatches.map(b => b.id);
                    const sessions = brewSessions.filter(s => batchIds.includes(s.batchId) && s.status === 'COMPLETED');
                    
                    if (sessions.length === 0) return null;

                    return (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2"><Clock size={14} /> Historial de Asistente de Cocción</h4>
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/80 overflow-hidden shadow-sm">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-700/80">
                              <tr>
                                <th className="p-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Fecha</th>
                                <th className="p-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Lote</th>
                                <th className="p-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Tiempo Total</th>
                                <th className="p-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">OG Lograda</th>
                                <th className="p-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase">Eficiencia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                              {sessions.map(s => {
                                const b = batches.find(bx => bx.id === s.batchId);
                                const h = Math.floor(s.globalElapsed / 3600);
                                const m = Math.floor((s.globalElapsed % 3600) / 60);
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition">
                                    <td className="p-2 text-slate-700 dark:text-slate-300">{new Date(s.startTime).toLocaleDateString()}</td>
                                    <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{b?.lotCode || 'N/A'}</td>
                                    <td className="p-2 text-slate-700 dark:text-slate-300">{h}h {m}m</td>
                                    <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{s.metrics.preFermentation.og || b?.originalGravity || '-'}</td>
                                    <td className="p-2 text-slate-700 dark:text-slate-300">{s.metrics.preFermentation.efficiencyCalc ? `${s.metrics.preFermentation.efficiencyCalc}%` : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-between gap-2 items-center">
                    <div className="text-xs text-slate-400 dark:text-slate-500 italic px-2 hidden sm:block">
                      Para cocinar, ve a Producción {' > '} Nuevo Lote
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={(e) => openEditModal(recipe, e)}
                        className="text-slate-600 dark:text-slate-300 hover:text-copper dark:hover:text-copper hover:bg-copper/10 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition border border-slate-200 dark:border-zinc-700 hover:border-copper/30 dark:hover:border-copper/30 bg-white dark:bg-zinc-800 shadow-sm"
                      >
                        <Pencil size={16} /> Editar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMasterRecipe(recipe.id); showToast({ message: `Receta "${recipe.name}" eliminada`, type: 'info' }); }}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition border border-slate-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-900/30 bg-white dark:bg-zinc-800 shadow-sm"
                      >
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
