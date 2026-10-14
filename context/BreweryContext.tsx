/**
 * BreweryContext.tsx — Context wrapper compatible con Zustand store.
 *
 * Mantiene exactamente la misma API (useBrewery(), BreweryProvider) pero
 * internamente usa el store atómico de Zustand.
 *
 * Los componentes que usen useBrewery() siguen funcionando igual.
 * Para máxima performance, usar selectores atómicos directos del store.
 */
import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useBreweryStore } from './store';
import { migrateFromLocalStorage } from './db';
import type {
  Batch, Ingredient, Keg, BottleStock, BrewerySettings, Sale,
  MonthlyBalance, Expense, Customer, Payment, ShoppingListItem,
  MasterRecipe, CalendarEvent, FermentationLog, SensoryProfile, QualityLog,
  Fermenter
} from '../types';

interface BreweryContextType {
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
  isLoading: boolean;
  updateSettings: (s: Partial<BrewerySettings>) => void;
  addBatch: (b: Batch) => void;
  updateBatch: (id: string, u: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;
  addFermentationLog: (bid: string, l: Omit<FermentationLog, 'id'>) => void;
  deleteFermentationLog: (bid: string, lid: string) => void;
  addSensoryProfile: (bid: string, p: Omit<SensoryProfile, 'id'>) => void;
  deleteSensoryProfile: (bid: string, pid: string) => void;
  addQualityLog: (bid: string, l: Omit<QualityLog, 'id'>) => void;
  deleteQualityLog: (bid: string, lid: string) => void;
  updateInventory: (id: string, a: number) => void;
  addIngredient: (i: Ingredient) => void;
  editIngredient: (id: string, u: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;
  // ---- Fermenters ----
  addFermenter: (f: Omit<Fermenter, 'id'> & { id?: string }) => void;
  updateFermenter: (id: string, u: Partial<Fermenter>) => void;
  deleteFermenter: (id: string) => void;
  cleanFermenter: (id: string) => void;
  markFermenterDirty: (id: string) => void;
  assignBatchToFermenter: (fid: string, bid: string) => void;
  releaseFermenter: (fid: string, md?: boolean) => void;
  // ---- Kegs ----
  updateKegStatus: (id: string, s: Keg['status'], loc: string) => void;
  addKeg: (k: Keg) => void;
  updateKeg: (id: string, u: Partial<Keg>) => void;
  fillKegFromBatch: (kid: string, bid: string) => void;
  bottleFromKeg: (kid: string, fn: string, q: number, iid: string | null, cv: number) => void;
  deleteKeg: (id: string) => void;
  addBottleStock: (b: BottleStock) => void;
  updateBottleStock: (id: string, qc: number) => void;
  deleteBottleStock: (id: string) => void;
  addSale: (s: Sale) => void;
  updateSale: (id: string, u: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  addExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, u: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addPayment: (p: Payment) => void;
  closeMonth: (b: MonthlyBalance) => void;
  downloadBackup: () => Promise<void>;
  restoreBackup: (f: File) => Promise<boolean>;
  addShoppingItem: (t: string) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  addMasterRecipe: (r: MasterRecipe) => void;
  updateMasterRecipe: (id: string, u: Partial<MasterRecipe>) => void;
  deleteMasterRecipe: (id: string) => void;
  addCalendarEvent: (e: CalendarEvent) => void;
  updateCalendarEvent: (id: string, u: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
}

const BreweryContext = createContext<BreweryContextType | undefined>(undefined);

export const BreweryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hydrate = useBreweryStore(s => s.hydrate);
  const isHydrated = useBreweryStore(s => s.isHydrated);

  useEffect(() => {
    migrateFromLocalStorage().then(() => hydrate());
  }, [hydrate]);

  // Datos con selectores atómicos
  const batches = useBreweryStore(s => s.batches);
  const inventory = useBreweryStore(s => s.inventory);
  const kegs = useBreweryStore(s => s.kegs);
  const bottles = useBreweryStore(s => s.bottles);
  const fermenters = useBreweryStore(s => s.fermenters);
  const settings = useBreweryStore(s => s.settings);
  const sales = useBreweryStore(s => s.sales);
  const expenses = useBreweryStore(s => s.expenses);
  const customers = useBreweryStore(s => s.customers);
  const payments = useBreweryStore(s => s.payments);
  const financialHistory = useBreweryStore(s => s.financialHistory);
  const shoppingList = useBreweryStore(s => s.shoppingList);
  const masterRecipes = useBreweryStore(s => s.masterRecipes);
  const calendarEvents = useBreweryStore(s => s.calendarEvents);
  const isLoading = useBreweryStore(s => s.isLoading);

  // Acciones (referencias estables por Zustand)
  const updateSettings = useBreweryStore(s => s.updateSettings);
  const addBatch = useBreweryStore(s => s.addBatch);
  const updateBatch = useBreweryStore(s => s.updateBatch);
  const deleteBatch = useBreweryStore(s => s.deleteBatch);
  const addFermentationLog = useBreweryStore(s => s.addFermentationLog);
  const deleteFermentationLog = useBreweryStore(s => s.deleteFermentationLog);
  const addSensoryProfile = useBreweryStore(s => s.addSensoryProfile);
  const deleteSensoryProfile = useBreweryStore(s => s.deleteSensoryProfile);
  const addQualityLog = useBreweryStore(s => s.addQualityLog);
  const deleteQualityLog = useBreweryStore(s => s.deleteQualityLog);
  const updateInventory = useBreweryStore(s => s.updateInventory);
  const addIngredient = useBreweryStore(s => s.addIngredient);
  const editIngredient = useBreweryStore(s => s.editIngredient);
  const deleteIngredient = useBreweryStore(s => s.deleteIngredient);
  const addFermenter = useBreweryStore(s => s.addFermenter);
  const updateFermenter = useBreweryStore(s => s.updateFermenter);
  const deleteFermenter = useBreweryStore(s => s.deleteFermenter);
  const cleanFermenter = useBreweryStore(s => s.cleanFermenter);
  const markFermenterDirty = useBreweryStore(s => s.markFermenterDirty);
  const assignBatchToFermenter = useBreweryStore(s => s.assignBatchToFermenter);
  const releaseFermenter = useBreweryStore(s => s.releaseFermenter);
  const updateKegStatus = useBreweryStore(s => s.updateKegStatus);
  const addKeg = useBreweryStore(s => s.addKeg);
  const updateKeg = useBreweryStore(s => s.updateKeg);
  const fillKegFromBatch = useBreweryStore(s => s.fillKegFromBatch);
  const bottleFromKeg = useBreweryStore(s => s.bottleFromKeg);
  const deleteKeg = useBreweryStore(s => s.deleteKeg);
  const addBottleStock = useBreweryStore(s => s.addBottleStock);
  const updateBottleStock = useBreweryStore(s => s.updateBottleStock);
  const deleteBottleStock = useBreweryStore(s => s.deleteBottleStock);
  const addSale = useBreweryStore(s => s.addSale);
  const updateSale = useBreweryStore(s => s.updateSale);
  const deleteSale = useBreweryStore(s => s.deleteSale);
  const addExpense = useBreweryStore(s => s.addExpense);
  const deleteExpense = useBreweryStore(s => s.deleteExpense);
  const addCustomer = useBreweryStore(s => s.addCustomer);
  const updateCustomer = useBreweryStore(s => s.updateCustomer);
  const deleteCustomer = useBreweryStore(s => s.deleteCustomer);
  const addPayment = useBreweryStore(s => s.addPayment);
  const closeMonth = useBreweryStore(s => s.closeMonth);
  const downloadBackup = useBreweryStore(s => s.downloadBackup);
  const restoreBackup = useBreweryStore(s => s.restoreBackup);
  const addShoppingItem = useBreweryStore(s => s.addShoppingItem);
  const toggleShoppingItem = useBreweryStore(s => s.toggleShoppingItem);
  const deleteShoppingItem = useBreweryStore(s => s.deleteShoppingItem);
  const addMasterRecipe = useBreweryStore(s => s.addMasterRecipe);
  const updateMasterRecipe = useBreweryStore(s => s.updateMasterRecipe);
  const deleteMasterRecipe = useBreweryStore(s => s.deleteMasterRecipe);
  const addCalendarEvent = useBreweryStore(s => s.addCalendarEvent);
  const updateCalendarEvent = useBreweryStore(s => s.updateCalendarEvent);
  const deleteCalendarEvent = useBreweryStore(s => s.deleteCalendarEvent);

  const value = useMemo<BreweryContextType>(() => ({
    batches, inventory, kegs, bottles, fermenters, settings, sales, expenses,
    customers, payments, financialHistory, shoppingList, masterRecipes,
    calendarEvents, isLoading,
    updateSettings, addBatch, updateBatch, deleteBatch,
    addFermentationLog, deleteFermentationLog, addSensoryProfile,
    deleteSensoryProfile, addQualityLog, deleteQualityLog,
    updateInventory, addIngredient, editIngredient, deleteIngredient,
    addFermenter, updateFermenter, deleteFermenter, cleanFermenter, markFermenterDirty, assignBatchToFermenter, releaseFermenter,
    updateKegStatus, addKeg, updateKeg, fillKegFromBatch, bottleFromKeg,
    deleteKeg, addBottleStock, updateBottleStock, deleteBottleStock,
    addSale, updateSale, deleteSale, addExpense, deleteExpense,
    addCustomer, updateCustomer, deleteCustomer, addPayment,
    closeMonth, downloadBackup, restoreBackup,
    addShoppingItem, toggleShoppingItem, deleteShoppingItem,
    addMasterRecipe, updateMasterRecipe, deleteMasterRecipe,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  }), [
    batches, inventory, kegs, bottles, fermenters, settings, sales, expenses,
    customers, payments, financialHistory, shoppingList, masterRecipes,
    calendarEvents, isLoading,
    updateSettings, addBatch, updateBatch, deleteBatch,
    addFermentationLog, deleteFermentationLog, addSensoryProfile,
    deleteSensoryProfile, addQualityLog, deleteQualityLog,
    updateInventory, addIngredient, editIngredient, deleteIngredient,
    addFermenter, updateFermenter, deleteFermenter, cleanFermenter, markFermenterDirty, assignBatchToFermenter, releaseFermenter,
    updateKegStatus, addKeg, updateKeg, fillKegFromBatch, bottleFromKeg,
    deleteKeg, addBottleStock, updateBottleStock, deleteBottleStock,
    addSale, updateSale, deleteSale, addExpense, deleteExpense,
    addCustomer, updateCustomer, deleteCustomer, addPayment,
    closeMonth, downloadBackup, restoreBackup,
    addShoppingItem, toggleShoppingItem, deleteShoppingItem,
    addMasterRecipe, updateMasterRecipe, deleteMasterRecipe,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  ]);

  return (
    <BreweryContext.Provider value={value}>
      {children}
    </BreweryContext.Provider>
  );
};

export const useBrewery = (): BreweryContextType => {
  const ctx = useContext(BreweryContext);
  if (ctx === undefined) {
    throw new Error('useBrewery must be used within a BreweryProvider');
  }
  return ctx;
};
