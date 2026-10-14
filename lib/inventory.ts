import { Ingredient } from '../types';

export type InventoryHealth = 'FRESH' | 'LOW_STOCK' | 'USE_SOON' | 'OLD' | 'OUT';

const MASS_UNITS_TO_KG: Record<string, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.453592,
};

const VOLUME_UNITS_TO_L: Record<string, number> = {
  L: 1,
  ml: 0.001,
  gal: 3.78541,
};

const COUNT_UNITS: Record<string, number> = {
  u: 1,
  pack: 1,
  cajas: 1,
  paq: 1,
};

const getDaysOld = (purchaseDate: string): number => {
  if (!purchaseDate || typeof purchaseDate !== 'string') return 0;
  const time = Date.parse(purchaseDate);
  if (isNaN(time) || time <= 0) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
};

export const normalizeToBaseUnit = (amount: number, unit: string): number | null => {
  if (MASS_UNITS_TO_KG[unit] !== undefined) return amount * MASS_UNITS_TO_KG[unit];
  if (VOLUME_UNITS_TO_L[unit] !== undefined) return amount * VOLUME_UNITS_TO_L[unit];
  if (COUNT_UNITS[unit] !== undefined) return amount * COUNT_UNITS[unit];
  return null;
};

export const getReorderThreshold = (ingredient: Ingredient): number => {
  if (ingredient.type === 'PACKAGING') return 50;
  if (ingredient.type === 'YEAST') return 2;
  return 5;
};

export const getInventoryHealth = (ingredient: Ingredient): InventoryHealth => {
  const daysOld = getDaysOld(ingredient.purchaseDate);
  const stockAmount = Math.max(0, ingredient.stockAmount);

  if (stockAmount <= 0) return 'OUT';

  // For reorder threshold comparison, normalize to base unit when possible
  const normalized = normalizeToBaseUnit(stockAmount, ingredient.unit);
  const threshold = getReorderThreshold(ingredient);
  
  // When unit is not recognized (normalized === null), compare raw stockAmount against threshold
  // For unrecognized units, assume the threshold applies directly
  const comparableAmount = normalized !== null ? normalized : stockAmount;
  if (comparableAmount < threshold) return 'LOW_STOCK';

  if ((ingredient.type === 'HOP' && daysOld > 365) || (ingredient.type === 'MALT' && daysOld > 365) || (ingredient.type === 'YEAST' && daysOld > 90)) {
    return 'OLD';
  }
  if ((ingredient.type === 'HOP' && daysOld > 60) || (ingredient.type === 'YEAST' && daysOld > 30)) {
    return 'USE_SOON';
  }
  return 'FRESH';
};

export const getSuggestedReorderAmount = (ingredient: Ingredient): number | null => {
  const normalized = normalizeToBaseUnit(Math.max(0, ingredient.stockAmount), ingredient.unit);
  const threshold = getReorderThreshold(ingredient);
  if (normalized === null) return null;
  if (normalized >= threshold) return 0;
  return parseFloat((threshold - normalized).toFixed(2));
};
