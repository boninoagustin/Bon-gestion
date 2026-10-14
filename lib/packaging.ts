import { Keg } from '../types';

export const getKegDaysOut = (keg: Keg): number => {
  if (keg.status !== 'WITH_CLIENT' || !keg.dateDispatched) return 0;
  const date = new Date(keg.dateDispatched);
  if (isNaN(date.getTime())) return 0;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  return Math.max(0, days);
};

export const isKegLate = (keg: Keg, thresholdDays = 20): boolean => {
  return getKegDaysOut(keg) > thresholdDays;
};

export const getKegFillPercentage = (keg: Keg): number => {
  const currentVol = keg.currentVolume !== undefined ? keg.currentVolume : keg.size;
  if (!keg.size || keg.size <= 0) return 0;
  if (currentVol <= 0) return 0;
  return Math.min(100, Math.max(0, (currentVol / keg.size) * 100));
};

export const safeAmount = (val: unknown): number =>
  typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0;
