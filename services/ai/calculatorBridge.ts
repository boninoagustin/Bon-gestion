/**
 * @fileoverview calculatorBridge.ts — Puente entre el asistente IA (texto/voz) y la suite visual
 * de calculadoras (`components/Calculators.tsx`).
 *
 * Flujo:
 * 1. Una tool de cálculo (`services/ai/tools.ts`) devuelve `calculatorLink: { type, params }`.
 * 2. `geminiService` serializa el link en el texto final como
 *    `[ABRIR_CALCULADORA: {"type":"KETTLE","params":{...}}]` (solo en modo texto).
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
  | 'PRIMING';

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
];

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
  targetOG: 'OG',
  yeastType: 'Levadura',
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

/** Normaliza y valida un link crudo (por ejemplo, proveniente de JSON parseado). */
export function normalizeCalculatorLink(raw: unknown): CalculatorDeepLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const type = String(rec.type ?? '').toUpperCase().trim() as CalculatorKind;
  if (!VALID_KINDS.includes(type)) return null;
  const params: CalculatorParams = {};
  if (rec.params && typeof rec.params === 'object') {
    for (const [k, v] of Object.entries(rec.params as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) params[k] = v;
      else if (typeof v === 'string' && v.trim()) params[k] = v.trim();
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
      try {
        const link = normalizeCalculatorLink(JSON.parse(json));
        if (link) {
          const key = JSON.stringify(link);
          if (!seen.has(key)) {
            seen.add(key);
            links.push(link);
          }
        }
      } catch {
        // Tag malformado: se descarta silenciosamente.
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
    if (raw) pending = normalizeCalculatorLink(JSON.parse(raw));
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
  linkOrType: CalculatorDeepLink | CalculatorKind,
  params?: CalculatorParams
): void {
  const link: CalculatorDeepLink =
    typeof linkOrType === 'string'
      ? { type: linkOrType, params: params ?? {} }
      : linkOrType;

  pending = link;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  } catch {
    // sin storage: queda en memoria
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bon:navigate', { detail: { view: ViewState.CALCULATORS } }));
  window.dispatchEvent(new CustomEvent(CALCULATOR_OPEN_EVENT, { detail: link }));
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
