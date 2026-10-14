/**
 * store.ts — Zustand store atómico con slices por dominio.
 *
 * Reemplaza BreweryContext + useDbState manteniendo la persistencia Dexie.
 * Cada componente se suscribe SOLO a los datos que necesita, eliminando
 * re-renders en cascada.
 */
import { create } from 'zustand';
import { 
  Batch, Ingredient, Keg, BottleStock, BrewerySettings, Sale, 
  MonthlyBalance, Expense, Customer, Payment, ShoppingListItem,
  MasterRecipe, CalendarEvent, FermentationLog, SensoryProfile, QualityLog,
  BatchStatus, CostItem, BrewSession, Fermenter, FermenterStatus
} from '../types';
import { dbGet, dbSet } from '../context/db';
import { isFinishedBatch, validateFermenterAssignment } from '../lib/fermenterIntegrity';

// ============================================================================
// Slice único (por simplicidad, con selectores atómicos)
// Zustand internamente solo notifica a suscriptores cuyo selector cambió.
// ============================================================================

export interface BreweryStore {
  // ---- Data ----
  batches: Batch[];
  inventory: Ingredient[];
  kegs: Keg[];
  bottles: BottleStock[];
  fermenters: Fermenter[];
  settings: BrewerySettings;
  sales: Sale[];
  expenses: Expense[];
  customers: Customer[];
  payments: Payment[];
  financialHistory: MonthlyBalance[];
  shoppingList: ShoppingListItem[];
  masterRecipes: MasterRecipe[];
  calendarEvents: CalendarEvent[];
  annualOverrides: Record<string, { income?: number; fijos?: number; insumos?: number; varios?: number }>;
  brewSessions: BrewSession[];
  isLoading: boolean;
  isHydrated: boolean;
  activeBrewBatchId: string | null;

  // ---- Init ----
  hydrate: () => Promise<void>;

  // ---- State Handlers ----
  setActiveBrewBatchId: (id: string | null) => void;

  // ---- Settings ----
  updateSettings: (settings: Partial<BrewerySettings>) => void;

  // ---- Batches ----
  addBatch: (batch: Batch) => void;
  updateBatch: (id: string, updates: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;
  addFermentationLog: (batchId: string, log: Omit<FermentationLog, 'id'>) => void;
  deleteFermentationLog: (batchId: string, logId: string) => void;
  addSensoryProfile: (batchId: string, profile: Omit<SensoryProfile, 'id'>) => void;
  deleteSensoryProfile: (batchId: string, profileId: string) => void;
  addQualityLog: (batchId: string, log: Omit<QualityLog, 'id'>) => void;
  deleteQualityLog: (batchId: string, logId: string) => void;

  // ---- Inventory ----
  updateInventory: (id: string, amount: number) => void;
  addIngredient: (ingredient: Ingredient) => void;
  editIngredient: (id: string, updates: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;

  // ---- Fermenters ----
  addFermenter: (fermenter: Omit<Fermenter, 'id'> & { id?: string }) => void;
  updateFermenter: (id: string, updates: Partial<Fermenter>) => void;
  deleteFermenter: (id: string) => void;
  cleanFermenter: (id: string) => void;
  markFermenterDirty: (id: string) => void;
  assignBatchToFermenter: (fermenterId: string, batchId: string) => void;
  releaseFermenter: (fermenterId: string, markDirty?: boolean) => void;

  // ---- Kegs ----
  updateKegStatus: (id: string, status: Keg['status'], location: string) => void;
  addKeg: (keg: Keg) => void;
  updateKeg: (id: string, updates: Partial<Keg>) => void;
  fillKegFromBatch: (kegId: string, batchId: string, customAmount?: number) => void;
  bottleFromKeg: (kegId: string, formatName: string, quantity: number, inventoryId: string | null, customVolumePerUnit: number) => void;
  deleteKeg: (id: string) => void;
  toggleKegTap: (id: string, isTapped: boolean) => void;
  serveFromTap: (kegId: string, volumeLiters: number, formatName: string, price: number) => void;
  giftFromTap: (kegId: string, volumeLiters: number, formatName: string) => void;
  // ---- Bottles ----
  addBottleStock: (bottle: BottleStock) => void;
  updateBottleStock: (id: string, quantityChange: number) => void;
  deleteBottleStock: (id: string) => void;
  giftBottle: (bottleId: string, quantity: number) => void;

  // ---- Sales ----
  addSale: (sale: Sale) => void;
  updateSale: (id: string, updates: Partial<Sale>) => void;
  deleteSale: (id: string) => void;

  // ---- Expenses ----
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;

  // ---- Customers ----
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // ---- Payments ----
  addPayment: (payment: Payment) => void;

  // ---- Financial ----
  closeMonth: (balance: MonthlyBalance) => void;
  openMonth: (monthKey: string) => void;

  // ---- Backup ----
  downloadBackup: () => Promise<void>;
  restoreBackup: (file: File) => Promise<boolean>;

  // ---- Shopping List ----
  addShoppingItem: (text: string, estimatedCost?: number) => void;
  updateShoppingItemCost: (id: string, cost: number) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;

  // ---- Recipes ----
  addMasterRecipe: (recipe: MasterRecipe) => void;
  updateMasterRecipe: (id: string, updates: Partial<MasterRecipe>) => void;
  deleteMasterRecipe: (id: string) => void;

  // ---- Calendar ----
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;

  // ---- Annual Overrides ----
  setAnnualOverride: (monthKey: string, field: 'income' | 'fijos' | 'insumos' | 'varios', value: number | undefined) => void;

  // ---- Brew Assistant ----
  addBrewSession: (session: BrewSession) => void;
  updateBrewSession: (id: string, updates: Partial<BrewSession>) => void;
  deleteBrewSession: (id: string) => void;
}

// ============================================================================
// Persistencia asíncrona con Dexie (debounced)
// ============================================================================

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(key: string, value: unknown): void {
  const existing = pendingSaves.get(key);
  if (existing) clearTimeout(existing);
  
  pendingSaves.set(key, setTimeout(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => dbSet(key, value), { timeout: 2000 });
    } else {
      setTimeout(() => dbSet(key, value), 0);
    }
    pendingSaves.delete(key);
  }, 500));
}

// ============================================================================
// Store
// ============================================================================

export const useBreweryStore = create<BreweryStore>()((set, get) => ({
  // ---- Defaults ----
  batches: [],
  inventory: [],
  kegs: [],
  bottles: [],
  fermenters: [],
  settings: { fixedCosts: [], fermenterCapacity: 3 },
  sales: [],
  expenses: [],
  customers: [],
  payments: [],
  financialHistory: [],
  shoppingList: [],
  masterRecipes: [],
  calendarEvents: [],
  annualOverrides: {},
  brewSessions: [],
  isLoading: true,
  isHydrated: false,
  activeBrewBatchId: null,

  // ---- State Handlers ----
  setActiveBrewBatchId: (id) => set({ activeBrewBatchId: id }),

  // ---- Hydrate from IndexedDB ----
  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const [batches, inventory, kegs, bottles, fermenters, sales, expenses, customers, 
             payments, financialHistory, settings, shoppingList, masterRecipes, 
             calendarEvents, annualOverrides, brewSessions] = await Promise.all([
        dbGet<Batch[]>('batches', []),
        dbGet<Ingredient[]>('inventory', []),
        dbGet<Keg[]>('kegs', []),
        dbGet<BottleStock[]>('bottles', []),
        dbGet<Fermenter[]>('fermenters', []),
        dbGet<Sale[]>('sales', []),
        dbGet<Expense[]>('expenses', []),
        dbGet<Customer[]>('customers', []),
        dbGet<Payment[]>('payments', []),
        dbGet<MonthlyBalance[]>('financialHistory', []),
        dbGet<BrewerySettings>('settings', { fixedCosts: [], fermenterCapacity: 3 }),
        dbGet<ShoppingListItem[]>('shoppingList', []),
        dbGet<MasterRecipe[]>('masterRecipes', []),
        dbGet<CalendarEvent[]>('calendarEvents', []),
        dbGet<Record<string, { income?: number; fijos?: number; insumos?: number; varios?: number }>>('annualOverrides', {}),
        dbGet<BrewSession[]>('brewSessions', [])
      ]);
      
      // Migración de estados antiguos
      const migratedBatches = batches.map(b =>
        (b.status === ('Envasado' as unknown as BatchStatus)) 
          ? { ...b, status: BatchStatus.PACKAGED } 
          : b
      );
      
      set({
        batches: migratedBatches, inventory, kegs, bottles, fermenters, sales, expenses,
        customers, payments, financialHistory, settings, shoppingList,
        masterRecipes, calendarEvents, annualOverrides, brewSessions, isLoading: false, isHydrated: true,
      });
    } catch (e) {
      console.error('[Store] Error hydrating:', e);
      set({ isLoading: false, isHydrated: true });
    }
  },

  // ---- Settings ----
  updateSettings: (updates) => {
    set(state => {
      const next = { ...state.settings, ...updates };
      scheduleSave('settings', next);
      return { settings: next };
    });
  },

  // ---- Batches ----
  addBatch: (batch) => {
    if (!batch || typeof batch !== 'object' || 'preventDefault' in batch) {
      console.error("Attempted to add invalid batch object:", batch);
      return;
    }
    
    // Validación exhaustiva del objeto batch
    if (
      !batch.id || 
      typeof batch.id !== 'string' ||
      !batch.recipeName || 
      typeof batch.recipeName !== 'string' ||
      !batch.brewDate || 
      typeof batch.brewDate !== 'string' ||
      isNaN(Date.parse(batch.brewDate)) ||
      typeof batch.volumeKettle !== 'number' ||
      typeof batch.volumePackaged !== 'number' ||
      !Array.isArray(batch.ingredientsUsed)
    ) {
      console.error("Invalid batch object structure:", batch);
      return;
    }
    set(state => {
      if (batch.fermenterId) validateFermenterAssignment(batch, batch.fermenterId, state.batches, state.fermenters);
      const volumeAvailable = batch.status === BatchStatus.PACKAGED ? batch.volumePackaged : 0;
      const shouldDiscount = batch.ingredientsDiscounted !== false; // default true unless explicitly false
      
      // Descontar ingredientes
      let nextInventory = state.inventory;
      if (shouldDiscount && batch.ingredientsUsed && batch.ingredientsUsed.length > 0) {
        const inventoryMap = new Map(state.inventory.map(i => [i.id, i]));
        batch.ingredientsUsed.forEach(usedItem => {
          const original = inventoryMap.get(usedItem.inventoryId);
          if (original) {
            const newAmount = Math.max(0, original.stockAmount - usedItem.amountUsed);
            inventoryMap.set(original.id, { ...original, stockAmount: newAmount });
          }
        });
        nextInventory = Array.from(inventoryMap.values());
      }

      // Vincular fermentador si fue seleccionado
      let nextFermenters = state.fermenters;
      let assignedFermenterName = batch.fermenterName;
      if (batch.fermenterId) {
        const found = state.fermenters.find(f => f.id === batch.fermenterId);
        if (found) {
          assignedFermenterName = found.name;
          nextFermenters = state.fermenters.map(f =>
            f.id === batch.fermenterId
              ? { ...f, status: 'OCCUPIED' as const, currentBatchId: batch.id }
              : f
          );
          scheduleSave('fermenters', nextFermenters);
        }
      }

      const newBatch: Batch = { 
        ...batch, 
        fermenterName: assignedFermenterName,
        volumeAvailable, 
        fermentationLogs: [], 
        sensoryProfiles: [], 
        qualityLogs: [],
        ingredientsDiscounted: shouldDiscount
      };
      const next = [newBatch, ...state.batches];

      scheduleSave('batches', next);
      if (nextInventory !== state.inventory) scheduleSave('inventory', nextInventory);
      return { batches: next, inventory: nextInventory, fermenters: nextFermenters };
    });
  },

  updateBatch: (id, updates) => {
    set(state => {
      let nextInventory = state.inventory;
      let nextFermenters = state.fermenters;
      let fermentersModified = false;

      const currentBatch = state.batches.find(b => b.id === id);
      if (!currentBatch) throw new Error('El lote no existe.');
      const candidate = { ...currentBatch, ...updates };
      if (candidate.fermenterId && (!isFinishedBatch(candidate) || !!updates.fermenterId)) {
        validateFermenterAssignment(candidate, candidate.fermenterId, state.batches, state.fermenters);
      }

      const next = state.batches.map(b => {
        if (b.id !== id) return b;
        let nextVolumeAvailable = updates.volumeAvailable !== undefined ? updates.volumeAvailable : b.volumeAvailable;
        if (updates.volumeAvailable === undefined) {
          if (updates.status === BatchStatus.PACKAGED && updates.volumePackaged !== undefined) {
            if (b.status !== BatchStatus.PACKAGED) {
              nextVolumeAvailable = updates.volumePackaged;
            }
          }
        }

        // Lógica de Descuento Automatizado de Stock al finalizar
        let updatedIngredientsDiscounted = updates.ingredientsDiscounted !== undefined ? updates.ingredientsDiscounted : b.ingredientsDiscounted;
        
        // Si el lote pasa a estar en estado PACKAGED (Finalizado)
        // y NO ha sido descontado aún:
        const isTransitioningToPackaged = updates.status === BatchStatus.PACKAGED && b.status !== BatchStatus.PACKAGED;
        const ingredientsNeedDiscount = !updatedIngredientsDiscounted;
        
        if (isTransitioningToPackaged && ingredientsNeedDiscount && b.ingredientsUsed && b.ingredientsUsed.length > 0) {
          const inventoryMap = new Map(nextInventory.map(i => [i.id, i]));
          b.ingredientsUsed.forEach(usedItem => {
            const original = inventoryMap.get(usedItem.inventoryId);
            if (original) {
              const newAmount = Math.max(0, original.stockAmount - usedItem.amountUsed);
              inventoryMap.set(original.id, { ...original, stockAmount: newAmount });
            }
          });
          nextInventory = Array.from(inventoryMap.values());
          updatedIngredientsDiscounted = true;
        }

        // Lógica de fermentador asignado / cache de nombre
        let updatedFermenterName = updates.fermenterName !== undefined ? updates.fermenterName : b.fermenterName;
        if (updates.fermenterId && updates.fermenterId !== b.fermenterId) {
          const targetF = state.fermenters.find(f => f.id === updates.fermenterId);
          if (targetF) updatedFermenterName = targetF.name;
        } else if (updates.fermenterId === '') {
          updatedFermenterName = undefined;
        }

        return { 
          ...b, 
          ...updates, 
          fermenterName: updatedFermenterName,
          volumeAvailable: nextVolumeAvailable,
          ingredientsDiscounted: updatedIngredientsDiscounted
        };
      });

      // Sincronizar estado de fermentadores si cambió asignación o lote finalizó
      if (currentBatch) {
        // 1. Cambio de fermentador
        if (updates.fermenterId !== undefined && updates.fermenterId !== currentBatch.fermenterId) {
          fermentersModified = true;
          nextFermenters = nextFermenters.map(f => {
            if (currentBatch.fermenterId && f.id === currentBatch.fermenterId) {
              return { ...f, status: 'DIRTY' as const, currentBatchId: undefined };
            }
            if (updates.fermenterId && f.id === updates.fermenterId) {
              return { ...f, status: 'OCCUPIED' as const, currentBatchId: currentBatch.id };
            }
            return f;
          });
        }

        // 2. Si el lote finaliza (COMPLETED o volumen envasado a 0)
        const nextVolumeAvail = updates.volumeAvailable !== undefined ? updates.volumeAvailable : currentBatch.volumeAvailable;
        const isFinishing = updates.status === BatchStatus.PACKAGED || updates.status === BatchStatus.COMPLETED ||
                            (nextVolumeAvail !== undefined && nextVolumeAvail <= 0 && (currentBatch.volumeAvailable ?? 1) > 0);
        const effectiveFermenterId = updates.fermenterId !== undefined ? updates.fermenterId : currentBatch.fermenterId;

        if (isFinishing && effectiveFermenterId) {
          const finished = next.find(b => b.id === id)!;
          finished.fermenterId = undefined;
          finished.fermenterName = undefined;
          fermentersModified = true;
          nextFermenters = nextFermenters.map(f =>
            f.id === effectiveFermenterId && f.currentBatchId === id
              ? { ...f, status: 'DIRTY' as const, currentBatchId: undefined }
              : f
          );
        }
      }

      scheduleSave('batches', next);
      if (fermentersModified) {
        scheduleSave('fermenters', nextFermenters);
      }
      if (nextInventory !== state.inventory) {
        scheduleSave('inventory', nextInventory);
        return { batches: next, inventory: nextInventory, fermenters: nextFermenters };
      }
      return { batches: next, fermenters: nextFermenters };
    });
  },

  deleteBatch: (id) => {
    set(state => {
      const bToDelete = state.batches.find(b => b.id === id);
      let nextFermenters = state.fermenters;
      if (bToDelete?.fermenterId) {
        nextFermenters = state.fermenters.map(f =>
          f.id === bToDelete.fermenterId && f.currentBatchId === id
            ? { ...f, status: 'DIRTY' as const, currentBatchId: undefined }
            : f
        );
        scheduleSave('fermenters', nextFermenters);
      }

      const nextBatches = state.batches.filter(b => b.id !== id);
      const nextEvents = state.calendarEvents.filter(e => e.batchId !== id);
      scheduleSave('batches', nextBatches);
      scheduleSave('calendarEvents', nextEvents);
      return { batches: nextBatches, calendarEvents: nextEvents, fermenters: nextFermenters };
    });
  },

  addFermentationLog: (batchId, log) => {
    const newLog = { ...log, id: Date.now().toString() };
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId) {
          const updatedLogs = [...(b.fermentationLogs || []), newLog]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return { ...b, fermentationLogs: updatedLogs };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  deleteFermentationLog: (batchId, logId) => {
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId) {
          return { ...b, fermentationLogs: b.fermentationLogs.filter(l => l.id !== logId) };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  addSensoryProfile: (batchId, profile) => {
    const newProfile = { ...profile, id: Date.now().toString() };
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId) {
          return { ...b, sensoryProfiles: [...(b.sensoryProfiles || []), newProfile] };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  deleteSensoryProfile: (batchId, profileId) => {
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId && b.sensoryProfiles) {
          return { ...b, sensoryProfiles: b.sensoryProfiles.filter(p => p.id !== profileId) };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  addQualityLog: (batchId, log) => {
    const newLog = { ...log, id: Date.now().toString() };
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId) {
          return { ...b, qualityLogs: [...(b.qualityLogs || []), newLog] };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  deleteQualityLog: (batchId, logId) => {
    set(state => {
      const next = state.batches.map(b => {
        if (b.id === batchId && b.qualityLogs) {
          return { ...b, qualityLogs: b.qualityLogs.filter(l => l.id !== logId) };
        }
        return b;
      });
      scheduleSave('batches', next);
      return { batches: next };
    });
  },

  // ---- Inventory ----
  updateInventory: (id, amount) => {
    set(state => {
      const next = state.inventory.map(i => i.id === id ? { ...i, stockAmount: amount } : i);
      scheduleSave('inventory', next);
      return { inventory: next };
    });
  },

  addIngredient: (ingredient) => {
    if (!ingredient || typeof ingredient !== 'object') return;
    
    // Validación completa de los parámetros de entrada
    if (
      !ingredient.id || 
      typeof ingredient.id !== 'string' ||
      !ingredient.name || 
      typeof ingredient.name !== 'string' ||
      typeof ingredient.stockAmount !== 'number' ||
      typeof ingredient.costPerUnit !== 'number' ||
      !ingredient.unit || 
      typeof ingredient.unit !== 'string' ||
      !ingredient.purchaseDate || 
      typeof ingredient.purchaseDate !== 'string' ||
      isNaN(Date.parse(ingredient.purchaseDate))
    ) {
      console.error("Invalid ingredient object structure:", ingredient);
      return;
    }
    
    const purchaseId = `inv_${ingredient.id}`;
    const totalCost = ingredient.stockAmount * ingredient.costPerUnit;
    const expense: Expense = {
      id: crypto.randomUUID(),
      date: ingredient.purchaseDate,
      description: `Compra ${ingredient.name} (${ingredient.stockAmount}${ingredient.unit})`,
      amount: totalCost,
      category: 'INVENTORY',
      inventoryPurchaseId: purchaseId,
    };
    set(state => {
      const nextInventory = [ingredient, ...state.inventory];
      const nextExpenses = [expense, ...state.expenses];
      scheduleSave('inventory', nextInventory);
      scheduleSave('expenses', nextExpenses);
      return { inventory: nextInventory, expenses: nextExpenses };
    });
  },

  editIngredient: (id, updates) => {
    set(state => {
      const next = state.inventory.map(i => i.id === id ? { ...i, ...updates } : i);
      scheduleSave('inventory', next);
      return { inventory: next };
    });
  },

  deleteIngredient: (id) => {
    const purchaseId = `inv_${id}`;
    set(state => {
      const nextInventory = state.inventory.filter(i => i.id !== id);
      const nextExpenses = state.expenses.filter(e => e.inventoryPurchaseId !== purchaseId);
      scheduleSave('inventory', nextInventory);
      scheduleSave('expenses', nextExpenses);
      return { inventory: nextInventory, expenses: nextExpenses };
    });
  },

  // ---- Fermenters ----
  addFermenter: (fermenter) => {
    if (!fermenter || typeof fermenter !== 'object') return;
    set(state => {
      const id = fermenter.id || `F-${Date.now().toString().slice(-4)}`;
      const newFermenter: Fermenter = {
        id,
        name: fermenter.name.trim(),
        capacity: Number(fermenter.capacity) || 300,
        status: fermenter.status || 'AVAILABLE',
        notes: fermenter.notes?.trim() || '',
        currentBatchId: fermenter.currentBatchId,
        lastCleanedDate: fermenter.status === 'AVAILABLE' ? new Date().toISOString() : fermenter.lastCleanedDate
      };
      const next = [...state.fermenters, newFermenter];
      scheduleSave('fermenters', next);
      return { fermenters: next };
    });
  },

  updateFermenter: (id, updates) => {
    set(state => {
      const current = state.fermenters.find(f => f.id === id);
      if (!current) throw new Error('El fermentador no existe.');
      const updated = { ...current, ...updates };
      if (updated.id !== id) throw new Error('No se puede cambiar el ID del fermentador.');
      if (updated.currentBatchId !== current.currentBatchId) throw new Error('Use asignar o liberar para cambiar el lote del fermentador.');
      const occupied = current.status === 'OCCUPIED' || !!current.currentBatchId || state.batches.some(b => b.fermenterId === id && !isFinishedBatch(b));
      if (occupied && updated.status !== 'OCCUPIED') throw new Error('Debe liberar el fermentador ocupado primero.');
      if (!occupied && updated.status === 'OCCUPIED') throw new Error('Debe asignar un lote para ocupar el fermentador.');
      if (!updated.name?.trim() || !Number.isFinite(updated.capacity) || updated.capacity <= 0) throw new Error('Nombre o capacidad del fermentador inválidos.');
      updated.name = updated.name.trim();
      const next = state.fermenters.map(f => f.id === id ? updated : f);
      const assigned = state.batches.find(b => b.id === current.currentBatchId);
      if (assigned) validateFermenterAssignment(assigned, id, state.batches, next);
      const batches = state.batches.map(b => b.fermenterId === id ? { ...b, fermenterName: updated.name } : b);
      scheduleSave('fermenters', next);
      scheduleSave('batches', batches);
      return { fermenters: next, batches };
    });
  },

  deleteFermenter: (id) => {
    set(state => {
      const next = state.fermenters.filter(f => f.id !== id);
      const nextBatches = state.batches.map(b => 
        b.fermenterId === id ? { ...b, fermenterId: undefined, fermenterName: undefined } : b
      );
      scheduleSave('fermenters', next);
      scheduleSave('batches', nextBatches);
      return { fermenters: next, batches: nextBatches };
    });
  },

  cleanFermenter: (id) => {
    set(state => {
      const current = state.fermenters.find(f => f.id === id);
      if (!current) throw new Error('El fermentador no existe.');
      if (current.status === 'OCCUPIED' || current.currentBatchId || state.batches.some(b => b.fermenterId === id && !isFinishedBatch(b))) throw new Error('Debe liberar el fermentador ocupado primero.');
      const next = state.fermenters.map(f =>
        f.id === id
          ? { ...f, status: 'AVAILABLE' as const, currentBatchId: undefined, lastCleanedDate: new Date().toISOString() }
          : f
      );
      scheduleSave('fermenters', next);
      return { fermenters: next };
    });
  },

  markFermenterDirty: (id) => {
    set(state => {
      const current = state.fermenters.find(f => f.id === id);
      if (!current) throw new Error('El fermentador no existe.');
      if (current.status === 'OCCUPIED' || current.currentBatchId || state.batches.some(b => b.fermenterId === id && !isFinishedBatch(b))) throw new Error('Debe liberar el fermentador ocupado primero.');
      const next = state.fermenters.map(f =>
        f.id === id
          ? { ...f, status: 'DIRTY' as const, currentBatchId: undefined }
          : f
      );
      scheduleSave('fermenters', next);
      return { fermenters: next };
    });
  },

  assignBatchToFermenter: (fermenterId, batchId) => {
    set(state => {
      const batch = state.batches.find(b => b.id === batchId);
      const targetFermenter = state.fermenters.find(f => f.id === fermenterId);
      if (!batch || !targetFermenter) throw new Error('El lote o fermentador no existe.');
      validateFermenterAssignment(batch, fermenterId, state.batches, state.fermenters);

      const nextFermenters = state.fermenters.map(f => {
        if (f.id === fermenterId) {
          return { ...f, status: 'OCCUPIED' as const, currentBatchId: batchId };
        }
        if (batch.fermenterId && f.id === batch.fermenterId && f.id !== fermenterId) {
          return { ...f, status: 'DIRTY' as const, currentBatchId: undefined };
        }
        return f;
      });

      const nextBatches = state.batches.map(b =>
        b.id === batchId
          ? { ...b, fermenterId, fermenterName: targetFermenter.name }
          : b
      );

      scheduleSave('fermenters', nextFermenters);
      scheduleSave('batches', nextBatches);
      return { fermenters: nextFermenters, batches: nextBatches };
    });
  },

  releaseFermenter: (fermenterId, markDirty = true) => {
    set(state => {
      const nextFermenters = state.fermenters.map(f =>
        f.id === fermenterId
          ? { ...f, status: markDirty ? ('DIRTY' as const) : ('AVAILABLE' as const), currentBatchId: undefined }
          : f
      );
      const nextBatches = state.batches.map(b =>
        b.fermenterId === fermenterId
          ? { ...b, fermenterId: undefined, fermenterName: undefined }
          : b
      );
      scheduleSave('fermenters', nextFermenters);
      scheduleSave('batches', nextBatches);
      return { fermenters: nextFermenters, batches: nextBatches };
    });
  },

  // ---- Kegs ----
  updateKegStatus: (id, status, location) => {
    set(state => {
      const next = state.kegs.map(k => k.id === id ? { ...k, status, currentLocation: location } : k);
      scheduleSave('kegs', next);
      return { kegs: next };
    });
  },

  addKeg: (keg) => {
    if (!keg || typeof keg !== 'object') return;
    set(state => {
      const next = [...state.kegs, keg];
      scheduleSave('kegs', next);
      return { kegs: next };
    });
  },

  updateKeg: (id, updates) => {
    set(state => {
      const next = state.kegs.map(k => k.id === id ? { ...k, ...updates } : k);
      scheduleSave('kegs', next);
      return { kegs: next };
    });
  },

  fillKegFromBatch: (kegId, batchId, customAmount) => {
    const state = get();
    const keg = state.kegs.find(k => k.id === kegId);
    if (!keg) return;

    const batch = state.batches.find(b => b.id === batchId);
    if (!batch) return;

    const batchAvailable = batch.volumeAvailable !== undefined ? batch.volumeAvailable : batch.volumePackaged;
    if (batchAvailable <= 0) return;

    let amountToFill = customAmount !== undefined ? customAmount : keg.size;
    if (batchAvailable < amountToFill) amountToFill = batchAvailable;

    const newBatchVolume = Math.max(0, batchAvailable - amountToFill);
    let newStatus = batch.status;
    if (newBatchVolume <= 0.5) newStatus = BatchStatus.COMPLETED;

    const contentsLabel = `${batch.recipeName} (${batch.lotCode})`;

    set(state => {
      let nextFermenters = state.fermenters;
      if (newStatus === BatchStatus.COMPLETED && batch.fermenterId) {
        nextFermenters = state.fermenters.map(f =>
          f.id === batch.fermenterId && f.currentBatchId === batch.id
            ? { ...f, status: 'DIRTY' as const, currentBatchId: undefined }
            : f
        );
        scheduleSave('fermenters', nextFermenters);
      }

      const nextKegs = state.kegs.map(k =>
        k.id === kegId
          ? { ...k, status: 'IN_HOUSE' as const, currentLocation: 'Cámara de Frío', contents: contentsLabel, batchId: batch.id, currentVolume: amountToFill }
          : k
      );
      const nextBatches = state.batches.map(b =>
        b.id === batch.id ? { ...b, volumeAvailable: newBatchVolume, status: newStatus, ...(newStatus === BatchStatus.COMPLETED ? { fermenterId: undefined, fermenterName: undefined } : {}) } : b
      );
      scheduleSave('kegs', nextKegs);
      scheduleSave('batches', nextBatches);
      return { kegs: nextKegs, batches: nextBatches, fermenters: nextFermenters };
    });
  },

  bottleFromKeg: (kegId, formatName, quantity, inventoryId, customVolumePerUnit) => {
    const state = get();
    const keg = state.kegs.find(k => k.id === kegId);
    if (!keg || !keg.contents) return;

    const totalDispensedLiters = customVolumePerUnit * quantity;
    const currentKegVolume = keg.currentVolume !== undefined ? keg.currentVolume : keg.size;
    const newKegVolume = Math.max(0, currentKegVolume - totalDispensedLiters);

    const sourceBatch = state.batches.find(b => b.id === keg.batchId);
    const lotCode = sourceBatch?.lotCode;

    const newStock: BottleStock = {
      id: crypto.randomUUID(), style: keg.contents!, format: formatName, quantity,
      packagedDate: new Date().toISOString().split('T')[0],
      notes: `Trasvasado de Barril #${keg.id}`, lotCode
    };

    set(state => {
      let nextBottles = [newStock, ...state.bottles];
      let nextInventory = state.inventory;
      let nextKegs = state.kegs.map(k => {
        if (k.id !== kegId) return k;
        if (newKegVolume <= 0.5) {
          return { ...k, status: 'DIRTY' as const, currentLocation: 'Lavadero (Vacío por Trasvase)', contents: '', dateDispatched: undefined, currentVolume: 0, batchId: undefined };
        }
        return { ...k, currentVolume: newKegVolume };
      });

      if (inventoryId) {
        nextInventory = state.inventory.map(i =>
          i.id === inventoryId ? { ...i, stockAmount: Math.max(0, i.stockAmount - quantity) } : i
        );
      }

      scheduleSave('bottles', nextBottles);
      scheduleSave('inventory', nextInventory);
      scheduleSave('kegs', nextKegs);
      return { bottles: nextBottles, inventory: nextInventory, kegs: nextKegs };
    });
  },

  deleteKeg: (id) => {
    set(state => {
      const next = state.kegs.filter(k => k.id !== id);
      scheduleSave('kegs', next);
      return { kegs: next };
    });
  },

  toggleKegTap: (id, isTapped) => {
    set(state => {
      const next = state.kegs.map(k => k.id === id ? { ...k, isTapped } : k);
      scheduleSave('kegs', next);
      return { kegs: next };
    });
  },

  serveFromTap: (kegId, volumeLiters, formatName, price) => {
    set(state => {
      const keg = state.kegs.find(k => k.id === kegId);
      if (!keg) return state;

      const currentVol = keg.currentVolume ?? keg.size;
      const newVol = Math.max(0, currentVol - volumeLiters);
      
      let nextKegs = state.kegs.map(k => {
        if (k.id === kegId) {
          const updated = { ...k, currentVolume: newVol };
          // If empty, un-tap and mark dirty
          if (newVol <= 0.2) { // Allow small margin
            updated.isTapped = false;
            updated.status = 'DIRTY';
            updated.currentVolume = 0;
            updated.contents = '';
            updated.batchId = undefined;
          }
          return updated;
        }
        return k;
      });

      // Create a sale record
      const newSale = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        customer: 'Taproom / Evento',
        description: `Venta Pizarra: ${formatName} - Barril #${keg.id}`,
        type: 'TAPROOM' as const,
        format: formatName,
        quantity: 1,
        amount: price,
        isPaid: true,
        status: 'PAID' as const,
        lotCode: keg.batchId ? state.batches.find(b => b.id === keg.batchId)?.lotCode : undefined
      };

      const nextSales = [newSale, ...state.sales];

      scheduleSave('kegs', nextKegs);
      scheduleSave('sales', nextSales);

      return { kegs: nextKegs, sales: nextSales };
    });
  },

  giftFromTap: (kegId, volumeLiters, formatName) => {
    set(state => {
      const keg = state.kegs.find(k => k.id === kegId);
      if (!keg) return state;

      const currentVol = keg.currentVolume ?? keg.size;
      const newVol = Math.max(0, currentVol - volumeLiters);
      
      let nextKegs = state.kegs.map(k => {
        if (k.id === kegId) {
          const updated = { ...k, currentVolume: newVol };
          // If empty, un-tap and mark dirty
          if (newVol <= 0.2) {
            updated.isTapped = false;
            updated.status = 'DIRTY';
            updated.currentVolume = 0;
            updated.contents = '';
            updated.batchId = undefined;
          }
          return updated;
        }
        return k;
      });

      // Calculate cost
      let cost = 0;
      if (keg.batchId) {
        const batch = state.batches.find(b => b.id === keg.batchId);
        if (batch) {
          const totalCost = (batch.totalIngredientsCost || 0) + (batch.overheadCost || 0);
          const volPackaged = batch.volumePackaged || 1;
          const costPerLiter = totalCost / volPackaged;
          cost = costPerLiter * volumeLiters;
        }
      }

      // Create an expense record for the gift
      const newExpense = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        description: `Regalo Pizarra: ${formatName} - Barril #${keg.id}`,
        amount: cost,
        category: 'REGALO' as const
      };

      const nextExpenses = [newExpense, ...state.expenses];

      scheduleSave('kegs', nextKegs);
      scheduleSave('expenses', nextExpenses);

      return { kegs: nextKegs, expenses: nextExpenses };
    });
  },

  // ---- Bottles ----
  addBottleStock: (bottle) => {
    set(state => {
      const next = [bottle, ...state.bottles];
      scheduleSave('bottles', next);
      return { bottles: next };
    });
  },

  updateBottleStock: (id, quantityChange) => {
    set(state => {
      const next = state.bottles.map(b => b.id === id ? { ...b, quantity: Math.max(0, b.quantity + quantityChange) } : b);
      scheduleSave('bottles', next);
      return { bottles: next };
    });
  },

  deleteBottleStock: (id) => {
    set(state => {
      const next = state.bottles.filter(b => b.id !== id);
      scheduleSave('bottles', next);
      return { bottles: next };
    });
  },

  giftBottle: (bottleId, quantity) => {
    set(state => {
      const bottle = state.bottles.find(b => b.id === bottleId);
      if (!bottle) return state;

      // Ensure quantity is not more than available
      const actualQty = Math.min(quantity, bottle.quantity);
      if (actualQty <= 0) return state;

      const newQty = bottle.quantity - actualQty;
      let nextBottles = state.bottles;

      if (newQty <= 0) {
        nextBottles = state.bottles.filter(b => b.id !== bottleId);
      } else {
        nextBottles = state.bottles.map(b => b.id === bottleId ? { ...b, quantity: newQty } : b);
      }

      // Calculate cost
      let cost = 0;
      if (bottle.lotCode) {
        const batch = state.batches.find(b => b.lotCode === bottle.lotCode);
        if (batch) {
          const totalCost = (batch.totalIngredientsCost || 0) + (batch.overheadCost || 0);
          const volPackaged = batch.volumePackaged || 1;
          const costPerLiter = totalCost / volPackaged;
          
          // Estimate volume from format (e.g. "Pinta 500ml", "330 ml", "1L")
          const match = bottle.format.match(/(\d+)\s*(ml|l)/i);
          let volumeInLiters = 0.5; // default 500ml
          if (match) {
              if (match[2].toLowerCase() === 'ml') {
                  volumeInLiters = parseInt(match[1]) / 1000;
              } else {
                  volumeInLiters = parseFloat(match[1]);
              }
          }
          
          cost = costPerLiter * volumeInLiters * actualQty;
        }
      }

      // Create an expense record for the gift
      const newExpense = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        description: `Regalo: ${actualQty}x ${bottle.style} (${bottle.format})`,
        amount: cost,
        category: 'REGALO' as const
      };

      const nextExpenses = [newExpense, ...state.expenses];

      scheduleSave('bottles', nextBottles);
      scheduleSave('expenses', nextExpenses);

      return { bottles: nextBottles, expenses: nextExpenses };
    });
  },

  // ---- Sales ----
  addSale: (sale) => {
    set(state => {
      const nextSales = [sale, ...state.sales];
      let nextCustomers = state.customers;
      if (sale.customerId) {
        nextCustomers = state.customers.map(c =>
          c.id === sale.customerId
            ? { 
                ...c, 
                debt: !sale.isPaid ? c.debt + sale.amount : c.debt, 
                totalSales: (c.totalSales || 0) + sale.amount 
              }
            : c
        );
      }
      scheduleSave('sales', nextSales);
      scheduleSave('customers', nextCustomers);
      return { sales: nextSales, customers: nextCustomers };
    });
  },

  updateSale: (id, updates) => {
    set(state => {
      const original = state.sales.find(s => s.id === id);
      if (!original) return {};

      const updated = { ...original, ...updates };
      let nextCustomers = state.customers;

      if (original.customerId) {
        nextCustomers = nextCustomers.map(c =>
          c.id === original.customerId
            ? { 
                ...c, 
                debt: !original.isPaid ? Math.max(0, c.debt - original.amount) : c.debt, 
                totalSales: Math.max(0, (c.totalSales || 0) - original.amount) 
              }
            : c
        );
      }
      if (updated.customerId) {
        nextCustomers = nextCustomers.map(c =>
          c.id === updated.customerId
            ? { 
                ...c, 
                debt: !updated.isPaid ? c.debt + updated.amount : c.debt, 
                totalSales: (c.totalSales || 0) + updated.amount 
              }
            : c
        );
      }

      const nextSales = state.sales.map(s => s.id === id ? updated : s);
      scheduleSave('sales', nextSales);
      scheduleSave('customers', nextCustomers);
      return { sales: nextSales, customers: nextCustomers };
    });
  },

  deleteSale: (id) => {
    set(state => {
      const saleToDelete = state.sales.find(s => s.id === id);
      if (!saleToDelete) return {};

      let nextCustomers = state.customers;
      if (saleToDelete.customerId) {
        nextCustomers = state.customers.map(c =>
          c.id === saleToDelete.customerId
            ? { 
                ...c, 
                debt: !saleToDelete.isPaid ? Math.max(0, c.debt - saleToDelete.amount) : c.debt, 
                totalSales: Math.max(0, (c.totalSales || 0) - saleToDelete.amount) 
              }
            : c
        );
      }

      const nextSales = state.sales.filter(s => s.id !== id);
      scheduleSave('sales', nextSales);
      scheduleSave('customers', nextCustomers);
      return { sales: nextSales, customers: nextCustomers };
    });
  },

  // ---- Expenses ----
  addExpense: (expense) => {
    set(state => {
      const next = [expense, ...state.expenses];
      scheduleSave('expenses', next);
      return { expenses: next };
    });
  },

  deleteExpense: (id) => {
    set(state => {
      const next = state.expenses.filter(e => e.id !== id);
      scheduleSave('expenses', next);
      return { expenses: next };
    });
  },

  // ---- Customers ----
  addCustomer: (customer) => {
    set(state => {
      const next = [...state.customers, customer];
      scheduleSave('customers', next);
      return { customers: next };
    });
  },

  updateCustomer: (id, updates) => {
    set(state => {
      const next = state.customers.map(c => c.id === id ? { ...c, ...updates } : c);
      scheduleSave('customers', next);
      return { customers: next };
    });
  },

  deleteCustomer: (id) => {
    set(state => {
      const next = state.customers.filter(c => c.id !== id);
      scheduleSave('customers', next);
      return { customers: next };
    });
  },

  // ---- Payments ----
  addPayment: (payment) => {
    set(state => {
      const nextPayments = [payment, ...state.payments];
      const nextCustomers = state.customers.map(c =>
        c.id === payment.customerId
          ? { ...c, debt: Math.max(0, c.debt - payment.amount) }
          : c
      );
      scheduleSave('payments', nextPayments);
      scheduleSave('customers', nextCustomers);
      return { payments: nextPayments, customers: nextCustomers };
    });
  },

  // ---- Financial ----
  closeMonth: (balance) => {
    set(state => {
      const filtered = state.financialHistory.filter(h => h.monthKey !== balance.monthKey);
      const nextFinancials = [balance, ...filtered].sort(
        (a, b) => new Date(b.closedDate!).getTime() - new Date(a.closedDate!).getTime()
      );
      const targetMonthKey = balance.monthKey;
      const nextSales = state.sales.map(s =>
        s.date.startsWith(targetMonthKey) ? { ...s, isClosed: true } : s
      );
      const nextExpenses = state.expenses.map(e =>
        e.date.startsWith(targetMonthKey) ? { ...e, isClosed: true } : e
      );
      scheduleSave('financialHistory', nextFinancials);
      scheduleSave('sales', nextSales);
      scheduleSave('expenses', nextExpenses);
      return { financialHistory: nextFinancials, sales: nextSales, expenses: nextExpenses };
    });
  },

  openMonth: (monthKey) => {
    set(state => {
      const nextFinancials = state.financialHistory.filter(h => h.monthKey !== monthKey);
      const nextSales = state.sales.map(s =>
        s.date.startsWith(monthKey) ? { ...s, isClosed: false } : s
      );
      const nextExpenses = state.expenses.map(e =>
        e.date.startsWith(monthKey) ? { ...e, isClosed: false } : e
      );
      scheduleSave('financialHistory', nextFinancials);
      scheduleSave('sales', nextSales);
      scheduleSave('expenses', nextExpenses);
      return { financialHistory: nextFinancials, sales: nextSales, expenses: nextExpenses };
    });
  },

  // ---- Backup ----
  downloadBackup: async () => {
    const state = get();
    const data = {
      timestamp: new Date().toISOString(), version: "1.2",
      batches: state.batches, inventory: state.inventory, kegs: state.kegs,
      bottles: state.bottles, fermenters: state.fermenters, sales: state.sales, expenses: state.expenses,
      settings: state.settings, financialHistory: state.financialHistory,
      customers: state.customers, payments: state.payments,
      shoppingList: state.shoppingList, masterRecipes: state.masterRecipes,
      calendarEvents: state.calendarEvents,
      annualOverrides: state.annualOverrides,
      brewSessions: state.brewSessions
    };
    const fileName = `BON_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const jsonString = JSON.stringify(data);

    try {
      const file = new File([jsonString], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Respaldo BON Gestión', text: 'Copia de seguridad de datos de BON Gestión.' });
        return;
      }
    } catch (e) { /* fallback */ }

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  restoreBackup: async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (!data.batches || !data.inventory || !data.settings) { resolve(false); return; }

          const migratedBatches = data.batches.map((b: Batch) => ({
            ...b, sensoryProfiles: b.sensoryProfiles || [],
            qualityLogs: b.qualityLogs || [],
            fermentationLogs: b.fermentationLogs || []
          }));

          const updatedState = {
            batches: migratedBatches, inventory: data.inventory, kegs: data.kegs || [],
            bottles: data.bottles || [], fermenters: data.fermenters || [], sales: data.sales || [], expenses: data.expenses || [],
            customers: data.customers || [], payments: data.payments || [],
            settings: data.settings, financialHistory: data.financialHistory || [],
            shoppingList: data.shoppingList || [], masterRecipes: data.masterRecipes || [],
            calendarEvents: data.calendarEvents || [],
            annualOverrides: data.annualOverrides || {},
            brewSessions: data.brewSessions || []
          };

          set(updatedState);

          // Persistir en Dexie IndexedDB
          Object.entries(updatedState).forEach(([key, value]) => {
            scheduleSave(key, value);
          });

          resolve(true);
        } catch { resolve(false); }
      };
      reader.readAsText(file);
    });
  },

  // ---- Shopping List ----
  addShoppingItem: (text, estimatedCost) => {
    if (typeof text !== 'string') return;
    const newItem: ShoppingListItem = { id: Date.now().toString(), text, completed: false, estimatedCost };
    set(state => {
      const next = [...state.shoppingList, newItem];
      scheduleSave('shoppingList', next);
      return { shoppingList: next };
    });
  },
  
  updateShoppingItemCost: (id, cost) => {
    set(state => {
      const next = state.shoppingList.map(item => item.id === id ? { ...item, estimatedCost: cost } : item);
      scheduleSave('shoppingList', next);
      return { shoppingList: next };
    });
  },

  toggleShoppingItem: (id) => {
    set(state => {
      const next = state.shoppingList.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      scheduleSave('shoppingList', next);
      return { shoppingList: next };
    });
  },

  deleteShoppingItem: (id) => {
    set(state => {
      const next = state.shoppingList.filter(item => item.id !== id);
      scheduleSave('shoppingList', next);
      return { shoppingList: next };
    });
  },

  // ---- Recipes ----
  addMasterRecipe: (recipe) => {
    if (!recipe || typeof recipe !== 'object') return;
    
    // Validación completa de los parámetros de entrada
    if (
      !recipe.id || 
      typeof recipe.id !== 'string' ||
      !recipe.name || 
      typeof recipe.name !== 'string' ||
      !recipe.style || 
      typeof recipe.style !== 'string' ||
      typeof recipe.batchSize !== 'number' ||
      !Array.isArray(recipe.ingredients)
    ) {
      console.error("Invalid master recipe object structure:", recipe);
      return;
    }
    set(state => {
      const next = [recipe, ...state.masterRecipes];
      scheduleSave('masterRecipes', next);
      return { masterRecipes: next };
    });
  },

  updateMasterRecipe: (id, updates) => {
    set(state => {
      const next = state.masterRecipes.map(r => r.id === id ? { ...r, ...updates } : r);
      scheduleSave('masterRecipes', next);
      return { masterRecipes: next };
    });
  },

  deleteMasterRecipe: (id) => {
    set(state => {
      const next = state.masterRecipes.filter(r => r.id !== id);
      scheduleSave('masterRecipes', next);
      return { masterRecipes: next };
    });
  },

  // ---- Calendar ----
  addCalendarEvent: (event) => {
    if (!event || typeof event !== 'object') return;
    
    // Validación completa de los parámetros de entrada
    if (
      !event.id || 
      typeof event.id !== 'string' ||
      !event.title || 
      typeof event.title !== 'string' ||
      !event.start || 
      typeof event.start !== 'string' ||
      isNaN(Date.parse(event.start)) ||
      (event.end && (typeof event.end !== 'string' || isNaN(Date.parse(event.end))))
    ) {
      console.error("Invalid calendar event object structure:", event);
      return;
    }
    set(state => {
      const next = [...state.calendarEvents, event];
      scheduleSave('calendarEvents', next);
      return { calendarEvents: next };
    });
  },

  updateCalendarEvent: (id, updates) => {
    set(state => {
      const next = state.calendarEvents.map(e => e.id === id ? { ...e, ...updates } : e);
      scheduleSave('calendarEvents', next);
      return { calendarEvents: next };
    });
  },

  deleteCalendarEvent: (id) => {
    set(state => {
      const filtered = state.calendarEvents.filter(e => e.id !== id);
      scheduleSave('calendarEvents', filtered);
      return { calendarEvents: filtered };
    });
  },

  // ---- Annual Overrides ----
  setAnnualOverride: (monthKey, field, value) => {
    set(state => {
      const currentOverrides = state.annualOverrides[monthKey] || {};
      const updatedOverrides = { ...state.annualOverrides, [monthKey]: { ...currentOverrides, [field]: value } };
      
      // Remove undefined keys
      if (value === undefined || value === null) {
        delete updatedOverrides[monthKey][field];
      }
      
      scheduleSave('annualOverrides', updatedOverrides);
      return { annualOverrides: updatedOverrides };
    });
  },

  // ---- Brew Assistant ----
  addBrewSession: (session) => {
    set(state => {
      const next = [session, ...state.brewSessions];
      scheduleSave('brewSessions', next);
      return { brewSessions: next };
    });
  },

  updateBrewSession: (id, updates) => {
    set(state => {
      const next = state.brewSessions.map(s => s.id === id ? { ...s, ...updates, lastUpdatedAt: Date.now() } : s);
      scheduleSave('brewSessions', next);
      return { brewSessions: next };
    });
  },

  deleteBrewSession: (id) => {
    set(state => {
      const next = state.brewSessions.filter(s => s.id !== id);
      scheduleSave('brewSessions', next);
      return { brewSessions: next };
    });
  }
}));
