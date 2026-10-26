/**
 * @fileoverview calcTools.ts — Herramientas de Function Calling de ingeniería cervecera que exponen
 * las funciones puras de `lib/brewmath.ts` al agente BON (Gemini / OpenAI IPC / motor offline).
 *
 * Cada herramienta:
 * 1. Valida y sanitiza estrictamente los argumentos (`ArgReader` + `sanitizePositiveNumber`). Si faltan
 *    parámetros obligatorios NO inventa valores: devuelve `{ error, needsUserInput: true, missingParameters, askUser }`
 *    para que el modelo pregunte exactamente los datos faltantes (slot-filling).
 * 2. Ejecuta la función de `lib/brewmath.ts` correspondiente.
 * 3. Devuelve resultados redondeados + `summary` (texto técnico legible) + `spokenSummary`
 *    (frase natural para TTS) + `calculatorLinks` (deep link a la calculadora visual con valores
 *    precargados).
 */

import {
  calculateABV,
  calculateABVAdvanced,
  calculateAcidAddition,
  calculateCarbonationPressure,
  calculateDilutionWater,
  calculateKettleVolume,
  calculatePitchingRate,
  calculatePriming,
  calculateSpargeVolumes,
  calculateStrikeTemp,
  calculateYeastStarter,
  correctGravity,
  correctRefractometerReading,
  AcidType,
  sanitizeGravity,
  sanitizeNumber,
  sanitizePositiveNumber,
  sgToPlato,
  YeastPitchStyle,
} from '../../lib/brewmath';
import type { ToolResult } from './actions';
import { CalculatorDeepLink, serializeCalculatorTag } from './calculatorBridge';
import { normalizeTranscript } from './voiceText';

// ============================================================================
// 1. UTILIDADES DE VALIDACIÓN (SLOT-FILLING)
// ============================================================================

type Raw = Record<string, unknown>;

const isProvided = (v: unknown): boolean =>
  v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');

/** Redondeo numérico seguro. */
const r = (n: number, d = 2): number => {
  const f = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Formato es-AR para frases habladas/legibles ("55,8"). */
const fmt = (n: number, d = 1): string =>
  r(n, d).toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Formato de densidad con punto fijo de 3 decimales ("1.050"). */
const fmtSG = (sg: number): string => sg.toFixed(3);

interface NumberRule {
  label: string;
  min: number;
  max: number;
  aliases?: string[];
  /** Si se define, el parámetro es opcional y usa este valor por defecto (registrado como supuesto). */
  defaultValue?: number;
  /** Texto del supuesto cuando se usa el valor por defecto */
  assumption?: string;
  allowNegative?: boolean;
}

/**
 * Lector de argumentos que acumula parámetros faltantes y errores de rango,
 * sin lanzar excepciones ni inventar datos.
 */
class ArgReader {
  readonly missing: string[] = [];
  readonly errors: string[] = [];
  readonly assumptions: string[] = [];

  constructor(private readonly raw: Raw) {}

  private pick(key: string, aliases: string[] = []): unknown {
    for (const k of [key, ...aliases]) {
      if (isProvided(this.raw[k])) return this.raw[k];
    }
    return undefined;
  }

  has(key: string, aliases: string[] = []): boolean {
    return this.pick(key, aliases) !== undefined;
  }

  num(key: string, rule: NumberRule): number {
    const rawVal = this.pick(key, rule.aliases);
    if (rawVal === undefined) {
      if (rule.defaultValue !== undefined) {
        if (rule.assumption) this.assumptions.push(rule.assumption);
        return rule.defaultValue;
      }
      this.missing.push(rule.label);
      return NaN;
    }
    const parsed = rule.allowNegative
      ? sanitizeNumber(rawVal, {
          fallback: NaN,
          allowNegative: true,
          min: -Infinity,
          max: Infinity,
        })
      : sanitizePositiveNumber(rawVal, NaN, Infinity);
    if (!Number.isFinite(parsed)) {
      this.errors.push(`${rule.label}: valor no numérico ("${String(rawVal)}").`);
      return NaN;
    }
    if (parsed < rule.min || parsed > rule.max) {
      this.errors.push(
        `${rule.label} fuera de rango físico (${parsed}). Rango válido: ${rule.min} a ${rule.max}.`
      );
      return NaN;
    }
    return parsed;
  }

  gravity(key: string, label: string, aliases: string[] = [], defaultValue?: number): number {
    const rawVal = this.pick(key, aliases);
    if (rawVal === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      this.missing.push(label);
      return NaN;
    }
    const sg = sanitizeGravity(rawVal, NaN);
    if (!Number.isFinite(sg) || sg < 0.98 || sg > 1.2) {
      this.errors.push(
        `${label} inválida ("${String(rawVal)}"). Usá formato 1.050 o 1050 (rango 0.980 a 1.200).`
      );
      return NaN;
    }
    return sg;
  }

  oneOf<T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
    synonyms: Record<string, T> = {},
    aliases: string[] = []
  ): T {
    const rawVal = this.pick(key, aliases);
    if (rawVal === undefined) return fallback;
    const k = String(rawVal)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    if ((allowed as readonly string[]).includes(k)) return k as T;
    const syn = synonyms[k.toLowerCase()];
    if (syn) return syn;
    return fallback;
  }

  str(key: string): string | undefined {
    const v = this.pick(key);
    return typeof v === 'string' ? v.trim() : undefined;
  }

  /** Devuelve el resultado de error si hay faltantes o errores; `null` si todo está OK. */
  failure(toolHint: string): ToolResult | null {
    if (this.missing.length > 0) {
      return {
        error: `Faltan datos obligatorios para ${toolHint}: ${this.missing.join(', ')}.`,
        needsUserInput: true,
        missingParameters: [...this.missing],
        askUser: `Preguntale al usuario, en tono rioplatense y breve, exactamente estos datos: ${this.missing.join(
          ' y '
        )}. NO inventes ni asumas valores.`,
      };
    }
    if (this.errors.length > 0) {
      return {
        error: this.errors.join(' '),
        needsUserInput: true,
        askUser: 'Pedile al usuario que confirme o corrija el/los valor(es) indicados.',
      };
    }
    return null;
  }
}

const link = (type: CalculatorDeepLink['type'], params: CalculatorDeepLink['params']): CalculatorDeepLink => ({
  type,
  params,
});

const todayIso = (): string => new Date().toLocaleDateString('en-CA');

// ============================================================================
// 2. EJECUTORES
// ============================================================================

/** Volumen geométrico de olla cilíndrica. */
export function executeKettleVolume(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const diameterCm = a.num('diameterCm', {
    label: 'diámetro interior de la olla (cm)',
    min: 5,
    max: 600,
    aliases: ['diameter', 'diametro'],
  });

  let liquidHeightCm: number;
  const kettleHeightCm = a.has('kettleHeightCm')
    ? a.num('kettleHeightCm', { label: 'altura total de la olla (cm)', min: 5, max: 800 })
    : NaN;

  if (!a.has('liquidHeightCm', ['height', 'altura']) && a.has('emptyFromRimCm') && Number.isFinite(kettleHeightCm)) {
    const empty = a.num('emptyFromRimCm', { label: 'distancia del borde al líquido (cm)', min: 0, max: 800 });
    liquidHeightCm = kettleHeightCm - empty;
    a.assumptions.push(
      `Altura de líquido calculada como altura de olla (${fmt(kettleHeightCm)} cm) menos espacio libre (${fmt(empty)} cm).`
    );
  } else {
    liquidHeightCm = a.num('liquidHeightCm', {
      label: 'altura del líquido (cm)',
      min: 0.1,
      max: 800,
      aliases: ['height', 'altura'],
    });
  }

  const fail = a.failure('calcular el volumen de la olla');
  if (fail) return fail;

  if (Number.isFinite(kettleHeightCm) && liquidHeightCm > kettleHeightCm) {
    return {
      error: `La altura del líquido (${liquidHeightCm} cm) no puede superar la altura total de la olla (${kettleHeightCm} cm).`,
      needsUserInput: true,
    };
  }

  const volumeL = calculateKettleVolume(diameterCm, liquidHeightCm);
  const litersPerCm = calculateKettleVolume(diameterCm, 1);
  const totalCapacityL = Number.isFinite(kettleHeightCm)
    ? calculateKettleVolume(diameterCm, kettleHeightCm)
    : undefined;

  const summary =
    `Volumen actual: ${fmt(volumeL)} L (olla de ${fmt(diameterCm)} cm de diámetro con ${fmt(liquidHeightCm)} cm de líquido). ` +
    `Cada centímetro de altura equivale a ${fmt(litersPerCm, 2)} L.` +
    (totalCapacityL !== undefined
      ? ` Capacidad total: ${fmt(totalCapacityL)} L (libre: ${fmt(totalCapacityL - volumeL)} L).`
      : '');

  return {
    success: true,
    calculation: 'kettle_volume',
    formula: 'V = π × (D/2)² × H / 1000',
    inputs: { diameterCm, liquidHeightCm, kettleHeightCm: totalCapacityL !== undefined ? kettleHeightCm : undefined },
    volumeL: r(volumeL, 1),
    litersPerCm: r(litersPerCm, 3),
    totalCapacityL: totalCapacityL !== undefined ? r(totalCapacityL, 1) : undefined,
    freeCapacityL: totalCapacityL !== undefined ? r(totalCapacityL - volumeL, 1) : undefined,
    assumptions: a.assumptions,
    summary,
    spokenSummary: `Con ${fmt(diameterCm)} centímetros de diámetro y ${fmt(liquidHeightCm)} de altura tenés aproximadamente ${fmt(volumeL)} litros en la olla.`,
    calculatorLinks: [link('KETTLE', { diameterCm, liquidHeightCm })],
  };
}

/** Temperatura y volumen de agua de empaste (strike). */
export function executeStrikeWater(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const grainWeightKg = a.num('grainWeightKg', {
    label: 'peso total de grano (kg)',
    min: 0.1,
    max: 10000,
    aliases: ['grainKg'],
  });
  const targetMashTempC = a.num('targetMashTempC', {
    label: 'temperatura objetivo de macerado (°C)',
    min: 40,
    max: 80,
    aliases: ['mashTempC'],
  });
  const grainTempC = a.num('grainTempC', {
    label: 'temperatura del grano (°C)',
    min: -10,
    max: 50,
    allowNegative: true,
    defaultValue: 20,
    assumption: 'Temperatura del grano asumida: 20 °C (ambiente).',
  });
  const ratio = a.num('waterToGrainRatioLKg', {
    label: 'relación agua/grano (L/kg)',
    min: 1.5,
    max: 8,
    aliases: ['mashRatio', 'waterToGrainRatio', 'mashRatioLKg', 'ratio'],
    defaultValue: 3,
    assumption: 'Relación agua/grano asumida: 3 L/kg.',
  });
  const thermalLossC = a.num('thermalLossC', {
    label: 'pérdida térmica del equipo (°C)',
    min: 0,
    max: 15,
    defaultValue: 1,
    assumption: 'Pérdida térmica del macerador asumida: 1 °C.',
  });

  const fail = a.failure('calcular el agua de empaste');
  if (fail) return fail;

  const strikeTempC = calculateStrikeTemp(ratio, targetMashTempC, grainTempC, thermalLossC);
  const mashWaterL = grainWeightKg * ratio;
  const totalMashVolumeL = mashWaterL + grainWeightKg * 0.67;

  return {
    success: true,
    calculation: 'strike_water',
    formula: 'T_strike = (0.41 / R) × (T_mash − T_grano) + T_mash + ΔT_equipo',
    inputs: { grainWeightKg, targetMashTempC, grainTempC, waterToGrainRatioLKg: ratio, thermalLossC },
    strikeTempC: r(strikeTempC, 1),
    mashWaterL: r(mashWaterL, 1),
    totalMashVolumeL: r(totalMashVolumeL, 1),
    assumptions: a.assumptions,
    summary:
      `Calentá ${fmt(mashWaterL)} L de agua a ${fmt(strikeTempC)} °C para empastar ${fmt(grainWeightKg)} kg de grano ` +
      `y estabilizar en ${fmt(targetMashTempC)} °C. Volumen total del macerado ≈ ${fmt(totalMashVolumeL)} L.`,
    spokenSummary: `Calentá ${fmt(mashWaterL)} litros de agua a ${fmt(strikeTempC)} grados para llegar a ${fmt(targetMashTempC)} grados de macerado.`,
    calculatorLinks: [
      link('STRIKE', { grainWeightKg, targetMashTempC, grainTempC, waterToGrainRatioLKg: ratio, thermalLossC }),
    ],
  };
}

/** Balance hídrico de lavado (sparge) a partir del volumen pre-hervor objetivo. */
export function executeSpargeWater(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const preBoilVolumeL = a.num('preBoilVolumeL', {
    label: 'volumen objetivo en olla pre-hervor (L)',
    min: 1,
    max: 50000,
    aliases: ['targetKettleVolumeL', 'kettleVolumeL'],
  });
  const grainWeightKg = a.num('grainWeightKg', {
    label: 'peso total de grano (kg)',
    min: 0.1,
    max: 10000,
    aliases: ['grainKg'],
  });
  const ratio = a.num('waterToGrainRatioLKg', {
    label: 'relación agua/grano (L/kg)',
    min: 1.5,
    max: 8,
    aliases: ['mashRatio', 'waterToGrainRatio'],
    defaultValue: 3,
    assumption: 'Relación de empaste asumida: 3 L/kg.',
  });
  const absorptionLPerKg = a.num('absorptionLPerKg', {
    label: 'absorción del grano (L/kg)',
    min: 0.3,
    max: 2.5,
    defaultValue: 1.0,
    assumption: 'Absorción del grano asumida: 1,0 L/kg.',
  });
  const deadSpaceL = a.num('deadSpaceL', {
    label: 'espacio muerto del macerador (L)',
    min: 0,
    max: 5000,
    defaultValue: 0,
    assumption: 'Espacio muerto del macerador asumido: 0 L.',
  });

  const fail = a.failure('calcular el agua de lavado');
  if (fail) return fail;

  const totalWaterL = preBoilVolumeL + grainWeightKg * absorptionLPerKg + deadSpaceL;
  const res = calculateSpargeVolumes(totalWaterL, grainWeightKg, ratio, absorptionLPerKg, deadSpaceL);
  const warnings: string[] = [];
  if (res.mashWaterL > totalWaterL) {
    warnings.push(
      'El agua de empaste ya supera el agua total necesaria: bajá la relación agua/grano o hacé macerado sin lavado (no-sparge).'
    );
  }

  return {
    success: true,
    calculation: 'sparge_water',
    inputs: { preBoilVolumeL, grainWeightKg, waterToGrainRatioLKg: ratio, absorptionLPerKg, deadSpaceL },
    totalWaterL: r(totalWaterL, 1),
    mashWaterL: r(res.mashWaterL, 1),
    spargeWaterL: r(res.spargeWaterL, 1),
    grainAbsorptionL: r(res.grainAbsorptionL, 1),
    firstRunningsL: r(res.firstRunningsL, 1),
    preBoilVolumeL: r(res.preBoilVolumeL, 1),
    warnings,
    assumptions: a.assumptions,
    summary:
      `Agua total: ${fmt(totalWaterL)} L → empaste ${fmt(res.mashWaterL)} L + lavado ${fmt(res.spargeWaterL)} L. ` +
      `El grano retiene ${fmt(res.grainAbsorptionL)} L y recolectás ${fmt(res.preBoilVolumeL)} L pre-hervor.`,
    spokenSummary: `Necesitás ${fmt(res.spargeWaterL)} litros de agua de lavado, además de ${fmt(res.mashWaterL)} litros de empaste.`,
    calculatorLinks: [
      link('SPARGE', {
        totalWaterL: r(totalWaterL, 1),
        grainWeightKg,
        waterToGrainRatioLKg: ratio,
        absorptionLPerKg,
        deadSpaceL,
      }),
    ],
  };
}

/** Presión de carbonatación forzada (Zahm & Nagel / ASBC). */
export function executeCarbonation(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const beerTempC = a.num('beerTempC', {
    label: 'temperatura de la cerveza (°C)',
    min: -2,
    max: 30,
    allowNegative: true,
    aliases: ['temperatureC', 'tempC'],
  });
  const targetCO2Volumes = a.num('targetCO2Volumes', {
    label: 'volúmenes de CO2 objetivo',
    min: 1,
    max: 5,
    aliases: ['targetVolumes', 'co2Volumes', 'volumesCo2', 'vols'],
  });
  const fail = a.failure('calcular la presión de carbonatación');
  if (fail) return fail;

  const styleId = a.str('styleId');
  const res = calculateCarbonationPressure(beerTempC, targetCO2Volumes, styleId);
  const warnings: string[] = [];
  if (res.style && !res.inStyleRange) {
    warnings.push(
      `${targetCO2Volumes} vol está fuera del rango de ${res.style.name} (${res.style.minVols}-${res.style.maxVols} vol).`
    );
  }

  return {
    success: true,
    calculation: 'carbonation_pressure',
    formula: 'Zahm & Nagel / ASBC (Ley de Henry)',
    inputs: { beerTempC, targetCO2Volumes, styleId },
    psi: r(res.psi, 1),
    bar: r(res.bar, 2),
    kpa: r(res.kpa, 0),
    warnings,
    summary: `Para ${fmt(targetCO2Volumes, 2)} vol de CO2 a ${fmt(beerTempC)} °C regulá a ${fmt(res.psi)} PSI (${fmt(res.bar, 2)} bar). Dejá equilibrar 5 a 7 días.`,
    spokenSummary: `Para ${fmt(targetCO2Volumes, 2)} volúmenes a ${fmt(beerTempC)} grados poné el regulador en ${fmt(res.psi)} PSI, o sea ${fmt(res.bar, 2)} bar.`,
    calculatorLinks: [link('CARB', { beerTempC, targetCO2Volumes })],
  };
}

/** Corrección de refractómetro con alcohol presente (Terrill / Novotny). */
export function executeRefractometerCorrection(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const originalBrix = a.num('originalBrix', {
    label: 'Brix inicial (antes de fermentar)',
    min: 1,
    max: 40,
    aliases: ['ogBrix'],
  });
  const currentBrix = a.num('currentBrix', {
    label: 'Brix actual (con alcohol)',
    min: 0,
    max: 40,
    aliases: ['fgBrix', 'finalBrix', 'fg'],
  });
  const wcf = a.num('wortCorrectionFactor', {
    label: 'factor de corrección de mosto (WCF)',
    min: 0.9,
    max: 1.2,
    aliases: ['wcf'],
    defaultValue: 1.04,
    assumption: 'Factor de corrección de mosto (WCF) asumido: 1,04.',
  });
  const fail = a.failure('corregir la lectura del refractómetro');
  if (fail) return fail;
  if (currentBrix > originalBrix) {
    return {
      error: `El Brix actual (${currentBrix}) no puede ser mayor al Brix inicial (${originalBrix}). Confirmá las lecturas.`,
      needsUserInput: true,
    };
  }
  const model = a.oneOf('model', ['TERRILL', 'NOVOTNY', 'AUTO'] as const, 'AUTO');
  const res = correctRefractometerReading(originalBrix, currentBrix, wcf, model);

  return {
    success: true,
    calculation: 'refractometer_correction',
    inputs: { originalBrix, currentBrix, wortCorrectionFactor: wcf, model },
    activeModel: res.activeModel,
    originalGravity: r(res.ogSG, 4),
    finalGravity: r(res.fgSG, 4),
    correctedFg: r(res.fgSG, 4),
    originalPlato: r(res.ogPlato, 2),
    apparentExtractPlato: r(res.apparentExtractPlato, 2),
    realExtractPlato: r(res.realExtractPlato, 2),
    abv: r(res.abvHall, 2),
    abvLinear: r(res.abvStandard, 2),
    apparentAttenuation: r(res.apparentAttenuation, 1),
    assumptions: a.assumptions,
    summary:
      `FG corregida: ${fmtSG(res.fgSG)} (${fmt(res.apparentExtractPlato)} °P) desde OG ${fmtSG(res.ogSG)} ` +
      `(modelo ${res.activeModel}). ABV ≈ ${fmt(res.abvHall)} %, atenuación aparente ${fmt(res.apparentAttenuation)} %.`,
    spokenSummary: `La densidad final corregida es ${fmtSG(res.fgSG)}, con alrededor de ${fmt(res.abvHall)} por ciento de alcohol.`,
    calculatorLinks: [
      link('REFRACTOMETER', { originalBrix, currentBrix, wortCorrectionFactor: wcf }),
    ],
  };
}

/** Corrección de densímetro por temperatura de la muestra (Thiesen). */
export function executeHydrometerTempCorrection(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const measuredGravity = a.gravity('measuredGravity', 'lectura del densímetro', ['gravity', 'sg']);
  const measuredTempC = a.num('measuredTempC', {
    label: 'temperatura de la muestra (°C)',
    min: 0,
    max: 100,
    aliases: ['sampleTempC', 'tempC'],
  });
  const calibrationTempC = a.num('calibrationTempC', {
    label: 'temperatura de calibración del densímetro (°C)',
    min: 10,
    max: 30,
    defaultValue: 20,
    assumption: 'Densímetro calibrado a 20 °C (verificá si el tuyo es de 15 °C).',
  });
  const fail = a.failure('corregir la densidad por temperatura');
  if (fail) return fail;

  const corrected = correctGravity(measuredGravity, measuredTempC, calibrationTempC);
  const deltaPoints = (corrected - measuredGravity) * 1000;

  return {
    success: true,
    calculation: 'hydrometer_temperature_correction',
    inputs: { measuredGravity, measuredTempC, calibrationTempC },
    correctedGravity: r(corrected, 4),
    correctedPlato: r(sgToPlato(corrected), 2),
    correctionPoints: r(deltaPoints, 1),
    assumptions: a.assumptions,
    summary: `Lectura ${fmtSG(measuredGravity)} a ${fmt(measuredTempC)} °C → densidad corregida ${fmtSG(corrected)} (${deltaPoints >= 0 ? '+' : ''}${fmt(deltaPoints)} puntos, calibración ${fmt(calibrationTempC)} °C).`,
    spokenSummary: `La densidad corregida es ${fmtSG(corrected)}.`,
    calculatorLinks: [link('DENSITY', { measuredGravity, measuredTempC, calibrationTempC })],
  };
}

const YEAST_SYNONYMS: Record<string, YeastPitchStyle> = {
  ale: 'ALE',
  lager: 'LAGER',
  hybrid: 'HYBRID',
  hibrida: 'HYBRID',
  kolsch: 'HYBRID',
};

/** Tasa de inoculación + starter recomendado (Braukaiser). */
export function executePitchRateAndStarter(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const volumeL = a.num('volumeL', {
    label: 'volumen del lote en fermentador (L)',
    min: 1,
    max: 50000,
    aliases: ['batchVolumeL', 'batchVolumeLiters', 'wortVolumeL', 'volume'],
  });
  const targetOG = a.gravity('targetOG', 'densidad original (OG)', ['og', 'wortGravity']);
  const yeastType = a.oneOf(
    'yeastType',
    ['ALE', 'LAGER', 'HYBRID', 'HIGH_GRAVITY_ALE', 'HIGH_GRAVITY_LAGER'] as const,
    'ALE',
    YEAST_SYNONYMS,
    ['pitchStyle', 'style']
  );
  const yeastFormat = a.oneOf('yeastFormat', ['LIQUID', 'DRY'] as const, 'LIQUID', {
    liquida: 'LIQUID',
    seca: 'DRY',
  });
  const cellsPerPackBillions = a.num('cellsPerPackBillions', {
    label: 'células por paquete (miles de millones)',
    min: 1,
    max: 2000,
    defaultValue: 100,
    assumption: 'Paquete líquido estándar asumido: 100 mil millones de células.',
  });
  const packsAvailable = a.num('packsAvailable', {
    label: 'paquetes disponibles',
    min: 0,
    max: 1000,
    defaultValue: 1,
  });

  const fail = a.failure('calcular la tasa de inoculación');
  if (fail) return fail;

  let viabilityPercent = 100;
  let ageDays: number | undefined;
  const manufactureDate = a.str('manufactureDate');
  if (a.has('viabilityPercent')) {
    viabilityPercent = a.num('viabilityPercent', { label: 'viabilidad (%)', min: 1, max: 100 });
  } else if (manufactureDate && /^\d{4}-\d{2}-\d{2}/.test(manufactureDate) && yeastFormat === 'LIQUID') {
    const diffMs =
      new Date(`${todayIso()}T12:00:00`).getTime() -
      new Date(`${manufactureDate.slice(0, 10)}T12:00:00`).getTime();
    if (Number.isFinite(diffMs)) {
      ageDays = Math.max(0, Math.round(diffMs / 86400000));
      viabilityPercent = Math.max(10, Math.min(100, 100 - ageDays * 0.7));
    }
  }
  if (!Number.isFinite(viabilityPercent)) viabilityPercent = 100;

  const pitch = calculatePitchingRate({
    batchVolumeL: volumeL,
    og: targetOG,
    yeastType,
    cellsPerPackBillions,
    viabilityPercent,
  });

  const result: ToolResult = {
    success: true,
    calculation: 'pitch_rate',
    inputs: { volumeL, targetOG, yeastType, yeastFormat, cellsPerPackBillions, viabilityPercent: r(viabilityPercent, 0), manufactureDate, ageDays },
    plato: r(pitch.plato, 2),
    pitchRateMillionCellsPerMlPlato: pitch.targetRateCellsPerMlPlato,
    effectiveStyle: pitch.effectiveStyle,
    isHighGravity: pitch.isHighGravity,
    totalCellsBillions: r(pitch.totalCellsBillions, 0),
    cellsNeededBillions: r(pitch.totalCellsBillions, 0),
    packsNeeded: Math.ceil(pitch.packsNeeded),
    dryYeastGrams: r(pitch.dryYeastGrams, 0),
    assumptions: a.assumptions,
  };

  const links: CalculatorDeepLink[] = [
    link('PITCH', {
      volumeL,
      batchVolumeL: volumeL,
      targetOG,
      og: targetOG,
      yeastType,
      pitchStyle: yeastType,
      cellsPerPackBillions,
      viabilityPercent: r(viabilityPercent, 0),
    }),
  ];

  let starterText = '';
  let starterSpoken = '';
  if (yeastFormat === 'LIQUID') {
    const availableCells = packsAvailable * cellsPerPackBillions * (viabilityPercent / 100);
    const deficit = pitch.totalCellsBillions - availableCells;
    if (deficit > 0) {
      const starterGravity = 1.036;
      const growthPerLiter = 10 * sgToPlato(starterGravity) * 1.4;
      const starterL = Math.ceil((deficit / growthPerLiter) * 2) / 2;
      const starter = calculateYeastStarter(starterL, starterGravity, availableCells);
      result.starter = {
        needed: true,
        volumeL: starter.volumeL,
        gravity: starterGravity,
        dmeGrams: r(starter.dmeGrams, 0),
        estimatedFinalCellsBillions: r(starter.estimatedFinalCellsBillions, 0),
        startingCellsBillions: r(availableCells, 0),
      };
      starterText = ` Con ${fmt(packsAvailable, 0)} paquete(s) al ${fmt(viabilityPercent, 0)} % te faltan ${fmt(deficit, 0)} B de células: hacé un starter de ${fmt(starter.volumeL)} L a ${fmtSG(starterGravity)} con ${fmt(starter.dmeGrams, 0)} g de DME (en agitador).`;
      starterSpoken = ` Necesitás un starter de ${fmt(starter.volumeL)} litros con ${fmt(starter.dmeGrams, 0)} gramos de extracto seco.`;
      links.push(link('STARTER', { starterVolumeL: starter.volumeL, starterGravity }));
    } else {
      result.starter = { needed: false };
      starterText = ` Con ${fmt(packsAvailable, 0)} paquete(s) alcanza, no hace falta starter.`;
      starterSpoken = ' No hace falta starter.';
    }
  }

  result.summary =
    `Necesitás ${fmt(pitch.totalCellsBillions, 0)} mil millones de células (${pitch.targetRateCellsPerMlPlato} M cel/mL/°P, ${fmt(pitch.plato)} °P` +
    `${pitch.isHighGravity ? ', alta densidad' : ''}) ≈ ${Math.ceil(pitch.packsNeeded)} paquete(s) líquido(s) o ${fmt(pitch.dryYeastGrams, 0)} g de levadura seca.` +
    starterText;
  result.spokenSummary =
    `Necesitás unos ${fmt(pitch.totalCellsBillions, 0)} mil millones de células, o sea ${Math.ceil(pitch.packsNeeded)} paquetes líquidos o ${fmt(pitch.dryYeastGrams, 0)} gramos de levadura seca.` +
    starterSpoken;
  result.calculatorLinks = links;
  return result;
}

const ACID_SYNONYMS: Record<string, AcidType> = {
  lactico: 'LACTIC',
  lactic: 'LACTIC',
  fosforico: 'PHOSPHORIC',
  phosphoric: 'PHOSPHORIC',
  citrico: 'CITRIC',
  citric: 'CITRIC',
};

/** Dosificación de ácido para neutralizar alcalinidad y llegar al pH objetivo. */
export function executeAcidAddition(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const waterVolumeL = a.num('waterVolumeL', {
    label: 'volumen de agua a tratar (L)',
    min: 1,
    max: 100000,
    aliases: ['volumeL'],
  });
  const alkalinityPpm = a.num('alkalinityPpm', {
    label: 'alcalinidad del agua (ppm como CaCO3)',
    min: 0,
    max: 1000,
    aliases: ['alkalinity'],
  });
  const targetPh = a.num('targetPh', {
    label: 'pH objetivo',
    min: 4.5,
    max: 6.5,
    defaultValue: 5.4,
    assumption: 'pH objetivo de macerado asumido: 5,4.',
  });
  const acidType = a.oneOf('acidType', ['LACTIC', 'PHOSPHORIC', 'CITRIC'] as const, 'LACTIC', ACID_SYNONYMS);
  const fail = a.failure('calcular la adición de ácido');
  if (fail) return fail;

  const res = calculateAcidAddition(waterVolumeL, alkalinityPpm, targetPh, acidType);
  const acidName =
    acidType === 'LACTIC' ? 'ácido láctico 88 %' : acidType === 'PHOSPHORIC' ? 'ácido fosfórico 85 %' : 'ácido cítrico';

  return {
    success: true,
    calculation: 'acid_addition',
    inputs: { waterVolumeL, alkalinityPpm, targetPh, acidType },
    amount: r(res.amount, 1),
    acidDoseMl: r(res.amount, 1),
    unit: res.unit,
    acidName,
    neutralizedAlkalinityPpm: r(res.neutralizedAlkalinityPpm, 0),
    assumptions: a.assumptions,
    summary: `Agregá ${fmt(res.amount)} ${res.unit === 'ml' ? 'mL' : 'g'} de ${acidName} a ${fmt(waterVolumeL, 0)} L para neutralizar ${fmt(res.neutralizedAlkalinityPpm, 0)} ppm de alcalinidad (pH objetivo ${fmt(targetPh, 2)}). Agregá de a poco y medí.`,
    spokenSummary: `Agregá ${fmt(res.amount)} ${res.unit === 'ml' ? 'mililitros' : 'gramos'} de ${acidName.replace('%', 'por ciento')}.`,
    calculatorLinks: [link('ACID', { waterVolumeL, alkalinityPpm, targetPh, acidType })],
  };
}

/** Ajuste de densidad por dilución (agregar agua) o por hervor/evaporación. */
export function executeDilutionAndBoiloff(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const currentGravity = a.gravity('currentGravity', 'densidad actual', ['gravity']);
  const currentVolumeL = a.num('currentVolumeL', {
    label: 'volumen actual de mosto (L)',
    min: 0.5,
    max: 100000,
    aliases: ['volumeL'],
  });
  const targetGravity = a.gravity('targetGravity', 'densidad objetivo');
  const evaporationRateLPerHour = a.has('evaporationRateLPerHour')
    ? a.num('evaporationRateLPerHour', { label: 'tasa de evaporación (L/h)', min: 0.1, max: 5000 })
    : undefined;
  const fail = a.failure('ajustar la densidad');
  if (fail) return fail;

  const p1 = (currentGravity - 1) * 1000;
  const p2 = (targetGravity - 1) * 1000;
  if (p1 <= 0 || p2 <= 0) {
    return { error: 'Las densidades deben ser mayores a 1.000.', needsUserInput: true };
  }

  if (Math.abs(p1 - p2) < 0.05) {
    return {
      success: true,
      calculation: 'gravity_adjustment',
      mode: 'NONE',
      summary: `La densidad actual (${fmtSG(currentGravity)}) ya coincide con la objetivo. No hace falta ajustar.`,
      spokenSummary: 'Ya estás en la densidad objetivo, no hace falta ajustar.',
    };
  }

  if (p2 < p1) {
    const waterToAddL = calculateDilutionWater(currentGravity, currentVolumeL, targetGravity);
    const finalVolumeL = currentVolumeL + waterToAddL;
    return {
      success: true,
      calculation: 'gravity_adjustment',
      mode: 'DILUTION',
      formula: 'V_final = V × (SG_actual − 1) / (SG_objetivo − 1)',
      inputs: { currentGravity, currentVolumeL, targetGravity },
      waterToAddL: r(waterToAddL, 1),
      finalVolumeL: r(finalVolumeL, 1),
      summary: `Agregá ${fmt(waterToAddL)} L de agua para bajar de ${fmtSG(currentGravity)} a ${fmtSG(targetGravity)}. Volumen final: ${fmt(finalVolumeL)} L.`,
      spokenSummary: `Agregá ${fmt(waterToAddL)} litros de agua para bajar de ${fmtSG(currentGravity)} a ${fmtSG(targetGravity)}.`,
      calculatorLinks: [link('DILUTION', { currentGravity, currentVolumeL, targetGravity })],
    };
  }

  const finalVolumeL = (p1 * currentVolumeL) / p2;
  const evaporateL = currentVolumeL - finalVolumeL;
  const minutes =
    evaporationRateLPerHour !== undefined ? (evaporateL / evaporationRateLPerHour) * 60 : undefined;
  return {
    success: true,
    calculation: 'gravity_adjustment',
    mode: 'BOILOFF',
    formula: 'V_final = V × (SG_actual − 1) / (SG_objetivo − 1)',
    inputs: { currentGravity, currentVolumeL, targetGravity, evaporationRateLPerHour },
    evaporateL: r(evaporateL, 1),
    finalVolumeL: r(finalVolumeL, 1),
    extraBoilMinutes: minutes !== undefined ? r(minutes, 0) : undefined,
    summary:
      `Para subir de ${fmtSG(currentGravity)} a ${fmtSG(targetGravity)} tenés que evaporar ${fmt(evaporateL)} L (quedan ${fmt(finalVolumeL)} L)` +
      (minutes !== undefined ? `: unos ${fmt(minutes, 0)} min extra de hervor a ${fmt(evaporationRateLPerHour as number)} L/h.` : '. Alternativa: agregar extracto seco (DME).'),
    spokenSummary:
      `Tenés que evaporar ${fmt(evaporateL)} litros para llegar a ${fmtSG(targetGravity)}` +
      (minutes !== undefined ? `, unos ${fmt(minutes, 0)} minutos más de hervor.` : '.'),
  };
}

/** ABV con validación estricta (sin valores inventados). */
export function executeAbv(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const og = a.gravity('og', 'densidad inicial (OG)', ['originalGravity']);
  const fg = a.gravity('fg', 'densidad final (FG)', ['finalGravity']);
  const fail = a.failure('calcular el alcohol');
  if (fail) return fail;
  if (og <= fg) {
    return {
      error: `La densidad inicial (${fmtSG(og)}) debe ser mayor a la final (${fmtSG(fg)}).`,
      needsUserInput: true,
    };
  }
  const adv = calculateABVAdvanced(og, fg);
  const linear = calculateABV(og, fg);
  return {
    success: true,
    calculation: 'abv',
    inputs: { og, fg },
    abv: r(linear, 2),
    abvNonlinear: r(adv.abv, 2),
    apparentAttenuation: r(adv.apparentAttenuation, 1),
    realAttenuation: r(adv.realAttenuation, 1),
    unit: '%',
    summary: `ABV: ${fmt(linear, 2)} % (fórmula estándar; Hall/ASBC: ${fmt(adv.abv, 2)} %) con OG ${fmtSG(og)} y FG ${fmtSG(fg)}. Atenuación aparente: ${fmt(adv.apparentAttenuation)} %.`,
    spokenSummary: `Con ${fmtSG(og)} de inicial y ${fmtSG(fg)} de final tenés ${fmt(linear)} por ciento de alcohol, con ${fmt(adv.apparentAttenuation, 0)} por ciento de atenuación.`,
    calculatorLinks: [link('ABV', { og, fg })],
  };
}

/** Priming con validación estricta. */
export function executePriming(raw: Raw): ToolResult {
  const a = new ArgReader(raw);
  const volumeLiters = a.num('volumeLiters', {
    label: 'volumen a envasar (L)',
    min: 0.5,
    max: 50000,
    aliases: ['volumeL'],
  });
  const targetVolumes = a.num('targetVolumes', {
    label: 'volúmenes de CO2 objetivo',
    min: 1,
    max: 5,
    aliases: ['targetCO2Volumes'],
  });
  const temperatureC = a.num('temperatureC', {
    label: 'temperatura máxima post-fermentación (°C)',
    min: -2,
    max: 40,
    allowNegative: true,
  });
  const fail = a.failure('calcular el priming');
  if (fail) return fail;
  const table = calculatePriming(volumeLiters, temperatureC, targetVolumes, 'TABLE');
  const dex = calculatePriming(volumeLiters, temperatureC, targetVolumes, 'DEXTROSE');
  return {
    success: true,
    calculation: 'priming',
    inputs: { volumeLiters, targetVolumes, temperatureC },
    residualCO2: r(table.residualCO2, 2),
    dextroseGrams: r(dex.totalGrams, 1),
    tableSugarGrams: r(table.totalGrams, 1),
    sugarGrams: r(table.totalGrams, 1),
    tableSugarPerBottle500ml: r(table.perBottle500ml, 2),
    summary: `Para ${fmt(volumeLiters)} L a ${fmt(targetVolumes, 2)} vol: ${fmt(table.totalGrams, 0)} g de azúcar de mesa o ${fmt(dex.totalGrams, 0)} g de dextrosa (CO2 residual ${fmt(table.residualCO2, 2)} vol).`,
    spokenSummary: `Usá ${fmt(table.totalGrams, 0)} gramos de azúcar de mesa o ${fmt(dex.totalGrams, 0)} gramos de dextrosa.`,
    calculatorLinks: [
      link('PRIMING', { volumeL: volumeLiters, temperatureC, targetCO2Volumes: targetVolumes }),
    ],
  };
}

// ============================================================================
// 3. DECLARACIONES JSON-SCHEMA PARA EL LLM
// ============================================================================

const n = (description: string) => ({ type: 'number' as const, description });
const s = (description: string, extra: Record<string, unknown> = {}) => ({
  type: 'string' as const,
  description,
  ...extra,
});
const o = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object' as const,
  properties,
  ...(required.length ? { required } : {}),
});

const SLOT_NOTE =
  ' Si el usuario no dio los datos obligatorios, NO llames la herramienta con valores inventados: preguntale primero.';

export const calcToolDeclarations = [
  {
    name: 'calculate_kettle_volume',
    description:
      'Calcula los litros de líquido en una olla/macerador/tanque cilíndrico a partir del diámetro interior y la altura del líquido (V = π·(D/2)²·H/1000). Devuelve volumen actual, litros por cm y capacidad total si se pasa la altura de la olla.' +
      SLOT_NOTE,
    parameters: o(
      {
        diameterCm: n('Diámetro INTERIOR de la olla en centímetros (ej: 35)'),
        liquidHeightCm: n('Altura de la columna de líquido en centímetros (ej: 58)'),
        kettleHeightCm: n('(Opcional) Altura total interior de la olla en cm, para capacidad total'),
        emptyFromRimCm: n('(Opcional) Distancia medida desde el borde hasta el líquido en cm (requiere kettleHeightCm)'),
      },
      ['diameterCm', 'liquidHeightCm']
    ),
  },
  {
    name: 'calculate_strike_water',
    description:
      'Calcula la temperatura del agua de empaste (strike) y el volumen de agua de macerado (ecuación de Palmer).' +
      SLOT_NOTE,
    parameters: o(
      {
        grainWeightKg: n('Peso total de grano en kg'),
        targetMashTempC: n('Temperatura objetivo del macerado en °C (ej: 66)'),
        grainTempC: n('(Opcional) Temperatura del grano en °C (default 20)'),
        waterToGrainRatioLKg: n('(Opcional) Relación agua/grano en L/kg (default 3)'),
        thermalLossC: n('(Opcional) Pérdida térmica del macerador en °C (default 1)'),
      },
      ['grainWeightKg', 'targetMashTempC']
    ),
  },
  {
    name: 'calculate_sparge_water',
    description:
      'Calcula el balance de agua: agua total, agua de empaste y agua de lavado (sparge) necesarias para llegar a un volumen pre-hervor objetivo.' +
      SLOT_NOTE,
    parameters: o(
      {
        preBoilVolumeL: n('Volumen objetivo a recolectar en la olla antes de hervir (L)'),
        grainWeightKg: n('Peso total de grano en kg'),
        waterToGrainRatioLKg: n('(Opcional) Relación de empaste L/kg (default 3)'),
        absorptionLPerKg: n('(Opcional) Absorción del grano en L/kg (default 1.0)'),
        deadSpaceL: n('(Opcional) Espacio muerto / falso fondo del macerador en L (default 0)'),
      },
      ['preBoilVolumeL', 'grainWeightKg']
    ),
  },
  {
    name: 'calculate_carbonation',
    description:
      'Calcula la presión de CO2 (PSI y bar) para carbonatación forzada en barril según temperatura de la cerveza y volúmenes de CO2 objetivo (Zahm & Nagel).' +
      SLOT_NOTE,
    parameters: o(
      {
        beerTempC: n('Temperatura de la cerveza en el barril/tanque en °C'),
        targetCO2Volumes: n('Volúmenes de CO2 deseados (ej: 2.5)'),
        styleId: s('(Opcional) Estilo para validar rango (ej: "AMERICAN_IPA")'),
      },
      ['beerTempC', 'targetCO2Volumes']
    ),
  },
  {
    name: 'calculate_refractometer_correction',
    description:
      'Corrige lecturas de refractómetro con alcohol presente (Terrill/Novotny): devuelve FG corregida (SG y °Plato), OG, ABV y atenuación.' +
      SLOT_NOTE,
    parameters: o(
      {
        originalBrix: n('Lectura Brix ANTES de fermentar'),
        currentBrix: n('Lectura Brix actual (cerveza fermentando/fermentada)'),
        wortCorrectionFactor: n('(Opcional) Factor de corrección de mosto WCF (default 1.04)'),
        model: s('(Opcional) Modelo: TERRILL, NOVOTNY o AUTO', { enum: ['TERRILL', 'NOVOTNY', 'AUTO'] }),
      },
      ['originalBrix', 'currentBrix']
    ),
  },
  {
    name: 'calculate_hydrometer_temp_correction',
    description:
      'Corrige una lectura de densímetro según la temperatura de la muestra y la temperatura de calibración del instrumento.' +
      SLOT_NOTE,
    parameters: o(
      {
        measuredGravity: n('Lectura del densímetro (ej: 1.048 o 1048)'),
        measuredTempC: n('Temperatura de la muestra en °C'),
        calibrationTempC: n('(Opcional) Temperatura de calibración del densímetro en °C (default 20)'),
      },
      ['measuredGravity', 'measuredTempC']
    ),
  },
  {
    name: 'calculate_pitch_rate_and_starter',
    description:
      'Calcula las células de levadura necesarias, paquetes o gramos de levadura seca, y el starter recomendado (litros y gramos de DME) según volumen, OG, tipo de cepa y fecha de fabricación.' +
      SLOT_NOTE,
    parameters: o(
      {
        volumeL: n('Volumen de mosto en fermentador (L)'),
        targetOG: n('Densidad original (ej: 1.050)'),
        yeastType: s('(Opcional) Tipo de cepa: ALE, LAGER o HYBRID (default ALE)', {
          enum: ['ALE', 'LAGER', 'HYBRID', 'HIGH_GRAVITY_ALE', 'HIGH_GRAVITY_LAGER'],
        }),
        yeastFormat: s('(Opcional) LIQUID o DRY (default LIQUID)', { enum: ['LIQUID', 'DRY'] }),
        manufactureDate: s('(Opcional) Fecha de fabricación del paquete líquido YYYY-MM-DD (estima viabilidad)'),
        viabilityPercent: n('(Opcional) Viabilidad conocida en % (sobrescribe la estimación por fecha)'),
        cellsPerPackBillions: n('(Opcional) Células por paquete en miles de millones (default 100)'),
        packsAvailable: n('(Opcional) Paquetes disponibles para el starter (default 1)'),
      },
      ['volumeL', 'targetOG']
    ),
  },
  {
    name: 'calculate_acid_addition',
    description:
      'Calcula la cantidad de ácido (láctico 88%, fosfórico 85% o cítrico) para neutralizar la alcalinidad del agua y ajustar el pH de macerado/lavado.' +
      SLOT_NOTE,
    parameters: o(
      {
        waterVolumeL: n('Volumen de agua a tratar (L)'),
        alkalinityPpm: n('Alcalinidad del agua en ppm como CaCO3'),
        targetPh: n('(Opcional) pH objetivo (default 5.4)'),
        acidType: s('(Opcional) LACTIC, PHOSPHORIC o CITRIC (default LACTIC)', {
          enum: ['LACTIC', 'PHOSPHORIC', 'CITRIC'],
        }),
      },
      ['waterVolumeL', 'alkalinityPpm']
    ),
  },
  {
    name: 'calculate_dilution_and_boiloff',
    description:
      'Ajusta la densidad del mosto: si la objetivo es menor calcula los litros de agua a agregar (dilución); si es mayor calcula los litros a evaporar y minutos extra de hervor.' +
      SLOT_NOTE,
    parameters: o(
      {
        currentGravity: n('Densidad actual (ej: 1.060)'),
        currentVolumeL: n('Volumen actual de mosto (L)'),
        targetGravity: n('Densidad objetivo (ej: 1.050)'),
        evaporationRateLPerHour: n('(Opcional) Tasa de evaporación del equipo en L/h'),
      },
      ['currentGravity', 'currentVolumeL', 'targetGravity']
    ),
  },
];

/** Mapa nombre → ejecutor para registrar en el despachador de `tools.ts`. */
export const calcToolHandlers: Record<string, (args: Raw) => ToolResult> = {
  calculate_kettle_volume: executeKettleVolume,
  calculate_strike_water: executeStrikeWater,
  calculate_sparge_water: executeSpargeWater,
  calculate_carbonation: executeCarbonation,
  calculate_refractometer_correction: executeRefractometerCorrection,
  calculate_hydrometer_temp_correction: executeHydrometerTempCorrection,
  calculate_pitch_rate_and_starter: executePitchRateAndStarter,
  calculate_acid_addition: executeAcidAddition,
  calculate_dilution_and_boiloff: executeDilutionAndBoiloff,
  calculate_abv: executeAbv,
  calculate_priming: executePriming,
};

/** Nombres de todas las herramientas de cálculo (útil para detectar deep links). */
export const CALC_TOOL_NAMES = new Set(Object.keys(calcToolHandlers));

/**
 * Parser determinista para resolver consultas de cálculo comunes en modo local offline
 * (sin conexión a internet o cuota de API agotada).
 */
export function tryOfflineCalculation(userQuery: string, isVoiceMode: boolean = false): string | null {
  if (!userQuery) return null;
  const normalized = normalizeTranscript(userQuery);
  const q = normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const numExtractor = (regexList: RegExp[]): number | undefined => {
    for (const re of regexList) {
      const match = q.match(re);
      if (match && match[1]) {
        const val = Number(match[1].replace(',', '.'));
        if (Number.isFinite(val)) return val;
      }
    }
    return undefined;
  };

  // 1. VOLUMEN DE OLLA
  if (/volumen.*olla|olla.*volumen|litros.*olla|olla.*litros|capacidad.*olla|olla.*alto|olla.*diametro/.test(q)) {
    const diameter = numExtractor([
      /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetros?)?\s*(?:de\s+)?diametro/,
      /diametro\s*(?:de\s+|:\s*|\s+)?(\d+(?:[.,]\d+)?)/,
    ]);
    const height = numExtractor([
      /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetros?)?\s*(?:de\s+)?(?:alto|altura|liquido)/,
      /(?:alto|altura|liquido|profundidad)\s*(?:de\s+|:\s*|\s+)?(\d+(?:[.,]\d+)?)/,
    ]);

    if (diameter !== undefined && height !== undefined) {
      const res = executeKettleVolume({ diameterCm: diameter, liquidHeightCm: height });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcularte el volumen exacto de la olla necesito dos datos: el diámetro interior en cm y la altura del líquido en cm. ¿Qué medidas tenés?';
  }

  // 2. CARBONATACIÓN FORZADA
  if (/carbonat|psi|barril.*co2|co2.*barril|presion.*co2/.test(q)) {
    const temp = numExtractor([
      /(?:temp|temperatura|a)\s*(-?\d+(?:[.,]\d+)?)\s*(?:°|grados|c\b)/,
      /(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c|grados)/,
    ]);
    const vols = numExtractor([
      /(\d+(?:[.,]\d+)?)\s*(?:vol|volumenes|vols)/,
      /(?:volumenes|vols?)\s*(?:de\s+)?(\d+(?:[.,]\d+)?)/,
    ]);

    if (temp !== undefined && vols !== undefined) {
      const res = executeCarbonation({ beerTempC: temp, targetCO2Volumes: vols });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcularte la presión de carbonatación en PSI necesito saber la temperatura de la cerveza en el barril (°C) y los volúmenes de CO2 objetivo. ¿Qué valores tenés?';
  }

  // 3. ALCOHOL / ABV / ATENUACIÓN
  if (/\babv\b|alcohol|atenuacion|graduacion/.test(q)) {
    const gravities = Array.from(q.matchAll(/\b(1[.,]\d{3}|\d{4})\b/g)).map((m) => {
      const num = Number(m[1].replace(',', '.'));
      return num >= 980 && num <= 1200 ? num / 1000 : num;
    });

    let og: number | undefined;
    let fg: number | undefined;

    if (gravities.length >= 2) {
      const sorted = [...gravities].sort((a, b) => b - a);
      og = sorted[0];
      fg = sorted[1];
    } else {
      const ogMatch = q.match(/(?:og|inicial|original)\D*(\d+(?:[.,]\d+)?)/);
      const fgMatch = q.match(/(?:fg|final)\D*(\d+(?:[.,]\d+)?)/);
      if (ogMatch) og = sanitizeGravity(ogMatch[1], 0);
      if (fgMatch) fg = sanitizeGravity(fgMatch[1], 0);
    }

    if (og && fg && og > fg) {
      const res = executeAbv({ og, fg });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcular el porcentaje de alcohol (ABV) necesito la Densidad Original (OG) y la Densidad Final (FG). ¿Cuáles mediste?';
  }

  // 4. TEMPERATURA DE STRIKE (EMPASTE)
  if (/strike|empaste|agua.*macerado|macerado.*agua/.test(q)) {
    const grain = numExtractor([
      /(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)/,
      /(?:grano|malta)\D*(\d+(?:[.,]\d+)?)/,
    ]);
    const mashTemp = numExtractor([
      /(?:macerar|macerado|objetivo)\D*(\d+(?:[.,]\d+)?)\s*(?:°|grados)?/,
      /(\d+(?:[.,]\d+)?)\s*(?:°|grados)/,
    ]);

    if (grain !== undefined && mashTemp !== undefined) {
      const res = executeStrikeWater({ grainWeightKg: grain, targetMashTempC: mashTemp });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcular el agua de empaste (strike) necesito el peso de grano en kg y la temperatura deseada de macerado en °C. ¿Qué datos tenés?';
  }

  // 5. AGUA DE LAVADO (SPARGE)
  if (/lavado|sparge|agua.*lavado/.test(q)) {
    const kettle = numExtractor([
      /(\d+(?:[.,]\d+)?)\s*(?:l|litros)\s*(?:en\s+olla|pre-hervor|prehervor)?/,
      /(?:olla|recolectar|objetivo)\D*(\d+(?:[.,]\d+)?)\s*(?:l|litros)?/,
    ]);
    const grain = numExtractor([/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)/]);

    if (kettle !== undefined && grain !== undefined) {
      const res = executeSpargeWater({ preBoilVolumeL: kettle, grainWeightKg: grain });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcular el agua de lavado (sparge) necesito el volumen objetivo a recolectar en olla (L) y el peso de grano (kg). ¿Qué medidas tenés?';
  }

  // 6. CORRECCIÓN DE REFRACTÓMETRO
  if (/refractometro|brix/.test(q)) {
    const brixVals = Array.from(q.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:brix|°\s*bx|bx)/g)).map((m) =>
      Number(m[1].replace(',', '.'))
    );
    if (brixVals.length >= 2) {
      const sorted = [...brixVals].sort((a, b) => b - a);
      const res = executeRefractometerCorrection({ originalBrix: sorted[0], currentBrix: sorted[1] });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para corregir la lectura del refractómetro necesito los grados Brix iniciales (antes de fermentar) y los Brix actuales con alcohol. ¿Cuáles son?';
  }

  // 7. CORRECCIÓN DE DENSÍMETRO POR TEMPERATURA
  if (/densimetro|hidrometro|corregir.*densidad/.test(q)) {
    const grav = numExtractor([/\b(1[.,]\d{3}|\d{4})\b/]);
    const temp = numExtractor([/(\d+(?:[.,]\d+)?)\s*(?:°\s*c|grados)/]);
    if (grav !== undefined && temp !== undefined) {
      const res = executeHydrometerTempCorrection({ measuredGravity: grav, measuredTempC: temp });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para corregir la lectura del densímetro necesito la densidad observada y la temperatura de la muestra en °C. ¿Qué valores mediste?';
  }

  // 8. ÁCIDO / AJUSTE DE PH
  if (/acido|alcalinidad|\bph\b.*macerado|macerado.*\bph\b/.test(q)) {
    const vol = numExtractor([/(\d+(?:[.,]\d+)?)\s*(?:l|litros)/]);
    const alk = numExtractor([/(\d+(?:[.,]\d+)?)\s*ppm/, /alcalinidad\D*(\d+(?:[.,]\d+)?)/]);
    if (vol !== undefined && alk !== undefined) {
      const acidType: AcidType = q.includes('fosforico')
        ? 'PHOSPHORIC'
        : q.includes('citrico')
        ? 'CITRIC'
        : 'LACTIC';
      const res = executeAcidAddition({ waterVolumeL: vol, alkalinityPpm: alk, acidType });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcular la dosis de ácido necesito el volumen de agua a tratar en litros y la alcalinidad en ppm como CaCO3. ¿Qué datos tenés?';
  }

  // 9. TASA DE INOCULACIÓN / LEVADURA / STARTER
  if (/inoculacion|starter|levadura.*celulas|cuanta.*levadura/.test(q)) {
    const vol = numExtractor([/(\d+(?:[.,]\d+)?)\s*(?:l|litros)/]);
    const grav = numExtractor([/\b(1[.,]\d{3}|\d{4})\b/]);
    if (vol !== undefined && grav !== undefined) {
      const yeastType: YeastPitchStyle = q.includes('lager')
        ? 'LAGER'
        : q.includes('hibrid') || q.includes('kolsch')
        ? 'HYBRID'
        : 'ALE';
      const res = executePitchRateAndStarter({ volumeL: vol, targetOG: grav, yeastType });
      if (res.success) {
        if (isVoiceMode) return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        const linkTag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${linkTag}`;
      }
    }
    return 'Para calcular la tasa de inoculación y el starter necesito el volumen del lote en litros y la Densidad Original (OG). ¿Qué valores tenés?';
  }

  return null;
}