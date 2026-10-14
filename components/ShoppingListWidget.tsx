import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, CheckSquare, Square, Trash2, Sparkles, Receipt } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { DebouncedInput } from './ui/DebouncedInput';
import { BatchStatus, ShoppingListItem, Ingredient } from '../types';
import { InventoryModal } from './InventoryModal';

export const ShoppingListWidget: React.FC = () => {
  const shoppingList = useBreweryStore(s => s.shoppingList);
  const calendarEvents = useBreweryStore(s => s.calendarEvents);
  const batches = useBreweryStore(s => s.batches);
  const masterRecipes = useBreweryStore(s => s.masterRecipes);
  const inventory = useBreweryStore(s => s.inventory);
  const addShoppingItem = useBreweryStore(s => s.addShoppingItem);
  const toggleShoppingItem = useBreweryStore(s => s.toggleShoppingItem);
  const deleteShoppingItem = useBreweryStore(s => s.deleteShoppingItem);
  const updateShoppingItemCost = useBreweryStore(s => s.updateShoppingItemCost);
  const [newItemText, setNewItemText] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [calculationResult, setCalculationResult] = useState<string | null>(null);
  const [purchasingItem, setPurchasingItem] = useState<ShoppingListItem | null>(null);

  const parseShoppingItem = (item: ShoppingListItem, inventoryList: Ingredient[]): Partial<Ingredient> => {
    const text = item.text.trim();
    // 1. Detectar patrón de faltantes autogenerado: "Nombre (XX unit faltantes)"
    const missingPattern = /^(.*?)\s*\(\s*([\d.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*faltantes\s*\)/i;
    const match = text.match(missingPattern);

    let name = text;
    let amount = 1;
    let unit = 'kg';

    if (match) {
      name = match[1].trim();
      amount = parseFloat(match[2].replace(',', '.')) || 1;
      unit = match[3].trim().toLowerCase();
    } else {
      // 2. Detectar patrones como "XX kg Nombre" o "Nombre XX kg"
      const leadingMatch = text.match(/^([\d.,]+)\s*(kg|g|lb|l|ml|u|paq|cajas|pack)\b\s*(.*)$/i);
      const trailingMatch = text.match(/^(.*?)\s+([\d.,]+)\s*(kg|g|lb|l|ml|u|paq|cajas|pack)$/i);
      if (leadingMatch) {
        amount = parseFloat(leadingMatch[1].replace(',', '.')) || 1;
        unit = leadingMatch[2].trim().toLowerCase();
        name = leadingMatch[3].trim();
      } else if (trailingMatch) {
        name = trailingMatch[1].trim();
        amount = parseFloat(trailingMatch[2].replace(',', '.')) || 1;
        unit = trailingMatch[3].trim().toLowerCase();
      }
    }

    // Buscar en inventario para inferir categoría (MALT, HOP, YEAST, etc.) y unidad estándar
    const existing = inventoryList.find(i => 
      i.name.toLowerCase() === name.toLowerCase() ||
      i.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(i.name.toLowerCase())
    );

    const type = existing ? existing.type : 'MALT';
    if (existing && !match) {
      unit = existing.unit;
    }

    let costPerUnit = 0;
    if (item.estimatedCost && amount > 0) {
      costPerUnit = Math.round((item.estimatedCost / amount) * 100) / 100;
    } else if (existing?.costPerUnit) {
      costPerUnit = existing.costPerUnit;
    }

    return {
      name,
      type,
      stockAmount: amount,
      unit,
      costPerUnit,
      purchaseDate: new Date().toISOString().split('T')[0],
      lotNumber: ''
    };
  };

  const totalEstimatedCost = useMemo(() => {
    return shoppingList
      .filter(item => !item.completed)
      .reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  }, [shoppingList]);

  const handleAddItem = (explicitText?: string) => {
    const text = typeof explicitText === 'string' ? explicitText : newItemText;
    if (text.trim()) {
      const cost = parseFloat(newItemCost);
      addShoppingItem(text.trim(), isNaN(cost) ? undefined : cost);
      setNewItemText('');
      setNewItemCost('');
    }
  };

  const handleAutoGenerateShoppingList = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Buscar eventos de cocción futuros en los próximos 30 días
    const upcomingBrews = (calendarEvents || []).filter(e => e.type === 'BREW' && e.start >= todayStr && e.start <= futureDate);
    
    // También verificar lotes en estado de planificación
    const plannedBatches = (batches || []).filter(b => b.status === BatchStatus.PLANNED);

    // Recolectar recetas a procesar
    const recipeBatchPairs: { recipeId: string; batchName: string }[] = [];

    upcomingBrews.forEach(e => {
      const batch = batches.find(b => b.id === e.batchId);
      if (batch?.recipeId) {
        recipeBatchPairs.push({ recipeId: batch.recipeId, batchName: batch.recipeName || batch.lotCode });
      }
    });

    plannedBatches.forEach(b => {
      if (b.recipeId && !recipeBatchPairs.some(p => p.recipeId === b.recipeId)) {
        recipeBatchPairs.push({ recipeId: b.recipeId, batchName: b.recipeName || b.lotCode });
      }
    });

    if (recipeBatchPairs.length === 0) {
      setCalculationResult("No hay cocciones programadas para los próximos 30 días en el Calendario.");
      setTimeout(() => setCalculationResult(null), 4000);
      return;
    }

    // Calcular insumos totales requeridos
    const neededIngredients: Record<string, { amount: number; unit: string }> = {};

    recipeBatchPairs.forEach(({ recipeId }) => {
      const recipe = masterRecipes.find(r => r.id === recipeId);
      if (recipe && recipe.ingredients) {
        recipe.ingredients.forEach(i => {
          if (!neededIngredients[i.name]) {
            neededIngredients[i.name] = { amount: 0, unit: (i as any).unit || 'kg' };
          }
          neededIngredients[i.name].amount += i.amountUsed;
        });
      }
    });

    // Comparar con inventario
    let addedCount = 0;
    let totalEstimated = 0;

    Object.entries(neededIngredients).forEach(([name, { amount: amountNeeded, unit }]) => {
      const invItem = (inventory || []).find(i => i.name.toLowerCase() === name.toLowerCase());
      const currentStock = invItem ? invItem.stockAmount : 0;
      
      if (currentStock < amountNeeded) {
        const missing = Number((amountNeeded - currentStock).toFixed(2));
        const itemText = `${name} (${missing} ${invItem?.unit || unit} faltantes)`;

        // Chequear si ya existe en la lista de compras
        const alreadyExists = shoppingList.some(item => !item.completed && item.text.toLowerCase().includes(name.toLowerCase()));
        
        if (!alreadyExists) {
          const unitCost = invItem ? ((invItem as any).costPerUnit || (invItem as any).unitCost) : undefined;
          const estimatedCost = unitCost ? Math.round(missing * unitCost) : undefined;
          addShoppingItem(itemText, estimatedCost);
          addedCount++;
          if (estimatedCost) totalEstimated += estimatedCost;
        }
      }
    });

    if (addedCount > 0) {
      setCalculationResult(`✅ Se agregaron ${addedCount} insumo(s) faltantes a la lista${totalEstimated > 0 ? ` (+$${totalEstimated.toLocaleString()} estimados)` : ''}.`);
    } else {
      setCalculationResult(`✨ ¡Tienes suficiente stock! Tu inventario cubre las cocciones planificadas.`);
    }
    setTimeout(() => setCalculationResult(null), 5000);
  };

  return (
    <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800/80 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
        <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ShoppingCart size={20} className="text-copper" />
          Lista de Compras
        </h3>
        <button
          onClick={handleAutoGenerateShoppingList}
          title="Calcular insumos faltantes para las próximas cocciones"
          className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-2.5 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Sparkles size={14} className="text-amber-500" />
          Auto-Generar
        </button>
      </div>

      {calculationResult && (
        <div className="mb-3 p-2.5 rounded-xl text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
          {calculationResult}
        </div>
      )}
      
      <div className="flex gap-2 mb-4">
        <DebouncedInput 
          type="text"
          value={newItemText || ''}
          onDebouncedChange={setNewItemText}
          onEnter={(val) => handleAddItem(val)}
          placeholder="Ej: Levadura US-05..."
          className="flex-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/50 text-zinc-950 dark:text-white focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
        />
        <div className="relative w-24 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-zinc-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            value={newItemCost}
            onChange={(e) => setNewItemCost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="Costo"
            className="w-full pl-7 pr-2 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/50 text-zinc-950 dark:text-white focus:ring-2 focus:ring-copper/50 outline-none transition-all shadow-sm"
          />
        </div>
        <button onClick={() => handleAddItem()} className="bg-slate-dark dark:bg-copper-dark text-white px-4 rounded-xl font-bold hover:bg-zinc-700 dark:hover:bg-copper transition-all shadow-md active:scale-95 flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[150px] pr-1">
        {shoppingList.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600 italic text-xs">
            <ShoppingCart size={32} className="mb-2 opacity-20" />
            <p>Todo al día. Nada que comprar.</p>
          </div>
        )}
        {shoppingList.map(item => (
          <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 group transition-all">
            <div className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1" onClick={() => toggleShoppingItem(item.id)}>
              {item.completed ? <CheckSquare size={18} className="text-emerald-500 shrink-0" /> : <Square size={18} className="text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-copper transition-colors" />}
              <span className={`text-sm truncate transition-all duration-300 ${item.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-200 font-medium'}`}>
                {item.text}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPurchasingItem(item);
                }}
                title="Registrar compra: Abrir factura en inventario"
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 shrink-0 shadow-sm"
              >
                <Receipt size={13} className="text-emerald-500" />
                <span className="hidden sm:inline">Comprado</span>
              </button>
              <div className="relative w-20">
                <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-zinc-400 text-xs">$</span>
                <input
                  type="number"
                  value={item.estimatedCost || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateShoppingItemCost(item.id, isNaN(val) ? 0 : val);
                  }}
                  disabled={item.completed}
                  placeholder="0"
                  className={`w-full pl-5 pr-1 py-1 text-xs rounded border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 outline-none text-right transition-colors ${item.completed ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                />
              </div>
              <button 
                onClick={() => deleteShoppingItem(item.id)}
                className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition shrink-0 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-between items-center">
        <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Total Pendiente</span>
        <span className="text-lg font-black font-mono text-zinc-800 dark:text-zinc-100">${totalEstimatedCost.toFixed(2)}</span>
      </div>

      {purchasingItem && (
        <InventoryModal
          key={purchasingItem.id}
          initialData={parseShoppingItem(purchasingItem, inventory)}
          onClose={() => setPurchasingItem(null)}
          onSuccess={() => {
            deleteShoppingItem(purchasingItem.id);
            setPurchasingItem(null);
          }}
        />
      )}
    </div>
  );
};