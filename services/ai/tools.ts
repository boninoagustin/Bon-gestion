/**
 * @fileoverview tools.ts — Declaraciones de Function Calling tipadas rígidamente y validador
 * pre-ejecución para el Agente de Ingeniería Cervecera y Operaciones de Bon-Gestión.
 *
 * Incluye las 4 herramientas troncales requeridas con validación estricta antes de tocar IndexedDB/Zustand:
 * 1. `query_inventory`: Auditoría tipada de stock con filtros por categoría, umbral mínimo y valorización.
 * 2. `schedule_batch`: Programación transaccional de cocción validando fecha, receta, stock de insumos y capacidad de fermentador.
 * 3. `update_fermenter_temperature`: Control de setpoint térmico del fermentador con validación de rango físico (-5°C a 38°C),
 *    detección de riesgo de choque térmico/diacetilo y registro automático en el historial de fermentación del lote activo.
 * 4. `calculate_recipe_metrics`: Simulación físico-química integral de receta (OG, FG, ABV Hall/Lineal, IBU Tinseth paso a paso + geometría,
 *    Color Morey SRM/EBC, relación BU:GU, tasa de inoculación de levadura y validación de estilo BJCP).
 */

import { useBreweryStore } from '../../context/store';
import {
  Batch,
  BatchIngredient,
  BatchStatus,
  EventType,
  Fermenter,
  Ingredient,
} from '../../types';
import {
  calculateABV,
  calculateABVAdvanced,
  calculateMoreyColor,
  calculatePitchingRate,
  calculatePriming,
  calculateTinsethIBUBreakdown,
  HopAdditionInput,
  HopAdditionStage,
  HopFormType,
  sanitizeGravity,
  sanitizeNumber,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
  sgToPlato,
  YeastPitchStyle,
} from '../../lib/brewmath';
import { BJCP_STYLES, validateParameter } from '../../lib/bjcp';
import { aiActions, localToday, normalizeText, ToolResult } from './actions';
import { diagnoseFermentationDeviations } from './prompts';
import { calcToolDeclarations, calcToolHandlers } from './calcTools';

// ============================================================================
// 1. TIPADO RÍGIDO DE ARGUMENTOS PARA FUNCTION CALLING
// ============================================================================

export type IngredientCategory = Ingredient['type'];

/** Argumentos tipados para `query_inventory` */
export interface QueryInventoryArgs {
  /** Texto opcional para filtrar por nombre de insumo o número de lote */
  filter?: string;
  /** Categoría estricta del insumo */
  category?: IngredientCategory;
  /** Si es true, devuelve únicamente insumos agotados o por debajo del umbral crítico */
  onlyLowStock?: boolean;
  /** Cantidad mínima requerida para verificar disponibilidad inmediata de cocción */
  minStockRequired?: number;
}

/** Argumentos tipados para `schedule_batch` */
export interface ScheduleBatchArgs {
  /** Nombre de la receta maestra o estilo a cocinar */
  recipeName: string;
  /** Fecha programada de cocción en formato ISO YYYY-MM-DD */
  brewDate: string;
  /** Volumen objetivo del lote en litros (default: tamaño de la receta o 250L) */
  batchSizeLiters?: number;
  /** Nombre, número o ID del fermentador a asignar/reservar (opcional) */
  fermenterId?: string;
  /** Si es true, crea además el registro de Lote en estado PLANNED en la base de datos */
  createPlannedBatch?: boolean;
  /** Notas operativas para el calendario y orden de cocción */
  notes?: string;
}

/** Motivo técnico del ajuste térmico en el fermentador */
export type ThermalStageReason =
  | 'PRIMARY_FERM'
  | 'DIACETYL_REST'
  | 'DRY_HOP'
  | 'COLD_CRASH'
  | 'MATURATION'
  | 'OTHER';

/** Argumentos tipados para `update_fermenter_temperature` */
export interface UpdateFermenterTemperatureArgs {
  /** Identificador, nombre o número del fermentador (ej. "F-01", "Fermentador 1", "1") */
  fermenterId: string;
  /** Nueva temperatura objetivo o medida en grados Celsius (°C), rango válido [-5, 38] */
  targetTemperatureC: number;
  /** Lectura opcional de gravedad específica tomada en simultáneo (ej. 1.014) */
  gravityReading?: number;
  /** Etapa técnica del perfil de fermentación */
  stageReason?: ThermalStageReason;
  /** Observaciones adicionales del operador */
  notes?: string;
}

/** Insumo fermentable para `calculate_recipe_metrics` */
export interface RecipeFermentableInput {
  name: string;
  /** Peso en kilogramos (kg) */
  weightKg: number;
  /** Potencial de extracto en L°/kg (default: 300 para malta base) */
  potentialPtsPerKg?: number;
  /** Color en grados Lovibond (°L, default: 3) */
  lovibond?: number;
}

/** Adición de lúpulo para `calculate_recipe_metrics` */
export interface RecipeHopInput {
  name?: string;
  /** Peso en gramos (g) */
  weightGrams: number;
  /** Porcentaje de alfa-ácidos (% AA, ej. 12.5) */
  alphaAcidsPercent: number;
  /** Tiempo de hervor o contacto en minutos (min) */
  boilTimeMinutes: number;
  /** Etapa de adición (default: 'BOIL') */
  stage?: HopAdditionStage;
  /** Formato del lúpulo (default: 'PELLET') */
  form?: HopFormType;
  /** Temperatura de whirlpool en °C si stage === 'HOPSTAND' */
  whirlpoolTempC?: number;
}

/** Argumentos tipados para `calculate_recipe_metrics` */
export interface CalculateRecipeMetricsArgs {
  /** Volumen final del lote en fermentador en litros (L) */
  batchVolumeLiters: number;
  /** Volumen de hervor en litros (opcional, default: batchVolumeLiters) */
  boilVolumeLiters?: number;
  /** Eficiencia de extracción de sala de cocción en % (default: 75%) */
  efficiencyPercent?: number;
  /** Tasa de evaporación en L/h (default: 25 L/h) */
  evaporationRateLPerHour?: number;
  /** Diámetro de la olla de hervor en cm para factor geométrico de Tinseth (default: 70 cm) */
  kettleDiameterCm?: number;
  /** Lista de maltas y adjuntos fermentables */
  fermentables: RecipeFermentableInput[];
  /** Lista de adiciones de lúpulo */
  hops?: RecipeHopInput[];
  /** Atenuación aparente estimada de la levadura en % (default: 78%) */
  expectedAttenuationPercent?: number;
  /** Tipo de cepa para tasa de inoculación (default: 'ALE') */
  yeastType?: YeastPitchStyle;
  /** Estilo BJCP opcional para contrastar parámetros (ej. "American IPA") */
  styleName?: string;
}

/** Resultado de validación previa a la ejecución en base de datos */
export type ValidationResult<T> =
  | { valid: true; data: T; error?: never }
  | { valid: false; error: string; data?: never };

// ============================================================================
// 2. VALIDADORES PRE-EJECUCIÓN DE ARGUMENTOS (GUARDRAILS DE BASE DE DATOS)
// ============================================================================

const VALID_CATEGORIES: readonly IngredientCategory[] = [
  'MALT',
  'HOP',
  'YEAST',
  'ADJUNCT',
  'CHEMICAL',
  'PACKAGING',
];

const VALID_THERMAL_REASONS: readonly ThermalStageReason[] = [
  'PRIMARY_FERM',
  'DIACETYL_REST',
  'DRY_HOP',
  'COLD_CRASH',
  'MATURATION',
  'OTHER',
];

const VALID_YEAST_STYLES: readonly YeastPitchStyle[] = [
  'ALE',
  'LAGER',
  'HYBRID',
  'HIGH_GRAVITY_ALE',
  'HIGH_GRAVITY_LAGER',
];

/**
 * Valida y normaliza los argumentos de `query_inventory` antes de consultar el store.
 */
export function validateQueryInventoryArgs(
  raw: Record<string, unknown>
): ValidationResult<QueryInventoryArgs> {
  const filter =
    typeof raw.filter === 'string' && raw.filter.trim().length > 0
      ? raw.filter.trim()
      : undefined;

  let category: IngredientCategory | undefined;
  if (raw.category !== undefined && raw.category !== null && raw.category !== '') {
    const upper = String(raw.category).toUpperCase().trim() as IngredientCategory;
    if (!VALID_CATEGORIES.includes(upper)) {
      return {
        valid: false,
        error: `Categoría de inventario inválida "${String(raw.category)}". Valores permitidos: ${VALID_CATEGORIES.join(', ')}.`,
      };
    }
    category = upper;
  }

  const onlyLowStock = Boolean(raw.onlyLowStock);
  let minStockRequired: number | undefined;
  if (raw.minStockRequired !== undefined && raw.minStockRequired !== null) {
    const parsed = sanitizeNumber(raw.minStockRequired, {
      fallback: -1,
      min: -1,
      allowNegative: true,
    });
    if (parsed < 0) {
      return {
        valid: false,
        error: 'El parámetro minStockRequired debe ser un número mayor o igual a 0.',
      };
    }
    minStockRequired = parsed;
  }

  return {
    valid: true,
    data: { filter, category, onlyLowStock, minStockRequired },
  };
}

/**
 * Valida y normaliza los argumentos de `schedule_batch` antes de escribir en la base de datos local.
 */
export function validateScheduleBatchArgs(
  raw: Record<string, unknown>
): ValidationResult<ScheduleBatchArgs> {
  const recipeName =
    typeof raw.recipeName === 'string' ? raw.recipeName.trim() : '';
  if (!recipeName) {
    return {
      valid: false,
      error: 'Falta el nombre de la receta o estilo a programar (recipeName).',
    };
  }

  const brewDateRaw =
    typeof raw.brewDate === 'string' ? raw.brewDate.trim().slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brewDateRaw) || Number.isNaN(Date.parse(brewDateRaw))) {
    return {
      valid: false,
      error: `Fecha de cocción inválida "${String(raw.brewDate)}". Debe tener formato YYYY-MM-DD válido.`,
    };
  }

  let batchSizeLiters: number | undefined;
  if (raw.batchSizeLiters !== undefined && raw.batchSizeLiters !== null) {
    const parsedVol = sanitizeNumber(raw.batchSizeLiters, {
      fallback: 0,
      min: 0,
      max: 10000,
    });
    if (parsedVol <= 0 || parsedVol > 10000) {
      return {
        valid: false,
        error: 'El volumen del lote (batchSizeLiters) debe estar entre 1 y 10.000 litros.',
      };
    }
    batchSizeLiters = parsedVol;
  }

  const fermenterId =
    typeof raw.fermenterId === 'string' && raw.fermenterId.trim().length > 0
      ? raw.fermenterId.trim()
      : undefined;

  const createPlannedBatch =
    raw.createPlannedBatch !== undefined ? Boolean(raw.createPlannedBatch) : true;

  const notes =
    typeof raw.notes === 'string' && raw.notes.trim().length > 0
      ? raw.notes.trim()
      : undefined;

  return {
    valid: true,
    data: {
      recipeName,
      brewDate: brewDateRaw,
      batchSizeLiters,
      fermenterId,
      createPlannedBatch,
      notes,
    },
  };
}

/**
 * Valida y normaliza los argumentos de `update_fermenter_temperature` antes de modificar el tanque o lote.
 */
export function validateUpdateFermenterTemperatureArgs(
  raw: Record<string, unknown>
): ValidationResult<UpdateFermenterTemperatureArgs> {
  const fermenterId =
    typeof raw.fermenterId === 'string' || typeof raw.fermenterId === 'number'
      ? String(raw.fermenterId).trim()
      : '';
  if (!fermenterId) {
    return {
      valid: false,
      error: 'Falta indicar el fermentador (fermenterId).',
    };
  }

  if (
    raw.targetTemperatureC === undefined ||
    raw.targetTemperatureC === null ||
    raw.targetTemperatureC === ''
  ) {
    return {
      valid: false,
      error: 'Falta indicar la temperatura objetivo en °C (targetTemperatureC).',
    };
  }

  const rawTemp = Number(String(raw.targetTemperatureC).replace(',', '.'));
  if (!Number.isFinite(rawTemp) || rawTemp < -5 || rawTemp > 38) {
    return {
      valid: false,
      error: `Temperatura fuera de rango operativo seguro (${String(raw.targetTemperatureC)}°C). El rango permitido para fermentadores es de -5°C a 38°C.`,
    };
  }
  const targetTemperatureC = sanitizeTemperatureC(rawTemp, 19, -5, 38);

  let gravityReading: number | undefined;
  if (
    raw.gravityReading !== undefined &&
    raw.gravityReading !== null &&
    raw.gravityReading !== ''
  ) {
    const cleanG = sanitizeGravity(raw.gravityReading, -1);
    if (cleanG < 0.985 || cleanG > 1.2) {
      return {
        valid: false,
        error: `Lectura de densidad inválida (${String(raw.gravityReading)}). Debe estar entre 0.985 y 1.200 (o 985 a 1200).`,
      };
    }
    gravityReading = cleanG;
  }

  let stageReason: ThermalStageReason = 'OTHER';
  if (raw.stageReason && typeof raw.stageReason === 'string') {
    const upper = raw.stageReason.toUpperCase().trim() as ThermalStageReason;
    if (VALID_THERMAL_REASONS.includes(upper)) {
      stageReason = upper;
    }
  }

  const notes =
    typeof raw.notes === 'string' && raw.notes.trim().length > 0
      ? raw.notes.trim()
      : undefined;

  return {
    valid: true,
    data: {
      fermenterId,
      targetTemperatureC,
      gravityReading,
      stageReason,
      notes,
    },
  };
}

/**
 * Valida y normaliza los argumentos de `calculate_recipe_metrics`.
 */
export function validateCalculateRecipeMetricsArgs(
  raw: Record<string, unknown>
): ValidationResult<CalculateRecipeMetricsArgs> {
  const batchVolumeLiters = sanitizePositiveNumber(raw.batchVolumeLiters, 0, 20000);
  if (batchVolumeLiters <= 0) {
    return {
      valid: false,
      error: 'El volumen del lote (batchVolumeLiters) debe ser mayor a 0 litros.',
    };
  }

  if (!Array.isArray(raw.fermentables) || raw.fermentables.length === 0) {
    return {
      valid: false,
      error: 'Debes proporcionar al menos un grano o fermentable en la lista `fermentables`.',
    };
  }

  const fermentables: RecipeFermentableInput[] = [];
  for (const item of raw.fermentables) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const weightKg = sanitizePositiveNumber(rec.weightKg, 0, 5000);
    if (weightKg <= 0) {
      return {
        valid: false,
        error: `Cada grano en fermentables debe tener un weightKg > 0 (recibido en "${String(rec.name ?? 'malta')}").`,
      };
    }
    fermentables.push({
      name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : 'Malta Base',
      weightKg,
      potentialPtsPerKg: sanitizePositiveNumber(rec.potentialPtsPerKg ?? 300, 300, 400),
      lovibond: sanitizePositiveNumber(rec.lovibond ?? 3, 3, 1000),
    });
  }

  const hops: RecipeHopInput[] = [];
  if (Array.isArray(raw.hops)) {
    for (const h of raw.hops) {
      if (!h || typeof h !== 'object') continue;
      const rec = h as Record<string, unknown>;
      const weightGrams = sanitizePositiveNumber(rec.weightGrams, 0, 50000);
      const alphaAcidsPercent = sanitizePositiveNumber(rec.alphaAcidsPercent, 0, 100);
      const boilTimeMinutes = sanitizePositiveNumber(rec.boilTimeMinutes ?? 0, 0, 240);
      if (weightGrams <= 0 || alphaAcidsPercent <= 0) continue;

      const stageRaw = String(rec.stage ?? 'BOIL').toUpperCase().trim();
      const stage: HopAdditionStage =
        stageRaw === 'FIRST_WORT' ||
        stageRaw === 'HOPSTAND' ||
        stageRaw === 'DRY_HOP'
          ? stageRaw
          : 'BOIL';

      const formRaw = String(rec.form ?? 'PELLET').toUpperCase().trim();
      const form: HopFormType =
        formRaw === 'WHOLE' || formRaw === 'PLUG' ? formRaw : 'PELLET';

      hops.push({
        name: typeof rec.name === 'string' ? rec.name.trim() : 'Lúpulo',
        weightGrams,
        alphaAcidsPercent,
        boilTimeMinutes,
        stage,
        form,
        whirlpoolTempC:
          rec.whirlpoolTempC !== undefined
            ? sanitizeTemperatureC(rec.whirlpoolTempC, 85, 50, 100)
            : undefined,
      });
    }
  }

  const boilVolumeLiters = sanitizePositiveNumber(
    raw.boilVolumeLiters ?? batchVolumeLiters,
    batchVolumeLiters,
    25000
  );
  const efficiencyPercent = sanitizeNumber(raw.efficiencyPercent ?? 75, {
    fallback: 75,
    min: 10,
    max: 100,
  });
  const evaporationRateLPerHour = sanitizePositiveNumber(
    raw.evaporationRateLPerHour ?? 25,
    25,
    500
  );
  const kettleDiameterCm = sanitizePositiveNumber(
    raw.kettleDiameterCm ?? 70,
    70,
    500
  );
  const expectedAttenuationPercent = sanitizeNumber(
    raw.expectedAttenuationPercent ?? 78,
    { fallback: 78, min: 40, max: 98 }
  );

  const rawYeast = String(raw.yeastType ?? 'ALE').toUpperCase().trim() as YeastPitchStyle;
  const yeastType: YeastPitchStyle = VALID_YEAST_STYLES.includes(rawYeast)
    ? rawYeast
    : 'ALE';

  const styleName =
    typeof raw.styleName === 'string' && raw.styleName.trim().length > 0
      ? raw.styleName.trim()
      : undefined;

  return {
    valid: true,
    data: {
      batchVolumeLiters,
      boilVolumeLiters,
      efficiencyPercent,
      evaporationRateLPerHour,
      kettleDiameterCm,
      fermentables,
      hops,
      expectedAttenuationPercent,
      yeastType,
      styleName,
    },
  };
}

// ============================================================================
// 3. IMPLEMENTACIÓN DE LAS 4 HERRAMIENTAS TRONCALES CON INTEGRIDAD ACID
// ============================================================================

/**
 * Ejecuta `query_inventory` con validación previa de tipos y filtros avanzados.
 */
export function executeQueryInventory(rawArgs: Record<string, unknown>): ToolResult {
  const validation = validateQueryInventoryArgs(rawArgs);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const { filter, category, onlyLowStock, minStockRequired } = validation.data;
  const state = useBreweryStore.getState();
  const normalizedFilter = filter ? normalizeText(filter) : '';

  const filtered = state.inventory.filter((item) => {
    if (category && item.type !== category) return false;
    if (
      normalizedFilter &&
      !normalizeText(item.name).includes(normalizedFilter) &&
      !normalizeText(item.lotNumber).includes(normalizedFilter) &&
      !normalizeText(item.type).includes(normalizedFilter)
    ) {
      return false;
    }
    if (onlyLowStock && item.stockAmount > 5) return false;
    return true;
  });

  const items = filtered.map((item) => {
    const meetsMinRequirement =
      minStockRequired !== undefined ? item.stockAmount >= minStockRequired : true;
    return {
      id: item.id,
      name: item.name,
      category: item.type,
      stockAmount: Number(item.stockAmount.toFixed(3)),
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      totalValuation: Number((item.stockAmount * item.costPerUnit).toFixed(0)),
      lotNumber: item.lotNumber,
      purchaseDate: item.purchaseDate,
      status:
        item.stockAmount <= 0
          ? 'OUT_OF_STOCK'
          : item.stockAmount <= 5
          ? 'LOW_STOCK'
          : 'OK',
      meetsMinRequirement,
      shortfall:
        minStockRequired !== undefined && item.stockAmount < minStockRequired
          ? Number((minStockRequired - item.stockAmount).toFixed(3))
          : 0,
    };
  });

  const totalInventoryValuation = items.reduce(
    (sum, i) => sum + i.totalValuation,
    0
  );

  return {
    success: true,
    count: items.length,
    totalInventoryValuation,
    outOfStockCount: items.filter((i) => i.status === 'OUT_OF_STOCK').length,
    lowStockCount: items.filter((i) => i.status === 'LOW_STOCK').length,
    items,
  };
}

/**
 * Ejecuta `schedule_batch`: valida fecha, receta, stock disponible y fermentador,
 * agenda el evento en el calendario y opcionalmente crea el lote `PLANNED`.
 */
export function executeScheduleBatch(rawArgs: Record<string, unknown>): ToolResult {
  const validation = validateScheduleBatchArgs(rawArgs);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const {
    recipeName,
    brewDate,
    batchSizeLiters,
    fermenterId,
    createPlannedBatch,
    notes,
  } = validation.data;

  const state = useBreweryStore.getState();

  // Buscar receta maestra coincidente si existe
  const normRecipe = normalizeText(recipeName);
  const matchedRecipe = state.masterRecipes.find(
    (r) =>
      normalizeText(r.name) === normRecipe ||
      normalizeText(r.name).includes(normRecipe)
  );

  const effectiveVolume =
    batchSizeLiters ??
    matchedRecipe?.batchSize ??
    state.settings.equipmentVolume ??
    250;

  // Verificar fermentador si se indicó
  let targetFermenter: Fermenter | undefined;
  if (fermenterId) {
    const normFerm = normalizeText(fermenterId);
    targetFermenter = state.fermenters.find(
      (f) =>
        normalizeText(f.id) === normFerm ||
        normalizeText(f.name) === normFerm ||
        normalizeText(f.name).includes(normFerm)
    );
    if (!targetFermenter) {
      return {
        error: `No se encontró el fermentador "${fermenterId}". Disponibles: ${state.fermenters.map((f) => `${f.name} (${f.status})`).join(', ') || 'ninguno'}.`,
      };
    }
    if (effectiveVolume > targetFermenter.capacity) {
      return {
        error: `El volumen del lote (${effectiveVolume}L) supera la capacidad máxima de ${targetFermenter.name} (${targetFermenter.capacity}L).`,
      };
    }
  }

  // Verificar disponibilidad de insumos si hay receta maestra asociada
  const stockShortfalls: { name: string; needed: number; available: number; unit: string }[] = [];
  const batchIngredients: BatchIngredient[] = [];
  let estimatedIngredientsCost = 0;

  if (matchedRecipe && Array.isArray(matchedRecipe.ingredients)) {
    const scaleFactor =
      matchedRecipe.batchSize > 0 ? effectiveVolume / matchedRecipe.batchSize : 1;

    for (const ing of matchedRecipe.ingredients) {
      const scaledAmount = Number((ing.amountUsed * scaleFactor).toFixed(3));
      const invItem =
        state.inventory.find((i) => i.id === ing.inventoryId) ||
        state.inventory.find((i) => normalizeText(i.name) === normalizeText(ing.name));

      const available = invItem?.stockAmount ?? 0;
      const unitCost = invItem?.costPerUnit ?? ing.costAtTime ?? 0;

      if (available < scaledAmount) {
        stockShortfalls.push({
          name: ing.name,
          needed: scaledAmount,
          available,
          unit: ing.unit,
        });
      }

      batchIngredients.push({
        inventoryId: invItem?.id || ing.inventoryId,
        name: ing.name,
        amountUsed: scaledAmount,
        costAtTime: unitCost,
        unit: ing.unit,
        type: ing.type,
      });
      estimatedIngredientsCost += scaledAmount * unitCost;
    }
  }

  const batchId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `batch_${Date.now()}`;
  const lotCode = `L-${brewDate.replace(/-/g, '').slice(2)}-${recipeName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)}`;

  if (createPlannedBatch) {
    const plannedBatch: Batch = {
      id: batchId,
      recipeName: matchedRecipe ? matchedRecipe.name : recipeName,
      recipeId: matchedRecipe?.id,
      recipeVersion: matchedRecipe?.version,
      style: matchedRecipe?.style || recipeName,
      brewDate,
      status: BatchStatus.PLANNED,
      volumeKettle: effectiveVolume,
      volumeFermenter: Math.round(effectiveVolume * 0.9),
      volumePackaged: Math.round(effectiveVolume * 0.85),
      ingredientsUsed: batchIngredients,
      totalIngredientsCost: Math.round(estimatedIngredientsCost),
      overheadCost: 0,
      originalGravity: matchedRecipe?.targetOG || 1.05,
      finalGravity: matchedRecipe?.targetFG || 1.01,
      lotCode,
      fermentationLogs: [],
      sensoryProfiles: [],
      qualityLogs: [],
      notes: notes || `Cocción programada por IA para ${brewDate}`,
      ingredientsDiscounted: false, // En estado PLANNED aún no descuenta stock físico hasta cocinar
    };
    state.addBatch(plannedBatch);
  }

  const eventId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ev_${Date.now()}`;

  state.addCalendarEvent({
    id: eventId,
    batchId: createPlannedBatch ? batchId : undefined,
    title: `Cocción: ${matchedRecipe ? matchedRecipe.name : recipeName} (${effectiveVolume}L)`,
    start: brewDate,
    type: EventType.BREW,
    completed: false,
    notes: [
      notes,
      targetFermenter ? `Tanque previsto: ${targetFermenter.name}` : undefined,
      stockShortfalls.length > 0
        ? `Faltantes de stock: ${stockShortfalls.map((s) => `${s.name} (faltan ${(s.needed - s.available).toFixed(2)} ${s.unit})`).join(', ')}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' | '),
  });

  return {
    success: true,
    message: `Cocción de "${matchedRecipe ? matchedRecipe.name : recipeName}" (${effectiveVolume}L) agendada para el ${brewDate}${createPlannedBatch ? ` con lote planificado [${lotCode}]` : ''}.`,
    scheduledBatch: {
      batchId: createPlannedBatch ? batchId : undefined,
      lotCode: createPlannedBatch ? lotCode : undefined,
      recipeName: matchedRecipe ? matchedRecipe.name : recipeName,
      brewDate,
      batchSizeLiters: effectiveVolume,
      plannedFermenter: targetFermenter?.name,
      estimatedIngredientsCost: Math.round(estimatedIngredientsCost),
      stockReady: stockShortfalls.length === 0,
      stockShortfalls,
    },
  };
}

/**
 * Ejecuta `update_fermenter_temperature`: valida tanque y rango térmico (-5°C a 38°C),
 * actualiza las notas operativas del tanque y registra la medición en el lote activo,
 * devolviendo además alertas técnicas si detecta riesgo de choque térmico o diacetilo.
 */
export function executeUpdateFermenterTemperature(
  rawArgs: Record<string, unknown>
): ToolResult {
  const validation = validateUpdateFermenterTemperatureArgs(rawArgs);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const {
    fermenterId,
    targetTemperatureC,
    gravityReading,
    stageReason,
    notes,
  } = validation.data;

  const state = useBreweryStore.getState();
  const normQuery = normalizeText(fermenterId);
  const digitMatch = normQuery.match(/^(?:(?:f|fermentador|tanque)[\s-]*)?0*(\d+)$/);

  const matchedFermenters = state.fermenters.filter((f) => {
    if (
      normalizeText(f.id) === normQuery ||
      normalizeText(f.name) === normQuery
    ) {
      return true;
    }
    if (digitMatch) {
      const fMatch = normalizeText(f.name).match(/^(?:(?:f|fermentador|tanque)[\s-]*)?0*(\d+)$/) ||
        normalizeText(f.id).match(/^(?:(?:f|fermentador|tanque)[\s-]*)?0*(\d+)$/);
      return fMatch && Number(fMatch[1]) === Number(digitMatch[1]);
    }
    return false;
  });

  if (matchedFermenters.length === 0) {
    return {
      error: `No encontré el fermentador "${fermenterId}". Tanques existentes: ${state.fermenters.map((f) => f.name).join(', ') || 'ninguno'}.`,
    };
  }
  if (matchedFermenters.length > 1) {
    return {
      error: `El identificador "${fermenterId}" coincide con varios fermentadores (${matchedFermenters.map((f) => f.name).join(', ')}). Especificá el nombre exacto.`,
    };
  }

  const fermenter = matchedFermenters[0];
  const activeBatch =
    state.batches.find(
      (b) => b.id === fermenter.currentBatchId && b.status !== BatchStatus.COMPLETED
    ) ||
    state.batches.find(
      (b) => b.fermenterId === fermenter.id && b.status !== BatchStatus.COMPLETED
    );

  const engineeringWarnings: string[] = [];
  let previousTemp: number | undefined;

  if (activeBatch) {
    const tempLogs = [...(activeBatch.fermentationLogs || [])]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .filter((l) => typeof l.temperature === 'number');

    if (tempLogs.length > 0) {
      previousTemp = tempLogs[tempLogs.length - 1].temperature;
    }

    // Evaluar salto térmico brusco o Cold Crash sin descanso de diacetilo
    if (previousTemp !== undefined) {
      const deltaT = targetTemperatureC - previousTemp;
      if (deltaT < -5 && targetTemperatureC > 4) {
        engineeringWarnings.push(
          `Descenso brusco de ${Math.abs(deltaT).toFixed(1)}°C durante fermentación activa: riesgo de choque térmico y floculación prematura de la levadura.`
        );
      }
    }

    if (targetTemperatureC <= 4) {
      const og = activeBatch.originalGravity || 1.05;
      const lastG =
        gravityReading ??
        [...(activeBatch.fermentationLogs || [])]
          .reverse()
          .find((l) => typeof l.gravity === 'number')?.gravity;
      if (lastG !== undefined) {
        const att = ((og - lastG) / Math.max(0.001, og - 1)) * 100;
        if (att < 72) {
          engineeringWarnings.push(
            `Atención: Iniciando Cold Crash (${targetTemperatureC}°C) con atenuación aparente baja (${att.toFixed(1)}%). Verificar descanso de diacetilo (VDK) antes de enfriar.`
          );
        }
      }
    }

    const logNote = [
      `Setpoint térmico: ${targetTemperatureC}°C (${stageReason})`,
      notes,
    ]
      .filter(Boolean)
      .join(' — ');

    state.addFermentationLog(activeBatch.id, {
      date: localToday(),
      action: 'MEDICION',
      temperature: targetTemperatureC,
      gravity: gravityReading,
      notes: logNote,
    });
  }

  const updatedNotes = `Setpoint: ${targetTemperatureC}°C${notes ? ` | ${notes}` : ''}`;
  state.updateFermenter(fermenter.id, { notes: updatedNotes });

  return {
    success: true,
    message: `Temperatura de ${fermenter.name} actualizada a ${targetTemperatureC}°C${activeBatch ? ` (registrado en lote ${activeBatch.lotCode} - ${activeBatch.recipeName})` : ''}.`,
    fermenter: {
      id: fermenter.id,
      name: fermenter.name,
      previousTemperatureC: previousTemp,
      newTemperatureC: targetTemperatureC,
      batchLotCode: activeBatch?.lotCode,
      gravityRecorded: gravityReading,
      stageReason,
    },
    engineeringWarnings,
  };
}

/**
 * Ejecuta `calculate_recipe_metrics`: calcula con rigor ingenieril OG, FG, ABV,
 * IBU Tinseth paso a paso + geometría, Color Morey SRM/EBC, relación BU:GU,
 * tasa de inoculación y cumplimiento de estilo BJCP.
 */
export function executeCalculateRecipeMetrics(
  rawArgs: Record<string, unknown>
): ToolResult {
  const validation = validateCalculateRecipeMetricsArgs(rawArgs);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const {
    batchVolumeLiters,
    boilVolumeLiters = batchVolumeLiters,
    efficiencyPercent = 75,
    evaporationRateLPerHour = 25,
    kettleDiameterCm = 70,
    fermentables,
    hops = [],
    expectedAttenuationPercent = 78,
    yeastType = 'ALE',
    styleName,
  } = validation.data;

  // 1. Cálculo de OG y FG
  const totalGrainKg = fermentables.reduce((s, f) => s + f.weightKg, 0);
  const totalEffectivePoints = fermentables.reduce(
    (s, f) =>
      s +
      f.weightKg *
        (f.potentialPtsPerKg ?? 300) *
        (efficiencyPercent / 100),
    0
  );

  const estimatedOG = Number(
    (1 + totalEffectivePoints / batchVolumeLiters / 1000).toFixed(3)
  );
  const estimatedFG = Number(
    (
      1 +
      ((estimatedOG - 1) * (1 - expectedAttenuationPercent / 100))
    ).toFixed(3)
  );

  // 2. ABV y Grados Plato
  const abvMetrics = calculateABVAdvanced(estimatedOG, estimatedFG);

  // 3. IBU Tinseth paso a paso + Geometría
  const hopInputs: HopAdditionInput[] = hops.map((h, i) => ({
    id: String(i + 1),
    name: h.name,
    amount: h.weightGrams,
    alpha: h.alphaAcidsPercent,
    time: h.boilTimeMinutes,
    type: h.stage ?? 'BOIL',
    form: h.form ?? 'PELLET',
    whirlpoolTempC: h.whirlpoolTempC,
  }));

  const ibuBreakdown = calculateTinsethIBUBreakdown(
    hopInputs,
    boilVolumeLiters,
    estimatedOG,
    {
      evaporationRateLPerHour,
      kettleDiameterCm,
      gravityReferenceStage: 'POST_BOIL',
    }
  );

  // 4. Color Morey (SRM / EBC)
  const colorMetrics = calculateMoreyColor(
    fermentables.map((f) => ({
      name: f.name,
      kg: f.weightKg,
      lovibond: f.lovibond ?? 3,
    })),
    batchVolumeLiters
  );

  // 5. Relación Amargor / Gravedad (BU:GU Ratio)
  const gravityUnits = Math.max(1, (estimatedOG - 1) * 1000);
  const buGuRatio = Number((ibuBreakdown.totalIBU / gravityUnits).toFixed(2));

  // 6. Tasa de Inoculación (Pitching Rate)
  const pitchMetrics = calculatePitchingRate({
    batchVolumeL: batchVolumeLiters,
    og: estimatedOG,
    yeastType,
  });

  // 7. Validación contra guía BJCP si se proporcionó styleName
  let bjcpEvaluation: Record<string, string> | undefined;
  if (styleName) {
    const styleKey = Object.keys(BJCP_STYLES).find(
      (k) =>
        normalizeText(k) === normalizeText(styleName) ||
        normalizeText(BJCP_STYLES[k].name).includes(normalizeText(styleName))
    );
    if (styleKey) {
      const limits = BJCP_STYLES[styleKey];
      bjcpEvaluation = {
        style: limits.name,
        og: validateParameter(estimatedOG, limits.og, 'OG', (v) => v.toFixed(3)).message,
        fg: validateParameter(estimatedFG, limits.fg, 'FG', (v) => v.toFixed(3)).message,
        abv: validateParameter(abvMetrics.abv, limits.abv, 'ABV', (v) => `${v.toFixed(1)}%`).message,
        ibu: validateParameter(ibuBreakdown.totalIBU, limits.ibu, 'IBU', (v) => `${v.toFixed(0)} IBU`).message,
        srm: validateParameter(colorMetrics.srm, limits.srm, 'SRM', (v) => `${v.toFixed(1)} SRM`).message,
      };
    }
  }

  return {
    success: true,
    metrics: {
      batchVolumeLiters,
      totalGrainKg: Number(totalGrainKg.toFixed(2)),
      estimatedOG,
      estimatedFG,
      ogPlato: Number(sgToPlato(estimatedOG).toFixed(1)),
      fgPlato: Number(sgToPlato(estimatedFG).toFixed(1)),
      abvPercent: Number(abvMetrics.abv.toFixed(2)),
      abvLinearPercent: Number(abvMetrics.abvLinear.toFixed(2)),
      apparentAttenuationPercent: Number(
        abvMetrics.apparentAttenuation.toFixed(1)
      ),
      realAttenuationPercent: Number(abvMetrics.realAttenuation.toFixed(1)),
      totalIBU: Number(ibuBreakdown.totalIBU.toFixed(1)),
      buGuRatio,
      kettleGeometryFactor: Number(
        ibuBreakdown.geometry.geometryFactor.toFixed(3)
      ),
      colorSRM: Number(colorMetrics.srm.toFixed(1)),
      colorEBC: Number(colorMetrics.ebc.toFixed(1)),
      colorHex: colorMetrics.hexColor,
      pitchingRate: {
        effectiveStyle: pitchMetrics.effectiveStyle,
        rateCellsPerMlPlato: pitchMetrics.targetRateCellsPerMlPlato,
        totalCellsBillions: Math.round(pitchMetrics.totalCellsBillions),
        packsNeeded200B: Number(pitchMetrics.packsNeeded.toFixed(1)),
        dryYeastGrams: Math.round(pitchMetrics.dryYeastGrams),
      },
      bjcpEvaluation,
    },
  };
}

// ============================================================================
// 4. REGISTRO DE HERRAMIENTAS DE ESCRITURA Y DECLARACIONES PARA EL LLM
// ============================================================================

/** Herramientas que modifican datos (se listan como "acciones ejecutadas" en el chat). */
export const WRITE_TOOLS = new Set([
  'schedule_batch',
  'update_fermenter_temperature',
  'update_keg_status',
  'clean_fermenter',
  'update_fermenter_status',
  'assign_fermenter',
  'update_inventory',
  'edit_ingredient',
  'add_ingredient',
  'update_batch_status',
  'add_fermentation_log',
  'add_quality_log',
  'fill_keg_from_batch',
  'tap_keg',
  'serve_from_tap',
  'gift_from_tap',
  'update_bottle_stock',
  'gift_bottle',
  'add_sale',
  'add_payment',
  'add_expense',
  'add_customer',
  'update_customer',
  'add_calendar_event',
  'complete_calendar_event',
  'add_to_shopping_list',
  'undo_last_action',
  'set_timer',
  'cancel_timer',
]);

interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly string[];
  items?: Record<string, unknown>;
  properties?: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
}

const obj = (
  properties: Record<string, JsonSchemaProperty> = {},
  required: readonly string[] = []
): JsonSchemaProperty => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});

const str = (
  description: string,
  extra: Partial<JsonSchemaProperty> = {}
): JsonSchemaProperty => ({
  type: 'string',
  description,
  ...extra,
});

const numb = (description: string): JsonSchemaProperty => ({
  type: 'number',
  description,
});

const bool = (description: string): JsonSchemaProperty => ({
  type: 'boolean',
  description,
});

export const aiTools = [
  {
    functionDeclarations: [
      // --------------- 4 HERRAMIENTAS TRONCALES REQUERIDAS ---------------
      {
        name: 'query_inventory',
        description:
          'Consulta y audita el inventario de insumos cerveceros con validación estricta. Permite filtrar por texto/lote, categoría (MALT, HOP, YEAST, ADJUNCT, CHEMICAL, PACKAGING), listar solo stock crítico y verificar si alcanza para una cantidad mínima.',
        parameters: obj({
          filter: str('(Opcional) Nombre parcial del insumo o número de lote'),
          category: str('(Opcional) Categoría exacta del insumo', {
            enum: VALID_CATEGORIES,
          }),
          onlyLowStock: bool(
            '(Opcional) true para listar únicamente insumos agotados o con stock bajo (<= 5)'
          ),
          minStockRequired: numb(
            '(Opcional) Cantidad mínima requerida para comprobar disponibilidad'
          ),
        }),
      },
      {
        name: 'schedule_batch',
        description:
          'Programa una nueva cocción en el calendario de producción y crea el lote planificado verificando capacidad del fermentador y disponibilidad de insumos de la receta.',
        parameters: obj(
          {
            recipeName: str('Nombre de la receta maestra o estilo a cocinar'),
            brewDate: str('Fecha programada en formato YYYY-MM-DD'),
            batchSizeLiters: numb(
              '(Opcional) Volumen objetivo del lote en litros (ej: 250)'
            ),
            fermenterId: str(
              '(Opcional) Nombre o código del fermentador a asignar (ej: "F-01", "Fermentador 1")'
            ),
            createPlannedBatch: bool(
              '(Opcional) true para dar de alta el lote en estado PLANNED además del evento en el calendario (default: true)'
            ),
            notes: str('(Opcional) Notas técnicas u operativas para el día de cocción'),
          },
          ['recipeName', 'brewDate']
        ),
      },
      {
        name: 'update_fermenter_temperature',
        description:
          'Actualiza el setpoint o temperatura actual de un fermentador (-5°C a 38°C), registra automáticamente el control en el lote activo y evalúa riesgos de choque térmico o diacetilo.',
        parameters: obj(
          {
            fermenterId: str(
              'Nombre, número o ID del fermentador (ej: "1", "F-01", "Fermentador 1")'
            ),
            targetTemperatureC: numb(
              'Temperatura objetivo o registrada en °C (rango válido: -5 a 38)'
            ),
            gravityReading: numb(
              '(Opcional) Lectura de densidad específica tomada junto al ajuste térmico (ej: 1.012)'
            ),
            stageReason: str(
              '(Opcional) Etapa técnica: PRIMARY_FERM, DIACETYL_REST, DRY_HOP, COLD_CRASH, MATURATION, OTHER',
              { enum: VALID_THERMAL_REASONS }
            ),
            notes: str('(Opcional) Observaciones técnicas'),
          },
          ['fermenterId', 'targetTemperatureC']
        ),
      },
      {
        name: 'calculate_recipe_metrics',
        description:
          'Calcula todas las métricas de ingeniería de una receta: OG, FG, ABV (Hall/Lineal), IBU Tinseth exacto (con evaporación paso a paso y geometría de olla), Color Morey (SRM/EBC), relación BU:GU, tasa de inoculación de levadura y validación BJCP.',
        parameters: obj(
          {
            batchVolumeLiters: numb('Volumen final en fermentador en litros (L)'),
            boilVolumeLiters: numb('(Opcional) Volumen post-hervor en litros'),
            efficiencyPercent: numb(
              '(Opcional) Eficiencia del equipo en % (default: 75)'
            ),
            evaporationRateLPerHour: numb(
              '(Opcional) Tasa de evaporación en L/h (default: 25)'
            ),
            kettleDiameterCm: numb(
              '(Opcional) Diámetro de la olla de hervor en cm (default: 70)'
            ),
            fermentables: {
              type: 'array',
              description:
                'Lista de maltas/granos con { name, weightKg, potentialPtsPerKg, lovibond }',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nombre de la malta' },
                  weightKg: { type: 'number', description: 'Peso en kg' },
                  potentialPtsPerKg: {
                    type: 'number',
                    description: 'Potencial L°/kg (default 300)',
                  },
                  lovibond: {
                    type: 'number',
                    description: 'Color en °Lovibond (default 3)',
                  },
                },
                required: ['name', 'weightKg'],
              },
            },
            hops: {
              type: 'array',
              description:
                'Lista de adiciones de lúpulo con { name, weightGrams, alphaAcidsPercent, boilTimeMinutes, stage, form }',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Variedad de lúpulo' },
                  weightGrams: { type: 'number', description: 'Peso en gramos' },
                  alphaAcidsPercent: {
                    type: 'number',
                    description: '% de Alfa Ácidos',
                  },
                  boilTimeMinutes: {
                    type: 'number',
                    description: 'Minutos de hervor o contacto',
                  },
                  stage: {
                    type: 'string',
                    description: 'BOIL, FIRST_WORT, HOPSTAND o DRY_HOP',
                  },
                  form: {
                    type: 'string',
                    description: 'PELLET, WHOLE o PLUG',
                  },
                },
                required: ['weightGrams', 'alphaAcidsPercent', 'boilTimeMinutes'],
              },
            },
            expectedAttenuationPercent: numb(
              '(Opcional) Atenuación aparente esperada en % (default: 78)'
            ),
            yeastType: str(
              '(Opcional) Tipo de levadura: ALE, LAGER, HYBRID, HIGH_GRAVITY_ALE, HIGH_GRAVITY_LAGER',
              { enum: VALID_YEAST_STYLES }
            ),
            styleName: str(
              '(Opcional) Nombre del estilo BJCP para validar rangos (ej: "American IPA")'
            ),
          },
          ['batchVolumeLiters', 'fermentables']
        ),
      },
      {
        name: 'diagnose_fermentation',
        description:
          'Ejecuta un diagnóstico profundo de ingeniería sobre todos los lotes en fermentación/maduración buscando atenuación baja, perfiles térmicos anormales, riesgo de autólisis y riesgo de diacetilo (VDK / Hop Creep).',
        parameters: obj({
          lotCode: str('(Opcional) Filtrar por código de lote o receta específica'),
        }),
      },

      // ------------------------------ CÁLCULOS CERVECEROS FORMALES ------------------------------
      ...calcToolDeclarations,
      {
        name: 'calculate_ibu',
        description:
          'Calcula los IBUs (Tinseth) aportados por una adición de lúpulo.',
        parameters: obj(
          {
            alphaAcids: numb('Porcentaje de ácidos alfa del lúpulo (ej: 5.5)'),
            weightGrams: numb('Peso del lúpulo en gramos'),
            volumeLiters: numb('Volumen del lote en litros'),
            boilTimeMins: numb('Tiempo de hervor en minutos'),
            gravity: numb('Gravedad del mosto durante el hervor (ej: 1.050)'),
          },
          ['alphaAcids', 'weightGrams', 'volumeLiters', 'boilTimeMins', 'gravity']
        ),
      },
      {
        name: 'calculate_srm',
        description:
          'Calcula el color de la cerveza en SRM usando la ecuación de Morey.',
        parameters: obj(
          {
            mcu: numb(
              'Malt Color Units: (Peso Lbs * Color Lovibond) / Volumen Galones'
            ),
          },
          ['mcu']
        ),
      },

      // ------------------------------ LECTURA OPERATIVA ------------------------------
      {
        name: 'get_daily_briefing',
        description:
          'Resumen completo del día: agenda de hoy y atrasada, fermentadores y barriles sucios para CIP/limpieza, clientes deudores para llamar/cobrar, faltantes de stock crítico y cómo vienen los lotes en fermentación.',
        parameters: obj(),
      },
      {
        name: 'get_inventory_details',
        description: 'Lista de insumos con stock, unidad, costo y lote.',
        parameters: obj({
          filter: str(
            '(Opcional) Filtrar por nombre o tipo (MALT, HOP, YEAST, ADJUNCT, CHEMICAL, PACKAGING)'
          ),
        }),
      },
      {
        name: 'get_active_batches',
        description:
          'Lotes activos (no agotados) con estado, fermentador asignado, días desde la cocción, densidades, volúmenes, costos y últimos registros de fermentación.',
        parameters: obj(),
      },
      {
        name: 'get_batch_details',
        description:
          'Detalle completo de UN lote (activo o histórico): ingredientes, fermentador, todos los registros de fermentación, controles de calidad y perfiles sensoriales.',
        parameters: obj(
          { lotCode: str('Código del lote o nombre de la receta') },
          ['lotCode']
        ),
      },
      {
        name: 'get_batch_history',
        description:
          'Lotes terminados/históricos con ABV, costo por litro, puntaje sensorial promedio y defectos.',
        parameters: obj({
          limit: numb('Cantidad de lotes (default 10, máx 30)'),
        }),
      },
      {
        name: 'get_financial_report',
        description:
          'Reporte financiero de un mes: ingresos, gastos por categoría, ventas por tipo, ventas impagas, costos fijos configurados e historial de cierres.',
        parameters: obj({
          month: str('(Opcional) Mes en formato YYYY-MM. Default: mes actual'),
        }),
      },
      {
        name: 'get_fermenters_status',
        description:
          'Todos los fermentadores: estado (AVAILABLE, OCCUPIED, DIRTY, MAINTENANCE), capacidad en litros, lote actual que contiene y fecha de último CIP.',
        parameters: obj(),
      },
      {
        name: 'get_kegs_status',
        description:
          'Todos los barriles: estado (IN_HOUSE, WITH_CLIENT, DIRTY), ubicación, contenido, litros, si está pinchado y días con el cliente.',
        parameters: obj(),
      },
      {
        name: 'get_bottle_stock',
        description:
          'Stock de botellas/latas envasadas por estilo, formato y lote.',
        parameters: obj(),
      },
      {
        name: 'get_recipes',
        description: 'Recetas maestras con ingredientes y parámetros objetivo.',
        parameters: obj(),
      },
      {
        name: 'get_customers',
        description:
          'Clientes (CRM) con contacto, dirección, deuda y ventas totales.',
        parameters: obj({ filter: str('(Opcional) Filtrar por nombre') }),
      },
      {
        name: 'get_customer_statement',
        description:
          'Cuenta corriente de un cliente: ventas, pagos, deuda y barriles que tiene.',
        parameters: obj({ customer: str('Nombre del cliente') }, ['customer']),
      },
      {
        name: 'get_calendar_events',
        description:
          'Eventos del calendario de producción y eventos atrasados.',
        parameters: obj({
          daysAhead: numb('Días hacia adelante (default 7)'),
          daysBack: numb('Días hacia atrás (default 0)'),
          includeCompleted: bool('Incluir eventos completados'),
        }),
      },
      {
        name: 'get_shopping_list',
        description: 'Lista de compras actual.',
        parameters: obj(),
      },
      {
        name: 'generate_shopping_list',
        description:
          'Calcula qué insumos faltan para las cocciones agendadas en el calendario comparando recetas vs. inventario.',
        parameters: obj({ daysAhead: numb('Días hacia adelante (ej: 30)') }, [
          'daysAhead',
        ]),
      },
      {
        name: 'get_timers',
        description: 'Timers activos y minutos restantes.',
        parameters: obj(),
      },

      // ------------------------------ ESCRITURA OPERATIVA ------------------------------
      {
        name: 'clean_fermenter',
        description:
          'Marca un fermentador como limpio y desinfectado (CIP realizado). Pasa el estado a AVAILABLE y registra la fecha de limpieza.',
        parameters: obj(
          {
            fermenterId: str(
              'Nombre o número del fermentador (ej: "1", "Fermentador 1", "F-01")'
            ),
            notes: str(
              '(Opcional) Notas sobre el proceso de limpieza o sanitizante usado'
            ),
          },
          ['fermenterId']
        ),
      },
      {
        name: 'update_fermenter_status',
        description:
          'Cambia el estado de un fermentador (AVAILABLE, OCCUPIED, DIRTY, MAINTENANCE).',
        parameters: obj(
          {
            fermenterId: str('Nombre o número del fermentador (ej: "1", "F-02")'),
            status: str('Nuevo estado', {
              enum: ['AVAILABLE', 'OCCUPIED', 'DIRTY', 'MAINTENANCE'],
            }),
            notes: str('(Opcional) Observaciones o motivos'),
          },
          ['fermenterId', 'status']
        ),
      },
      {
        name: 'assign_fermenter',
        description:
          'Asigna un lote de cerveza en producción a un fermentador específico y lo pasa a OCCUPIED.',
        parameters: obj(
          {
            fermenterId: str(
              'Nombre o número del fermentador (ej: "1", "Fermentador 2")'
            ),
            lotCode: str('Código del lote o receta'),
          },
          ['fermenterId', 'lotCode']
        ),
      },
      {
        name: 'update_keg_status',
        description:
          'Cambia el estado de un barril (IN_HOUSE, WITH_CLIENT, DIRTY).',
        parameters: obj(
          {
            kegId: str('Número o código del barril (ej: "045", "12")'),
            status: str('Nuevo estado', {
              enum: ['IN_HOUSE', 'WITH_CLIENT', 'DIRTY'],
            }),
            customer: str('(Opcional, para WITH_CLIENT) Nombre del cliente'),
            location: str('(Opcional) Ubicación'),
          },
          ['kegId', 'status']
        ),
      },
      {
        name: 'update_inventory',
        description:
          'Modifica el stock de un insumo usando amountChange (+/-) o newAmount.',
        parameters: obj(
          {
            ingredientName: str('Nombre del insumo'),
            amountChange: numb(
              'Cantidad a sumar (positivo) o restar (negativo)'
            ),
            newAmount: numb('(Alternativa) Nuevo stock absoluto'),
          },
          ['ingredientName']
        ),
      },
      {
        name: 'edit_ingredient',
        description:
          'Edita datos de un insumo existente: precio por unidad, número de lote, nombre o unidad.',
        parameters: obj(
          {
            ingredientName: str('Nombre actual del insumo'),
            costPerUnit: numb('Nuevo costo por unidad'),
            lotNumber: str('Nuevo número de lote'),
            newName: str('Nuevo nombre'),
            unit: str('Nueva unidad'),
          },
          ['ingredientName']
        ),
      },
      {
        name: 'add_ingredient',
        description:
          'Da de alta un insumo NUEVO (registra automáticamente el gasto de compra).',
        parameters: obj(
          {
            name: str('Nombre'),
            type: str('Tipo', { enum: VALID_CATEGORIES }),
            stockAmount: numb('Cantidad comprada'),
            unit: str('Unidad (kg, g, L, sobres, unidades)'),
            costPerUnit: numb('Costo por unidad'),
            lotNumber: str('(Opcional) Lote del proveedor'),
          },
          ['name', 'type', 'stockAmount', 'unit', 'costPerUnit']
        ),
      },
      {
        name: 'update_batch_status',
        description:
          'Cambia el estado de un lote (PLANNED, MASHING, FERMENTING, CONDITIONING, PACKAGED, COMPLETED).',
        parameters: obj(
          {
            lotCode: str('Código del lote o nombre de la receta'),
            status: str('Nuevo estado', {
              enum: [
                'PLANNED',
                'MASHING',
                'FERMENTING',
                'CONDITIONING',
                'PACKAGED',
                'COMPLETED',
              ],
            }),
            volumePackaged: numb(
              '(Requerido para PACKAGED si el lote no lo tiene) Litros finales'
            ),
          },
          ['lotCode', 'status']
        ),
      },
      {
        name: 'add_fermentation_log',
        description:
          'Registra una medición o acción en la fermentación de un lote (densidad, temperatura, dry hop, purga, trasiego, etc.).',
        parameters: obj(
          {
            lotCode: str('Código del lote o receta'),
            action: str('Tipo de registro', {
              enum: [
                'MEDICION',
                'DRY_HOP',
                'CLARIFICANTE',
                'PURGA',
                'TRASIEGO',
                'OTRO',
              ],
            }),
            gravity: numb('Densidad (ej: 1.012)'),
            temperature: numb('Temperatura en °C'),
            notes: str('Notas'),
            date: str('(Opcional) Fecha YYYY-MM-DD, default hoy'),
          },
          ['lotCode']
        ),
      },
      {
        name: 'add_quality_log',
        description:
          'Registra un control de calidad en un lote (pH, densidad, temperatura, carbonatación, nota sensorial, análisis de laboratorio).',
        parameters: obj(
          {
            lotCode: str('Código del lote o receta'),
            type: str('Tipo', {
              enum: [
                'PH',
                'GRAVITY',
                'TEMPERATURE',
                'CARBONATION',
                'SENSORY',
                'LAB_ANALYSIS',
              ],
            }),
            value: str('Valor medido (número o texto)'),
            unit: str('(Opcional) Unidad'),
            notes: str('(Opcional) Notas'),
            technician: str('(Opcional) Quién midió'),
          },
          ['lotCode', 'type', 'value']
        ),
      },
      {
        name: 'fill_keg_from_batch',
        description:
          'Llena un barril con cerveza de un lote Finalizado (descuenta litros del lote).',
        parameters: obj(
          {
            kegId: str('Número o código del barril'),
            lotCode: str('Código del lote o receta'),
            liters: numb('(Opcional) Litros; default capacidad del barril'),
            confirmClean: bool(
              'true solo si el usuario confirmó que el barril ya está limpio'
            ),
          },
          ['kegId', 'lotCode']
        ),
      },
      {
        name: 'tap_keg',
        description: 'Pincha (o despincha) un barril en la canilla del taproom.',
        parameters: obj(
          {
            kegId: str('Número o código del barril'),
            tapped: bool('true = pinchar, false = despinchar'),
          },
          ['kegId']
        ),
      },
      {
        name: 'serve_from_tap',
        description:
          'Registra una venta servida desde la canilla (descuenta litros del barril y crea la venta TAPROOM).',
        parameters: obj(
          {
            kegId: str('Barril pinchado'),
            liters: numb('Litros servidos (pinta = 0.5)'),
            formatName: str('Formato (ej: "Pinta", "Media pinta")'),
            price: numb('Precio cobrado'),
          },
          ['kegId', 'liters', 'price']
        ),
      },
      {
        name: 'gift_from_tap',
        description:
          'Registra cerveza regalada desde la canilla (descuenta litros y registra el costo como gasto REGALO).',
        parameters: obj(
          {
            kegId: str('Barril pinchado'),
            liters: numb('Litros'),
            formatName: str('Formato'),
          },
          ['kegId', 'liters']
        ),
      },
      {
        name: 'update_bottle_stock',
        description:
          'Suma o resta unidades del stock de botellas/latas.',
        parameters: obj(
          {
            bottle: str('Estilo y/o formato o lote'),
            quantityChange: numb('Unidades (negativo resta)'),
          },
          ['bottle', 'quantityChange']
        ),
      },
      {
        name: 'gift_bottle',
        description:
          'Registra botellas regaladas (descuenta stock y registra el costo como gasto REGALO).',
        parameters: obj(
          {
            bottle: str('Estilo y/o formato'),
            quantity: numb('Unidades'),
          },
          ['bottle', 'quantity']
        ),
      },
      {
        name: 'add_sale',
        description:
          'Registra una venta comercial (KEG, BOTTLE o TAPROOM).',
        parameters: obj(
          {
            amount: numb('Monto total'),
            description: str('Descripción'),
            type: str('Tipo de venta', { enum: ['KEG', 'BOTTLE', 'TAPROOM'] }),
            customer: str('(Opcional) Nombre del cliente del CRM'),
            isPaid: bool('(Opcional) true si ya se cobró'),
            quantity: numb('(Opcional) Cantidad de unidades'),
            lotCode: str('(Opcional) Lote vendido'),
          },
          ['amount', 'description', 'type']
        ),
      },
      {
        name: 'add_payment',
        description: 'Registra un pago recibido de un cliente (baja su deuda).',
        parameters: obj(
          {
            customer: str('Nombre del cliente'),
            amount: numb('Monto'),
            notes: str('Notas'),
          },
          ['customer', 'amount']
        ),
      },
      {
        name: 'add_expense',
        description: 'Registra un gasto operativo.',
        parameters: obj(
          {
            description: str('Descripción'),
            amount: numb('Monto'),
            category: str('Categoría', {
              enum: [
                'INVENTORY',
                'FIXED',
                'MAINTENANCE',
                'MARKETING',
                'LOGISTICS',
                'ADMIN',
                'OTHER',
                'REGALO',
              ],
            }),
          },
          ['description', 'amount', 'category']
        ),
      },
      {
        name: 'add_customer',
        description: 'Crea un cliente nuevo en el CRM.',
        parameters: obj(
          {
            name: str('Nombre o negocio'),
            contact: str('Teléfono o email'),
            address: str('Dirección o zona'),
            debt: numb('Deuda inicial (0 si no tiene)'),
          },
          ['name']
        ),
      },
      {
        name: 'update_customer',
        description: 'Actualiza datos de un cliente.',
        parameters: obj(
          {
            customer: str('Nombre actual del cliente'),
            name: str('Nuevo nombre'),
            contact: str('Contacto'),
            address: str('Dirección'),
            debt: numb('Deuda corregida'),
          },
          ['customer']
        ),
      },
      {
        name: 'add_calendar_event',
        description: 'Agenda un evento en el calendario de producción.',
        parameters: obj(
          {
            title: str('Título (ej: "Cocción IPA", "Entrega Bar X")'),
            date: str('Fecha YYYY-MM-DD'),
            type: str('Tipo', {
              enum: [
                'BREW',
                'FERMENTATION_END',
                'MATURATION_START',
                'PACKAGING',
                'MAINTENANCE',
                'DELIVERY',
                'CLEANING',
                'CUSTOM',
              ],
            }),
            notes: str('(Opcional) Notas u hora'),
            lotCode: str('(Opcional) Lote relacionado'),
          },
          ['title', 'date']
        ),
      },
      {
        name: 'complete_calendar_event',
        description: 'Marca como hecho un evento pendiente del calendario.',
        parameters: obj({ event: str('Título del evento') }, ['event']),
      },
      {
        name: 'add_to_shopping_list',
        description: 'Agrega un ítem a la lista de compras.',
        parameters: obj(
          {
            text: str('Qué comprar (ej: "25 kg Malta Pilsen")'),
            estimatedCost: numb('(Opcional) Costo estimado'),
          },
          ['text']
        ),
      },
      {
        name: 'undo_last_action',
        description:
          'Deshace la última acción reversible ejecutada por el asistente.',
        parameters: obj(),
      },
      {
        name: 'navigate_to',
        description: 'Abre una sección de la app.',
        parameters: obj(
          {
            section: str(
              'Sección: inicio, produccion, inventario, envasado, calculadoras, chat, clientes, recetas, calendario, coccion'
            ),
          },
          ['section']
        ),
      },
      {
        name: 'set_timer',
        description: 'Programa un timer/recordatorio con alerta sonora y de voz.',
        parameters: obj(
          {
            minutes: numb('Minutos (1 a 1440)'),
            label: str('Qué hay que hacer cuando suene'),
          },
          ['minutes']
        ),
      },
      {
        name: 'cancel_timer',
        description: 'Cancela un timer activo.',
        parameters: obj({
          label: str('(Opcional) Nombre del timer; default el último'),
        }),
      },
    ],
  },
];

// ============================================================================
// 5. MAPA DE HANDLERS Y DESPACHADOR SEGURO (executeTool)
// ============================================================================

type ToolHandler = (args: Record<string, unknown>) => ToolResult;

const HANDLERS: Record<string, ToolHandler> = {
  // 4 Herramientas principales con tipado y validación estricta
  query_inventory: (args) => executeQueryInventory(args),
  schedule_batch: (args) => executeScheduleBatch(args),
  update_fermenter_temperature: (args) => executeUpdateFermenterTemperature(args),
  calculate_recipe_metrics: (args) => executeCalculateRecipeMetrics(args),

  diagnose_fermentation: (args) => {
    const state = useBreweryStore.getState();
    const lotFilter =
      typeof args.lotCode === 'string' ? normalizeText(args.lotCode) : '';
    const targetBatches = lotFilter
      ? state.batches.filter(
          (b) =>
            normalizeText(b.lotCode).includes(lotFilter) ||
            normalizeText(b.recipeName).includes(lotFilter)
        )
      : state.batches;
    const alerts = diagnoseFermentationDeviations(
      targetBatches,
      state.fermenters
    );
    return {
      success: true,
      analyzedBatchesCount: targetBatches.filter(
        (b) =>
          b.status === BatchStatus.FERMENTING ||
          b.status === BatchStatus.CONDITIONING
      ).length,
      alertsCount: alerts.length,
      alerts,
    };
  },

  // Herramientas de cálculo formal de lib/brewmath.ts (con slot-filling y deep links)
  ...calcToolHandlers,

  calculate_ibu: (raw) => {
    const alphaAcids = sanitizePositiveNumber(raw.alphaAcids, 0, 100);
    const weightGrams = sanitizePositiveNumber(raw.weightGrams, 0, 50000);
    const volumeLiters = sanitizePositiveNumber(raw.volumeLiters, 0, 20000);
    const boilTimeMins = sanitizePositiveNumber(raw.boilTimeMins, 0, 240);
    const gravity = sanitizeGravity(raw.gravity, 1.05);
    if (volumeLiters <= 0 || weightGrams <= 0 || alphaAcids <= 0) {
      return { error: 'Parámetros inválidos: volumeLiters, weightGrams y alphaAcids deben ser > 0.' };
    }
    const res = calculateTinsethIBUBreakdown(
      [{ amount: weightGrams, alpha: alphaAcids, time: boilTimeMins, type: 'BOIL' }],
      volumeLiters,
      gravity
    );
    return { ibu: Number(res.totalIBU.toFixed(2)) };
  },
  calculate_srm: (raw) => {
    const mcu = sanitizePositiveNumber(raw.mcu, 0, 5000);
    return { srm: Number((1.4922 * Math.pow(mcu, 0.6859)).toFixed(2)) };
  },

  // Lectura y escritura delegada a aiActions
  get_daily_briefing: () => aiActions.getDailyBriefing(),
  get_inventory_details: (a) => aiActions.getInventoryDetails(a as { filter?: string }),
  get_active_batches: () => aiActions.getActiveBatches(),
  get_batch_details: (a) => aiActions.getBatchDetails(a as { lotCode: string }),
  get_batch_history: (a) => aiActions.getBatchHistory(a as { limit?: number }),
  get_financial_report: (a) => aiActions.getFinancialReport(a as { month?: string }),
  get_fermenters_status: () => aiActions.getFermentersStatus(),
  get_kegs_status: () => aiActions.getKegsStatus(),
  get_bottle_stock: () => aiActions.getBottleStock(),
  get_recipes: () => aiActions.getRecipes(),
  get_customers: (a) => aiActions.getCustomers(a as { filter?: string }),
  get_customer_statement: (a) => aiActions.getCustomerStatement(a as { customer: string }),
  get_calendar_events: (a) =>
    aiActions.getCalendarEvents(
      a as { daysAhead?: number; daysBack?: number; includeCompleted?: boolean }
    ),
  get_shopping_list: () => aiActions.getShoppingList(),
  generate_shopping_list: (a) =>
    aiActions.generateShoppingList(a as { daysAhead?: number }),
  get_timers: () => aiActions.getTimers(),

  clean_fermenter: (a) =>
    aiActions.cleanFermenter(a as { fermenterId: string; notes?: string }),
  update_fermenter_status: (a) =>
    aiActions.updateFermenterStatus(
      a as { fermenterId: string; status: string; notes?: string }
    ),
  assign_fermenter: (a) =>
    aiActions.assignBatchToFermenter(
      a as { fermenterId: string; lotCode: string }
    ),
  update_keg_status: (a) =>
    aiActions.updateKegStatus(
      a as { kegId: string; status: string; location?: string; customer?: string }
    ),
  update_inventory: (a) =>
    aiActions.updateInventory(
      a as { ingredientName: string; amountChange?: number; newAmount?: number }
    ),
  edit_ingredient: (a) =>
    aiActions.editIngredient(
      a as {
        ingredientName: string;
        costPerUnit?: number;
        lotNumber?: string;
        newName?: string;
        unit?: string;
      }
    ),
  add_ingredient: (a) =>
    aiActions.addIngredient(
      a as {
        name: string;
        type: string;
        stockAmount: number;
        unit: string;
        costPerUnit: number;
        lotNumber?: string;
      }
    ),
  update_batch_status: (a) =>
    aiActions.updateBatchStatus(
      a as { lotCode: string; status: string; volumePackaged?: number }
    ),
  add_fermentation_log: (a) =>
    aiActions.addFermentationLog(
      a as {
        lotCode: string;
        action?: string;
        gravity?: number;
        temperature?: number;
        notes?: string;
        date?: string;
      }
    ),
  add_quality_log: (a) =>
    aiActions.addQualityLog(
      a as {
        lotCode: string;
        type: string;
        value: string | number;
        unit?: string;
        notes?: string;
        technician?: string;
      }
    ),
  fill_keg_from_batch: (a) =>
    aiActions.fillKegFromBatch(
      a as {
        kegId: string;
        lotCode: string;
        liters?: number;
        confirmClean?: boolean;
      }
    ),
  tap_keg: (a) => aiActions.tapKeg(a as { kegId: string; tapped?: boolean }),
  serve_from_tap: (a) =>
    aiActions.serveFromTap(
      a as { kegId: string; liters: number; formatName: string; price: number }
    ),
  gift_from_tap: (a) =>
    aiActions.giftFromTap(
      a as { kegId: string; liters: number; formatName: string }
    ),
  update_bottle_stock: (a) =>
    aiActions.updateBottleStock(
      a as { bottle: string; quantityChange: number }
    ),
  gift_bottle: (a) =>
    aiActions.giftBottle(a as { bottle: string; quantity: number }),
  add_sale: (a) =>
    aiActions.addSale(
      a as {
        amount: number;
        description: string;
        type: string;
        customer?: string;
        isPaid?: boolean;
        quantity?: number;
        lotCode?: string;
      }
    ),
  add_payment: (a) =>
    aiActions.addPayment(
      a as { customer: string; amount: number; notes?: string }
    ),
  add_expense: (a) =>
    aiActions.addExpense(
      a as { description: string; amount: number; category: string }
    ),
  add_customer: (a) =>
    aiActions.addCustomer(
      a as { name: string; contact?: string; address?: string; debt?: number }
    ),
  update_customer: (a) =>
    aiActions.updateCustomer(
      a as {
        customer: string;
        name?: string;
        contact?: string;
        address?: string;
        debt?: number;
      }
    ),
  add_calendar_event: (a) =>
    aiActions.addCalendarEvent(
      a as {
        title: string;
        date: string;
        type?: string;
        notes?: string;
        lotCode?: string;
      }
    ),
  complete_calendar_event: (a) =>
    aiActions.completeCalendarEvent(a as { event: string }),
  add_to_shopping_list: (a) =>
    aiActions.addToShoppingList(a as { text: string; estimatedCost?: number }),
  undo_last_action: () => aiActions.undoLastAction(),

  navigate_to: (a) => aiActions.navigateTo(a as { section: string }),
  set_timer: (a) => aiActions.setTimer(a as { minutes: number; label?: string }),
  cancel_timer: (a) => aiActions.cancelTimer(a as { label?: string }),
};

/**
 * Valida que los argumentos crudos sean un objeto seguro y ejecuta la herramienta solicitada.
 * Nunca lanza excepciones no controladas: devuelve `{ error }` descriptivo para que el agente informe al usuario.
 */
export const executeTool = (
  name: string,
  args: unknown
): ToolResult => {
  const handler = HANDLERS[name];
  if (!handler) {
    return { error: `Herramienta desconocida: "${name}".` };
  }

  if (args !== undefined && args !== null && (typeof args !== 'object' || Array.isArray(args))) {
    return {
      error: `Argumentos inválidos para "${name}": se esperaba un objeto JSON de parámetros.`,
    };
  }

  try {
    const safeArgs = (args as Record<string, unknown>) || {};
    const result = handler(safeArgs);
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result
      : { result };
  } catch (e) {
    console.error(`[AI tools] Error ejecutando ${name}:`, e);
    return {
      error: `Falló la ejecución de ${name}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
};
