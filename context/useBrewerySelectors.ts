/**
 * @fileoverview useBrewerySelectors.ts — Selectores atómicos y granulares del store Zustand.
 *
 * Optimizaciones implementadas:
 * 1. Cada hook de dominio memoriza el objeto retornado con `useMemo` para mantener
 *    estabilidad referencial entre renders.
 * 2. Se añaden selectores granulares por entidad (`useFermenterData`, `useFermenterById`,
 *    `useFermenterIds`, `useBatchById`, `useKegById`, `useIngredientById`) que evitan
 *    re-renders masivos al actualizar un solo fermentador, lote o barril.
 */
import { useCallback, useMemo } from 'react';
import { useBreweryStore, type BreweryStore } from './store';
import {
  useFermenterById,
  useFermenterIds,
  useBatchById,
  useKegById,
  useBreweryActions,
} from './BreweryContext';

export {
  useFermenterById,
  useFermenterIds,
  useBatchById,
  useKegById,
  useBreweryActions,
};

export function useFermenterData() {
  const fermenters = useBreweryStore((s) => s.fermenters);
  const addFermenter = useBreweryStore((s) => s.addFermenter);
  const updateFermenter = useBreweryStore((s) => s.updateFermenter);
  const deleteFermenter = useBreweryStore((s) => s.deleteFermenter);
  const cleanFermenter = useBreweryStore((s) => s.cleanFermenter);
  const markFermenterDirty = useBreweryStore((s) => s.markFermenterDirty);
  const assignBatchToFermenter = useBreweryStore((s) => s.assignBatchToFermenter);
  const releaseFermenter = useBreweryStore((s) => s.releaseFermenter);

  return useMemo(
    () => ({
      fermenters,
      addFermenter,
      updateFermenter,
      deleteFermenter,
      cleanFermenter,
      markFermenterDirty,
      assignBatchToFermenter,
      releaseFermenter,
    }),
    [
      fermenters,
      addFermenter,
      updateFermenter,
      deleteFermenter,
      cleanFermenter,
      markFermenterDirty,
      assignBatchToFermenter,
      releaseFermenter,
    ]
  );
}

export function useIngredientById(ingredientId: string) {
  return useBreweryStore(
    useCallback(
      (s: BreweryStore) => s.inventory.find((i) => i.id === ingredientId),
      [ingredientId]
    )
  );
}

export function useBatchData() {
  const batches = useBreweryStore((s) => s.batches);
  const addBatch = useBreweryStore((s) => s.addBatch);
  const updateBatch = useBreweryStore((s) => s.updateBatch);
  const deleteBatch = useBreweryStore((s) => s.deleteBatch);
  const addFermentationLog = useBreweryStore((s) => s.addFermentationLog);
  const deleteFermentationLog = useBreweryStore((s) => s.deleteFermentationLog);
  const addSensoryProfile = useBreweryStore((s) => s.addSensoryProfile);
  const deleteSensoryProfile = useBreweryStore((s) => s.deleteSensoryProfile);
  const addQualityLog = useBreweryStore((s) => s.addQualityLog);
  const deleteQualityLog = useBreweryStore((s) => s.deleteQualityLog);

  return useMemo(
    () => ({
      batches,
      addBatch,
      updateBatch,
      deleteBatch,
      addFermentationLog,
      deleteFermentationLog,
      addSensoryProfile,
      deleteSensoryProfile,
      addQualityLog,
      deleteQualityLog,
    }),
    [
      batches,
      addBatch,
      updateBatch,
      deleteBatch,
      addFermentationLog,
      deleteFermentationLog,
      addSensoryProfile,
      deleteSensoryProfile,
      addQualityLog,
      deleteQualityLog,
    ]
  );
}

export function useInventoryData() {
  const inventory = useBreweryStore((s) => s.inventory);
  const kegs = useBreweryStore((s) => s.kegs);
  const bottles = useBreweryStore((s) => s.bottles);
  const addIngredient = useBreweryStore((s) => s.addIngredient);
  const editIngredient = useBreweryStore((s) => s.editIngredient);
  const deleteIngredient = useBreweryStore((s) => s.deleteIngredient);
  const updateInventory = useBreweryStore((s) => s.updateInventory);
  const addKeg = useBreweryStore((s) => s.addKeg);
  const updateKeg = useBreweryStore((s) => s.updateKeg);
  const updateKegStatus = useBreweryStore((s) => s.updateKegStatus);
  const fillKegFromBatch = useBreweryStore((s) => s.fillKegFromBatch);
  const bottleFromKeg = useBreweryStore((s) => s.bottleFromKeg);
  const deleteKeg = useBreweryStore((s) => s.deleteKeg);
  const addBottleStock = useBreweryStore((s) => s.addBottleStock);
  const updateBottleStock = useBreweryStore((s) => s.updateBottleStock);
  const deleteBottleStock = useBreweryStore((s) => s.deleteBottleStock);

  return useMemo(
    () => ({
      inventory,
      kegs,
      bottles,
      addIngredient,
      editIngredient,
      deleteIngredient,
      updateInventory,
      addKeg,
      updateKeg,
      updateKegStatus,
      fillKegFromBatch,
      bottleFromKeg,
      deleteKeg,
      addBottleStock,
      updateBottleStock,
      deleteBottleStock,
    }),
    [
      inventory,
      kegs,
      bottles,
      addIngredient,
      editIngredient,
      deleteIngredient,
      updateInventory,
      addKeg,
      updateKeg,
      updateKegStatus,
      fillKegFromBatch,
      bottleFromKeg,
      deleteKeg,
      addBottleStock,
      updateBottleStock,
      deleteBottleStock,
    ]
  );
}

export function useFinancialData() {
  const sales = useBreweryStore((s) => s.sales);
  const expenses = useBreweryStore((s) => s.expenses);
  const customers = useBreweryStore((s) => s.customers);
  const payments = useBreweryStore((s) => s.payments);
  const financialHistory = useBreweryStore((s) => s.financialHistory);
  const addSale = useBreweryStore((s) => s.addSale);
  const updateSale = useBreweryStore((s) => s.updateSale);
  const deleteSale = useBreweryStore((s) => s.deleteSale);
  const addExpense = useBreweryStore((s) => s.addExpense);
  const deleteExpense = useBreweryStore((s) => s.deleteExpense);
  const addCustomer = useBreweryStore((s) => s.addCustomer);
  const updateCustomer = useBreweryStore((s) => s.updateCustomer);
  const deleteCustomer = useBreweryStore((s) => s.deleteCustomer);
  const addPayment = useBreweryStore((s) => s.addPayment);
  const closeMonth = useBreweryStore((s) => s.closeMonth);

  return useMemo(
    () => ({
      sales,
      expenses,
      customers,
      payments,
      financialHistory,
      addSale,
      updateSale,
      deleteSale,
      addExpense,
      deleteExpense,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addPayment,
      closeMonth,
    }),
    [
      sales,
      expenses,
      customers,
      payments,
      financialHistory,
      addSale,
      updateSale,
      deleteSale,
      addExpense,
      deleteExpense,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addPayment,
      closeMonth,
    ]
  );
}

export function useSettingsData() {
  const settings = useBreweryStore((s) => s.settings);
  const updateSettings = useBreweryStore((s) => s.updateSettings);
  const downloadBackup = useBreweryStore((s) => s.downloadBackup);
  const restoreBackup = useBreweryStore((s) => s.restoreBackup);

  return useMemo(
    () => ({
      settings,
      updateSettings,
      downloadBackup,
      restoreBackup,
    }),
    [settings, updateSettings, downloadBackup, restoreBackup]
  );
}

export function useCalendarData() {
  const calendarEvents = useBreweryStore((s) => s.calendarEvents);
  const masterRecipes = useBreweryStore((s) => s.masterRecipes);
  const addCalendarEvent = useBreweryStore((s) => s.addCalendarEvent);
  const updateCalendarEvent = useBreweryStore((s) => s.updateCalendarEvent);
  const deleteCalendarEvent = useBreweryStore((s) => s.deleteCalendarEvent);
  const addMasterRecipe = useBreweryStore((s) => s.addMasterRecipe);
  const updateMasterRecipe = useBreweryStore((s) => s.updateMasterRecipe);
  const deleteMasterRecipe = useBreweryStore((s) => s.deleteMasterRecipe);

  return useMemo(
    () => ({
      calendarEvents,
      masterRecipes,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addMasterRecipe,
      updateMasterRecipe,
      deleteMasterRecipe,
    }),
    [
      calendarEvents,
      masterRecipes,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addMasterRecipe,
      updateMasterRecipe,
      deleteMasterRecipe,
    ]
  );
}

export function useShoppingData() {
  const shoppingList = useBreweryStore((s) => s.shoppingList);
  const addShoppingItem = useBreweryStore((s) => s.addShoppingItem);
  const toggleShoppingItem = useBreweryStore((s) => s.toggleShoppingItem);
  const deleteShoppingItem = useBreweryStore((s) => s.deleteShoppingItem);

  return useMemo(
    () => ({
      shoppingList,
      addShoppingItem,
      toggleShoppingItem,
      deleteShoppingItem,
    }),
    [shoppingList, addShoppingItem, toggleShoppingItem, deleteShoppingItem]
  );
}

export function useLoadingState() {
  return useBreweryStore((s) => s.isLoading);
}
