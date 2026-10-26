/**
 * @fileoverview BrewMath — Motor de ingeniería cervecera y algoritmos físico-químicos para Bon-Gestión.
 *
 * Incluye:
 * 1. Sanitización y normalización estricta de entradas numéricas (comas/puntos, rangos físicos, gravedades).
 * 2. Densimetría avanzada:
 *    - Conversión exacta Gravedad Específica (SG) ↔ Grados Plato (°P) (Polinomio cúbico ASBC / Lincoln).
 *    - Corrección refractométrica en presencia de alcohol (Ecuación cúbica de Sean Terrill y modelo de Petr Novotny).
 *    - Corrección hidrométrica por temperatura (Ecuación de Thiesen / ASBC).
 * 3. Amargor (IBU):
 *    - Algoritmo de Glenn Tinseth exacto con integración paso a paso de la gravedad de hervor (concentración por evaporación),
 *      factor de utilización geométrica de olla (relación de aspecto D/H), factor por formato de lúpulo (pellet/flor/plug),
 *      isomerización sub-hervor en Hopstand/Whirlpool (modelo cinético de Malowicki) y corrección por alta densidad (> 1.050).
 * 4. Carbonatación:
 *    - Presión de equilibrio manométrica (PSI, Bar, kPa) según Ley de Henry / regresión ASBC (Zahm & Nagel).
 *    - Catálogo de volúmenes de CO2 recomendados por estilo BJCP 2021.
 *    - Carbonatación natural (Priming) con CO2 residual térmico y rendimiento fermentable por tipo de azúcar.
 * 5. Fermentación e Inoculación (Pitching Rate):
 *    - Cálculo de tasa de inoculación en celdas/mL/°P según familia de estilo (Ale, Lager, High Gravity Ale/Lager, Hybrid),
 *      viabilidad celular, paquetes requeridos y dosificación en gramos de levadura seca.
 *    - Propagación de starters de levadura (modelos de Braukaiser / Chris White).
 * 6. Maceración, Agua, Color y Termodinámica:
 *    - Temperatura de empaste (Strike Water - Palmer), balance hídrico de macerado/lavado (Sparge),
 *      color SRM/EBC (Ecuación de Morey), química de sales y relación SO4/Cl, acidificación por alcalinidad residual,
 *      parti-gyle (curva de extracción de Mosher/Braukaiser), dilución, dry hop, cold crash, calorías ASBC y termodinámica.
 */

// ============================================================================
// 1. SANITIZACIÓN DE INPUTS Y TIPOS BASE
// ============================================================================

/**
 * Opciones de configuración para la sanitización de valores numéricos.
 */
export interface SanitizeNumberOptions {
  /** Valor por defecto si el input es inválido, vacío o NaN (default: 0) */
  fallback?: number;
  /** Límite inferior permitido (default: 0 cuando allowNegative es false) */
  min?: number;
  /** Límite superior permitido (default: Number.MAX_SAFE_INTEGER) */
  max?: number;
  /** Permite valores negativos (default: false; activar solo para temperaturas bajo cero) */
  allowNegative?: boolean;
  /** Cantidad opcional de decimales para redondeo de precisión */
  decimals?: number;
}

/**
 * Normaliza y sanitiza cualquier entrada de usuario (número o string con coma/punto decimal),
 * evitando valores `NaN`, `Infinity` o negativos físicamente imposibles.
 *
 * - Convierte comas decimales (`,`) en puntos (`.`).
 * - Si existen múltiples separadores (ej. `"1.050,5"`), interpreta el último como separador decimal.
 * - Elimina caracteres no numéricos accidentales (espacios, unidades).
 * - Aplica límites `min` y `max` estrictos.
 *
 * @param input - Valor crudo ingresado por el usuario o proveniente de un input HTML.
 * @param options - Reglas de validación, límites y valor de respaldo.
 * @returns Número finito, normalizado y acotado dentro del rango físico válido.
 */
export function sanitizeNumber(
  input: unknown,
  options: SanitizeNumberOptions = {}
): number {
  const {
    fallback = 0,
    allowNegative = false,
    min = allowNegative ? -Infinity : 0,
    max = Infinity,
    decimals,
  } = options;

  const clampAndRound = (val: number): number => {
    const effectiveMin = allowNegative ? min : Math.max(0, min);
    const clamped = Math.min(max, Math.max(effectiveMin, val));
    if (typeof decimals === 'number' && decimals >= 0) {
      const factor = Math.pow(10, decimals);
      return Math.round((clamped + Number.EPSILON) * factor) / factor;
    }
    return clamped;
  };

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return clampAndRound(fallback);
    }
    return clampAndRound(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === ',') {
      return clampAndRound(fallback);
    }

    // Normalizar separadores decimales (soporta coma europea y punto anglosajón)
    let normalized = trimmed.replace(/\s+/g, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // Formato "1.234,56" -> "1234.56"
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato "1,234.56" -> "1234.56"
        normalized = normalized.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // Si hay más de una coma, dejar solo la última como punto decimal
      const parts = normalized.split(',');
      normalized =
        parts.length > 2
          ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`
          : normalized.replace(',', '.');
    }

    // Limpiar cualquier caracter extraño conservando dígitos, signo menos inicial y punto
    normalized = normalized.replace(/(?!^-)[^0-9.]/g, '');
    const parsed = Number.parseFloat(normalized);

    if (!Number.isFinite(parsed)) {
      return clampAndRound(fallback);
    }

    return clampAndRound(parsed);
  }

  return clampAndRound(fallback);
}

/**
 * Helper rápido para sanitizar magnitudes físicas estrictamente no negativas
 * (masas, volúmenes, tiempos, concentraciones, presiones).
 *
 * @param input - Valor a sanitizar.
 * @param fallback - Valor de respaldo si el input es inválido (default: 0).
 * @param max - Valor máximo permitido (opcional).
 * @returns Número finito >= 0.
 */
export function sanitizePositiveNumber(
  input: unknown,
  fallback: number = 0,
  max: number = Infinity
): number {
  return sanitizeNumber(input, {
    fallback: Math.max(0, fallback),
    min: 0,
    max,
    allowNegative: false,
  });
}

/**
 * Sanitiza y normaliza un valor de Gravedad Específica (SG).
 *
 * - Convierte automáticamente entradas expresadas en puntos enteros (ej. `1050` → `1.050`).
 * - Acepta formato con coma o punto (`"1,054"` → `1.054`).
 * - Acota al rango físico cervecero `[0.980, 2.000]`.
 *
 * @param input - Lectura de gravedad específica (ej. `1.050`, `"1,050"` o `1050`).
 * @param fallback - Gravedad por defecto si el valor es inválido (default: `1.000`).
 * @returns Gravedad específica normalizada (ej. `1.050`).
 */
export function sanitizeGravity(input: unknown, fallback: number = 1.0): number {
  const raw = sanitizeNumber(input, {
    fallback,
    min: 0,
    max: 2000,
    allowNegative: false,
  });

  if (raw === 0) return fallback;

  // Si el usuario ingresa "1050" en lugar de "1.050", normalizamos dividiendo por 1000
  const normalized = raw >= 980 && raw <= 2000 ? raw / 1000 : raw;

  if (normalized < 0.98 || normalized > 2.0) {
    return fallback;
  }

  return Number(normalized.toFixed(4));
}

/**
 * Sanitiza lecturas de temperatura en grados Celsius (°C), permitiendo valores bajo cero
 * físicamente válidos en cervecería (ej. Cold Crash a -2°C) pero impidiendo valores imposibles.
 *
 * @param input - Temperatura en °C.
 * @param fallback - Temperatura por defecto (default: 20°C).
 * @param min - Temperatura mínima permitida (default: -20°C).
 * @param max - Temperatura máxima permitida (default: 120°C).
 * @returns Temperatura sanitizada en °C.
 */
export function sanitizeTemperatureC(
  input: unknown,
  fallback: number = 20,
  min: number = -20,
  max: number = 120
): number {
  return sanitizeNumber(input, {
    fallback,
    min,
    max,
    allowNegative: true,
  });
}

// ============================================================================
// 2. DENSIDAD, PLATO, REFRACTÓMETRO (TERRILL / NOVOTNY) Y TEMPERATURA (THIESEN)
// ============================================================================

/**
 * Modelo matemático para la corrección de lecturas de refractómetro con alcohol presente.
 * - `'TERRILL'`: Polinomio cúbico de Sean Terrill (2011), ideal para cervezas totalmente atenuadas.
 * - `'NOVOTNY'`: Modelo cuadrático de Petr Novotny, más estable durante fermentación activa (alta FG/OG).
 * - `'AUTO'`: Selecciona automáticamente Novotny si Bf/Bi > 0.60 y Terrill para mostos atenuados (Bf/Bi <= 0.60).
 */
export type RefractometerModel = 'TERRILL' | 'NOVOTNY' | 'AUTO';

/**
 * Resultado detallado de la conversión y corrección refractométrica.
 */
export interface RefractometerCorrectionResult {
  /** Brix inicial corregido por el factor de corrección de mosto (WCF) */
  correctedOgBrix: number;
  /** Brix final aparente corregido por WCF */
  correctedFgBrix: number;
  /** Gravedad Específica Original (OG) */
  ogSG: number;
  /** Gravedad Específica Final (FG) según el modelo seleccionado */
  fgSG: number;
  /** FG calculada específicamente con la ecuación cúbica de Sean Terrill */
  fgSGTerrill: number;
  /** FG calculada específicamente con la ecuación cuadrática de Petr Novotny */
  fgSGNovotny: number;
  /** Grados Plato iniciales (°P) */
  ogPlato: number;
  /** Extracto Aparente final en °Plato */
  apparentExtractPlato: number;
  /** Extracto Real (Real Extract - Balling) en °Plato */
  realExtractPlato: number;
  /** Alcohol por Volumen (% ABV) por fórmula lineal estándar */
  abvStandard: number;
  /** Alcohol por Volumen (% ABV) por ecuación no lineal de Hall / ASBC */
  abvHall: number;
  /** Atenuación Aparente (0-100 %) */
  apparentAttenuation: number;
  /** Atenuación Real de Balling (0-100 %) */
  realAttenuation: number;
  /** Modelo efectivamente aplicado ('TERRILL' | 'NOVOTNY') */
  activeModel: 'TERRILL' | 'NOVOTNY';
}

/**
 * Convierte Gravedad Específica (SG a 20°C/20°C) a Grados Plato (°P)
 * utilizando el polinomio cúbico oficial de la ASBC (Lincoln Equation).
 *
 * Fórmula:
 * °P = -616.868 + 1111.14·SG - 630.272·SG² + 135.997·SG³
 *
 * @param sg - Gravedad Específica (ej. 1.050).
 * @returns Grados Plato (°P, % p/p de sacarosa equivalente).
 */
export function sgToPlato(sg: number): number {
  const cleanSg = sanitizeGravity(sg, 1.0);
  if (cleanSg <= 1.0) return 0;
  const plato =
    -616.868 +
    1111.14 * cleanSg -
    630.272 * Math.pow(cleanSg, 2) +
    135.997 * Math.pow(cleanSg, 3);
  return Math.max(0, plato);
}

/**
 * Convierte Grados Plato (°P) o Brix corregido de mosto sin fermentar a Gravedad Específica (SG).
 *
 * Fórmula racional de la ASBC:
 * SG = 1 + [ °P / (258.6 - (°P / 258.2) × 227.1) ]
 *
 * @param plato - Grados Plato (°P).
 * @returns Gravedad Específica (SG, ej. 1.048).
 */
export function platoToSg(plato: number): number {
  const cleanPlato = sanitizePositiveNumber(plato, 0, 65);
  if (cleanPlato <= 0) return 1.0;
  const denominator = 258.6 - (cleanPlato / 258.2) * 227.1;
  if (denominator <= 0) return 1.0;
  return 1 + cleanPlato / denominator;
}

/**
 * Convierte una lectura de grados Brix pre-fermentación a Gravedad Específica (SG),
 * aplicando el Factor de Corrección del Mosto (WCF, típicamente 1.04).
 *
 * @param brix - Lectura del refractómetro en °Brix.
 * @param wcf - Factor de corrección de mosto (default: 1.04).
 * @returns Gravedad Específica (SG).
 */
export function brixToSg(brix: number, wcf: number = 1.04): number {
  const cleanBrix = sanitizePositiveNumber(brix, 0, 65);
  const cleanWcf = sanitizeNumber(wcf, { fallback: 1.04, min: 0.9, max: 1.2 });
  const plato = cleanBrix / cleanWcf;
  return platoToSg(plato);
}

/**
 * Calcula la Gravedad Específica Final (FG) a partir de lecturas Brix inicial y final
 * usando la regresión cúbica de **Sean Terrill (2011)** para mosto fermentado con alcohol.
 *
 * Fórmula de Terrill:
 * FG = 1.0000 - 0.0044993·Bi + 0.011774·Bf + 0.00027581·Bi² - 0.0012717·Bf² - 0.0000072800·Bi³ + 0.000063293·Bf³
 * Donde Bi = OG_Brix / WCF y Bf = FG_Brix / WCF.
 *
 * @param correctedOgBrix - Brix original ya dividido por WCF (°P inicial).
 * @param correctedFgBrix - Brix final aparente ya dividido por WCF.
 * @returns Gravedad Específica Final corregida por alcohol (SG).
 */
export function calculateTerrillFG(
  correctedOgBrix: number,
  correctedFgBrix: number
): number {
  const bi = sanitizePositiveNumber(correctedOgBrix, 0, 60);
  const bf = sanitizePositiveNumber(correctedFgBrix, 0, 60);

  if (bi <= 0) return 1.0;
  if (bf >= bi) return platoToSg(bi);

  const fg =
    1.0 -
    0.0044993 * bi +
    0.011774 * bf +
    0.00027581 * Math.pow(bi, 2) -
    0.0012717 * Math.pow(bf, 2) -
    0.00000728 * Math.pow(bi, 3) +
    0.000063293 * Math.pow(bf, 3);

  return Math.max(0.985, Math.min(platoToSg(bi), fg));
}

/**
 * Calcula la Gravedad Específica Final (FG) a partir de lecturas Brix inicial y final
 * usando el modelo cuadrático de **Petr Novotny** para mosto en fermentación.
 *
 * Fórmula de Novotny:
 * FG = 1.0000 - 0.002349·Bi + 0.006276·Bf + 0.00003072·Bi² + 0.0000172·Bf² - 0.00002816·Bi·Bf
 *
 * Es especialmente preciso durante la fermentación activa (cuando Bf es cercano a Bi)
 * donde el polinomio cúbico de Terrill tiende a subestimar o sobreestimar la densidad.
 *
 * @param correctedOgBrix - Brix original ya dividido por WCF (°P inicial).
 * @param correctedFgBrix - Brix final aparente ya dividido por WCF.
 * @returns Gravedad Específica Final corregida por alcohol (SG).
 */
export function calculateNovotnyFG(
  correctedOgBrix: number,
  correctedFgBrix: number
): number {
  const bi = sanitizePositiveNumber(correctedOgBrix, 0, 60);
  const bf = sanitizePositiveNumber(correctedFgBrix, 0, 60);

  if (bi <= 0) return 1.0;
  if (bf >= bi) return platoToSg(bi);

  const fg =
    1.0 -
    0.002349 * bi +
    0.006276 * bf +
    0.00003072 * Math.pow(bi, 2) +
    0.0000172 * Math.pow(bf, 2) -
    0.00002816 * bi * bf;

  return Math.max(0.985, Math.min(platoToSg(bi), fg));
}

/**
 * Realiza la corrección completa de lecturas de refractómetro con presencia de alcohol
 * combinando las formulaciones de **Sean Terrill** y **Petr Novotny**, además del cálculo
 * de Extracto Real de Balling, Atenuación Aparente/Real y ABV.
 *
 * @param ogBrix - Lectura inicial del refractómetro (°Brix pre-fermentación).
 * @param fgBrix - Lectura actual/final del refractómetro (°Brix con alcohol).
 * @param wcf - Wort Correction Factor del instrumento (default: 1.04).
 * @param model - Modelo de corrección: `'TERRILL'`, `'NOVOTNY'` o `'AUTO'` (default: `'TERRILL'`).
 * @returns Objeto completo `RefractometerCorrectionResult` con densidades, extractos y alcohol.
 */
export function correctRefractometerReading(
  ogBrix: number,
  fgBrix: number,
  wcf: number = 1.04,
  model: RefractometerModel = 'TERRILL'
): RefractometerCorrectionResult {
  const cleanOgBrix = sanitizePositiveNumber(ogBrix, 0, 60);
  const cleanFgBrix = sanitizePositiveNumber(fgBrix, 0, 60);
  const cleanWcf = sanitizeNumber(wcf, { fallback: 1.04, min: 0.9, max: 1.2 });

  const correctedOgBrix = cleanOgBrix / cleanWcf;
  const correctedFgBrix = Math.min(correctedOgBrix, cleanFgBrix / cleanWcf);

  const ogSG = platoToSg(correctedOgBrix);
  const fgSGTerrill = calculateTerrillFG(correctedOgBrix, correctedFgBrix);
  const fgSGNovotny = calculateNovotnyFG(correctedOgBrix, correctedFgBrix);

  // En modo AUTO: si la relación Bf/Bi > 0.60 (inicio/mitad de fermentación), Novotny evita el desvío cúbico de Terrill
  const ratio = correctedOgBrix > 0 ? correctedFgBrix / correctedOgBrix : 0;
  const activeModel: 'TERRILL' | 'NOVOTNY' =
    model === 'AUTO' ? (ratio > 0.6 ? 'NOVOTNY' : 'TERRILL') : model;

  const fgSG = activeModel === 'NOVOTNY' ? fgSGNovotny : fgSGTerrill;
  const ogPlato = correctedOgBrix;
  const apparentExtractPlato = fgSG > 1 ? sgToPlato(fgSG) : 0;
  const realExtractPlato =
    0.1808 * ogPlato + 0.8192 * apparentExtractPlato;

  const abvStandard = calculateABV(ogSG, fgSG);
  const abvHall = calculateABVAdvanced(ogSG, fgSG).abv;
  const apparentAttenuation = calculateAttenuation(ogSG, fgSG);
  const realAttenuation = calculateRealAttenuation(ogSG, fgSG);

  return {
    correctedOgBrix,
    correctedFgBrix,
    ogSG,
    fgSG,
    fgSGTerrill,
    fgSGNovotny,
    ogPlato,
    apparentExtractPlato,
    realExtractPlato,
    abvStandard,
    abvHall,
    apparentAttenuation,
    realAttenuation,
    activeModel,
  };
}

/**
 * Calcula la densidad relativa del agua pura a una temperatura dada usando la ecuación de Thiesen.
 *
 * Fórmula de Thiesen:
 * ρ(T) = 1 - [ ((T + 288.9414) / (508929.2 × (T + 68.12963))) × (T - 3.9863)² ]
 *
 * @param t - Temperatura del agua en °C.
 * @returns Densidad relativa del agua (g/cm³).
 */
export function getWaterDensity(t: number): number {
  const temp = sanitizeTemperatureC(t, 20, -10, 110);
  return (
    1 -
    ((temp + 288.9414) / (508929.2 * (temp + 68.12963))) *
      Math.pow(temp - 3.9863, 2)
  );
}

/**
 * Corrige la lectura de un densímetro (hidrómetro) según la temperatura de la muestra
 * y la temperatura de calibración del instrumento.
 *
 * Fórmula:
 * SG_corregida = SG_medida × (ρ_agua(T_calibración) / ρ_agua(T_muestra))
 *
 * @param measuredGravity - Lectura observada en el densímetro (ej. 1.050).
 * @param sampleTemp - Temperatura actual de la muestra en °C.
 * @param calibrationTemp - Temperatura de calibración del densímetro en °C (usualmente 15°C o 20°C).
 * @returns Gravedad Específica corregida a la temperatura de calibración.
 */
export function correctGravity(
  measuredGravity: number,
  sampleTemp: number,
  calibrationTemp: number = 20
): number {
  const cleanGravity = sanitizeGravity(measuredGravity, 1.0);
  const cleanSampleTemp = sanitizeTemperatureC(sampleTemp, 20, -5, 105);
  const cleanCalTemp = sanitizeTemperatureC(calibrationTemp, 20, 0, 40);

  const densityMeas = getWaterDensity(cleanSampleTemp);
  const densityCal = getWaterDensity(cleanCalTemp);

  if (densityMeas <= 0) return cleanGravity;
  return cleanGravity * (densityCal / densityMeas);
}

// ============================================================================
// 3. ABV, ATENUACIÓN Y CALORÍAS
// ============================================================================

/**
 * Resultado detallado del cálculo de alcohol y extracto de una cerveza.
 */
export interface ABVCalculationResult {
  /** Alcohol por Volumen (% v/v) mediante ecuación no lineal de Hall / ASBC */
  abv: number;
  /** Alcohol por Volumen (% v/v) mediante factor lineal estándar 131.25 */
  abvLinear: number;
  /** Alcohol por Peso (% p/p - ABW) */
  abw: number;
  /** Atenuación Aparente (%) */
  apparentAttenuation: number;
  /** Atenuación Real de Balling (%) */
  realAttenuation: number;
  /** Grados Plato iniciales (°P) */
  ogPlato: number;
  /** Grados Plato finales aparentes (°P) */
  fgPlato: number;
  /** Extracto Real residual (°P) */
  realExtractPlato: number;
}

/**
 * Calcula el ABV (Alcohol por Volumen) usando la fórmula lineal estándar.
 * Mantiene compatibilidad exacta con tests unitarios base: `(OG - FG) * 131.25`.
 *
 * @param og - Densidad Original (ej. 1.050).
 * @param fg - Densidad Final (ej. 1.010).
 * @returns ABV en porcentaje (ej. 5.25).
 */
export function calculateABV(og: number, fg: number): number {
  const cleanOg = sanitizeGravity(og, 1.0);
  const cleanFg = sanitizeGravity(fg, 1.0);
  if (cleanOg <= cleanFg) return 0;
  return Math.max(0, (cleanOg - cleanFg) * 131.25);
}

/**
 * Calcula el ABV y parámetros de fermentación empleando la ecuación termodinámica
 * no lineal de **Hall / ASBC**, recomendada para cervezas de media y alta densidad.
 *
 * Fórmula:
 * ABW = [ 76.08 × (OG - FG) ] / (1.775 - OG)
 * ABV = ABW × (FG / 0.794)
 *
 * @param og - Densidad Original (ej. 1.075).
 * @param fg - Densidad Final (ej. 1.012).
 * @returns Objeto `ABVCalculationResult` con ABV no lineal, lineal, ABW y atenuaciones.
 */
export function calculateABVAdvanced(
  og: number,
  fg: number
): ABVCalculationResult {
  const cleanOg = sanitizeGravity(og, 1.0);
  const cleanFg = sanitizeGravity(fg, 1.0);

  if (cleanOg <= cleanFg || cleanOg >= 1.775) {
    const plato = sgToPlato(cleanOg);
    return {
      abv: 0,
      abvLinear: 0,
      abw: 0,
      apparentAttenuation: 0,
      realAttenuation: 0,
      ogPlato: plato,
      fgPlato: plato,
      realExtractPlato: plato,
    };
  }

  const abw = (76.08 * (cleanOg - cleanFg)) / (1.775 - cleanOg);
  const abv = Math.max(0, abw * (cleanFg / 0.794));
  const abvLinear = calculateABV(cleanOg, cleanFg);
  const apparentAttenuation = calculateAttenuation(cleanOg, cleanFg);
  const realAttenuation = calculateRealAttenuation(cleanOg, cleanFg);
  const ogPlato = sgToPlato(cleanOg);
  const fgPlato = sgToPlato(cleanFg);
  const realExtractPlato = 0.1808 * ogPlato + 0.8192 * fgPlato;

  return {
    abv,
    abvLinear,
    abw: Math.max(0, abw),
    apparentAttenuation,
    realAttenuation,
    ogPlato,
    fgPlato,
    realExtractPlato,
  };
}

/**
 * Calcula la Atenuación Aparente del mosto fermentado.
 *
 * Fórmula:
 * AA(%) = ((OG - FG) / (OG - 1)) × 100
 *
 * @param og - Densidad Original (ej. 1.050).
 * @param fg - Densidad Final (ej. 1.010).
 * @returns Porcentaje de atenuación aparente acotado en `[0, 100]`.
 */
export function calculateAttenuation(og: number, fg: number): number {
  const cleanOg = sanitizeGravity(og, 1.0);
  const cleanFg = sanitizeGravity(fg, 1.0);
  if (cleanOg <= 1.0 || cleanFg >= cleanOg) return 0;
  const att = ((cleanOg - cleanFg) / (cleanOg - 1.0)) * 100;
  return Math.max(0, Math.min(100, att));
}

/**
 * Calcula la Atenuación Real (Balling) descontando el efecto de densidad menor del etanol.
 *
 * Fórmula:
 * RE = 0.1808·°P_i + 0.8192·°P_f
 * AR(%) = ((°P_i - RE) / °P_i) × 100
 *
 * @param og - Densidad Original (SG).
 * @param fg - Densidad Final (SG).
 * @returns Porcentaje de atenuación real acotado en `[0, 100]`.
 */
export function calculateRealAttenuation(og: number, fg: number): number {
  const cleanOg = sanitizeGravity(og, 1.0);
  const cleanFg = sanitizeGravity(fg, 1.0);
  if (cleanOg <= 1.0 || cleanFg >= cleanOg) return 0;

  const pInitial = sgToPlato(cleanOg);
  const pFinal = sgToPlato(cleanFg);
  if (pInitial <= 0) return 0;

  const realExtract = 0.1808 * pInitial + 0.8192 * pFinal;
  const realAtt = ((pInitial - realExtract) / pInitial) * 100;
  return Math.max(0, Math.min(100, realAtt));
}

/**
 * Resultado nutricional y calórico estimado de la cerveza terminada.
 */
export interface BeerCaloriesResult {
  /** Kilocalorías por cada 100 mL */
  kcalPer100ml: number;
  /** Kilojulios por cada 100 mL */
  kjPer100ml: number;
  /** Kilocalorías por botella/lata estándar de 330 mL */
  kcalPer330ml: number;
  /** Kilocalorías por lata de 12 oz (355 mL) */
  kcalPer355ml: number;
  /** Kilocalorías por pinta americana (473 mL) */
  kcalPerPint473ml: number;
  /** Carbohidratos residuales estimados en gramos por 100 mL */
  carbsPer100ml: number;
}

/**
 * Calcula el aporte calórico (kcal y kJ) y carbohidratos residuales según las ecuaciones
 * oficiales de la ASBC para análisis nutricional cervecero.
 *
 * Fórmula ASBC (por 12 oz = 355 mL):
 * kcal_12oz = [1881.22 × FG × (OG - FG) / (1.775 - OG)] + [3550 × FG × (FG - 1)]
 *
 * @param og - Densidad Original (SG).
 * @param fg - Densidad Final (SG).
 * @returns Desglose calórico `BeerCaloriesResult`.
 */
export function calculateBeerCalories(
  og: number,
  fg: number
): BeerCaloriesResult {
  const cleanOg = sanitizeGravity(og, 1.05);
  const cleanFg = sanitizeGravity(fg, 1.01);

  if (cleanOg <= cleanFg || cleanOg >= 1.775) {
    return {
      kcalPer100ml: 0,
      kjPer100ml: 0,
      kcalPer330ml: 0,
      kcalPer355ml: 0,
      kcalPerPint473ml: 0,
      carbsPer100ml: 0,
    };
  }

  const calAlcohol12oz =
    (1881.22 * cleanFg * (cleanOg - cleanFg)) / (1.775 - cleanOg);
  const calCarbs12oz = Math.max(0, 3550 * cleanFg * (cleanFg - 1));
  const kcalPer355ml = Math.max(0, calAlcohol12oz + calCarbs12oz);

  const kcalPer100ml = kcalPer355ml * (100 / 355);
  const kjPer100ml = kcalPer100ml * 4.184;
  const kcalPer330ml = kcalPer355ml * (330 / 355);
  const kcalPerPint473ml = kcalPer355ml * (473 / 355);

  // Extracto real en g/100mL ≈ FG * RE_Plato * 0.91 (descontando proteínas y cenizas)
  const ogPlato = sgToPlato(cleanOg);
  const fgPlato = sgToPlato(cleanFg);
  const realExtract = Math.max(0, 0.1808 * ogPlato + 0.8192 * fgPlato);
  const carbsPer100ml = Math.max(0, cleanFg * realExtract * 0.91);

  return {
    kcalPer100ml,
    kjPer100ml,
    kcalPer330ml,
    kcalPer355ml,
    kcalPerPint473ml,
    carbsPer100ml,
  };
}

// ============================================================================
// 4. IBU — TINSETH EXACTO CON GRAVEDAD PASO A PASO Y GEOMETRÍA DE OLLA
// ============================================================================

/** Etapa de adición del lúpulo */
export type HopAdditionStage = 'BOIL' | 'FIRST_WORT' | 'HOPSTAND' | 'DRY_HOP';

/** Formato físico del lúpulo */
export type HopFormType = 'PELLET' | 'WHOLE' | 'PLUG';

/**
 * Datos de entrada para una adición individual de lúpulo.
 */
export interface HopAdditionInput {
  /** Identificador único opcional para UI */
  id?: string;
  /** Nombre de la variedad de lúpulo (opcional) */
  name?: string;
  /** Cantidad de lúpulo agregada en gramos (g) */
  amount: number;
  /** Porcentaje de Alfa Ácidos (% AA, ej. 12.5) */
  alpha: number;
  /** Tiempo de contacto / hervor en minutos (min) */
  time: number;
  /** Etapa de adición: 'BOIL', 'FIRST_WORT', 'HOPSTAND' o 'DRY_HOP' */
  type: HopAdditionStage;
  /** Formato del lúpulo: 'PELLET' (+10% utilización), 'PLUG' (+2%) o 'WHOLE' (base). Si se omite, usa el modo configurado en opciones */
  form?: HopFormType;
  /** Temperatura del mosto durante el Hopstand/Whirlpool en °C (default: 85°C si no se especifica) */
  whirlpoolTempC?: number;
}

/**
 * Opciones avanzadas de ingeniería para el cálculo de IBU por Tinseth.
 */
export interface TinsethOptions {
  /** Tasa de evaporación de la olla en L/h (default: 0 para cálculo estático clásico; > 0 activa integración paso a paso de gravedad) */
  evaporationRateLPerHour?: number;
  /** Duración total del hervor en minutos (default: 60 min) */
  totalBoilTimeMinutes?: number;
  /** Diámetro interno de la olla de hervor en cm (si se provee, calcula el factor de utilización según geometría D/H) */
  kettleDiameterCm?: number;
  /** Altura de líquido en cm (opcional; si no se provee pero hay diámetro, se deduce de V = π·r²·h) */
  liquidHeightCm?: number;
  /** Factor multiplicador para pellets (default: 1.0 para mantener compatibilidad base, o 1.10 si usePelletFactor=true) */
  usePelletFactor?: boolean;
  /** Temperatura por defecto del Hopstand/Whirlpool en °C (si se define, usa cinética de isomerización de Malowicki) */
  defaultWhirlpoolTempC?: number;
  /** Indica si `boilVolume` y `boilGravity` representan valores al final del hervor ('POST_BOIL') o al inicio ('PRE_BOIL') */
  gravityReferenceStage?: 'POST_BOIL' | 'PRE_BOIL';
}

/**
 * Factor geométrico de utilización en olla de hervor.
 */
export interface KettleGeometryUtilization {
  /** Diámetro de la olla en cm */
  diameterCm: number;
  /** Altura efectiva de la columna de mosto en cm */
  liquidHeightCm: number;
  /** Área superficial libre de evaporación en cm² */
  surfaceAreaCm2: number;
  /** Relación de aspecto Diámetro / Altura de líquido (D / H) */
  aspectRatio: number;
  /** Factor correctivo de utilización por geometría (acotado en [0.85, 1.15]) */
  geometryFactor: number;
}

/**
 * Desglose del aporte de IBU y utilización de una adición individual.
 */
export interface HopAdditionIBUResult {
  /** Índice o ID de la adición */
  id: string;
  /** Gravedad media efectiva experimentada por esta adición durante su tiempo en olla */
  effectiveGravity: number;
  /** Factor de densidad (Bigness Factor) integrado paso a paso */
  bignessFactor: number;
  /** Factor de tiempo de hervor (Boil Time Factor) */
  timeFactor: number;
  /** Factor combinado por etapa (Boil / FWH / Hopstand), formato y geometría */
  stageAndGeometryFactor: number;
  /** Porcentaje de utilización efectiva (0 a 1, ej. 0.24 = 24%) */
  utilization: number;
  /** Aporte de IBU de esta adición (con corrección de alta densidad aplicada si corresponde) */
  ibu: number;
}

/**
 * Resultado completo del cálculo de IBU paso a paso.
 */
export interface TinsethIBUBreakdown {
  /** IBU totales acumulados del lote */
  totalIBU: number;
  /** Volumen inicial de hervor estimado en litros */
  initialBoilVolumeL: number;
  /** Volumen final post-hervor estimado en litros */
  finalBoilVolumeL: number;
  /** Gravedad inicial al comienzo del hervor (SG) */
  initialBoilGravity: number;
  /** Gravedad final al terminar el hervor (SG) */
  finalBoilGravity: number;
  /** Gravedad media del hervor completo (SG) */
  averageBoilGravity: number;
  /** Factor de utilización geométrica aplicado */
  geometry: KettleGeometryUtilization;
  /** Factor de corrección por alta densidad (> 1.050) */
  highGravityCorrectionFactor: number;
  /** Desglose individual por cada adición de lúpulo */
  additions: HopAdditionIBUResult[];
}

/**
 * Calcula el factor de utilización de alfa-ácidos según la geometría de la olla de hervor.
 *
 * Fundamento físico:
 * En ollas anchas y bajas (relación de aspecto D/H > 1.0), la mayor superficie libre relativa
 * y menor presión hidrostática en el fondo favorecen la convección térmica y la formación de
 * coágulos (hot break) sin colapsar las plumas de vapor, incrementando la isomerización.
 * En ollas altas y esbeltas (D/H < 0.8), la presión hidrostática reduce la tasa de utilización.
 *
 * La relación estándar de calibración de Tinseth asume D/H ≈ 1.0 (factor = 1.00):
 * f_geom = 1.0 + 0.06 × tanh((D / H) - 1.0)  (acotado entre 0.88 y 1.12)
 *
 * @param diameterCm - Diámetro interno de la olla en cm (0 = geometría estándar 1.0).
 * @param volumeL - Volumen medio de mosto en litros.
 * @param explicitLiquidHeightCm - Altura medida del líquido en cm (opcional).
 * @returns Objeto `KettleGeometryUtilization` con área, altura, relación D/H y factor geométrico.
 */
export function calculateKettleGeometryFactor(
  diameterCm: number,
  volumeL: number,
  explicitLiquidHeightCm?: number
): KettleGeometryUtilization {
  const cleanDiameter = sanitizePositiveNumber(diameterCm, 0, 1000);
  const cleanVolume = sanitizePositiveNumber(volumeL, 0, 100000);

  if (cleanDiameter <= 0 || cleanVolume <= 0) {
    return {
      diameterCm: 0,
      liquidHeightCm: 0,
      surfaceAreaCm2: 0,
      aspectRatio: 1.0,
      geometryFactor: 1.0,
    };
  }

  const radiusCm = cleanDiameter / 2;
  const surfaceAreaCm2 = Math.PI * Math.pow(radiusCm, 2);
  const calculatedHeightCm = (cleanVolume * 1000) / surfaceAreaCm2;
  const liquidHeightCm =
    explicitLiquidHeightCm && explicitLiquidHeightCm > 0
      ? sanitizePositiveNumber(explicitLiquidHeightCm, calculatedHeightCm)
      : calculatedHeightCm;

  if (liquidHeightCm <= 0) {
    return {
      diameterCm: cleanDiameter,
      liquidHeightCm: 0,
      surfaceAreaCm2,
      aspectRatio: 1.0,
      geometryFactor: 1.0,
    };
  }

  const aspectRatio = cleanDiameter / liquidHeightCm;
  // Desviación suave centrada en D/H = 1.0
  const rawFactor = 1.0 + 0.06 * Math.tanh(aspectRatio - 1.0);
  const geometryFactor = Math.max(0.88, Math.min(1.12, rawFactor));

  return {
    diameterCm: cleanDiameter,
    liquidHeightCm,
    surfaceAreaCm2,
    aspectRatio,
    geometryFactor,
  };
}

/**
 * Calcula el factor relativo de isomerización para Hopstand / Whirlpool en función
 * de la temperatura sub-hervor según la cinética de Arrhenius / Malowicki (2005).
 *
 * k_rel(T) = min(1.0, 2.39 × 10^11 × exp(-9773 / (T_°C + 273.15)))
 * A ~85°C equivale aproximadamente a 0.50 (50% de la tasa de ebullición).
 *
 * @param tempC - Temperatura del whirlpool en °C.
 * @returns Factor relativo de utilización respecto al hervor (0 a 1).
 */
export function calculateSubBoilIsomerizationFactor(tempC: number): number {
  const cleanTemp = sanitizeTemperatureC(tempC, 85, 20, 100);
  if (cleanTemp < 60) return 0;
  const tempK = cleanTemp + 273.15;
  const factor = 2.39e11 * Math.exp(-9773 / tempK);
  return Math.max(0, Math.min(1.0, factor));
}

/**
 * Calcula el desglose completo de IBU mediante el método de **Glenn Tinseth**,
 * integrando paso a paso (minuto a minuto) la evolución de la densidad del mosto
 * durante el hervor por evaporación y ajustando por la geometría de la olla.
 *
 * Ecuación de Tinseth:
 * - Bigness Factor instantáneo: f_G(t) = 1.65 × 0.000125^(SG(t) - 1)
 * - Boil Time Factor: f_t(T) = (1 - e^(-0.04 × T)) / 4.15
 * - Utilización: U = f_G_efectivo × f_t(T) × f_etapa × f_formato × f_geometría
 * - IBU = (U × gramos × %AA × 10) / Volumen_Final_L
 * - Corrección de alta densidad (SG > 1.050): fc = 1 + (SG - 1.050) / 0.2
 *
 * @param hops - Lista de adiciones de lúpulo.
 * @param boilVolume - Volumen de referencia del hervor en litros.
 * @param boilGravity - Gravedad específica del mosto durante el hervor (ej. 1.050).
 * @param options - Opciones avanzadas (tasa de evaporación, tiempo total, diámetro de olla, etc.).
 * @returns Objeto `TinsethIBUBreakdown` con IBU total y métricas detalladas paso a paso.
 */
export function calculateTinsethIBUBreakdown(
  hops: HopAdditionInput[],
  boilVolume: number,
  boilGravity: number,
  options: TinsethOptions = {}
): TinsethIBUBreakdown {
  const cleanVolume = sanitizePositiveNumber(boilVolume, 0);
  const rawGravity = sanitizeNumber(boilGravity, { fallback: 0, min: 0 });
  const normalizedGravity =
    rawGravity >= 980 && rawGravity <= 2000 ? rawGravity / 1000 : rawGravity;

  const emptyGeometry = calculateKettleGeometryFactor(0, 0);

  if (
    cleanVolume <= 0 ||
    normalizedGravity < 1.0 ||
    normalizedGravity > 2.0 ||
    !Array.isArray(hops)
  ) {
    return {
      totalIBU: 0,
      initialBoilVolumeL: 0,
      finalBoilVolumeL: 0,
      initialBoilGravity: 1.0,
      finalBoilGravity: 1.0,
      averageBoilGravity: 1.0,
      geometry: emptyGeometry,
      highGravityCorrectionFactor: 1.0,
      additions: [],
    };
  }

  const evapRate = sanitizePositiveNumber(options.evaporationRateLPerHour ?? 0, 0, 500);
  const maxHopTime = hops.reduce(
    (max, h) => Math.max(max, sanitizePositiveNumber(h?.time, 0, 240)),
    60
  );
  const totalBoilMinutes = Math.max(
    maxHopTime,
    sanitizePositiveNumber(options.totalBoilTimeMinutes ?? 60, 60, 240)
  );
  const totalBoilHours = totalBoilMinutes / 60;
  const totalEvaporatedL = evapRate * totalBoilHours;

  const refStage = options.gravityReferenceStage ?? 'POST_BOIL';

  // Determinar volumen y gravedad al inicio (t = totalBoilMinutes) y al final (t = 0)
  let initialBoilVolumeL = cleanVolume;
  let finalBoilVolumeL = cleanVolume;

  if (evapRate > 0) {
    if (refStage === 'PRE_BOIL') {
      initialBoilVolumeL = cleanVolume;
      finalBoilVolumeL = Math.max(1, cleanVolume - totalEvaporatedL);
    } else {
      finalBoilVolumeL = cleanVolume;
      initialBoilVolumeL = cleanVolume + totalEvaporatedL;
    }
  }

  // Puntos totales de gravedad conservados durante el hervor: GP = V_ref * (SG_ref - 1)
  const totalGravityPoints = cleanVolume * (normalizedGravity - 1);
  const initialBoilGravity = 1 + totalGravityPoints / initialBoilVolumeL;
  const finalBoilGravity = 1 + totalGravityPoints / finalBoilVolumeL;
  const meanVolumeL = (initialBoilVolumeL + finalBoilVolumeL) / 2;
  const averageBoilGravity = 1 + totalGravityPoints / meanVolumeL;

  const geometry = calculateKettleGeometryFactor(
    options.kettleDiameterCm ?? 0,
    meanVolumeL,
    options.liquidHeightCm
  );

  // Función auxiliar que devuelve la gravedad específica en el minuto `mRemaining` antes de apagar fuego
  const getGravityAtMinuteRemaining = (mRemaining: number): number => {
    if (evapRate <= 0 || totalBoilMinutes <= 0) return normalizedGravity;
    const clampedRemaining = Math.max(0, Math.min(totalBoilMinutes, mRemaining));
    const fractionRemaining = clampedRemaining / totalBoilMinutes;
    const volumeAtMinute =
      finalBoilVolumeL + (initialBoilVolumeL - finalBoilVolumeL) * fractionRemaining;
    return 1 + totalGravityPoints / Math.max(1, volumeAtMinute);
  };

  // Factor de corrección por alta densidad de Tinseth (> 1.050)
  const effectiveRefGravity =
    evapRate > 0 ? averageBoilGravity : normalizedGravity;
  const highGravityCorrectionFactor =
    effectiveRefGravity > 1.05 ? 1 + (effectiveRefGravity - 1.05) / 0.2 : 1.0;

  let totalIBU = 0;
  const additionResults: HopAdditionIBUResult[] = [];

  hops.forEach((hop, idx) => {
    const id = hop.id ?? String(idx + 1);
    const amount = sanitizePositiveNumber(hop.amount, 0, 100000);
    const alpha = sanitizePositiveNumber(hop.alpha, 0, 100);
    const time = sanitizePositiveNumber(hop.time, 0, 240);

    if (hop.type === 'DRY_HOP' || amount <= 0 || alpha <= 0 || time <= 0) {
      additionResults.push({
        id,
        effectiveGravity: finalBoilGravity,
        bignessFactor: 0,
        timeFactor: 0,
        stageAndGeometryFactor: 0,
        utilization: 0,
        ibu: 0,
      });
      return;
    }

    // Integración paso a paso (minuto a minuto) de la gravedad y el Bigness Factor durante la residencia del lúpulo
    let sumGravity = 0;
    let sumBigness = 0;

    if (hop.type === 'HOPSTAND') {
      // El hopstand ocurre al apagar el fuego (volumen y gravedad final post-hervor)
      sumGravity = finalBoilGravity;
      sumBigness = 1.65 * Math.pow(0.000125, finalBoilGravity - 1);
    } else if (evapRate <= 0) {
      sumGravity = normalizedGravity;
      sumBigness = 1.65 * Math.pow(0.000125, normalizedGravity - 1);
    } else {
      const steps = Math.max(1, Math.round(time));
      for (let step = 0; step < steps; step++) {
        // Punto medio del minuto [step, step + 1] restante de hervor
        const minuteMid = Math.min(totalBoilMinutes, step + 0.5);
        const sgAtStep = getGravityAtMinuteRemaining(minuteMid);
        sumGravity += sgAtStep;
        sumBigness += 1.65 * Math.pow(0.000125, sgAtStep - 1);
      }
      sumGravity /= steps;
      sumBigness /= steps;
    }

    const timeFactor = (1 - Math.exp(-0.04 * time)) / 4.15;

    // Factor por etapa de adición
    let stageFactor = 1.0;
    if (hop.type === 'HOPSTAND') {
      if (typeof hop.whirlpoolTempC === 'number') {
        stageFactor = calculateSubBoilIsomerizationFactor(hop.whirlpoolTempC);
      } else if (typeof options.defaultWhirlpoolTempC === 'number') {
        stageFactor = calculateSubBoilIsomerizationFactor(options.defaultWhirlpoolTempC);
      } else {
        stageFactor = 0.5; // Estándar 80-90°C
      }
    } else if (hop.type === 'FIRST_WORT') {
      stageFactor = 1.1; // First Wort Hopping (+10% utilización percibida/isomerizada)
    }

    // Factor por formato físico del lúpulo
    let formFactor = 1.0;
    if (hop.form === 'PELLET') {
      formFactor = 1.1;
    } else if (hop.form === 'PLUG') {
      formFactor = 1.02;
    } else if (hop.form === 'WHOLE') {
      formFactor = 1.0;
    } else if (options.usePelletFactor) {
      formFactor = 1.1;
    }

    const stageAndGeometryFactor =
      stageFactor * formFactor * geometry.geometryFactor;
    const utilization = sumBigness * timeFactor * stageAndGeometryFactor;

    const rawIbu = (utilization * (amount * alpha * 10)) / finalBoilVolumeL;
    const correctedIbu = rawIbu / highGravityCorrectionFactor;

    totalIBU += correctedIbu;
    additionResults.push({
      id,
      effectiveGravity: sumGravity,
      bignessFactor: sumBigness,
      timeFactor,
      stageAndGeometryFactor,
      utilization,
      ibu: correctedIbu,
    });
  });

  return {
    totalIBU,
    initialBoilVolumeL,
    finalBoilVolumeL,
    initialBoilGravity,
    finalBoilGravity,
    averageBoilGravity,
    geometry,
    highGravityCorrectionFactor,
    additions: additionResults,
  };
}

/**
 * Calcula el IBU total usando la fórmula de Glenn Tinseth para múltiples adiciones.
 *
 * - `BOIL`: Tinseth con integración paso a paso de gravedad de hervor.
 * - `FIRST_WORT`: Tinseth × 1.10.
 * - `HOPSTAND`: Tinseth × 0.50 (o cinética de Arrhenius si se indica `whirlpoolTempC`).
 * - `DRY_HOP`: 0 IBU (solo aroma).
 *
 * Aplica corrección de gravedad alta (> 1.050) y factor geométrico si se especifica diámetro de olla.
 *
 * @param hops - Array de adiciones de lúpulo.
 * @param boilVolume - Volumen de hervor en litros.
 * @param boilGravity - Densidad del mosto durante el hervor (ej. 1.050).
 * @param options - Parámetros opcionales de evaporación y geometría de olla.
 * @returns IBU totales.
 */
export function calculateTinsethIBU(
  hops: HopAdditionInput[],
  boilVolume: number,
  boilGravity: number,
  options?: TinsethOptions
): number {
  if (boilVolume <= 0) return 0;
  if (boilGravity < 1.0 || boilGravity > 2.0) return 0;
  return calculateTinsethIBUBreakdown(hops, boilVolume, boilGravity, options).totalIBU;
}

// ============================================================================
// 5. CARBONATACIÓN FORZADA (LEY DE HENRY / ASBC), ESTILOS BJCP Y PRIMING
// ============================================================================

/**
 * Especificación de volúmenes de CO2 recomendados para un estilo BJCP.
 */
export interface BJCPCarbonationStyle {
  /** Identificador único del estilo */
  id: string;
  /** Nombre descriptivo y código BJCP */
  name: string;
  /** Familia / Categoría cervecera */
  category: string;
  /** Mínimo de volúmenes de CO2 del estilo */
  minVols: number;
  /** Máximo de volúmenes de CO2 del estilo */
  maxVols: number;
  /** Valor objetivo recomendado de volúmenes de CO2 */
  targetVols: number;
}

/**
 * Catálogo de estilos BJCP con sus rangos de carbonatación (volúmenes de CO2).
 */
export const BJCP_CARBONATION_STYLES: readonly BJCPCarbonationStyle[] = [
  { id: 'BRITISH_ALE', name: 'Strong Bitter / ESB (11C)', category: 'British Ale', minVols: 1.5, maxVols: 2.2, targetVols: 1.9 },
  { id: 'IRISH_STOUT', name: 'Irish Stout (15B)', category: 'Stout / Porter', minVols: 1.6, maxVols: 2.1, targetVols: 1.9 },
  { id: 'SWEET_STOUT', name: 'Sweet Stout (16A)', category: 'Stout / Porter', minVols: 1.8, maxVols: 2.3, targetVols: 2.0 },
  { id: 'ENGLISH_PORTER', name: 'English Porter (13C)', category: 'Stout / Porter', minVols: 1.8, maxVols: 2.3, targetVols: 2.1 },
  { id: 'IRISH_RED', name: 'Irish Red Ale (15A)', category: 'Irish / Scottish', minVols: 2.0, maxVols: 2.4, targetVols: 2.2 },
  { id: 'AMERICAN_PORTER', name: 'American Porter (20A)', category: 'Stout / Porter', minVols: 2.0, maxVols: 2.5, targetVols: 2.2 },
  { id: 'ENGLISH_IPA', name: 'English IPA (12C)', category: 'IPA', minVols: 2.0, maxVols: 2.5, targetVols: 2.2 },
  { id: 'HAZY_IPA', name: 'Hazy IPA / NEIPA (21C)', category: 'IPA', minVols: 2.1, maxVols: 2.5, targetVols: 2.3 },
  { id: 'AMERICAN_AMBER', name: 'American Amber Ale (19A)', category: 'American Ale', minVols: 2.2, maxVols: 2.6, targetVols: 2.4 },
  { id: 'AMERICAN_PALE_ALE', name: 'American Pale Ale (18B)', category: 'American Ale', minVols: 2.3, maxVols: 2.7, targetVols: 2.4 },
  { id: 'AMERICAN_IPA', name: 'American IPA (21A)', category: 'IPA', minVols: 2.2, maxVols: 2.7, targetVols: 2.4 },
  { id: 'SESSION_IPA', name: 'Session IPA (21B)', category: 'IPA', minVols: 2.2, maxVols: 2.6, targetVols: 2.4 },
  { id: 'BLONDE_ALE', name: 'Blonde Ale / Golden (18A)', category: 'American Ale', minVols: 2.3, maxVols: 2.7, targetVols: 2.5 },
  { id: 'CZECH_LAGER', name: 'Czech Premium Pale Lager (3B)', category: 'Lager', minVols: 2.3, maxVols: 2.6, targetVols: 2.5 },
  { id: 'GERMAN_PILS', name: 'German Pils (5D)', category: 'Lager', minVols: 2.4, maxVols: 2.8, targetVols: 2.6 },
  { id: 'KOLSCH', name: 'Kölsch (5B)', category: 'Hybrid', minVols: 2.4, maxVols: 2.8, targetVols: 2.6 },
  { id: 'BELGIAN_DUBBEL', name: 'Belgian Dubbel (26B)', category: 'Belgian', minVols: 2.7, maxVols: 3.3, targetVols: 3.0 },
  { id: 'SAISON', name: 'Saison (25B)', category: 'Belgian', minVols: 2.8, maxVols: 3.5, targetVols: 3.1 },
  { id: 'WITBIER', name: 'Witbier (24A)', category: 'Wheat', minVols: 2.8, maxVols: 3.6, targetVols: 3.2 },
  { id: 'WEISSBIER', name: 'Weissbier (10A)', category: 'Wheat', minVols: 3.2, maxVols: 4.4, targetVols: 3.6 },
] as const;

/**
 * Resultado del cálculo de presión de equilibrio de carbonatación forzada.
 */
export interface CarbonationPressureResult {
  /** Presión manométrica requerida en PSI (lb/in²) */
  psi: number;
  /** Presión manométrica requerida en Bares (bar) */
  bar: number;
  /** Presión manométrica requerida en Kilopascales (kPa) */
  kpa: number;
  /** Temperatura de la cerveza en °C */
  temperatureC: number;
  /** Temperatura equivalente en °F */
  temperatureF: number;
  /** Volúmenes de CO2 objetivo */
  targetVolumes: number;
  /** Estilo BJCP asociado si se seleccionó uno */
  style?: BJCPCarbonationStyle;
  /** Indica si los volúmenes elegidos están dentro del rango del estilo seleccionado */
  inStyleRange: boolean;
}

/**
 * Calcula la presión manométrica de equilibrio de CO2 necesaria para carbonatar cerveza
 * a una temperatura dada según la ecuación empírica de la **ASBC / Zahm & Nagel** (Ley de Henry).
 *
 * Ecuación:
 * T_F = (T_C × 9/5) + 32
 * P_PSI = -16.6999 - 0.0101059·T_F + 0.00116512·T_F² + 0.173354·T_F·V + 4.24267·V - 0.0684226·V²
 *
 * @param tempC - Temperatura de la cerveza en el barril/tanque (°C).
 * @param targetVolumesCO2 - Volúmenes de CO2 deseados (ej. 2.5).
 * @param styleId - ID opcional de estilo BJCP para validar rango de carbonatación.
 * @returns Objeto `CarbonationPressureResult` con presiones en PSI, Bar y kPa.
 */
export function calculateCarbonationPressure(
  tempC: number,
  targetVolumesCO2: number,
  styleId?: string
): CarbonationPressureResult {
  const cleanTempC = sanitizeTemperatureC(tempC, 4, -5, 45);
  const cleanVolumes = sanitizePositiveNumber(targetVolumesCO2, 2.5, 6.0);
  const tempF = (cleanTempC * 9) / 5 + 32;

  const rawPsi =
    -16.6999 -
    0.0101059 * tempF +
    0.00116512 * Math.pow(tempF, 2) +
    0.173354 * tempF * cleanVolumes +
    4.24267 * cleanVolumes -
    0.0684226 * Math.pow(cleanVolumes, 2);

  const psi = Math.max(0, rawPsi);
  const bar = psi * 0.0689475729;
  const kpa = psi * 6.89475729;

  const style = styleId
    ? BJCP_CARBONATION_STYLES.find(
        (s) => s.id === styleId || s.name.toLowerCase().includes(styleId.toLowerCase())
      )
    : undefined;

  const inStyleRange = style
    ? cleanVolumes >= style.minVols && cleanVolumes <= style.maxVols
    : true;

  return {
    psi,
    bar,
    kpa,
    temperatureC: cleanTempC,
    temperatureF: tempF,
    targetVolumes: cleanVolumes,
    style,
    inStyleRange,
  };
}

/** Tipos de azúcar fermentable para acondicionamiento en botella (Priming) */
export type SugarType = 'TABLE' | 'DEXTROSE' | 'HONEY' | 'DME';

/**
 * Factores relativos de dosificación respecto a la sacarosa pura (1.00 = 4.0 g/L por volumen de CO2).
 */
export const SUGAR_FACTORS: Record<SugarType, number> = {
  TABLE: 1.0,     // Sacarosa (100% fermentable, 0% humedad)
  DEXTROSE: 1.11, // Dextrosa monohidratada (~9% agua de cristalización => 1/0.90)
  HONEY: 1.25,    // Miel estándar (~80% azúcares fermentables => 1/0.80)
  DME: 1.54,      // Extracto de malta seco (~65% atenuación aparente => 1/0.65)
};

/**
 * Resultado del cálculo de azúcar de cebado (Priming) para refermentación en envase.
 */
export interface PrimingCalculationResult {
  /** CO2 residual disuelto en la cerveza verde al final de la fermentación (volúmenes) */
  residualCO2: number;
  /** Volúmenes adicionales de CO2 a generar mediante refermentación */
  neededCO2: number;
  /** Gramos de azúcar requeridos por litro de cerveza (g/L) */
  gramsPerLiter: number;
  /** Gramos totales de azúcar para todo el lote (g) */
  totalGrams: number;
  /** Gramos por botella de 330 mL */
  perBottle330ml: number;
  /** Gramos por botella de 500 mL */
  perBottle500ml: number;
}

/**
 * Calcula el CO2 residual disuelto en la cerveza a presión atmosférica (1 atm)
 * en función de la temperatura máxima alcanzada al final de la fermentación.
 *
 * Ecuación polinómica de regresión (Palmer / ASBC):
 * CO2_res = 3.0378 - 0.050062·T + 0.00026555·T²  (con T en °C)
 *
 * @param temp - Temperatura máxima de fermentación post-atenuación (°C).
 * @returns Volúmenes de CO2 residual.
 */
export function residualCO2(temp: number): number {
  const cleanTemp = sanitizeTemperatureC(temp, 20, -2, 45);
  const tempF = (cleanTemp * 9) / 5 + 32;
  return Math.max(
    0,
    3.0378 - 0.050062 * tempF + 0.00026555 * Math.pow(tempF, 2)
  );
}

/**
 * Calcula la cantidad de azúcar necesaria para carbonatar naturalmente en botella o barril.
 *
 * Fundamento estequiométrico (Gay-Lussac):
 * 1 g de sacarosa produce ~0.51 g de etanol y ~0.49 g de CO2 (~0.25 volúmenes de CO2 en 1 L).
 * Por tanto, se requieren 4.0 g/L de sacarosa por cada 1.0 volumen de CO2 adicional.
 *
 * @param volume - Volumen total a embotellar (litros).
 * @param fermTemp - Temperatura máxima de la cerveza al final de la fermentación (°C).
 * @param targetCO2 - Volúmenes de CO2 deseados según el estilo.
 * @param sugarType - Tipo de agente fermentable (`'TABLE'`, `'DEXTROSE'`, `'HONEY'`, `'DME'`).
 * @returns Objeto `PrimingCalculationResult` con dosis por litro, total y por botella.
 */
export function calculatePriming(
  volume: number,
  fermTemp: number,
  targetCO2: number,
  sugarType: SugarType
): PrimingCalculationResult {
  const cleanVolume = sanitizePositiveNumber(volume, 0);
  const cleanTargetCO2 = sanitizePositiveNumber(targetCO2, 0, 6.0);
  const residual = residualCO2(fermTemp);
  const neededCO2 = cleanTargetCO2 - residual;

  if (neededCO2 <= 0 || cleanVolume <= 0) {
    return {
      residualCO2: residual,
      neededCO2: 0,
      gramsPerLiter: 0,
      totalGrams: 0,
      perBottle330ml: 0,
      perBottle500ml: 0,
    };
  }

  const factor = SUGAR_FACTORS[sugarType] ?? 1.0;
  const gramsPerLiter = neededCO2 * 4.0 * factor;
  const totalGrams = gramsPerLiter * cleanVolume;
  const perBottle330ml = gramsPerLiter * 0.33;
  const perBottle500ml = gramsPerLiter * 0.5;

  return {
    residualCO2: residual,
    neededCO2,
    gramsPerLiter,
    totalGrams,
    perBottle330ml,
    perBottle500ml,
  };
}

// ============================================================================
// 6. TASA DE INOCULACIÓN DE LEVADURA (PITCHING RATE) Y STARTER
// ============================================================================

/**
 * Perfiles de tasa de inoculación según familia de estilo y densidad.
 * - `'ALE'`: Ale estándar (0.75 M cel/mL/°P; escala a 1.00 si OG > 1.060).
 * - `'HIGH_GRAVITY_ALE'`: Ale de alta densidad > 1.060 (1.00 M cel/mL/°P).
 * - `'HYBRID'`: Híbridas / Kölsch / Altbier (1.00 M cel/mL/°P).
 * - `'LAGER'`: Lager estándar (1.50 M cel/mL/°P; escala a 2.00 si OG > 1.060).
 * - `'HIGH_GRAVITY_LAGER'`: Lager fuerte / Bock / Doppelbock > 1.060 (2.00 M cel/mL/°P).
 */
export type YeastPitchStyle =
  | 'ALE'
  | 'HIGH_GRAVITY_ALE'
  | 'HYBRID'
  | 'LAGER'
  | 'HIGH_GRAVITY_LAGER';

/**
 * Tasas estándar de inoculación en millones de células por mililitro por grado Plato (10^6 cel/mL/°P).
 * Referencia: Fix (1997), White & Zainasheff ("Yeast", 2010).
 */
export const PITCH_RATE_STANDARDS: Record<YeastPitchStyle, number> = {
  ALE: 0.75,
  HIGH_GRAVITY_ALE: 1.0,
  HYBRID: 1.0,
  LAGER: 1.5,
  HIGH_GRAVITY_LAGER: 2.0,
};

/**
 * Parámetros de entrada para el cálculo de tasa de inoculación de levadura.
 */
export interface PitchRateInput {
  /** Volumen de mosto en fermentador en litros (L) */
  batchVolumeL: number;
  /** Gravedad Específica Original del mosto (OG, ej. 1.050) */
  og: number;
  /** Familia o estilo de fermentación */
  yeastType: YeastPitchStyle;
  /** Cantidad nominal de células por paquete en billones (10^9, default: 200) */
  cellsPerPackBillions?: number;
  /** Porcentaje de viabilidad estimada del paquete (0-100%, default: 100%) */
  viabilityPercent?: number;
  /** Tasa personalizada en 10^6 cel/mL/°P (si se especifica, sobreescribe la tasa del estilo) */
  customRateCellsPerMlPlato?: number;
  /** Densidad celular de levadura seca en billones de células por gramo (default: 10 B/g conservador, rango 10-20) */
  dryYeastBillionsPerGram?: number;
}

/**
 * Resultado completo del cálculo de inoculación de levadura.
 */
export interface PitchRateResult {
  /** Grados Plato exactos del mosto (polinomio ASBC) */
  plato: number;
  /** Tasa de inoculación aplicada en millones de células / mL / °P */
  targetRateCellsPerMlPlato: number;
  /** Categoría efectiva aplicada (incluyendo escalado automático por High Gravity) */
  effectiveStyle: YeastPitchStyle;
  /** Indica si el mosto es considerado de Alta Densidad (OG > 1.060 / > 14.7 °P) */
  isHighGravity: boolean;
  /** Total de células viables requeridas en billones (10^9 células) */
  totalCellsBillions: number;
  /** Células viables efectivas aportadas por cada paquete individual (billones) */
  viableCellsPerPackBillions: number;
  /** Cantidad de paquetes requeridos */
  packsNeeded: number;
  /** Equivalente estimado en gramos de levadura seca liofilizada (g) */
  dryYeastGrams: number;
}

/**
 * Calcula la cantidad exacta de células de levadura, paquetes y gramos de levadura seca
 * requeridos para una fermentación saludable según volumen, densidad (°Plato ASBC) y estilo.
 *
 * Fórmula:
 * Células_Totales = Tasa (10^6 cel/mL/°P) × (Volumen_L × 1000 mL/L) × °Plato
 * Billones_Células (10^9) = (Tasa × Volumen_L × °Plato)
 *
 * @param input - Parámetros del lote y de la cepa (`PitchRateInput`).
 * @returns Resultado detallado `PitchRateResult`.
 */
export function calculatePitchingRate(input: PitchRateInput): PitchRateResult {
  const cleanVolL = sanitizePositiveNumber(input.batchVolumeL, 0);
  const cleanOg = sanitizeGravity(input.og, 1.0);
  const cellsPerPack = sanitizePositiveNumber(input.cellsPerPackBillions ?? 200, 200);
  const viability = sanitizeNumber(input.viabilityPercent ?? 100, {
    fallback: 100,
    min: 1,
    max: 100,
  });
  const dryDensity = sanitizePositiveNumber(
    input.dryYeastBillionsPerGram ?? 10,
    10
  );

  const plato = sgToPlato(cleanOg);
  const isHighGravity = cleanOg > 1.06;

  let effectiveStyle: YeastPitchStyle = input.yeastType;
  if (isHighGravity) {
    if (input.yeastType === 'ALE') effectiveStyle = 'HIGH_GRAVITY_ALE';
    else if (input.yeastType === 'LAGER') effectiveStyle = 'HIGH_GRAVITY_LAGER';
  }

  const targetRate =
    typeof input.customRateCellsPerMlPlato === 'number' &&
    input.customRateCellsPerMlPlato > 0
      ? sanitizePositiveNumber(input.customRateCellsPerMlPlato, 0.75, 10)
      : PITCH_RATE_STANDARDS[effectiveStyle];

  if (cleanVolL <= 0 || plato <= 0) {
    return {
      plato: 0,
      targetRateCellsPerMlPlato: targetRate,
      effectiveStyle,
      isHighGravity,
      totalCellsBillions: 0,
      viableCellsPerPackBillions: cellsPerPack * (viability / 100),
      packsNeeded: 0,
      dryYeastGrams: 0,
    };
  }

  // (10^6 cel/mL/°P) * (Vol_L * 1000 mL/L) * °P = Vol_L * °P * Tasa * 10^9 (Billones)
  const totalCellsBillions = targetRate * cleanVolL * plato;
  const viableCellsPerPackBillions = cellsPerPack * (viability / 100);
  const packsNeeded =
    viableCellsPerPackBillions > 0
      ? totalCellsBillions / viableCellsPerPackBillions
      : 0;
  const dryYeastGrams =
    dryDensity > 0 ? totalCellsBillions / (dryDensity * (viability / 100)) : 0;

  return {
    plato,
    targetRateCellsPerMlPlato: targetRate,
    effectiveStyle,
    isHighGravity,
    totalCellsBillions,
    viableCellsPerPackBillions,
    packsNeeded,
    dryYeastGrams,
  };
}

/**
 * Resultado del cálculo de starter de levadura (propagación con extracto seco DME).
 */
export interface StarterCalculationResult {
  /** Volumen total del starter en litros (L) */
  volumeL: number;
  /** Gravedad específica objetivo del mosto del starter */
  targetGravity: number;
  /** Grados Plato objetivo del starter (°P) */
  plato: number;
  /** Gramos de Extracto de Malta Seco (DME) requeridos (g) */
  dmeGrams: number;
  /** Crecimiento celular estimado según modelo de agitador magnético de Braukaiser (billones de células finales) */
  estimatedFinalCellsBillions: number;
}

/**
 * Calcula los gramos de Extracto de Malta Seco (DME) necesarios para preparar un starter
 * de levadura a la densidad deseada y estima el conteo celular final según el modelo de **Braukaiser**.
 *
 * Potencial típico del DME: ~368 L°/kg (100 g de DME en 1 L de volumen final produce ~1.037 SG / ~9.2 °P).
 *
 * @param starterVolumeL - Volumen final del starter en litros (L).
 * @param targetGravity - Densidad objetivo del starter (ej. 1.036).
 * @param initialCellsBillions - Células viables inoculadas en el starter (billones, default: 100).
 * @returns Objeto `StarterCalculationResult`.
 */
export function calculateYeastStarter(
  starterVolumeL: number,
  targetGravity: number,
  initialCellsBillions: number = 100
): StarterCalculationResult {
  const cleanVol = sanitizePositiveNumber(starterVolumeL, 0, 500);
  const cleanGravity = sanitizeGravity(targetGravity, 1.036);
  const cleanInitialCells = sanitizePositiveNumber(initialCellsBillions, 100, 10000);

  if (cleanVol <= 0 || cleanGravity <= 1.0) {
    return {
      volumeL: cleanVol,
      targetGravity: cleanGravity,
      plato: 0,
      dmeGrams: 0,
      estimatedFinalCellsBillions: cleanInitialCells,
    };
  }

  const plato = sgToPlato(cleanGravity);
  // Extracto total en gramos ≈ Volumen (L) * SG * (°P * 10) / 0.97 (considerando ~3% humedad en DME)
  const dmeGrams = cleanVol * 10 * plato;

  // Modelo de crecimiento en agitador magnético (Braukaiser): ~1.4 billones de células nuevas por gramo de extracto
  const newCellsBillions = dmeGrams * 1.4;
  const estimatedFinalCellsBillions = cleanInitialCells + newCellsBillions;

  return {
    volumeL: cleanVol,
    targetGravity: cleanGravity,
    plato,
    dmeGrams,
    estimatedFinalCellsBillions,
  };
}

// ============================================================================
// 7. MACERACIÓN, LAVADO, OLLA, RECETA, PARTI-GYLE, COLOR, AGUA Y TERMODINÁMICA
// ============================================================================

/**
 * Calcula la temperatura a la que se debe calentar el agua de empaste (Strike Water).
 * Basada en la ecuación de balance entálpico de **John Palmer** ("How to Brew").
 *
 * Fórmula:
 * T_strike = (0.41 / R) × (T_macerado - T_grano) + T_macerado + ΔT_equipo
 * Donde 0.41 es el calor específico relativo de la malta respecto al agua (kcal/kg·°C).
 *
 * @param mashRatio - Relación agua/grano en L/kg.
 * @param targetMashTemp - Temperatura objetivo del macerado en °C.
 * @param grainTemp - Temperatura inicial del grano seco en °C.
 * @param thermalLoss - Factor de pérdida térmica del macerador en °C (default: 1.0°C).
 * @returns Temperatura del agua de empaste en °C.
 */
export function calculateStrikeTemp(
  mashRatio: number,
  targetMashTemp: number,
  grainTemp: number,
  thermalLoss: number = 1.0
): number {
  const cleanRatio = sanitizePositiveNumber(mashRatio, 0, 20);
  const cleanTarget = sanitizeTemperatureC(targetMashTemp, 65, 30, 100);
  const cleanGrainTemp = sanitizeTemperatureC(grainTemp, 20, -10, 60);
  const cleanLoss = sanitizeNumber(thermalLoss, { fallback: 1.0, min: 0, max: 15 });

  if (cleanRatio <= 0) return cleanTarget;
  return (
    (0.41 / cleanRatio) * (cleanTarget - cleanGrainTemp) +
    cleanTarget +
    cleanLoss
  );
}

/**
 * Calcula la eficiencia de extracción del macerado/equipo basada en la densidad original obtenida,
 * el volumen de mosto y el peso total de malta.
 *
 * @param og - Densidad original medida (ej. 1.050 o 1050).
 * @param volumeFermenter - Volumen obtenido en litros (L).
 * @param totalGrainKg - Peso total de granos en kilogramos (kg).
 * @param potentialPointsPerKg - Potencial medio de extracto de la malta en L°/kg (default: 300).
 * @returns Eficiencia en porcentaje (0-100%).
 */
export function calculateMashEfficiency(
  og: number,
  volumeFermenter: number,
  totalGrainKg: number,
  potentialPointsPerKg: number = 300
): number {
  if (!og || !volumeFermenter || totalGrainKg <= 0) return 0;

  const normalizedOg = sanitizeGravity(og, 1.0);
  const cleanVol = sanitizePositiveNumber(volumeFermenter, 0);
  const cleanGrain = sanitizePositiveNumber(totalGrainKg, 0);
  const cleanPotential = sanitizePositiveNumber(potentialPointsPerKg, 300);

  if (normalizedOg <= 1.0 || cleanVol <= 0 || cleanGrain <= 0 || cleanPotential <= 0) {
    return 0;
  }

  const actualPoints = cleanVol * (normalizedOg - 1) * 1000;
  const potentialPoints = cleanGrain * cleanPotential;

  return Math.max(0, Math.min(100, (actualPoints / potentialPoints) * 100));
}

/**
 * Resultado del balance hídrico de maceración y lavado (Sparge).
 */
export interface SpargeWaterResult {
  /** Volumen de agua para el empaste inicial (Mash Water) en L */
  mashWaterL: number;
  /** Volumen de agua retenido por absorción del grano en L */
  grainAbsorptionL: number;
  /** Volumen de primer mosto drenado antes de lavar (First Runnings) en L */
  firstRunningsL: number;
  /** Volumen de agua de lavado (Sparge Water) en L */
  spargeWaterL: number;
  /** Volumen total recolectado en olla pre-hervor (Pre-Boil Volume) en L */
  preBoilVolumeL: number;
}

/**
 * Calcula la distribución de volúmenes de agua para maceración (Mash), absorción,
 * lavado (Sparge) y recolección pre-hervor.
 *
 * @param totalWaterL - Agua total disponible o calculada para la cocción (L).
 * @param grainKg - Peso total de granos (kg).
 * @param mashRatioLPerKg - Relación de empaste (L/kg).
 * @param absorptionLPerKg - Coeficiente de absorción específica del grano (L/kg, típicamente 0.9 - 1.0).
 * @param deadSpaceL - Pérdidas en falso fondo / espacio muerto del macerador (L).
 * @returns Desglose `SpargeWaterResult`.
 */
export function calculateSpargeVolumes(
  totalWaterL: number,
  grainKg: number,
  mashRatioLPerKg: number,
  absorptionLPerKg: number = 1.0,
  deadSpaceL: number = 0
): SpargeWaterResult {
  const cleanTotal = sanitizePositiveNumber(totalWaterL, 0);
  const cleanGrain = sanitizePositiveNumber(grainKg, 0);
  const cleanRatio = sanitizePositiveNumber(mashRatioLPerKg, 3.0);
  const cleanAbs = sanitizePositiveNumber(absorptionLPerKg, 1.0);
  const cleanDead = sanitizePositiveNumber(deadSpaceL, 0);

  const mashWaterL = cleanGrain * cleanRatio;
  const grainAbsorptionL = cleanGrain * cleanAbs;
  const firstRunningsL = Math.max(0, mashWaterL - grainAbsorptionL - cleanDead);
  const spargeWaterL = Math.max(0, cleanTotal - mashWaterL);
  const preBoilVolumeL = Math.max(0, firstRunningsL + spargeWaterL);

  return {
    mashWaterL,
    grainAbsorptionL,
    firstRunningsL,
    spargeWaterL,
    preBoilVolumeL,
  };
}

/**
 * Calcula el volumen geométrico de líquido contenido en una olla cilíndrica.
 *
 * Fórmula:
 * V (L) = [ π × (D_cm / 2)² × H_cm ] / 1000
 *
 * @param diameterCm - Diámetro interno de la olla en centímetros (cm).
 * @param liquidHeightCm - Altura de la columna de líquido en centímetros (cm).
 * @returns Volumen en litros (L).
 */
export function calculateKettleVolume(
  diameterCm: number,
  liquidHeightCm: number
): number {
  const cleanD = sanitizePositiveNumber(diameterCm, 0);
  const cleanH = sanitizePositiveNumber(liquidHeightCm, 0);
  if (cleanD <= 0 || cleanH <= 0) return 0;
  const radius = cleanD / 2;
  return (Math.PI * Math.pow(radius, 2) * cleanH) / 1000;
}

/**
 * Calcula los kilogramos de malta necesarios para alcanzar una Densidad Original (OG) objetivo.
 *
 * @param batchVolumeL - Volumen final de lote en litros (L).
 * @param targetOg - Densidad Original deseada (ej. 1.050).
 * @param efficiencyPercent - Eficiencia del equipo (0-100%).
 * @param maltPotentialPtsPerKg - Extracto potencial de la malta en L°/kg (default: 300).
 * @returns Peso total de malta requerido en kilogramos (kg).
 */
export function calculateRecipeGrainBill(
  batchVolumeL: number,
  targetOg: number,
  efficiencyPercent: number,
  maltPotentialPtsPerKg: number = 300
): number {
  const cleanVol = sanitizePositiveNumber(batchVolumeL, 0);
  const cleanOg = sanitizeGravity(targetOg, 1.0);
  const cleanEff = sanitizeNumber(efficiencyPercent, { fallback: 75, min: 0, max: 100 });
  const cleanPot = sanitizePositiveNumber(maltPotentialPtsPerKg, 300);

  if (cleanVol <= 0 || cleanOg <= 1.0 || cleanEff <= 0 || cleanPot <= 0) {
    return 0;
  }

  const totalPoints = cleanVol * (cleanOg - 1) * 1000;
  const effectivePotential = cleanPot * (cleanEff / 100);
  return totalPoints / effectivePotential;
}

/**
 * Calcula la Densidad Original (OG) estimada a partir de una masa conocida de granos.
 *
 * @param batchVolumeL - Volumen final del lote en litros (L).
 * @param grainKg - Masa de granos utilizada en kilogramos (kg).
 * @param efficiencyPercent - Eficiencia del equipo (0-100%).
 * @param maltPotentialPtsPerKg - Extracto potencial de la malta en L°/kg (default: 300).
 * @returns Gravedad Específica estimada (SG, ej. 1.052).
 */
export function calculateRecipeEstimatedOG(
  batchVolumeL: number,
  grainKg: number,
  efficiencyPercent: number,
  maltPotentialPtsPerKg: number = 300
): number {
  const cleanVol = sanitizePositiveNumber(batchVolumeL, 0);
  const cleanGrain = sanitizePositiveNumber(grainKg, 0);
  const cleanEff = sanitizeNumber(efficiencyPercent, { fallback: 75, min: 0, max: 100 });
  const cleanPot = sanitizePositiveNumber(maltPotentialPtsPerKg, 300);

  if (cleanVol <= 0 || cleanGrain <= 0 || cleanEff <= 0 || cleanPot <= 0) {
    return 1.0;
  }

  const effectivePotential = cleanPot * (cleanEff / 100);
  const totalPoints = cleanGrain * effectivePotential;
  return 1 + totalPoints / cleanVol / 1000;
}

/**
 * Resultado de la partición de mostos en una cocción Parti-gyle.
 */
export interface PartigyleResult {
  /** Volumen del Lote 1 (primeros mostos / cerveza fuerte) en L */
  volume1L: number;
  /** Volumen del Lote 2 (segundos mostos / cerveza suave) en L */
  volume2L: number;
  /** Fracción del extracto total retenida en el Lote 1 (0 a 1) */
  sugarFraction1: number;
  /** Fracción del extracto total retenida en el Lote 2 (0 a 1) */
  sugarFraction2: number;
  /** Gravedad Específica Original (OG) estimada para el Lote 1 */
  og1: number;
  /** Gravedad Específica Original (OG) estimada para el Lote 2 */
  og2: number;
}

/**
 * Calcula las densidades originales (OG) de dos lotes obtenidos por el método **Parti-gyle**
 * utilizando la curva empírica de elución de extracto en lavado continuo (Braukaiser / Mosher).
 *
 * Fracción acumulada de azúcares en función de la fracción de volumen recolectado V:
 * S(V) = V + 0.32 × V × (1 - V)
 * (El primer 50% del volumen arrastra ~58% de los azúcares totales).
 *
 * @param totalVolumeL - Volumen combinado de ambos lotes (L).
 * @param totalOg - Gravedad específica combinada que tendría el lote único (SG).
 * @param batch1VolumeL - Volumen asignado al primer lote fuerte (L).
 * @returns Resultado `PartigyleResult` con volúmenes, fracciones de azúcar y OGs.
 */
export function calculatePartigyle(
  totalVolumeL: number,
  totalOg: number,
  batch1VolumeL: number
): PartigyleResult {
  const cleanTotalVol = sanitizePositiveNumber(totalVolumeL, 0);
  const cleanTotalOg = sanitizeGravity(totalOg, 1.0);
  const volume1L = Math.min(
    cleanTotalVol,
    sanitizePositiveNumber(batch1VolumeL, 0)
  );
  const volume2L = Math.max(0, cleanTotalVol - volume1L);

  if (cleanTotalVol <= 0 || cleanTotalOg <= 1.0) {
    return {
      volume1L,
      volume2L,
      sugarFraction1: 0,
      sugarFraction2: 0,
      og1: 1.0,
      og2: 1.0,
    };
  }

  const totalPoints = (cleanTotalOg - 1) * 1000 * cleanTotalVol;
  const vFraction = volume1L / cleanTotalVol;
  const sugarFraction1 = Math.min(
    1,
    Math.max(0, vFraction + 0.32 * vFraction * (1 - vFraction))
  );
  const sugarFraction2 = Math.max(0, 1 - sugarFraction1);

  const points1 = totalPoints * sugarFraction1;
  const points2 = totalPoints * sugarFraction2;

  const og1 = volume1L > 0 ? 1 + points1 / volume1L / 1000 : 1.0;
  const og2 = volume2L > 0 ? 1 + points2 / volume2L / 1000 : 1.0;

  return {
    volume1L,
    volume2L,
    sugarFraction1,
    sugarFraction2,
    og1,
    og2,
  };
}

/**
 * Entrada de malta para el cálculo de color.
 */
export interface MaltColorAdditionInput {
  id?: string;
  name?: string;
  /** Color de la malta en grados Lovibond (°L) */
  lovibond: number;
  /** Peso de la malta en kilogramos (kg) */
  kg: number;
}

/**
 * Resultado del cálculo de color cervecero por la ecuación de Morey.
 */
export interface BeerColorResult {
  /** Unidades de color de malta acumuladas (Malt Color Units - MCU) */
  mcu: number;
  /** Color en escala SRM (Standard Reference Method) */
  srm: number;
  /** Color en escala europea EBC (SRM × 1.97) */
  ebc: number;
  /** Código hexadecimal RGB representativo del color de la cerveza */
  hexColor: string;
}

/**
 * Devuelve el color hexadecimal aproximado para un valor SRM dado.
 *
 * @param srm - Valor de color en escala SRM.
 * @returns Color hexadecimal (ej. `'#F8A600'`).
 */
export function getSRMHexColor(srm: number): string {
  const cleanSrm = sanitizePositiveNumber(srm, 1);
  const colors: Record<number, string> = {
    1: '#FFE699', 2: '#FFD878', 3: '#FFCA5A', 4: '#FFBF42', 5: '#FBB123',
    6: '#F8A600', 7: '#F39C00', 8: '#EA8F00', 9: '#E58500', 10: '#DE7C00',
    11: '#D77200', 12: '#CF6900', 13: '#CB6200', 14: '#C35900', 15: '#BB5100',
    16: '#B54C00', 17: '#B04500', 18: '#A63E00', 19: '#A13700', 20: '#9B3200',
    25: '#7C2900', 30: '#5E1E00', 35: '#401500', 40: '#261000',
  };
  const keys = Object.keys(colors)
    .map(Number)
    .sort((a, b) => a - b);
  let closest = keys[0];
  for (const k of keys) {
    if (k <= cleanSrm) closest = k;
  }
  return colors[closest] || '#1A0A00';
}

/**
 * Calcula el color de la cerveza en SRM y EBC utilizando la ecuación no lineal de **Dan Morey**.
 *
 * Fórmulas:
 * MCU = Σ [ (°L × Peso_lb) / Volumen_gal ] = Σ [ (°L × kg × 2.20462262) / (L × 0.26417205) ]
 * SRM = 1.4922 × (MCU ^ 0.6859)
 * EBC = SRM × 1.97
 *
 * @param malts - Lista de maltas con su peso (kg) y color (°Lovibond).
 * @param batchVolumeL - Volumen final del lote en litros (L).
 * @returns Objeto `BeerColorResult` con MCU, SRM, EBC y color Hex.
 */
export function calculateMoreyColor(
  malts: MaltColorAdditionInput[],
  batchVolumeL: number
): BeerColorResult {
  const cleanVol = sanitizePositiveNumber(batchVolumeL, 0);
  if (cleanVol <= 0 || !Array.isArray(malts) || malts.length === 0) {
    return {
      mcu: 0,
      srm: 0,
      ebc: 0,
      hexColor: getSRMHexColor(1),
    };
  }

  const gallons = cleanVol * 0.2641720524;
  let totalMCU = 0;

  malts.forEach((m) => {
    const lovibond = sanitizePositiveNumber(m.lovibond, 0, 1000);
    const kg = sanitizePositiveNumber(m.kg, 0, 50000);
    const lbs = kg * 2.2046226218;
    totalMCU += (lovibond * lbs) / gallons;
  });

  const rawSrm = totalMCU > 0 ? 1.4922 * Math.pow(totalMCU, 0.6859) : 0;
  const srm = Math.min(50, rawSrm);
  const ebc = srm * 1.97;

  return {
    mcu: totalMCU,
    srm,
    ebc,
    hexColor: getSRMHexColor(srm),
  };
}

/**
 * Perfil iónico de agua cervecera en partes por millón (ppm o mg/L).
 */
export interface WaterIonProfile {
  Ca: number;
  Mg: number;
  Na: number;
  SO4: number;
  Cl: number;
  HCO3: number;
}

/**
 * Adiciones de sales minerales expresadas en gramos cada 10 litros (o gramos totales según modo).
 */
export interface WaterSaltAdditions {
  /** Sulfato de Calcio Dihidratado - CaSO4·2H2O (Gypsum) */
  gypsum: number;
  /** Cloruro de Calcio Dihidratado - CaCl2·2H2O */
  cacl2: number;
  /** Sulfato de Magnesio Heptahidratado - MgSO4·7H2O (Sal de Epsom) */
  epsom: number;
  /** Cloruro de Sodio - NaCl (Sal común sin yodo) */
  salt: number;
  /** Ácido láctico (opcional) */
  lactic?: number;
}

/**
 * Resultado del cálculo de química de agua y balance Sulfato/Cloruro.
 */
export interface WaterChemistryResult extends WaterIonProfile {
  /** Relación numérica SO4 / Cl (null si Cl = 0) */
  so4ClRatio: number | null;
  /** Etiqueta formateada de la relación SO4/Cl */
  ratioFormatted: string;
  /** Descripción sensorial del balance amargo/maltoso */
  ratioDescription: string;
  /** Alcalinidad Residual de Kolbach en ppm como CaCO3 */
  residualAlkalinityPpm: number;
}

/**
 * Calcula el perfil mineral resultante del agua tras la adición de sales cerveceras,
 * la relación Sulfato/Cloruro y la Alcalinidad Residual de Kolbach.
 *
 * Aportes estequiométricos por cada 1 g en 10 L de agua:
 * - Gypsum (CaSO4·2H2O): +23.3 ppm Ca²⁺, +55.8 ppm SO4²⁻
 * - CaCl2·2H2O: +27.3 ppm Ca²⁺, +48.2 ppm Cl⁻
 * - Epsom (MgSO4·7H2O): +9.9 ppm Mg²⁺, +39.0 ppm SO4²⁻
 * - NaCl: +39.3 ppm Na⁺, +60.7 ppm Cl⁻
 *
 * @param waterVolumeL - Volumen de agua a tratar en litros (L).
 * @param baseProfile - Perfil mineral de partida en ppm.
 * @param additionsPer10L - Gramos de sales agregados (escalados a base 10 L según volumen).
 * @returns Perfil resultante `WaterChemistryResult`.
 */
export function calculateWaterChemistry(
  waterVolumeL: number,
  baseProfile: WaterIonProfile,
  additionsPer10L: WaterSaltAdditions
): WaterChemistryResult {
  const cleanVol = sanitizePositiveNumber(waterVolumeL, 1);
  const volFactor = cleanVol > 0 ? 10 / cleanVol : 0;

  const baseCa = sanitizePositiveNumber(baseProfile.Ca, 0);
  const baseMg = sanitizePositiveNumber(baseProfile.Mg, 0);
  const baseNa = sanitizePositiveNumber(baseProfile.Na, 0);
  const baseSO4 = sanitizePositiveNumber(baseProfile.SO4, 0);
  const baseCl = sanitizePositiveNumber(baseProfile.Cl, 0);
  const baseHCO3 = sanitizePositiveNumber(baseProfile.HCO3, 0);

  const gypsum = sanitizePositiveNumber(additionsPer10L.gypsum, 0);
  const cacl2 = sanitizePositiveNumber(additionsPer10L.cacl2, 0);
  const epsom = sanitizePositiveNumber(additionsPer10L.epsom, 0);
  const salt = sanitizePositiveNumber(additionsPer10L.salt, 0);

  const Ca = Math.round(baseCa + (gypsum * 23 + cacl2 * 27) * volFactor);
  const Mg = Math.round(baseMg + epsom * 10 * volFactor);
  const Na = Math.round(baseNa + salt * 39 * volFactor);
  const SO4 = Math.round(baseSO4 + (gypsum * 56 + epsom * 39) * volFactor);
  const Cl = Math.round(baseCl + (cacl2 * 48 + salt * 60) * volFactor);
  const HCO3 = Math.round(baseHCO3);

  const so4ClRatio = Cl > 0 ? SO4 / Cl : null;
  let ratioDescription = 'Equilibrado';
  if (so4ClRatio !== null) {
    if (so4ClRatio > 1.3) ratioDescription = 'Amargo (Resalta Lúpulo)';
    else if (so4ClRatio < 0.75) ratioDescription = 'Maltoso (Resalta Malta)';
  }

  // Alcalinidad Residual de Kolbach (en ppm CaCO3): RA = (HCO3 * 50/61) - (Ca / 1.4) - (Mg / 1.7)
  const alkalinityAsCaCO3 = HCO3 * (50 / 61);
  const residualAlkalinityPpm =
    alkalinityAsCaCO3 - Ca / 1.4 - Mg / 1.7;

  return {
    Ca,
    Mg,
    Na,
    SO4,
    Cl,
    HCO3,
    so4ClRatio,
    ratioFormatted: so4ClRatio !== null ? so4ClRatio.toFixed(2) : 'N/A',
    ratioDescription,
    residualAlkalinityPpm,
  };
}

/** Tipos de ácido para corrección de pH de agua/macerado */
export type AcidType = 'CITRIC' | 'LACTIC' | 'PHOSPHORIC';

/**
 * Resultado del cálculo de dosificación de ácido.
 */
export interface AcidAdditionResult {
  /** Cantidad de ácido a agregar */
  amount: number;
  /** Unidad de medida ('g' para sólido o 'ml' para líquidos) */
  unit: 'g' | 'ml';
  /** Alcalinidad neutralizada estimada en ppm */
  neutralizedAlkalinityPpm: number;
  /** Factor de neutralización aplicado (0 a 1) */
  neutralizationFactor: number;
}

/**
 * Calcula la cantidad de ácido (Cítrico anhidro/monohidrato, Láctico 88% o Fosfórico 85%)
 * necesaria para neutralizar la alcalinidad del agua y alcanzar el pH objetivo de macerado o lavado.
 *
 * @param waterVolumeL - Volumen de agua a tratar en litros (L).
 * @param alkalinityPpm - Alcalinidad (HCO3⁻ / CaCO3) del agua en ppm.
 * @param targetPh - pH objetivo deseado (rango típico 5.0 - 6.0).
 * @param acidType - Tipo de ácido (`'CITRIC'`, `'LACTIC'`, `'PHOSPHORIC'`).
 * @returns Resultado `AcidAdditionResult`.
 */
export function calculateAcidAddition(
  waterVolumeL: number,
  alkalinityPpm: number,
  targetPh: number,
  acidType: AcidType
): AcidAdditionResult {
  const cleanVol = sanitizePositiveNumber(waterVolumeL, 0);
  const cleanAlk = sanitizePositiveNumber(alkalinityPpm, 0);
  const cleanPh = sanitizeNumber(targetPh, { fallback: 5.4, min: 4.5, max: 6.5 });

  let neutralizationFactor = 0.9;
  if (cleanPh <= 5.2) neutralizationFactor = 1.0;
  else if (cleanPh >= 5.8) neutralizationFactor = 0.6;
  else neutralizationFactor = 1 - ((cleanPh - 5.2) / 0.6) * 0.4;

  const neutralizedAlkalinityPpm = cleanAlk * neutralizationFactor;

  if (cleanVol <= 0 || neutralizedAlkalinityPpm <= 0) {
    return {
      amount: 0,
      unit: acidType === 'CITRIC' ? 'g' : 'ml',
      neutralizedAlkalinityPpm: 0,
      neutralizationFactor,
    };
  }

  if (acidType === 'CITRIC') {
    return {
      amount: cleanVol * neutralizedAlkalinityPpm * 0.0021,
      unit: 'g',
      neutralizedAlkalinityPpm,
      neutralizationFactor,
    };
  }

  if (acidType === 'LACTIC') {
    return {
      amount: cleanVol * neutralizedAlkalinityPpm * 0.0012,
      unit: 'ml',
      neutralizedAlkalinityPpm,
      neutralizationFactor,
    };
  }

  return {
    amount: cleanVol * neutralizedAlkalinityPpm * 0.001,
    unit: 'ml',
    neutralizedAlkalinityPpm,
    neutralizationFactor,
  };
}

/**
 * Calcula los litros de agua desmineralizada/tratada necesarios para diluir un mosto
 * desde su gravedad actual hasta una gravedad objetivo menor (balance de masa de puntos de gravedad).
 *
 * Fórmula:
 * V_final = [ V_actual × (SG_actual - 1) ] / (SG_objetivo - 1)
 * Agua_Agregar = max(0, V_final - V_actual)
 *
 * @param currentGravity - Gravedad específica actual del mosto (ej. 1.060).
 * @param currentVolumeL - Volumen actual de mosto en litros (L).
 * @param targetGravity - Gravedad específica objetivo (ej. 1.050).
 * @returns Litros de agua a agregar (L).
 */
export function calculateDilutionWater(
  currentGravity: number,
  currentVolumeL: number,
  targetGravity: number
): number {
  const cleanCurrG = sanitizeGravity(currentGravity, 1.0);
  const cleanVol = sanitizePositiveNumber(currentVolumeL, 0);
  const cleanTargetG = sanitizeGravity(targetGravity, 1.0);

  if (cleanVol <= 0 || cleanTargetG <= 1.0 || cleanCurrG <= cleanTargetG) {
    return 0;
  }

  const p1 = (cleanCurrG - 1) * 1000;
  const p2 = (cleanTargetG - 1) * 1000;
  const finalVolume = (p1 * cleanVol) / p2;
  return Math.max(0, finalVolume - cleanVol);
}

/**
 * Calcula la cantidad total de lúpulo en gramos necesaria para realizar un Dry Hop.
 *
 * @param beerVolumeL - Volumen de cerveza en fermentador/madurador (L).
 * @param rateGramsPerLiter - Tasa de dosificación deseada en gramos por litro (g/L).
 * @returns Cantidad total de lúpulo en gramos (g).
 */
export function calculateDryHopAmount(
  beerVolumeL: number,
  rateGramsPerLiter: number
): number {
  const cleanVol = sanitizePositiveNumber(beerVolumeL, 0);
  const cleanRate = sanitizePositiveNumber(rateGramsPerLiter, 0, 50);
  return cleanVol * cleanRate;
}

/**
 * Calcula los días necesarios para completar una rampa de enfriamiento controlado (Cold Crash).
 *
 * @param startTempC - Temperatura inicial de fermentación/descanso de diacetilo (°C).
 * @param targetTempC - Temperatura final de guarda/clarificación (°C).
 * @param coolingRateCPerDay - Velocidad de descenso térmico en °C por día.
 * @returns Cantidad de días requeridos.
 */
export function calculateColdCrashDays(
  startTempC: number,
  targetTempC: number,
  coolingRateCPerDay: number
): number {
  const cleanStart = sanitizeTemperatureC(startTempC, 20, -10, 50);
  const cleanTarget = sanitizeTemperatureC(targetTempC, 2, -10, 50);
  const cleanRate = sanitizePositiveNumber(coolingRateCPerDay, 0);

  if (cleanStart <= cleanTarget || cleanRate <= 0) return 0;
  return (cleanStart - cleanTarget) / cleanRate;
}

/**
 * Resultado de simulación hídrica y termodinámica de equipamiento cervecero.
 */
export interface EquipmentThermodynamicsResult {
  /** Agua total requerida para el lote (L) */
  totalWaterL: number;
  /** Agua de empaste (Mash) en L */
  mashWaterL: number;
  /** Agua de lavado (Sparge) en L */
  spargeWaterL: number;
  /** Agua absorbida por la malta en L */
  grainAbsorptionL: number;
  /** Salto térmico solicitado ΔT en °C */
  deltaTempC: number;
  /** Energía térmica requerida en kilocalorías (kcal) */
  kcalRequired: number;
  /** Potencia térmica requerida en kilovatios (kW) para lograr el salto en el tiempo fijado */
  kwRequired: number;
  /** Volumen de mosto espeso a hervir en decocción para lograr el escalón térmico (L) */
  decoctionVolumeL: number;
}

/**
 * Calcula el balance hídrico de planta y los requerimientos termodinámicos (potencia en kW
 * y volumen de decocción) para un salto térmico en el macerador/olla.
 *
 * @param params - Parámetros operativos del equipo y del escalón térmico.
 * @returns Objeto `EquipmentThermodynamicsResult`.
 */
export function calculateEquipmentThermodynamics(params: {
  batchVolumeL: number;
  grainKg: number;
  mashRatioLPerKg: number;
  grainAbsorptionLPerKg: number;
  boilOffLPerHour: number;
  deadSpaceLossesL: number;
  currentTempC: number;
  targetTempC: number;
  heatingTimeMinutes: number;
}): EquipmentThermodynamicsResult {
  const batchVolumeL = sanitizePositiveNumber(params.batchVolumeL, 0);
  const grainKg = sanitizePositiveNumber(params.grainKg, 0);
  const mashRatio = sanitizePositiveNumber(params.mashRatioLPerKg, 3.0);
  const grainAbs = sanitizePositiveNumber(params.grainAbsorptionLPerKg, 0.9);
  const boilOff = sanitizePositiveNumber(params.boilOffLPerHour, 0);
  const losses = sanitizePositiveNumber(params.deadSpaceLossesL, 0);
  const currentTemp = sanitizeTemperatureC(params.currentTempC, 65, 0, 100);
  const targetTemp = sanitizeTemperatureC(params.targetTempC, 75, 0, 100);
  const heatingTimeMin = sanitizePositiveNumber(params.heatingTimeMinutes, 15);

  const grainAbsorptionL = grainKg * grainAbs;
  const totalWaterL = batchVolumeL + grainAbsorptionL + boilOff + losses;
  const mashWaterL = grainKg * mashRatio;
  const spargeWaterL = Math.max(0, totalWaterL - mashWaterL);

  const deltaTempC = Math.max(0, targetTemp - currentTemp);
  const kcalRequired = batchVolumeL * deltaTempC;
  const kwRequired =
    heatingTimeMin > 0 ? (kcalRequired * 4.184) / (heatingTimeMin * 60) : 0;

  const decoctionDenominator = Math.max(1, 100 - currentTemp);
  const decoctionFraction = Math.min(1, deltaTempC / decoctionDenominator);
  const decoctionVolumeL = batchVolumeL * decoctionFraction;

  return {
    totalWaterL,
    mashWaterL,
    spargeWaterL,
    grainAbsorptionL,
    deltaTempC,
    kcalRequired,
    kwRequired,
    decoctionVolumeL,
  };
}
