/**
 * BrewMath — Funciones puras de cálculo cervecero.
 *
 * Extraídas de los componentes individuales en `components/calculators/`
 * para permitir testing unitario independiente de React.
 *
 * Referencia: Tinseth (IBU), Thiesen (densidad agua), Palmer (priming).
 */

// ============================================================================
// ABV & Attenuation
// ============================================================================

/**
 * Calcula el ABV (Alcohol por Volumen) usando la fórmula estándar simplificada.
 * @param og - Densidad Original (ej. 1.050)
 * @param fg - Densidad Final (ej. 1.010)
 * @returns ABV en porcentaje (ej. 5.25)
 */
export function calculateABV(og: number, fg: number): number {
  return Math.max(0, (og - fg) * 131.25);
}

/**
 * Calcula la Atenuación Aparente.
 * @param og - Densidad Original
 * @param fg - Densidad Final
 * @returns Porcentaje de atenuación (0-100)
 */
export function calculateAttenuation(og: number, fg: number): number {
  if (og <= 1) return 0;
  const att = ((og - fg) / (og - 1)) * 100;
  return Math.max(0, Math.min(100, att));
}

// ============================================================================
// IBU — Tinseth
// ============================================================================

export type HopAdditionInput = {
  amount: number;  // gramos
  alpha: number;   // % Alpha Acids
  time: number;    // minutos de hervor
  type: 'BOIL' | 'HOPSTAND' | 'DRY_HOP';
};

/**
 * Calcula el IBU total usando la fórmula de Tinseth para múltiples adiciones.
 *
 * - BOIL: Tinseth estándar
 * - HOPSTAND: Tinseth × 0.5 (simula 80-90°C)
 * - DRY_HOP: 0 IBU (solo aroma)
 *
 * Aplica corrección de gravedad alta (> 1.050) según Glenn Tinseth.
 *
 * @param hops - Array de adiciones de lúpulo
 * @param boilVolume - Volumen de hervor en litros
 * @param boilGravity - Densidad del mosto durante el hervor
 * @returns IBU totales
 */
export function calculateTinsethIBU(
  hops: HopAdditionInput[],
  boilVolume: number,
  boilGravity: number
): number {
  if (boilVolume <= 0) return 0;
  // Guard against invalid gravities that would produce nonsensical results
  if (boilGravity < 1.000 || boilGravity > 2.000) return 0;

  let totalIBU = 0;

  hops.forEach(hop => {
    if (hop.type === 'DRY_HOP') return;

    const bignessFactor = 1.65 * Math.pow(0.000125, boilGravity - 1);
    const timeFactor = (1 - Math.exp(-0.04 * hop.time)) / 4.15;
    let utilization = bignessFactor * timeFactor;

    if (hop.type === 'HOPSTAND') {
      utilization *= 0.5;
    }

    const ibu = (utilization * (hop.amount * hop.alpha * 10)) / boilVolume;
    totalIBU += ibu;
  });

  // Corrección por gravedad alta
  if (boilGravity > 1.050) {
    const fc = 1 + (boilGravity - 1.050) / 0.2;
    totalIBU /= fc;
  }

  return totalIBU;
}

// ============================================================================
// Density Correction (Thiesen Equation)
// ============================================================================

/**
 * Calcula la densidad del agua a una temperatura dada usando la ecuación de Thiesen.
 * @param t - Temperatura en °C
 * @returns Densidad relativa del agua
 */
export function getWaterDensity(t: number): number {
  return 1 - ((t + 288.9414) / (508929.2 * (t + 68.12963))) * Math.pow(t - 3.9863, 2);
}

/**
 * Corrige la lectura de un densímetro según la temperatura de la muestra
 * y la temperatura de calibración del instrumento.
 *
 * @param measuredGravity - Lectura del densímetro
 * @param sampleTemp - Temperatura de la muestra (°C)
 * @param calibrationTemp - Temperatura de calibración del densímetro (°C), usualmente 15 o 20
 * @returns Densidad corregida
 */
export function correctGravity(
  measuredGravity: number,
  sampleTemp: number,
  calibrationTemp: number
): number {
  const densityMeas = getWaterDensity(sampleTemp);
  const densityCal = getWaterDensity(calibrationTemp);
  return measuredGravity * (densityCal / densityMeas);
}

// ============================================================================
// Strike Water Temperature
// ============================================================================

/**
 * Calcula la temperatura a la que se debe calentar el agua de empaste.
 * Basada en la fórmula de Palmer.
 *
 * @param mashRatio - Relación agua/grano (L/kg)
 * @param targetMashTemp - Temperatura objetivo del macerado (°C)
 * @param grainTemp - Temperatura actual del grano (°C)
 * @param thermalLoss - Factor de pérdida térmica del equipo (°C), default 1.0
 * @returns Temperatura del agua de empaste (°C)
 */
export function calculateStrikeTemp(
  mashRatio: number,
  targetMashTemp: number,
  grainTemp: number,
  thermalLoss: number = 1.0
): number {
  if (mashRatio <= 0) return targetMashTemp;
  return (0.41 / mashRatio) * (targetMashTemp - grainTemp) + targetMashTemp + thermalLoss;
}

// ============================================================================
// Priming Sugar
// ============================================================================

export type SugarType = 'TABLE' | 'DEXTROSE' | 'HONEY' | 'DME';

const SUGAR_FACTORS: Record<SugarType, number> = {
  TABLE: 1,       // Sucrose baseline
  DEXTROSE: 1.11, // ~10-15% moisture => 1/0.9
  HONEY: 1.25,    // ~20% moisture => 1/0.8
  DME: 1.54,      // DME is ~65% fermentable sugars
};

/**
 * Calcula el CO2 residual en la cerveza basado en la temperatura
 * máxima de fermentación.
 *
 * @param temp - Temperatura máxima de fermentación (°C)
 * @returns Volúmenes de CO2 residual
 */
export function residualCO2(temp: number): number {
  return 3.0378 - 0.050062 * temp + 0.00026555 * Math.pow(temp, 2);
}

/**
 * Calcula la cantidad de azúcar necesaria para carbonatar en botella.
 *
 * @param volume - Volumen a embotellar (litros)
 * @param fermTemp - Temperatura máxima de fermentación (°C)
 * @param targetCO2 - Volúmenes de CO2 deseados
 * @param sugarType - Tipo de azúcar a usar
 * @returns Objeto con g/L, total en gramos, y gramos por botella 330ml
 */
export function calculatePriming(
  volume: number,
  fermTemp: number,
  targetCO2: number,
  sugarType: SugarType
): { gramsPerLiter: number; totalGrams: number; perBottle330ml: number } {
  const residual = residualCO2(fermTemp);
  const neededCO2 = targetCO2 - residual;

  if (neededCO2 <= 0 || volume <= 0) {
    return { gramsPerLiter: 0, totalGrams: 0, perBottle330ml: 0 };
  }

  const factor = SUGAR_FACTORS[sugarType];
  const gramsPerLiter = neededCO2 * 4.0 * factor;
  const totalGrams = gramsPerLiter * volume;
  const perBottle330ml = totalGrams / (volume / 0.33);

  return { gramsPerLiter, totalGrams, perBottle330ml };
}

// ============================================================================
// Mash Efficiency
// ============================================================================

/**
 * Calcula la eficiencia del macerado basada en la densidad original,
 * el volumen al fermentador y el peso total de grano.
 *
 * Asume un potencial de extracción de 300 puntos por kg de malta.
 *
 * @param og - Densidad original (ej. 1.050)
 * @param volumeFermenter - Volumen al fermentador (litros)
 * @param totalGrainKg - Peso total de grano (kg)
 * @returns Eficiencia en porcentaje (0-100)
 */
export function calculateMashEfficiency(
  og: number,
  volumeFermenter: number,
  totalGrainKg: number
): number {
  if (!og || !volumeFermenter || totalGrainKg <= 0) return 0;
  
  let normalizedOg = og;
  if (og >= 1000) normalizedOg = og / 1000;

  const actualPoints = volumeFermenter * (normalizedOg - 1) * 1000;
  const potentialPoints = totalGrainKg * 300;

  if (potentialPoints === 0) return 0;
  return (actualPoints / potentialPoints) * 100;
}
