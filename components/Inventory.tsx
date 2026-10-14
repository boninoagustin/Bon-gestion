
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, History, Plus, Trash2, AlertTriangle, Pencil, Package, Settings, Eye, EyeOff, ShoppingCart, Wallet, TrendingUp } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { Ingredient, CostItem, BatchStatus } from '../types';
import { ShoppingListWidget } from './ShoppingListWidget';
import { useToast } from './Toast';
import { InventoryModal } from './InventoryModal';
import { getInventoryHealth, getSuggestedReorderAmount } from '../lib/inventory';

export const Inventory: React.FC = React.memo(() => {
  const inventory = useBreweryStore(s => s.inventory);
  const batches = useBreweryStore(s => s.batches);
  const settings = useBreweryStore(s => s.settings);
  const updateSettings = useBreweryStore(s => s.updateSettings);
  const addIngredient = useBreweryStore(s => s.addIngredient);
  const editIngredient = useBreweryStore(s => s.editIngredient);
  const deleteIngredient = useBreweryStore(s => s.deleteIngredient);
  const addShoppingItem = useBreweryStore(s => s.addShoppingItem);
  const { showToast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null);

  const [showDepleted, setShowDepleted] = useState(false); // Control visibility of 0 stock items
  const [typeFilter, setTypeFilter] = useState<'ALL' | Ingredient['type']>('ALL');
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'CRITICAL' | 'AGING'>('ALL');

  const typePriority: Record<string, number> = { 'MALT': 1, 'HOP': 2, 'YEAST': 3, 'ADJUNCT': 4, 'PACKAGING': 5, 'CHEMICAL': 6 };

  const sortedInventory = useMemo(() => [...inventory].sort((a, b) => {
      // 1. Sort by Stock Status (Items with stock first, empty last)
      if (a.stockAmount > 0 && b.stockAmount <= 0) return -1;
      if (a.stockAmount <= 0 && b.stockAmount > 0) return 1;

      // 2. Sort by Type priority
      const scoreA = typePriority[a.type] || 99;
      const scoreB = typePriority[b.type] || 99;
      if (scoreA !== scoreB) return scoreA - scoreB;
      
      // 3. Sort by Name
      const nameComparison = a.name.localeCompare(b.name);
      if (nameComparison !== 0) return nameComparison;
      
      // 4. Sort by Date (Oldest first - FIFO)
      return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
  }), [inventory]);

  const visibleInventory = useMemo(() => {
    let list = showDepleted ? sortedInventory : sortedInventory.filter(item => item.stockAmount > 0);
    if (typeFilter !== 'ALL') list = list.filter(i => i.type === typeFilter);
    if (healthFilter === 'CRITICAL') {
      list = list.filter(i => {
        const health = getInventoryHealth(i);
        return health === 'OUT' || health === 'LOW_STOCK' || health === 'OLD';
      });
    }
    if (healthFilter === 'AGING') {
      list = list.filter(i => {
        const health = getInventoryHealth(i);
        return health === 'USE_SOON' || health === 'OLD';
      });
    }
    return list;
  }, [showDepleted, sortedInventory, typeFilter, healthFilter]);

  const openAddModal = () => {
      setIngredientToEdit(null);
      setIsModalOpen(true);
  };

  const openEditModal = (item: Ingredient) => {
      setIngredientToEdit(item);
      setIsModalOpen(true);
  };

  const openDeleteModal = (id: string) => {
      setSelectedId(id);
      setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setIsDeleteModalOpen(false);
      setSelectedId(null);
      setIngredientToEdit(null);
  };

  const confirmDelete = () => { if (selectedId) { deleteIngredient(selectedId); closeModal(); } };
  const calculateTotalFixedCosts = (costs: CostItem[]) => costs.reduce((sum, item) => sum + item.amount, 0);
  
  const calculateRealMonthlyVolume = () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentPackagedBatches = batches.filter(b =>
          (b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED) &&
          new Date(b.packagedDate || b.brewDate) >= thirtyDaysAgo
      );
      return recentPackagedBatches.reduce((sum, b) => sum + b.volumePackaged, 0);
  };

  const effectiveVolume = settings.targetMonthlyVolume > 0 ? settings.targetMonthlyVolume : calculateRealMonthlyVolume();
  const totalFixed = calculateTotalFixedCosts(settings.fixedCosts || []);
  const estimatedOverhead = effectiveVolume > 0 ? (totalFixed / effectiveVolume).toFixed(0) : '---';

  const totalValue = inventory.reduce((sum, item) => sum + (Math.max(0, item.stockAmount) * item.costPerUnit), 0);
  const criticalItems = inventory.filter(i => {
      const health = getInventoryHealth(i);
      return health === 'OUT' || health === 'LOW_STOCK' || health === 'OLD';
  });
  const criticalItemsCount = criticalItems.length;
  const handleAddCriticalToShopping = () => {
      if (criticalItems.length === 0) return;
      criticalItems.forEach(item => {
          const suggested = getSuggestedReorderAmount(item);
          const label = suggested && suggested > 0 ? `${item.name} (+${suggested} ${item.unit})` : item.name;
          addShoppingItem(label);
      });
      showToast({ message: `Se agregaron ${criticalItems.length} insumos a compras`, type: 'success' });
  };



  return (
    <div className="space-y-6 pb-20">
      
      {isModalOpen && (
          <InventoryModal
              ingredientToEdit={ingredientToEdit}
              onClose={closeModal}
          />
      )}

      {isDeleteModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-700/80">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400 flex flex-col items-center text-center border-b border-red-100 dark:border-red-900/30"><AlertTriangle size={32} className="mb-2 text-red-600 dark:text-red-500"/><h3 className="font-bold text-lg">¿Eliminar Insumo?</h3><p className="text-sm mt-1">Esta acción descontará el stock y eliminará el gasto asociado.</p></div>
                <div className="p-4 grid grid-cols-2 gap-3"><button onClick={closeModal} className="py-2 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">Cancelar</button><button onClick={confirmDelete} className="py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">Eliminar</button></div>
            </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Inventario & Trazabilidad</h2><p className="text-sm text-slate-500 dark:text-slate-400">Gestión FIFO: Ordenado por Tipo &gt; Nombre &gt; Antigüedad</p></div>
        <div className="flex flex-col sm:flex-row gap-2 items-end w-full sm:w-auto">
            <button 
                onClick={() => setShowDepleted(!showDepleted)} 
                className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${showDepleted ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-400' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-slate-400 dark:hover:bg-zinc-700'}`}
            >
                {showDepleted ? <Eye size={16}/> : <EyeOff size={16}/>} {showDepleted ? 'Ocultar Agotados' : 'Ver Agotados'}
            </button>
            <div className="flex gap-2">
                <button onClick={openAddModal} className="bg-slate-dark text-white dark:bg-copper-dark dark:hover:bg-copper px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-all shadow-md active:scale-95 flex items-center gap-2"><Plus size={18} /> <span className="hidden sm:inline">Ingresar Factura</span><span className="sm:hidden">Factura</span></button>
            </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-copper/50"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="MALT">Malta</option>
          <option value="HOP">Lúpulo</option>
          <option value="YEAST">Levadura</option>
          <option value="ADJUNCT">Adjuntos</option>
          <option value="PACKAGING">Envases</option>
          <option value="CHEMICAL">Químicos</option>
        </select>
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-copper/50"
        >
          <option value="ALL">Todas las condiciones</option>
          <option value="CRITICAL">Críticos</option>
          <option value="AGING">Por vencer</option>
        </select>
        <button
          onClick={handleAddCriticalToShopping}
          className="px-3 py-2 rounded-lg text-xs font-bold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700/40 dark:text-green-400"
        >
          Agregar críticos a compras
        </button>
      </div>

      {/* DASHBOARD METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Valor Inmovilizado</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white font-mono">${totalValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Insumos Críticos</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-800 dark:text-white font-mono">{criticalItemsCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">requieren atención</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-copper/10 flex items-center justify-center text-copper shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Overhead Mensual</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-800 dark:text-white font-mono">{effectiveVolume > 0 ? `$${estimatedOverhead}` : '---'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">/ Litro</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-zinc-800/80">
                <tr><th className="px-4 sm:px-6 py-4">Insumo</th><th className="hidden sm:table-cell px-6 py-4">Lote Prov.</th><th className="px-4 sm:px-6 py-4">Stock</th><th className="hidden md:table-cell px-6 py-4">Fecha (FIFO)</th><th className="hidden sm:table-cell px-6 py-4">Valor Unit.</th><th className="px-4 sm:px-6 py-4">Estado</th><th className="px-4 sm:px-6 py-4 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {visibleInventory.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                        <Package size={48} className="mx-auto mb-2 opacity-20" />
                        <p>{showDepleted ? 'No hay insumos registrados.' : 'No hay insumos con stock. Activa "Ver Agotados" para ver el historial.'}</p>
                    </td></tr>
                ) : (
                    visibleInventory.map((item) => {
                    let statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'; 
                    let statusText = 'Fresco';
                    const health = getInventoryHealth(item);
                    const isOutOfStock = health === 'OUT';
                    const isLowStock = health === 'LOW_STOCK';

                    if (health === 'OUT') {
                        statusColor = 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
                        statusText = 'AGOTADO';
                    } else if (health === 'LOW_STOCK') {
                        statusColor = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
                        statusText = 'BAJO STOCK';
                    } else if (health === 'USE_SOON') { 
                        statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'; 
                        statusText = 'Usar Pronto'; 
                    } else if (health === 'OLD') { 
                        statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'; 
                        statusText = 'Viejo / Revisar'; 
                    }
                    
                    const daysOld = Math.floor((Date.now() - new Date(item.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));

                    return (
                        <tr key={item.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 group transition-opacity ${isOutOfStock ? 'opacity-60 bg-slate-50/30 dark:bg-slate-800/50' : ''}`}>
                        <td className="px-4 sm:px-6 py-4 font-medium text-slate-800 dark:text-white"><div className="flex items-center gap-2">{item.type === 'PACKAGING' && <Package size={14} className="text-slate-500 dark:text-slate-400" />}{item.name}</div><span className="block text-xs text-slate-400 font-normal">{item.type}</span><div className="sm:hidden text-xs text-slate-500 mt-1 font-mono">{item.lotNumber}</div></td>
                        <td className="hidden sm:table-cell px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">{item.lotNumber}</td>
                        <td className={`px-4 sm:px-6 py-4 font-bold ${isOutOfStock ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>{item.stockAmount} <span className="text-xs font-normal text-slate-400">{item.unit}</span></td>
                        <td className="hidden md:table-cell px-6 py-4"><div className="flex items-center gap-2"><History size={14} className="text-slate-400"/><span className="dark:text-slate-300">{item.purchaseDate}</span></div><span className="text-xs text-slate-400">({daysOld} días)</span></td>
                        <td className="hidden sm:table-cell px-6 py-4 text-slate-600 dark:text-slate-400">${Math.round(item.costPerUnit)}/{item.unit}</td>
                        <td className="hidden sm:table-cell px-6 py-4 text-slate-800 dark:text-white font-bold">${Math.round(Math.max(0, item.stockAmount) * item.costPerUnit).toFixed(2)}</td>
                        <td className="px-4 sm:px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor} whitespace-nowrap`}>{statusText}</span></td>
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {(isOutOfStock || isLowStock) && (
                                <button onClick={() => { addShoppingItem(item.name); showToast({message: 'Añadido a compras', type: 'success'}) }} className="p-2 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-full transition" title="Añadir a lista de compras">
                                   <ShoppingCart size={16} />
                                </button>
                             )}
                             <button onClick={() => openEditModal(item)} className="p-2 text-slate-400 hover:text-copper hover:bg-copper/10 rounded-full transition" title="Editar Insumo"><Pencil size={16} /></button><button onClick={() => openDeleteModal(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition" title="Eliminar Insumo"><Trash2 size={16} /></button>
                          </div>
                        </td>
                        </tr>
                    );
                    })
                )}
            </tbody>
            </table>
        </div>
      </div>
      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg text-sm text-zinc-700 flex items-start gap-3"><ArrowDownUp className="shrink-0 mt-0.5" size={18} /><p><span className="font-bold">Orden Automático:</span> La lista prioriza los insumos con stock, luego agrupa por TIPO y finalmente por antigüedad (FIFO).</p></div>

      <div className="mt-6">
        <ShoppingListWidget />
      </div>

    </div>
  );
});
