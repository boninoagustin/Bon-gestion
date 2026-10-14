import { describe, it, expect } from 'vitest';
import {
  calculateABV,
  calculateAttenuation,
  calculateTinsethIBU,
  getWaterDensity,
  correctGravity,
  calculateStrikeTemp,
  calculatePriming,
  residualCO2,
  calculateMashEfficiency,
  HopAdditionInput,
} from '../brewmath';
import { parseVolumeFromFormat, calculateSaleVolume } from '../volumeParser';

// ============================================================================
// ABV
// ============================================================================
describe('calculateABV', () => {
  it('calcula ABV estándar (OG 1.050, FG 1.010 → ~5.25%)', () => {
    const abv = calculateABV(1.050, 1.010);
    expect(abv).toBeCloseTo(5.25, 1);
  });

  it('cerveza fuerte (OG 1.080, FG 1.015 → ~8.53%)', () => {
    const abv = calculateABV(1.080, 1.015);
    expect(abv).toBeCloseTo(8.53, 1);
  });

  it('session beer (OG 1.035, FG 1.008 → ~3.54%)', () => {
    const abv = calculateABV(1.035, 1.008);
    expect(abv).toBeCloseTo(3.54, 1);
  });

  it('devuelve 0 si OG = FG (sin fermentación)', () => {
    expect(calculateABV(1.050, 1.050)).toBe(0);
  });

  it('nunca devuelve negativo (FG > OG)', () => {
    expect(calculateABV(1.010, 1.050)).toBe(0);
  });
});

// ============================================================================
// Attenuation
// ============================================================================
describe('calculateAttenuation', () => {
  it('atenuación típica Ale (OG 1.050, FG 1.010 → 80%)', () => {
    const att = calculateAttenuation(1.050, 1.010);
    expect(att).toBeCloseTo(80, 0);
  });

  it('alta atenuación (OG 1.060, FG 1.006 → 90%)', () => {
    const att = calculateAttenuation(1.060, 1.006);
    expect(att).toBeCloseTo(90, 0);
  });

  it('devuelve 0 si OG <= 1.000', () => {
    expect(calculateAttenuation(1.000, 1.000)).toBe(0);
    expect(calculateAttenuation(0.998, 0.990)).toBe(0);
  });

  it('nunca excede 100%', () => {
    expect(calculateAttenuation(1.050, 0.990)).toBeLessThanOrEqual(100);
  });

  it('nunca es negativo', () => {
    expect(calculateAttenuation(1.010, 1.050)).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// IBU Tinseth
// ============================================================================
describe('calculateTinsethIBU', () => {
  it('adición estándar de 60 min produce IBU razonable', () => {
    const hops: HopAdditionInput[] = [
      { amount: 50, alpha: 12.5, time: 60, type: 'BOIL' },
    ];
    const ibu = calculateTinsethIBU(hops, 300, 1.050);
    expect(ibu).toBeGreaterThan(0);
    expect(ibu).toBeLessThan(100);
  });

  it('dry hop contribuye 0 IBU', () => {
    const hops: HopAdditionInput[] = [
      { amount: 100, alpha: 15, time: 0, type: 'DRY_HOP' },
    ];
    expect(calculateTinsethIBU(hops, 20, 1.050)).toBe(0);
  });

  it('hopstand produce ~50% del IBU de boil', () => {
    const boilHop: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 15, type: 'BOIL' },
    ];
    const standHop: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 15, type: 'HOPSTAND' },
    ];
    const ibuBoil = calculateTinsethIBU(boilHop, 20, 1.050);
    const ibuStand = calculateTinsethIBU(standHop, 20, 1.050);
    expect(ibuStand).toBeCloseTo(ibuBoil * 0.5, 2);
  });

  it('mayor tiempo de hervor → más IBU', () => {
    const short: HopAdditionInput[] = [
      { amount: 30, alpha: 5, time: 10, type: 'BOIL' },
    ];
    const long: HopAdditionInput[] = [
      { amount: 30, alpha: 5, time: 60, type: 'BOIL' },
    ];
    expect(calculateTinsethIBU(long, 20, 1.050))
      .toBeGreaterThan(calculateTinsethIBU(short, 20, 1.050));
  });

  it('gravedad alta reduce IBU (corrección > 1.050)', () => {
    const hops: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 60, type: 'BOIL' },
    ];
    const ibuLow = calculateTinsethIBU(hops, 20, 1.040);
    const ibuHigh = calculateTinsethIBU(hops, 20, 1.080);
    expect(ibuHigh).toBeLessThan(ibuLow);
  });

  it('múltiples adiciones se suman correctamente', () => {
    const single: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 60, type: 'BOIL' },
    ];
    const multi: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 60, type: 'BOIL' },
      { amount: 30, alpha: 5, time: 15, type: 'BOIL' },
    ];
    expect(calculateTinsethIBU(multi, 20, 1.050))
      .toBeGreaterThan(calculateTinsethIBU(single, 20, 1.050));
  });

  it('volumen 0 devuelve 0 IBU', () => {
    const hops: HopAdditionInput[] = [
      { amount: 50, alpha: 10, time: 60, type: 'BOIL' },
    ];
    expect(calculateTinsethIBU(hops, 0, 1.050)).toBe(0);
  });
});

// ============================================================================
// Density Correction
// ============================================================================
describe('correctGravity', () => {
  it('a temperatura de calibración, la lectura no cambia', () => {
    const corrected = correctGravity(1.050, 15, 15);
    expect(corrected).toBeCloseTo(1.050, 3);
  });

  it('muestra caliente (60°C) corrige la densidad hacia arriba', () => {
    const corrected = correctGravity(1.050, 60, 15);
    expect(corrected).toBeGreaterThan(1.050);
  });

  it('muestra fría (5°C) corrige la densidad hacia abajo', () => {
    const corrected = correctGravity(1.050, 5, 20);
    expect(corrected).toBeLessThan(1.050);
  });
});

describe('getWaterDensity', () => {
  it('máxima densidad del agua cerca de 4°C', () => {
    const d4 = getWaterDensity(4);
    const d20 = getWaterDensity(20);
    const d60 = getWaterDensity(60);
    expect(d4).toBeGreaterThan(d20);
    expect(d20).toBeGreaterThan(d60);
  });
});

// ============================================================================
// Strike Water Temperature
// ============================================================================
describe('calculateStrikeTemp', () => {
  it('valores típicos producen temperatura por encima del objetivo', () => {
    const strike = calculateStrikeTemp(3, 65, 20);
    expect(strike).toBeGreaterThan(65);
  });

  it('grano más frío requiere agua más caliente', () => {
    const warm = calculateStrikeTemp(3, 65, 25);
    const cold = calculateStrikeTemp(3, 65, 10);
    expect(cold).toBeGreaterThan(warm);
  });

  it('mayor relación de empaste → temperatura más cercana al objetivo', () => {
    const thin = calculateStrikeTemp(4, 65, 20); // Empaste diluido
    const thick = calculateStrikeTemp(2, 65, 20); // Empaste espeso
    expect(thick).toBeGreaterThan(thin); // Espeso necesita más calor
  });

  it('relación de empaste 0 devuelve temperatura objetivo', () => {
    expect(calculateStrikeTemp(0, 65, 20)).toBe(65);
  });
});

// ============================================================================
// Priming Sugar
// ============================================================================
describe('calculatePriming', () => {
  it('Lager típica: 20L, 20°C fermentación, 2.5 vols CO2', () => {
    const result = calculatePriming(20, 20, 2.5, 'TABLE');
    expect(result.gramsPerLiter).toBeGreaterThan(0);
    expect(result.totalGrams).toBeGreaterThan(0);
    expect(result.totalGrams).toBeCloseTo(result.gramsPerLiter * 20, 1);
  });

  it('dextrosa necesita más cantidad que azúcar de mesa', () => {
    const table = calculatePriming(20, 20, 2.5, 'TABLE');
    const dex = calculatePriming(20, 20, 2.5, 'DEXTROSE');
    expect(dex.totalGrams).toBeGreaterThan(table.totalGrams);
  });

  it('DME necesita la mayor cantidad', () => {
    const table = calculatePriming(20, 20, 2.5, 'TABLE');
    const dme = calculatePriming(20, 20, 2.5, 'DME');
    expect(dme.totalGrams).toBeGreaterThan(table.totalGrams);
  });

  it('fermentación fría retiene más CO2, por lo tanto necesita menos azúcar', () => {
    const warm = calculatePriming(20, 22, 2.5, 'TABLE'); // Menos CO2 residual → más azúcar
    const cold = calculatePriming(20, 10, 2.5, 'TABLE'); // Más CO2 residual → menos azúcar
    expect(warm.totalGrams).toBeGreaterThan(cold.totalGrams);
  });

  it('target CO2 <= residual devuelve 0', () => {
    // A 5°C el residual es ~1.6 vols, pedir 1.0 no necesita priming
    const result = calculatePriming(20, 5, 1.0, 'TABLE');
    expect(result.totalGrams).toBe(0);
  });

  it('volumen 0 devuelve 0', () => {
    const result = calculatePriming(0, 20, 2.5, 'TABLE');
    expect(result.totalGrams).toBe(0);
  });
});

describe('residualCO2', () => {
  it('mayor temperatura → menor CO2 residual', () => {
    expect(residualCO2(10)).toBeGreaterThan(residualCO2(20));
    expect(residualCO2(20)).toBeGreaterThan(residualCO2(30));
  });

  it('valores típicos entre 0.5 y 2.5 vols para fermentación normal', () => {
    const co2at20 = residualCO2(20);
    expect(co2at20).toBeGreaterThan(0.5);
    expect(co2at20).toBeLessThan(2.5); // ~2.14 vols at 20°C
  });
});

// ============================================================================
// Mash Efficiency
// ============================================================================
describe('calculateMashEfficiency', () => {
  it('eficiencia típica está entre 60-85%', () => {
    // 50kg grano, 250L al fermentador, OG 1.050
    const eff = calculateMashEfficiency(1.050, 250, 50);
    expect(eff).toBeGreaterThan(50);
    expect(eff).toBeLessThan(100);
  });

  it('mayor OG con mismo grano → mayor eficiencia', () => {
    const low = calculateMashEfficiency(1.040, 250, 50);
    const high = calculateMashEfficiency(1.060, 250, 50);
    expect(high).toBeGreaterThan(low);
  });

  it('sin grano devuelve 0%', () => {
    expect(calculateMashEfficiency(1.050, 250, 0)).toBe(0);
  });

  it('sin volumen devuelve 0%', () => {
    expect(calculateMashEfficiency(1.050, 0, 50)).toBe(0);
  });
});

// ============================================================================
// Volume Parser
// ============================================================================
describe('parseVolumeFromFormat', () => {
  it('parsea mililitros', () => {
    expect(parseVolumeFromFormat('500ml')).toBeCloseTo(0.5);
    expect(parseVolumeFromFormat('330 ml')).toBeCloseTo(0.33);
    expect(parseVolumeFromFormat('1000ml')).toBeCloseTo(1.0);
    expect(parseVolumeFromFormat('473cc')).toBeCloseTo(0.473);
  });

  it('parsea litros', () => {
    expect(parseVolumeFromFormat('1L')).toBeCloseTo(1.0);
    expect(parseVolumeFromFormat('2 litros')).toBeCloseTo(2.0);
    expect(parseVolumeFromFormat('1.5lt')).toBeCloseTo(1.5);
  });

  it('parsea formatos con nombre', () => {
    expect(parseVolumeFromFormat('Pinta')).toBeCloseTo(0.5);
    expect(parseVolumeFromFormat('Growler')).toBeCloseTo(1.9);
    expect(parseVolumeFromFormat('Lata')).toBeCloseTo(0.473);
    expect(parseVolumeFromFormat('Media')).toBeCloseTo(0.5);
  });

  it('parsea barriles', () => {
    expect(parseVolumeFromFormat('Barril 20L')).toBeCloseTo(20);
    expect(parseVolumeFromFormat('Barril 30')).toBeCloseTo(30);
    expect(parseVolumeFromFormat('Barril 50')).toBeCloseTo(50);
  });

  it('parsea botellas con tamaño', () => {
    expect(parseVolumeFromFormat('Botella 730')).toBeCloseTo(0.73);
    expect(parseVolumeFromFormat('Botella 330')).toBeCloseTo(0.33);
    expect(parseVolumeFromFormat('Botella 500')).toBeCloseTo(0.5);
  });

  it('string vacío devuelve 0', () => {
    expect(parseVolumeFromFormat('')).toBe(0);
  });
});

describe('calculateSaleVolume', () => {
  it('multiplica volumen unitario por cantidad', () => {
    expect(calculateSaleVolume('Pinta', 10)).toBeCloseTo(5.0);
    expect(calculateSaleVolume('1L', 3)).toBeCloseTo(3.0);
  });
});
