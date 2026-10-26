/**
 * @fileoverview calculatorBridge.ts — Puente entre el asistente IA (texto/voz) y la suite visual
 * de calculadoras (`components/Calculators.tsx`).
 *
 * Flujo:
 * 1. Una tool de cálculo (`services/ai/tools.ts`) devuelve `calculatorLinks: [{ type, params }]`.
 * 2. `geminiService` serializa el link en el texto final como
 *    `[ABRIR_CALCULADORA: {"type":"KETTLE","params":{...}}]` (también soporta sintaxis JS relajada
 *    como `[ABRIR_CALCULADORA: { type: 'kettle', params: { diameter: 35, height: 58 } }]`).
 * 3. `AiConsultant` extrae los tags con `extractCalculatorLinks` y renderiza Action Cards.
 * 4. Al hacer clic, `openCalculatorFromAi` deja los parámetros "en espera", navega a la vista
 *    de Calculadoras y la calculadora correspondiente los consume con `useCalculatorPrefill`.
 */

import { useEffect, useState } from 'react';
import { ViewState } from '../../types';

// ============================================================================
// 1. TIPOS
// ============================================================================

/** Identificadores de calculadora (deben coincidir con `CalculatorType` de Calculators.tsx). */
export type CalculatorKind =
  | 'KETTLE'
  | 'STRIKE'
  | 'SPARGE'
  | 'CARB'
  | 'REFRACTOMETER'
  | 'DENSITY'
  | 'PITCH'
  | 'STARTER'
  | 'ACID'
  | 'DILUTION'
  | 'ABV'
  | 'PRIMING'
  | 'IBU'
  | 'COLOR'
  | 'EFFICIENCY'
  | 'RECIPE'
  | 'DRY_HOP'
  | 'COLD_CRASH'
  | 'CALORIES'
  | 'PARTIGYLE'
  | 'WATER_CHEM'
  | 'EQUIPMENT';

export type CalculatorParams = Record<string, number | string>;

export interface CalculatorDeepLink {
  type: CalculatorKind;
  params: CalculatorParams;
}

const VALID_KINDS: readonly CalculatorKind[] = [
  'KETTLE',
  'STRIKE',
  'SPARGE',
  'CARB',
  'REFRACTOMETER',
  'DENSITY',
  'PITCH',
  'STARTER',
  'ACID',
  'DILUTION',
  'ABV',
  'PRIMING',
  'IBU',
  'COLOR',
  'EFFICIENCY',
  'RECIPE',
  'DRY_HOP',
  'COLD_CRASH',
  'CALORIES',
  'PARTIGYLE',
  'WATER_CHEM',
  'EQUIPMENT',
];

const KIND_ALIASES: Record<string, CalculatorKind> = {
  KETTLE_VOLUME: 'KETTLE',
  OLLA: 'KETTLE',
  STRIKE_WATER: 'STRIKE',
  EMPASTE: 'STRIKE',
  SPARGE_WATER: 'SPARGE',
  LAVADO: 'SPARGE',
  CARBONATION: 'CARB',
  CARBONATACION: 'CARB',
  HYDROMETER: 'DENSITY',
  DENSIMETRO: 'DENSITY',
  PITCH_RATE: 'PITCH',
  YEAST: 'PITCH',
  LEVADURA: 'PITCH',
  PH: 'ACID',
  BOILOFF: 'DILUTION',
  SRM: 'COLOR',
};

/** Normalización de alias de claves de parámetros (ej. `diameter` -> `diameterCm`, `height` -> `liquidHeightCm`). */
const PARAM_KEY_ALIASES: Record<string, string> = {
  diameter: 'diameterCm',
  diametro: 'diameterCm',
  height: 'liquidHeightCm',
  altura: 'liquidHeightCm',
  liquidHeight: 'liquidHeightCm',
  grainKg: 'grainWeightKg',
  mashTempC: 'targetMashTempC',
  mashRatio: 'waterToGrainRatioLKg',
  ratio: 'waterToGrainRatioLKg',
  tempC: 'beerTempC',
  vols: 'targetCO2Volumes',
  volumesCo2: 'targetCO2Volumes',
  ogBrix: 'originalBrix',
  fgBrix: 'currentBrix',
  finalBrix: 'currentBrix',
  wcf: 'wortCorrectionFactor',
  sampleTempC: 'measuredTempC',
};

/** Etiquetas legibles para las Action Cards del chat. */
export const CALCULATOR_LABELS: Record<CalculatorKind, string> = {
  KETTLE: 'Volumen de Olla',
  STRIKE: 'Temperatura de Empaste',
  SPARGE: 'Agua de Lavado',
  CARB: 'Carbonatación Forzada',
  REFRACTOMETER: 'Corrección de Refractómetro',
  DENSITY: 'Corrección de Densímetro',
  PITCH: 'Tasa de Inoculación',
  STARTER: 'Starter de Levadura',
  ACID: 'Acidificación (pH)',
  DILUTION: 'Dilución / Hervor',
  ABV: 'Alcohol (ABV)',
  PRIMING: 'Priming',
  IBU: 'Amargor (IBU)',
  COLOR: 'Color (SRM / EBC)',
  EFFICIENCY: 'Eficiencia de Equipo',
  RECIPE: 'Diseño de Receta',
  DRY_HOP: 'Tasa de Dry Hop',
  COLD_CRASH: 'Rampa de Frío',
  CALORIES: 'Calorías Cerveza',
  PARTIGYLE: 'Parti-gyle',
  WATER_CHEM: 'Química de Agua',
  EQUIPMENT: 'Termodinámica de Equipos',
};

/** Etiquetas legibles de parámetros para mostrar en la tarjeta. */
export const PARAM_LABELS: Record<string, string> = {
  diameterCm: 'Diámetro (cm)',
  liquidHeightCm: 'Altura líquido (cm)',
  grainWeightKg: 'Grano (kg)',
  targetMashTempC: 'Macerado (°C)',
  grainTempC: 'Grano (°C)',
  waterToGrainRatioLKg: 'Relación (L/kg)',
  thermalLossC: 'Pérdida (°C)',
  totalWaterL: 'Agua total (L)',
  preBoilVolumeL: 'Pre-hervor (L)',
  absorptionLPerKg: 'Absorción (L/kg)',
  deadSpaceL: 'Espacio muerto (L)',
  beerTempC: 'Cerveza (°C)',
  targetCO2Volumes: 'Vol. CO₂',
  originalBrix: 'Brix inicial',
  currentBrix: 'Brix actual',
  wortCorrectionFactor: 'WCF',
  measuredGravity: 'SG medida',
  measuredTempC: 'Muestra (°C)',
  calibrationTempC: 'Calibración (°C)',
  volumeL: 'Volumen (L)',
  batchVolumeL: 'Volumen (L)',
  targetOG: 'OG',
  yeastType: 'Levadura',
  pitchStyle: 'Levadura',
  cellsPerPackBillions: 'Células/paq. (B)',
  viabilityPercent: 'Viabilidad (%)',
  starterVolumeL: 'Starter (L)',
  starterGravity: 'SG starter',
  waterVolumeL: 'Agua (L)',
  alkalinityPpm: 'Alcalinidad (ppm)',
  targetPh: 'pH objetivo',
  acidType: 'Ácido',
  currentGravity: 'SG actual',
  currentVolumeL: 'Volumen actual (L)',
  targetGravity: 'SG objetivo',
  og: 'OG',
  fg: 'FG',
  temperatureC: 'Temp. (°C)',
};

// ============================================================================
// 2. SERIALIZACIÓN / PARSEO DE TAGS EN EL TEXTO DEL CHAT
// ============================================================================

export const CALCULATOR_TAG_REGEX = /\[ABRIR_CALCULADORA:\s*(\{[\s\S]*?\})\s*\]/g;

/**
 * Convierte sintaxis JS relajada (ej. `{ type: 'kettle', params: { diameter: 35, height: 58 } }`)
 * a JSON estricto antes de parsear.
 */
function parseRelaxedJsonObject(rawJson: string): unknown {
  try {
    return JSON.parse(rawJson);
  } catch {
    try {
      const normalized = rawJson
        .replace(/'([^']*)'/g, '"$1"')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }
}

/** Normaliza y valida un link crudo (por ejemplo, proveniente de JSON o sintaxis JS). */
export function normalizeCalculatorLink(raw: unknown): CalculatorDeepLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const rawType = String(rec.type ?? '').toUpperCase().trim();
  const type = (VALID_KINDS.includes(rawType as CalculatorKind)
    ? rawType
    : KIND_ALIASES[rawType]) as CalculatorKind | undefined;
  if (!type || !VALID_KINDS.includes(type)) return null;

  const params: CalculatorParams = {};
  if (rec.params && typeof rec.params === 'object') {
    for (const [rawKey, v] of Object.entries(rec.params as Record<string, unknown>)) {
      const canonicalKey = PARAM_KEY_ALIASES[rawKey] || rawKey;
      if (typeof v === 'number' && Number.isFinite(v)) {
        params[canonicalKey] = v;
        if (canonicalKey !== rawKey) params[rawKey] = v;
      } else if (typeof v === 'string' && v.trim()) {
        params[canonicalKey] = v.trim();
        if (canonicalKey !== rawKey) params[rawKey] = v.trim();
      }
    }
  }

  // Asegurar compatibilidad cruzada en PITCH y CARB
  if (type === 'PITCH') {
    if (params.volumeL !== undefined && params.batchVolumeL === undefined) {
      params.batchVolumeL = params.volumeL;
    }
    if (params.batchVolumeL !== undefined && params.volumeL === undefined) {
      params.volumeL = params.batchVolumeL;
    }
    if (params.targetOG !== undefined && params.og === undefined) {
      params.og = params.targetOG;
    }
    if (params.og !== undefined && params.targetOG === undefined) {
      params.targetOG = params.og;
    }
    if (params.yeastType !== undefined && params.pitchStyle === undefined) {
      params.pitchStyle = String(params.yeastType).toUpperCase();
    }
  }

  return { type, params };
}

/** Serializa un link como tag embebible en el texto de respuesta. */
export function serializeCalculatorTag(link: CalculatorDeepLink): string {
  return `[ABRIR_CALCULADORA: ${JSON.stringify(link)}]`;
}

/** Extrae los links del texto y devuelve el texto limpio (sin tags). */
export function extractCalculatorLinks(text: string): {
  cleanText: string;
  links: CalculatorDeepLink[];
} {
  const links: CalculatorDeepLink[] = [];
  const seen = new Set<string>();
  const cleanText = (text || '')
    .replace(CALCULATOR_TAG_REGEX, (_m, json: string) => {
      const parsed = parseRelaxedJsonObject(json);
      const link = normalizeCalculatorLink(parsed);
      if (link) {
        const key = `${link.type}:${JSON.stringify(link.params)}`;
        if (!seen.has(key)) {
          seen.add(key);
          links.push(link);
        }
      }
      return '';
    })
    .trim();
  return { cleanText, links };
}

/** Elimina los tags de un texto (para reenviar historial al LLM o leer en voz alta). */
export function stripCalculatorTags(text: string): string {
  return (text || '').replace(CALCULATOR_TAG_REGEX, '').trim();
}

// ============================================================================
// 3. ESTADO "PENDIENTE" Y NAVEGACIÓN
// ============================================================================

export const CALCULATOR_OPEN_EVENT = 'bon:open-calculator';
const STORAGE_KEY = 'bon_pending_calculator';

let pending: CalculatorDeepLink | null = null;

function readPending(): CalculatorDeepLink | null {
  if (pending) return pending;
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (raw) pending = normalizeCalculatorLink(parseRelaxedJsonObject(raw));
  } catch {
    pending = null;
  }
  return pending;
}

/** Devuelve (sin consumir) el link pendiente. */
export function peekPendingCalculator(): CalculatorDeepLink | null {
  return readPending();
}

/** Limpia el link pendiente si corresponde al tipo indicado (o cualquiera si no se indica). */
export function clearPendingCalculator(type?: CalculatorKind): void {
  const current = readPending();
  if (!current || (type && current.type !== type)) return;
  pending = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin storage
  }
}

/**
 * Abre la calculadora indicada con los parámetros precargados:
 * guarda el link pendiente, navega a la vista CALCULATORS y notifica a la vista si ya está montada.
 */
export function openCalculatorFromAi(
  linkOrType: CalculatorDeepLink | CalculatorKind | string,
  params?: CalculatorParams
): void {
  const normalized =
    typeof linkOrType === 'string'
      ? normalizeCalculatorLink({ type: linkOrType, params: params ?? {} })
      : normalizeCalculatorLink(linkOrType);

  if (!normalized) return;

  pending = normalized;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // sin storage: queda en memoria
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bon:navigate', { detail: { view: ViewState.CALCULATORS } }));
  window.dispatchEvent(new CustomEvent(CALCULATOR_OPEN_EVENT, { detail: normalized }));
}

/**
 * Hook para calculadoras: devuelve los parámetros precargados por la IA (si el link pendiente
 * corresponde a este tipo) y lo limpia luego del montaje. Seguro ante el doble render de StrictMode
 * porque la lectura en el inicializador no es destructiva.
 */
export function useCalculatorPrefill(type: CalculatorKind): CalculatorParams {
  const [params] = useState<CalculatorParams>(() => {
    const p = peekPendingCalculator();
    return p && p.type === type ? p.params : {};
  });
  useEffect(() => {
    clearPendingCalculator(type);
  }, [type]);
  return params;
}

/** Helpers de lectura tipada de parámetros precargados. */
export const prefillNum = (params: CalculatorParams, key: string, fallback: number): number => {
  const v = params[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const prefillStr = <T extends string>(
  params: CalculatorParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T => {
  const v = String(params[key] ?? '').toUpperCase() as T;
  return allowed.includes(v) ? v : fallback;
};